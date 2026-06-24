// Stepped-calculation questions (Phase 1 of the deterministic-marking project).
//
// The platform checks these answers deterministically; the AI never decides
// right or wrong. A stepped_calculation question stores its givens and an
// ordered list of steps. Each step is checked in isolation by a pure function
// in this file — exact match for choices, value-into-slot match for
// substitution, numeric tolerance + unit string match for the final answer.
//
// On a wrong step the player shows the step's (or chosen option's) pre-written
// hint first; only on escalation does JAM Help open. No function here calls an
// LLM. Keep this module pure and dependency-free so it can run in the browser,
// in an edge function, and under vitest unchanged.

// ─── Givens ──────────────────────────────────────────────────────────────────

export interface Given {
  /** Symbol as it appears in the equation, e.g. "I", "V". */
  symbol: string;
  value: number;
  /** Unit shown to the student, e.g. "A", "V". Optional for unitless givens. */
  unit?: string;
  /** Plain-language name, e.g. "current". Optional. */
  label?: string;
}

// ─── Steps ───────────────────────────────────────────────────────────────────

/** Pick the correct equation/statement from a list. */
export interface ChooseEquationStep {
  id: string;
  kind: 'choose_equation';
  prompt: string;
  options: ChoiceOption[];
  /** Generic nudge if the student is stuck (distinct from per-option hints). */
  hint?: string;
}

export interface ChoiceOption {
  id: string;
  /** LaTeX (without delimiters) for the equation/statement. */
  latex: string;
  correct?: boolean;
  /** Misconception-specific nudge shown when THIS wrong option is picked. */
  hint?: string;
}

/**
 * Put the given values into the equation's blanks by tapping number tiles into
 * slots. `expression` is LaTeX with [slot] placeholders, e.g. "P = [I] \\times [V]".
 * The tile tray is the slot values plus `distractorValues`, shuffled by the UI.
 */
export interface SubstituteStep {
  id: string;
  kind: 'substitute';
  prompt: string;
  expression: string;
  slots: SubstituteSlot[];
  /** Extra wrong tiles to populate the tray alongside the correct values. */
  distractorValues?: number[];
  hint?: string;
}

export interface SubstituteSlot {
  /** Matches a [slot] placeholder in `expression`. */
  slot: string;
  value: number;
}

/** Final numeric answer, with an optional unit. */
export interface NumericStep {
  id: string;
  kind: 'numeric';
  prompt: string;
  value: number;
  /** Absolute tolerance (default 0 — exact). Use for rounding leeway. */
  tolerance?: number;
  /** Expected unit, e.g. "W". Omit for a unitless answer. */
  unit?: string;
  /** Accepted spellings/forms of the unit, e.g. ["W","watt","watts"]. */
  acceptedUnits?: string[];
  hint?: string;
}

export type Step = ChooseEquationStep | SubstituteStep | NumericStep;

export interface SteppedQuestion {
  given: Given[];
  steps: Step[];
}

// ─── Student responses ───────────────────────────────────────────────────────

export interface ChooseEquationResponse {
  kind: 'choose_equation';
  /** The option id the student selected. */
  optionId: string | null;
}

export interface SubstituteResponse {
  kind: 'substitute';
  /** slot id -> the value tapped into it (null if left blank). */
  assignments: Record<string, number | null>;
}

export interface NumericResponse {
  kind: 'numeric';
  value: number | null;
  /** Raw unit text the student entered/selected. */
  unit?: string;
}

export type StepResponse =
  | ChooseEquationResponse
  | SubstituteResponse
  | NumericResponse;

// ─── Check result ────────────────────────────────────────────────────────────

export interface StepCheckResult {
  correct: boolean;
  /** A pre-written hint to surface on a wrong attempt, if one applies. */
  hint?: string;
  /**
   * For substitute steps: the slot ids that are wrong/blank, so the UI can mark
   * exactly which tiles to clear. Empty when correct.
   */
  wrongSlots?: string[];
  /** For numeric steps: which half was wrong, for a precise hint. */
  valueOk?: boolean;
  unitOk?: boolean;
}

// ─── Pure checkers ───────────────────────────────────────────────────────────

