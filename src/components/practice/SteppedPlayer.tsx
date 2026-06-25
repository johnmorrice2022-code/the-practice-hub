// Student-facing player for stepped_calculation questions.
//
// Two entry points from one authored question (STEPPED_QUESTIONS.md §5):
//   • Direct  — show the question + a single final-answer box. Correct → full
//               marks. Wrong → a distractor-specific hint (deterministic) then
//               "Break it down" unfolds the scaffold.
//   • Stepped — the guided one-step-at-a-time scaffold; "Let me just answer"
//               jumps to Direct.
// Default is by tier (Higher → Direct, else Stepped) unless the question sets
// default_mode; the student can always override either way. Every check is
// deterministic via the pure checker — no AI decides right or wrong. A wrong
// step shows its pre-written hint; "I'm stuck" opens JAM Help.

import { useMemo, useState } from 'react';
import { Check, MessageCircle, ArrowRight, Lightbulb, ChevronDown } from 'lucide-react';
import { renderMathInText } from '@/lib/renderMathInText';
import {
  SteppedQuestion,
  Step,
  NumericStep,
  SelectStepsStep,
  checkStep,
  checkNumeric,
  checkSelectSteps,
  numericDistractorHint,
  buildSelectStepsReveal,
  SelectRevealEntry,
  StepResponse,
} from '@/lib/steppedQuestion';

type Mode = 'direct' | 'stepped';

interface SteppedPlayerProps {
  questionText: string;
  marks: number;
  data: SteppedQuestion;
  /** Student's tier — drives the default entry mode when the question doesn't set one. */
  tier?: string;
  /**
   * Called once, when the question is completed. `marksAwarded` is the full marks
   * for calculations (completing the scaffold / a correct Direct answer) or the
   * partial total for a select_steps question. `reveal` carries the §7 ordered
   * marking-point breakdown for select_steps so the mark screen can show it.
   */
  onComplete: (marksAwarded: number, reveal?: SelectRevealEntry[]) => void;
  /** Open JAM Help for the step the student is stuck on. */
  onJamHelp: (args: { studentAttempt: string; criterion: string }) => void;
}

// A short description of what a step needs — fed to JAM Help as the "criterion"
// so the tutor has the target without us ever showing the student the answer.
function criterionFor(step: Step): string {
  switch (step.kind) {
    case 'choose_equation': {
      const correct = step.options.find((o) => o.correct);
      return `Choose the correct equation: $${correct?.latex ?? ''}$`;
    }
    case 'substitute':
      return `Substitute the given values into the correct places: ${step.slots
        .map((s) => `${s.slot} = ${s.value}`)
        .join(', ')}`;
    case 'numeric':
      return `Work out the final value${
        step.unit ? ` and give the unit (${step.unit})` : ''
      }`;
    case 'select_steps':
      return `Select the correct points for: ${step.prompt}`;
  }
}

