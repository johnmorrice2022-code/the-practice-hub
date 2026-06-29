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
  /**
   * Known wrong answers → a specific nudge, fired in Direct mode (§5) when the
   * student's value matches one. Deterministic — no AI. Optional.
   */
  distractors?: { value: number; hint: string }[];
}

/**
 * Build an extended-response / required-practical answer by SELECTING the correct
 * statements from a pool that also holds distractors. Order is not graded (see
 * STEPPED_QUESTIONS.md §6). Partial credit:
 *   awarded = clamp(correctSelected − wrongSelected, 0, maxMarks)
 */
export interface SelectStepsStep {
  id: string;
  kind: 'select_steps';
  prompt: string;
  maxMarks: number;
  options: SelectStepOption[];
  hint?: string;
}

export interface SelectStepOption {
  id: string;
  text: string;
  correct?: boolean;
  /** Canonical sequence position — used ONLY for the feedback reveal, never graded. */
  order?: number;
}

export type Step =
  | ChooseEquationStep
  | SubstituteStep
  | NumericStep
  | SelectStepsStep;

export interface SteppedQuestion {
  given: Given[];
  steps: Step[];
  /**
   * Entry point (§5). If unset, derive from the student's tier:
   * Higher → 'direct', otherwise 'stepped'.
   */
  default_mode?: 'direct' | 'stepped';
  /**
   * Render the parsed given-value chips? If unset, derive from tier:
   * Foundation/default → true, Higher → false (they extract from the prose).
   */
  show_givens?: boolean;
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

export interface SelectStepsResponse {
  kind: 'select_steps';
  /** The option ids the student selected. */
  selected: string[];
}

export type StepResponse =
  | ChooseEquationResponse
  | SubstituteResponse
  | NumericResponse
  | SelectStepsResponse;

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
  /** For select_steps: partial marks and the breakdown for the feedback reveal. */
  marksAwarded?: number;
  maxMarks?: number;
  /** correct option ids the student selected */
  hits?: string[];
  /** correct option ids the student missed */
  missed?: string[];
  /** distractor option ids the student wrongly selected */
  wrongPicks?: string[];
  /** Whether the correct selections are in the canonical order (ascending `order`). */
  orderCorrect?: boolean;
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

export function checkSelectSteps(
  step: SelectStepsStep,
  response: SelectStepsResponse
): StepCheckResult {
  const selected = new Set(response.selected);
  const correctIds = step.options.filter((o) => o.correct).map((o) => o.id);

  const hits = correctIds.filter((id) => selected.has(id));
  const missed = correctIds.filter((id) => !selected.has(id));
  const wrongPicks = step.options
    .filter((o) => !o.correct && selected.has(o.id))
    .map((o) => o.id);

  // awarded = clamp(correctSelected − wrongSelected, 0, maxMarks)
  const marksAwarded = Math.max(
    0,
    Math.min(step.maxMarks, hits.length - wrongPicks.length)
  );
  const correct = missed.length === 0 && wrongPicks.length === 0;

  // Order check: are the correct selections in ascending canonical `order`
  // within the student's tap sequence? Distractors are ignored — only the
  // relative order of correct hits matters.
  const orderMap = new Map(
    step.options.filter((o) => o.correct && o.order != null).map((o) => [o.id, o.order!])
  );
  const hitOrders = response.selected
    .filter((id) => orderMap.has(id))
    .map((id) => orderMap.get(id)!);
  const orderCorrect =
    hitOrders.length > 0 &&
    hitOrders.every((v, i) => i === 0 || v > hitOrders[i - 1]);

  return {
    correct: correct && orderCorrect,
    marksAwarded,
    maxMarks: step.maxMarks,
    hits,
    missed,
    wrongPicks,
    orderCorrect,
    hint: correct ? undefined : step.hint,
  };
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
    case 'select_steps':
      return checkSelectSteps(step, response as SelectStepsResponse);
  }
}

// ─── Working reveal + direct-mode helpers (§5/§7) ────────────────────────────

/**
 * Assemble the full worked method from the steps (§7), as a `\n`-separated
 * worked_solution string with `$…$` LaTeX — always consistent with the scaffold,
 * shown on the mark screen on every path. Non-calculation kinds (select_steps)
 * are skipped here; they reveal via their own breakdown.
 */
export function buildWorking(data: SteppedQuestion): string {
  const lines: string[] = [];
  for (const step of data.steps) {
    if (step.kind === 'choose_equation') {
      const c = step.options.find((o) => o.correct);
      if (c) lines.push(`$${c.latex}$`);
    } else if (step.kind === 'substitute') {
      let expr = step.expression;
      for (const s of step.slots) {
        expr = expr.split(`[${s.slot}]`).join(String(s.value));
      }
      lines.push(`$${expr}$`);
    } else if (step.kind === 'numeric') {
      const unit = step.unit ? `\\ \\text{${step.unit}}` : '';
      lines.push(`$= ${step.value}${unit}$`);
    }
  }
  return lines.join('\n');
}

/**
 * One row of the select_steps feedback reveal (§7): the correct marking points in
 * their canonical `order`, each flagged as the student's hit/miss, followed by any
 * distractors they wrongly selected. Order is shown for teaching even though it is
 * never graded. Pure — maps cleanly onto the FeedbackCard step breakdown.
 */
export interface SelectRevealEntry {
  text: string;
  status: 'awarded' | 'not_awarded';
  /** A distractor the student wrongly selected (not a marking point). */
  wronglySelected?: boolean;
}

export function buildSelectStepsReveal(
  step: SelectStepsStep,
  result: StepCheckResult
): SelectRevealEntry[] {
  const hits = new Set(result.hits ?? []);

  return step.options
    .filter((o) => o.correct)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((o) => ({
      text: o.text,
      status: hits.has(o.id) ? 'awarded' : 'not_awarded',
    }));
}

/** The misconception hint for a wrong Direct-mode value, if it matches one. */
export function numericDistractorHint(
  step: NumericStep,
  value: number
): string | null {
  const d = (step.distractors ?? []).find((x) => x.value === value);
  return d ? d.hint : null;
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
      case 'select_steps': {
        const s = step as SelectStepsStep;
        if (!Array.isArray(s.options) || s.options.length < 2)
          errors.push(`${where}: needs at least 2 options`);
        else if (s.options.filter((o) => o.correct).length < 1)
          errors.push(`${where}: needs at least one correct option`);
        if (typeof s.maxMarks !== 'number' || s.maxMarks < 1)
          errors.push(`${where}: maxMarks must be a positive number`);
        break;
      }
      default:
        errors.push(`${where}: unknown step kind "${(step as Step).kind}"`);
    }
  });

  // A CALCULATION must resolve to exactly ONE final answer. Intermediate values
  // (a temperature change, a unit conversion, a P-before-E value) are working —
  // they belong in the substitute slots and the worked solution, never as extra
  // numeric "answer" steps. select_steps questions have no numeric step and are
  // exempt. (STEPPED_QUESTIONS.md — one final answer, breakdown in the working.)
  const numericCount = sq.steps.filter((s) => s && s.kind === 'numeric').length;
  const hasCalcSteps = sq.steps.some(
    (s) =>
      s && (s.kind === 'numeric' || s.kind === 'substitute' || s.kind === 'choose_equation')
  );
  if (hasCalcSteps && numericCount !== 1) {
    errors.push(
      `a calculation must have exactly one numeric (final answer) step — found ${numericCount}; fold intermediate values into the working`
    );
  }

  return errors;
}