function normaliseUnit(u: string): string {
  return u.trim().toLowerCase().replace(/\s+/g, '');
}

export function checkChooseEquation(
  step: ChooseEquationStep,
  response: ChooseEquationResponse
): StepCheckResult {
  const picked = step.options.find((o) => o.id === response.optionId);
  if (picked?.correct) return { correct: true };
  // Prefer the misconception-specific hint on the picked option, else the
  // step's generic hint.
  return { correct: false, hint: picked?.hint ?? step.hint };
}

export function checkSubstitute(
  step: SubstituteStep,
  response: SubstituteResponse
): StepCheckResult {
  const wrongSlots = step.slots
    .filter((s) => response.assignments[s.slot] !== s.value)
    .map((s) => s.slot);
  if (wrongSlots.length === 0) return { correct: true, wrongSlots: [] };
  return { correct: false, wrongSlots, hint: step.hint };
}

export function checkNumeric(
  step: NumericStep,
  response: NumericResponse
): StepCheckResult {
  const tol = step.tolerance ?? 0;
  const valueOk =
    response.value !== null && Math.abs(response.value - step.value) <= tol;

  let unitOk = true;
  if (step.unit) {
    const accepted = (step.acceptedUnits ?? [step.unit]).map(normaliseUnit);
    unitOk =
      response.unit !== undefined &&
      accepted.includes(normaliseUnit(response.unit));
  }

  if (valueOk && unitOk) return { correct: true, valueOk, unitOk };
  return { correct: false, valueOk, unitOk, hint: step.hint };
}

/** Dispatch to the right checker. Throws only on a kind mismatch (a bug). */
export function checkStep(step: Step, response: StepResponse): StepCheckResult {
  if (step.kind !== response.kind) {
    throw new Error(
      `Step/response kind mismatch: step is "${step.kind}", response is "${response.kind}"`
    );
  }
  switch (step.kind) {
    case 'choose_equation':
      return checkChooseEquation(step, response as ChooseEquationResponse);
    case 'substitute':
      return checkSubstitute(step, response as SubstituteResponse);
    case 'numeric':
      return checkNumeric(step, response as NumericResponse);
  }
}

// ─── Validation (used by the Review Queue / generator gate) ──────────────────

/**
 * Returns a list of human-readable problems with a stepped question, or [] if
 * it is well-formed. Cheap structural checks only — the deterministic safety net
 * before a stepped question is shown to a student.
 */
export function validateSteppedQuestion(q: unknown): string[] {
  const errors: string[] = [];
  const sq = q as Partial<SteppedQuestion> | null;
  if (!sq || typeof sq !== 'object') return ['steps payload is not an object'];

  if (!Array.isArray(sq.given)) errors.push('`given` must be an array');
  if (!Array.isArray(sq.steps) || sq.steps.length === 0) {
    errors.push('`steps` must be a non-empty array');
    return errors;
  }

  const ids = new Set<string>();
  sq.steps.forEach((step, i) => {
    const where = `step ${i + 1}`;
    if (!step || typeof step !== 'object') {
      errors.push(`${where}: not an object`);
      return;
    }
    if (!step.id) errors.push(`${where}: missing id`);
    else if (ids.has(step.id)) errors.push(`${where}: duplicate id "${step.id}"`);
    else ids.add(step.id);

    switch (step.kind) {
      case 'choose_equation': {
        const opts = (step as ChooseEquationStep).options;
        if (!Array.isArray(opts) || opts.length < 2)
          errors.push(`${where}: needs at least 2 options`);
        else if (opts.filter((o) => o.correct).length !== 1)
          errors.push(`${where}: must have exactly one correct option`);
        break;
      }
      case 'substitute': {
        const slots = (step as SubstituteStep).slots;
        if (!Array.isArray(slots) || slots.length === 0)
          errors.push(`${where}: needs at least one slot`);
        break;
      }
      case 'numeric': {
        if (typeof (step as NumericStep).value !== 'number')
          errors.push(`${where}: numeric value must be a number`);
        break;
      }
      default:
        errors.push(`${where}: unknown step kind "${(step as Step).kind}"`);
    }
  });

  return errors;
}