export function SteppedPlayer({
  questionText,
  marks,
  data,
  tier,
  onComplete,
  onJamHelp,
}: SteppedPlayerProps) {
  // Direct mode answers the LAST numeric step; if there's none it isn't offered.
  const lastNumericIdx = useMemo(() => {
    for (let i = data.steps.length - 1; i >= 0; i--) {
      if (data.steps[i].kind === 'numeric') return i;
    }
    return -1;
  }, [data.steps]);
  const canDirect = lastNumericIdx !== -1;

  // A select_steps question (extended response / required-practical 6-marker) is
  // its own flow: a tappable checklist, partial marks, submit to complete — no
  // Direct/Stepped split (STEPPED_QUESTIONS.md §6).
  const isSelectSteps =
    data.steps.length === 1 && data.steps[0].kind === 'select_steps';

  // Givens are part of the *stepped help* now — never shown up front. In a real
  // exam the student must extract the variables (I, V, …) from the prose, so the
  // given chips appear only once they open the scaffold, unless an author
  // explicitly suppresses them.
  const showGivens = data.show_givens ?? true;

  // Every question opens on the single answer box (Direct). The scaffold is
  // opt-in help, reached via "Provide stepped help".
  const [mode, setMode] = useState<Mode>(canDirect ? 'direct' : 'stepped');
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);

  const step = data.steps[stepIndex];

  return (
    <div>
      {/* Marks */}
      <div className="flex justify-end mb-3">
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{
            color: '#E23D28',
            background: 'rgba(226,61,40,0.08)',
            letterSpacing: '0.02em',
          }}
        >
          {marks} mark{marks !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Question stem */}
      <div
        className="text-base sm:text-lg leading-relaxed text-foreground mb-6"
        dangerouslySetInnerHTML={{ __html: renderMathInText(questionText) }}
      />

      {done ? (
        <DoneCard marks={marks} />
      ) : isSelectSteps ? (
        <SelectStepsView
          step={data.steps[0] as SelectStepsStep}
          onJamHelp={(attempt) =>
            onJamHelp({
              studentAttempt: attempt,
              criterion: criterionFor(data.steps[0]),
            })
          }
          onSubmit={(selected) => {
            const s = data.steps[0] as SelectStepsStep;
            const res = checkSelectSteps(s, {
              kind: 'select_steps',
              selected,
            });
            setDone(true);
            onComplete(res.marksAwarded ?? 0, buildSelectStepsReveal(s, res));
          }}
        />
      ) : mode === 'direct' ? (
        <DirectAnswer
          step={data.steps[lastNumericIdx] as NumericStep}
          onCorrect={() => {
            setDone(true);
            onComplete(marks);
          }}
          onBreakDown={() => {
            setMode('stepped');
            setStepIndex(0);
          }}
          onJamHelp={(attempt) =>
            onJamHelp({
              studentAttempt: attempt,
              criterion: criterionFor(data.steps[lastNumericIdx]),
            })
          }
        />
      ) : (
        <>
          {/* Givens — revealed as part of the stepped help */}
          {showGivens && data.given.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {data.given.map((g, i) => (
                <span
                  key={i}
                  className="text-xs font-mono px-2.5 py-1 rounded-md bg-muted text-muted-foreground"
                >
                  {g.symbol} = {g.value}
                  {g.unit ? ` ${g.unit}` : ''}
                  {g.label ? ` (${g.label})` : ''}
                </span>
              ))}
            </div>
          )}

          {/* Step progress */}
          <div className="flex items-center gap-1.5 mb-4">
            {data.steps.map((_, i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{
                  background:
                    i < stepIndex
                      ? '#22c55e'
                      : i === stepIndex
                        ? '#F5A623'
                        : 'rgba(0,0,0,0.08)',
                }}
              />
            ))}
          </div>

          <StepView
            key={step.id}
            step={step}
            index={stepIndex}
            total={data.steps.length}
            onCorrect={() => {
              if (stepIndex < data.steps.length - 1) {
                setStepIndex(stepIndex + 1);
              } else {
                setDone(true);
                onComplete(marks);
              }
            }}
            onJamHelp={(studentAttempt) =>
              onJamHelp({ studentAttempt, criterion: criterionFor(step) })
            }
          />

          {canDirect && (
            <button
              onClick={() => setMode('direct')}
              className="mt-4 text-[11px] text-muted-foreground hover:text-[#E23D28] transition-colors"
            >
              Confident? Let me just answer →
            </button>
          )}
        </>
      )}
    </div>
  );
}

function DoneCard({ marks }: { marks: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: '#22c55e' }}
      >
        <Check size={24} color="white" />
      </div>
      <p className="text-sm font-semibold text-foreground">
        Complete — {marks} mark{marks !== 1 ? 's' : ''}.
      </p>
    </div>
  );
}

// ─── Direct mode — answer first ───────────────────────────────────────────────

