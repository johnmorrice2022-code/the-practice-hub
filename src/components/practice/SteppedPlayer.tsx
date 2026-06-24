// Student-facing player for stepped_calculation questions.
//
// Reveals steps one at a time (guided): each step appears only once the previous
// is correct. The platform checks every step deterministically via the pure
// checker in src/lib/steppedQuestion.ts — no AI decides right or wrong here. A
// wrong step shows its pre-written hint and lets the student retry; if they are
// still stuck (or tap "I'm stuck"), JAM Help opens to coach them. Completing all
// steps awards the question's marks in full.

import { useMemo, useState } from 'react';
import { Check, MessageCircle, ArrowRight, Lightbulb } from 'lucide-react';
import { renderMathInText } from '@/lib/renderMathInText';
import {
  SteppedQuestion,
  Step,
  checkStep,
  StepResponse,
} from '@/lib/steppedQuestion';

interface SteppedPlayerProps {
  questionText: string;
  marks: number;
  data: SteppedQuestion;
  /** Called once, when every step has been answered correctly. */
  onComplete: (marksAwarded: number) => void;
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
  }
}

export function SteppedPlayer({
  questionText,
  marks,
  data,
  onComplete,
  onJamHelp,
}: SteppedPlayerProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const step = data.steps[stepIndex];

  return (
    <div>
      {/* Question stem */}
      <div
        className="text-base sm:text-lg leading-relaxed text-foreground mb-3"
        dangerouslySetInnerHTML={{ __html: renderMathInText(questionText) }}
      />
      {data.given.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
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
                i < stepIndex || done
                  ? '#22c55e'
                  : i === stepIndex
                    ? '#F5A623'
                    : 'rgba(0,0,0,0.08)',
            }}
          />
        ))}
      </div>

      {done ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: '#22c55e' }}
          >
            <Check size={24} color="white" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            All steps complete — {marks} mark{marks !== 1 ? 's' : ''}.
          </p>
          <p className="text-xs text-muted-foreground">
            You worked through every step yourself. That's exactly how the marks
            are earned in the exam.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}

// ─── A single step ────────────────────────────────────────────────────────────

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

  // Per-kind response state.
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
    }
  }

  function describeAttempt(): string {
    switch (step.kind) {
      case 'choose_equation': {
        const o = step.kind === 'choose_equation'
          ? step.options.find((x) => x.id === optionId)
          : null;
        return o ? `chose ${o.latex}` : 'made no choice';
      }
      case 'substitute':
        return Object.entries(assignments)
          .map(([s, v]) => `${s}=${v ?? '?'}`)
          .join(', ');
      case 'numeric':
        return `${numValue || '?'} ${numUnit}`.trim();
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
    // Clear wrong substitution tiles so the student can retry cleanly.
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
        : numValue.trim() !== '';

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

      {/* Hint */}
      {hint && !solved && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 p-3">
          <Lightbulb size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">{hint}</p>
        </div>
      )}

      {/* Actions */}
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
  // Split the expression into literal segments and [slot] placeholders.
  const segments = useMemo(
    () => step.expression.split(/(\[[^\]]+\])/).filter((s) => s !== ''),
    [step.expression]
  );
  const tiles = useMemo(() => {
    const vals = [
      ...step.slots.map((s) => s.value),
      ...(step.distractorValues ?? []),
    ];
    // Stable shuffle per mount.
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