function DirectAnswer({
  step,
  onCorrect,
  onBreakDown,
  onJamHelp,
}: {
  step: NumericStep;
  onCorrect: () => void;
  onBreakDown: () => void;
  onJamHelp: (studentAttempt: string) => void;
}) {
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  function handleCheck() {
    const res = checkNumeric(step, {
      kind: 'numeric',
      value: value.trim() === '' ? null : Number(value),
      unit,
    });
    if (res.correct) {
      onCorrect();
      return;
    }
    const dHint =
      value.trim() !== '' ? numericDistractorHint(step, Number(value)) : null;
    setHint(dHint ?? 'Not quite — check your value and unit.');
  }

  const canCheck = value.trim() !== '';

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Your answer
      </p>
      <NumericInput
        step={step}
        value={value}
        unit={unit}
        disabled={false}
        onValue={setValue}
        onUnit={setUnit}
      />

      {hint && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 p-3">
          <Lightbulb size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">{hint}</p>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          onClick={handleCheck}
          disabled={!canCheck}
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-40 active:scale-[0.97]"
          style={{
            color: '#fff',
            background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
            boxShadow: '0 2px 10px rgba(226,61,40,0.30)',
          }}
        >
          <Check size={12} /> Check answer
        </button>
      </div>

      {/* Explicit help — discuss the question, or unfold the scaffold */}
      <div className="mt-6 pt-5 border-t border-border/50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
          Need a hand?
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => onJamHelp(`${value || '?'} ${unit}`.trim())}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-lg border border-border text-muted-foreground hover:border-[#E23D28]/40 hover:text-[#E23D28] transition-colors"
          >
            <MessageCircle size={14} /> JAM Help — discuss this question
          </button>
          <button
            onClick={onBreakDown}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-lg border border-[#E23D28]/30 text-[#E23D28] hover:bg-[#E23D28]/5 transition-colors"
          >
            <ChevronDown size={14} /> Provide stepped help
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── select_steps — build the answer by choosing the marking points ───────────

function SelectStepsView({
  step,
  onSubmit,
  onJamHelp,
}: {
  step: SelectStepsStep;
  onSubmit: (selected: string[]) => void;
  onJamHelp: (attempt: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Shuffle once so the correct points aren't all grouped at the top.
  const options = useMemo(
    () =>
      step.options
        .map((o) => ({ o, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map((x) => x.o),
    [step]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Select every correct point ({step.maxMarks} mark
        {step.maxMarks !== 1 ? 's' : ''})
      </p>

      <div className="space-y-2">
        {options.map((o) => {
          const active = selected.has(o.id);
          return (
            <button
              key={o.id}
              onClick={() => toggle(o.id)}
              className="w-full text-left flex items-start gap-3 rounded-xl border-2 px-4 py-3 transition-colors"
              style={{
                borderColor: active ? '#E23D28' : 'rgba(0,0,0,0.10)',
                background: active ? 'rgba(226,61,40,0.04)' : 'white',
              }}
            >
              <span
                className="w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center"
                style={{
                  borderColor: active ? '#E23D28' : 'rgba(0,0,0,0.25)',
                  background: active ? '#E23D28' : 'transparent',
                }}
              >
                {active && <Check size={12} color="white" />}
              </span>
              <span
                className="text-sm text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMathInText(o.text) }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <button
          onClick={() => onJamHelp('(selection)')}
          className="flex items-center justify-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-lg border border-border text-muted-foreground hover:border-[#E23D28]/40 hover:text-[#E23D28] transition-colors"
        >
          <MessageCircle size={14} /> JAM Help — discuss this question
        </button>

        <button
          onClick={() => onSubmit([...selected])}
          disabled={selected.size === 0}
          className="flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-lg transition-all disabled:opacity-40 active:scale-[0.97]"
          style={{
            color: '#fff',
            background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
            boxShadow: '0 2px 10px rgba(226,61,40,0.30)',
          }}
        >
          <Check size={12} /> Submit answer
        </button>
      </div>
    </div>
  );
}

// ─── A single guided step ─────────────────────────────────────────────────────

function StepView({
  step,
  index,
  total,
  onCorrect,
  onJamHelp,
}: {
  step: Step;
  index: number;
  total: number;
  onCorrect: () => void;
  onJamHelp: (studentAttempt: string) => void;
}) {
  const [hint, setHint] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(false);

  const [optionId, setOptionId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, number | null>>(
    {}
  );
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [numValue, setNumValue] = useState('');
  const [numUnit, setNumUnit] = useState('');

  function buildResponse(): StepResponse {
    switch (step.kind) {
      case 'choose_equation':
        return { kind: 'choose_equation', optionId };
      case 'substitute':
        return { kind: 'substitute', assignments };
      case 'numeric':
        return {
          kind: 'numeric',
          value: numValue.trim() === '' ? null : Number(numValue),
          unit: numUnit,
        };
      case 'select_steps':
        return { kind: 'select_steps', selected: [] };
    }
  }

  function describeAttempt(): string {
    switch (step.kind) {
      case 'choose_equation': {
        const o = step.options.find((x) => x.id === optionId);
        return o ? `chose ${o.latex}` : 'made no choice';
      }
      case 'substitute':
        return Object.entries(assignments)
          .map(([s, v]) => `${s}=${v ?? '?'}`)
          .join(', ');
      case 'numeric':
        return `${numValue || '?'} ${numUnit}`.trim();
      case 'select_steps':
        return '(selection)';
    }
  }

  function handleCheck() {
    const result = checkStep(step, buildResponse());
    if (result.correct) {
      setSolved(true);
      setHint(null);
      return;
    }
    setAttempts((a) => a + 1);
    setHint(result.hint ?? 'Not quite — take another look.');
    if (step.kind === 'substitute' && result.wrongSlots) {
      setAssignments((prev) => {
        const next = { ...prev };
        for (const s of result.wrongSlots!) next[s] = null;
        return next;
      });
      setSelectedSlot(result.wrongSlots[0] ?? null);
    }
  }

  const canCheck =
    step.kind === 'choose_equation'
      ? optionId !== null
      : step.kind === 'substitute'
        ? step.slots.every((s) => assignments[s.slot] != null)
        : step.kind === 'numeric'
          ? numValue.trim() !== ''
          : false;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Step {index + 1} of {total}
      </p>
      <div
        className="text-sm sm:text-base text-foreground mb-4"
        dangerouslySetInnerHTML={{ __html: renderMathInText(step.prompt) }}
      />

      {step.kind === 'choose_equation' && (
        <ChooseEquationInput
          step={step}
          selected={optionId}
          disabled={solved}
          onSelect={setOptionId}
        />
      )}
      {step.kind === 'substitute' && (
        <SubstituteInput
          step={step}
          assignments={assignments}
          selectedSlot={selectedSlot}
          disabled={solved}
          onSelectSlot={setSelectedSlot}
          onPlace={(value) => {
            const slot =
              selectedSlot ??
              step.slots.find((s) => assignments[s.slot] == null)?.slot ??
              null;
            if (!slot) return;
            setAssignments((prev) => ({ ...prev, [slot]: value }));
            const nextEmpty = step.slots.find(
              (s) => s.slot !== slot && assignments[s.slot] == null
            );
            setSelectedSlot(nextEmpty?.slot ?? null);
          }}
          onClearSlot={(slot) => {
            setAssignments((prev) => ({ ...prev, [slot]: null }));
            setSelectedSlot(slot);
          }}
        />
      )}
      {step.kind === 'numeric' && (
        <NumericInput
          step={step}
          value={numValue}
          unit={numUnit}
          disabled={solved}
          onValue={setNumValue}
          onUnit={setNumUnit}
        />
      )}

      {hint && !solved && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 p-3">
          <Lightbulb size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">{hint}</p>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        {!solved && (
          <button
            onClick={() => onJamHelp(describeAttempt())}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#E23D28] transition-colors"
          >
            <MessageCircle size={12} />
            {attempts >= 2 ? "I'm stuck — get help" : 'JAM Help'}
          </button>
        )}

        {solved ? (
          <button
            onClick={onCorrect}
            className="ml-auto flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg text-white active:scale-[0.97] transition-transform"
            style={{ background: '#22c55e' }}
          >
            <Check size={12} />
            {index < total - 1 ? 'Correct — continue' : 'Correct — finish'}
            <ArrowRight size={12} />
          </button>
        ) : (
          <button
            onClick={handleCheck}
            disabled={!canCheck}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-40 active:scale-[0.97]"
            style={{
              color: '#fff',
              background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
              boxShadow: '0 2px 10px rgba(226,61,40,0.30)',
            }}
          >
            <Check size={12} /> Check
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

function ChooseEquationInput({
  step,
  selected,
  disabled,
  onSelect,
}: {
  step: Extract<Step, { kind: 'choose_equation' }>;
  selected: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {step.options.map((o) => {
        const active = selected === o.id;
        return (
          <button
            key={o.id}
            disabled={disabled}
            onClick={() => onSelect(o.id)}
            className="w-full text-left flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors disabled:opacity-60"
            style={{
              borderColor: active ? '#E23D28' : 'rgba(0,0,0,0.10)',
              background: active ? 'rgba(226,61,40,0.04)' : 'white',
            }}
          >
            <span
              className="w-4 h-4 rounded-full border-2 shrink-0"
              style={{
                borderColor: active ? '#E23D28' : 'rgba(0,0,0,0.25)',
                background: active ? '#E23D28' : 'transparent',
              }}
            />
            <span
              className="text-sm text-foreground"
              dangerouslySetInnerHTML={{
                __html: renderMathInText(`$${o.latex}$`),
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

function SubstituteInput({
  step,
  assignments,
  selectedSlot,
  disabled,
  onSelectSlot,
  onPlace,
  onClearSlot,
}: {
  step: Extract<Step, { kind: 'substitute' }>;
  assignments: Record<string, number | null>;
  selectedSlot: string | null;
  disabled: boolean;
  onSelectSlot: (slot: string) => void;
  onPlace: (value: number) => void;
  onClearSlot: (slot: string) => void;
}) {
  const segments = useMemo(
    () => step.expression.split(/(\[[^\]]+\])/).filter((s) => s !== ''),
    [step.expression]
  );
  const tiles = useMemo(() => {
    const vals = [
      ...step.slots.map((s) => s.value),
      ...(step.distractorValues ?? []),
    ];
    return vals
      .map((v) => ({ v, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map((x) => x.v);
  }, [step]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-lg">
        {segments.map((seg, i) => {
          const m = seg.match(/^\[([^\]]+)\]$/);
          if (m) {
            const slot = m[1];
            const val = assignments[slot];
            const isSelected = selectedSlot === slot;
            return (
              <button
                key={i}
                disabled={disabled}
                onClick={() =>
                  val != null ? onClearSlot(slot) : onSelectSlot(slot)
                }
                className="min-w-[3rem] h-11 px-3 rounded-lg border-2 border-dashed font-mono text-base transition-colors"
                style={{
                  borderColor: isSelected
                    ? '#E23D28'
                    : val != null
                      ? '#22c55e'
                      : 'rgba(0,0,0,0.25)',
                  background:
                    val != null ? 'rgba(34,197,94,0.08)' : 'transparent',
                }}
              >
                {val != null ? val : '?'}
              </button>
            );
          }
          return (
            <span
              key={i}
              className="font-mono text-foreground"
              dangerouslySetInnerHTML={{
                __html: renderMathInText(`$${seg}$`),
              }}
            />
          );
        })}
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground mb-1.5">
          Tap a blank, then tap a number to place it.
        </p>
        <div className="flex flex-wrap gap-2">
          {tiles.map((v, i) => (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onPlace(v)}
              className="min-w-[3rem] h-11 px-3 rounded-lg border font-mono text-base bg-white hover:border-[#F5A623] active:scale-[0.96] transition-all disabled:opacity-50"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NumericInput({
  step,
  value,
  unit,
  disabled,
  onValue,
  onUnit,
}: {
  step: Extract<Step, { kind: 'numeric' }>;
  value: string;
  unit: string;
  disabled: boolean;
  onValue: (v: string) => void;
  onUnit: (v: string) => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label className="text-[11px] text-muted-foreground mb-1 block">
          Answer
        </label>
        <input
          inputMode="decimal"
          disabled={disabled}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          className="w-full border-2 rounded-lg px-3 py-2.5 text-base font-mono focus:outline-none focus:border-[#F5A623]"
          style={{ borderColor: 'rgba(0,0,0,0.12)' }}
          placeholder="0"
        />
      </div>
      {step.unit !== undefined && (
        <div className="w-28">
          <label className="text-[11px] text-muted-foreground mb-1 block">
            Unit
          </label>
          <input
            disabled={disabled}
            value={unit}
            onChange={(e) => onUnit(e.target.value)}
            className="w-full border-2 rounded-lg px-3 py-2.5 text-base font-mono focus:outline-none focus:border-[#F5A623]"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            placeholder="unit"
          />
        </div>
      )}
    </div>
  );
}
