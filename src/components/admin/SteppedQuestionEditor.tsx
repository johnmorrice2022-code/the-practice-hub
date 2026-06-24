// Touch-first authoring/review UI for stepped_calculation questions.
//
// Drives the `steps` jsonb column ({ given[], steps[] }) defined and validated by
// src/lib/steppedQuestion.ts. Used in the Review Queue so a reviewer can author or
// fix a scaffold by hand — no JSON. Exports a controlled editor and a read-only
// preview (the reviewer's "what the scaffold looks like" view); the preview will
// be reused by the player's worked-solution reveal later.

import { useMemo } from 'react';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Wand2,
} from 'lucide-react';
import { renderMathInText } from '@/lib/renderMathInText';
import {
  SteppedQuestion,
  Step,
  Given,
  ChooseEquationStep,
  SubstituteStep,
  NumericStep,
  ChoiceOption,
  validateSteppedQuestion,
} from '@/lib/steppedQuestion';

const EMPTY: SteppedQuestion = { given: [], steps: [] };

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

const KIND_LABEL: Record<Step['kind'], string> = {
  choose_equation: 'Choose equation',
  substitute: 'Substitute values',
  numeric: 'Final answer',
};

// The canonical P = I × V pilot scaffold — one tap to start from.
function pivStarter(): SteppedQuestion {
  return {
    given: [
      { symbol: 'I', value: 2, unit: 'A', label: 'current' },
      { symbol: 'V', value: 12, unit: 'V', label: 'potential difference' },
    ],
    steps: [
      {
        id: newId('equation'),
        kind: 'choose_equation',
        prompt: 'Which equation links power, current and potential difference?',
        options: [
          { id: newId('opt'), latex: 'P = I \\times V', correct: true },
          {
            id: newId('opt'),
            latex: 'P = \\frac{V}{I}',
            hint: 'Power here is not a ratio — it combines current and pd by multiplying.',
          },
          {
            id: newId('opt'),
            latex: 'P = I^2 R',
            hint: 'That equation uses resistance — look at what the question gives you.',
          },
        ],
        hint: 'Look at the two quantities the question gives you and the one it asks for.',
      },
      {
        id: newId('substitute'),
        kind: 'substitute',
        prompt: 'Put the values into $P = I \\times V$.',
        expression: 'P = [I] \\times [V]',
        slots: [
          { slot: 'I', value: 2 },
          { slot: 'V', value: 12 },
        ],
        distractorValues: [24, 6],
        hint: 'The current goes where I is; the potential difference goes where V is.',
      },
      {
        id: newId('answer'),
        kind: 'numeric',
        prompt: 'Calculate the power. Give the unit.',
        value: 24,
        tolerance: 0,
        unit: 'W',
        acceptedUnits: ['W', 'watt', 'watts'],
        hint: 'Multiply your two numbers, then give the unit of power.',
      },
    ],
  };
}

function emptyStep(kind: Step['kind']): Step {
  switch (kind) {
    case 'choose_equation':
      return {
        id: newId('equation'),
        kind,
        prompt: '',
        options: [
          { id: newId('opt'), latex: '', correct: true },
          { id: newId('opt'), latex: '' },
        ],
      };
    case 'substitute':
      return {
        id: newId('substitute'),
        kind,
        prompt: '',
        expression: '',
        slots: [{ slot: '', value: 0 }],
      };
    case 'numeric':
      return { id: newId('answer'), kind, prompt: '', value: 0 };
  }
}

// ─── shared field bits ────────────────────────────────────────────────────────

const labelCls = 'text-[11px] font-medium text-gray-500 mb-1 block';
const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-300';

function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        className={`${inputCls} ${mono ? 'font-mono' : ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function numbersToText(ns: number[] | undefined): string {
  return (ns ?? []).join(', ');
}
function textToNumbers(t: string): number[] {
  return t
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}

// ─── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps {
  value: SteppedQuestion | null | undefined;
  onChange: (next: SteppedQuestion) => void;
}

export function SteppedQuestionEditor({ value, onChange }: EditorProps) {
  const sq: SteppedQuestion = value && typeof value === 'object' ? value : EMPTY;
  const errors = useMemo(() => validateSteppedQuestion(sq), [sq]);

  function update(patch: Partial<SteppedQuestion>) {
    onChange({ ...sq, ...patch });
  }
  function updateStep(i: number, next: Step) {
    update({ steps: sq.steps.map((s, idx) => (idx === i ? next : s)) });
  }
  function removeStep(i: number) {
    update({ steps: sq.steps.filter((_, idx) => idx !== i) });
  }
  function moveStep(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= sq.steps.length) return;
    const next = [...sq.steps];
    [next[i], next[j]] = [next[j], next[i]];
    update({ steps: next });
  }
  function addStep(kind: Step['kind']) {
    update({ steps: [...sq.steps, emptyStep(kind)] });
  }

  const isEmpty = sq.given.length === 0 && sq.steps.length === 0;

  return (
    <div className="space-y-4">
      {isEmpty && (
        <button
          type="button"
          onClick={() => onChange(pivStarter())}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors"
        >
          <Wand2 size={12} /> Start from the P = I × V example
        </button>
      )}

      {/* Givens */}
      <div className="bg-white rounded-xl border border-black/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Given values
          </p>
          <button
            type="button"
            onClick={() =>
              update({ given: [...sq.given, { symbol: '', value: 0 }] })
            }
            className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700"
          >
            <Plus size={12} /> Add
          </button>
        </div>
        {sq.given.length === 0 && (
          <p className="text-xs text-gray-400">No givens yet.</p>
        )}
        {sq.given.map((g, i) => (
          <GivenRow
            key={i}
            given={g}
            onChange={(next) =>
              update({ given: sq.given.map((x, idx) => (idx === i ? next : x)) })
            }
            onRemove={() =>
              update({ given: sq.given.filter((_, idx) => idx !== i) })
            }
          />
        ))}
      </div>

      {/* Steps */}
      {sq.steps.map((step, i) => (
        <StepEditor
          key={step.id || i}
          step={step}
          index={i}
          total={sq.steps.length}
          onChange={(next) => updateStep(i, next)}
          onRemove={() => removeStep(i)}
          onMove={(dir) => moveStep(i, dir)}
        />
      ))}

      {/* Add step */}
      <div className="flex flex-wrap gap-2">
        {(['choose_equation', 'substitute', 'numeric'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => addStep(k)}
            className="flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600 transition-colors"
          >
            <Plus size={12} /> {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {/* Validation */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 mb-1.5">
            <AlertTriangle size={12} /> Fix before saving
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            {errors.map((e, i) => (
              <li key={i} className="text-[11px] text-amber-800">
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GivenRow({
  given,
  onChange,
  onRemove,
}: {
  given: Given;
  onChange: (g: Given) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="w-16">
        <label className={labelCls}>Symbol</label>
        <input
          className={`${inputCls} font-mono`}
          value={given.symbol}
          onChange={(e) => onChange({ ...given, symbol: e.target.value })}
        />
      </div>
      <div className="w-24">
        <label className={labelCls}>Value</label>
        <input
          className={inputCls}
          type="number"
          value={Number.isNaN(given.value) ? '' : given.value}
          onChange={(e) => onChange({ ...given, value: Number(e.target.value) })}
        />
      </div>
      <div className="w-20">
        <label className={labelCls}>Unit</label>
        <input
          className={inputCls}
          value={given.unit ?? ''}
          onChange={(e) => onChange({ ...given, unit: e.target.value })}
        />
      </div>
      <div className="flex-1">
        <label className={labelCls}>Name (optional)</label>
        <input
          className={inputCls}
          value={given.label ?? ''}
          onChange={(e) => onChange({ ...given, label: e.target.value })}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function StepEditor({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  step: Step;
  index: number;
  total: number;
  onChange: (s: Step) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-black/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
          {index + 1}. {KIND_LABEL[step.kind]}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"
        >
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-gray-300 hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <TextField
        label="Prompt (LaTeX with $…$ allowed)"
        value={step.prompt}
        onChange={(v) => onChange({ ...step, prompt: v })}
        placeholder="What the student is asked at this step"
      />

      {step.kind === 'choose_equation' && (
        <ChooseEquationFields step={step} onChange={onChange} />
      )}
      {step.kind === 'substitute' && (
        <SubstituteFields step={step} onChange={onChange} />
      )}
      {step.kind === 'numeric' && (
        <NumericFields step={step} onChange={onChange} />
      )}

      <TextField
        label="Hint if stuck (shown before JAM Help opens)"
        value={step.hint ?? ''}
        onChange={(v) => onChange({ ...step, hint: v })}
        placeholder="A gentle nudge — never the answer"
      />
    </div>
  );
}

function ChooseEquationFields({
  step,
  onChange,
}: {
  step: ChooseEquationStep;
  onChange: (s: ChooseEquationStep) => void;
}) {
  function setOption(i: number, next: ChoiceOption) {
    onChange({
      ...step,
      options: step.options.map((o, idx) => (idx === i ? next : o)),
    });
  }
  function setCorrect(i: number) {
    onChange({
      ...step,
      options: step.options.map((o, idx) => ({ ...o, correct: idx === i })),
    });
  }
  return (
    <div className="space-y-2">
      <label className={labelCls}>
        Options (select the correct one with the radio)
      </label>
      {step.options.map((o, i) => (
        <div key={o.id} className="flex items-start gap-2">
          <input
            type="radio"
            className="mt-2.5 accent-emerald-500"
            checked={!!o.correct}
            onChange={() => setCorrect(i)}
          />
          <div className="flex-1 space-y-1">
            <input
              className={`${inputCls} font-mono`}
              value={o.latex}
              placeholder="LaTeX, e.g. P = I \times V"
              onChange={(e) => setOption(i, { ...o, latex: e.target.value })}
            />
            {!o.correct && (
              <input
                className={`${inputCls} text-[12px]`}
                value={o.hint ?? ''}
                placeholder="Hint shown if this wrong option is picked"
                onChange={(e) => setOption(i, { ...o, hint: e.target.value })}
              />
            )}
            {o.latex.trim() && (
              <div
                className="text-sm text-gray-700 px-1"
                dangerouslySetInnerHTML={{
                  __html: renderMathInText(`$${o.latex}$`),
                }}
              />
            )}
          </div>
          <button
            type="button"
            disabled={step.options.length <= 2}
            onClick={() =>
              onChange({
                ...step,
                options: step.options.filter((_, idx) => idx !== i),
              })
            }
            className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-30"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...step,
            options: [...step.options, { id: newId('opt'), latex: '' }],
          })
        }
        className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700"
      >
        <Plus size={12} /> Add option
      </button>
    </div>
  );
}

function SubstituteFields({
  step,
  onChange,
}: {
  step: SubstituteStep;
  onChange: (s: SubstituteStep) => void;
}) {
  return (
    <div className="space-y-3">
      <TextField
        label="Expression — LaTeX with [slot] blanks, e.g. P = [I] \times [V]"
        value={step.expression}
        mono
        onChange={(v) => onChange({ ...step, expression: v })}
      />
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls}>Slots (blank → correct value)</label>
          <button
            type="button"
            onClick={() =>
              onChange({ ...step, slots: [...step.slots, { slot: '', value: 0 }] })
            }
            className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700"
          >
            <Plus size={12} /> Add slot
          </button>
        </div>
        {step.slots.map((s, i) => (
          <div key={i} className="flex items-end gap-2 mb-2">
            <div className="flex-1">
              <input
                className={`${inputCls} font-mono`}
                value={s.slot}
                placeholder="slot name, e.g. I"
                onChange={(e) =>
                  onChange({
                    ...step,
                    slots: step.slots.map((x, idx) =>
                      idx === i ? { ...x, slot: e.target.value } : x
                    ),
                  })
                }
              />
            </div>
            <div className="w-28">
              <input
                className={inputCls}
                type="number"
                value={Number.isNaN(s.value) ? '' : s.value}
                placeholder="value"
                onChange={(e) =>
                  onChange({
                    ...step,
                    slots: step.slots.map((x, idx) =>
                      idx === i ? { ...x, value: Number(e.target.value) } : x
                    ),
                  })
                }
              />
            </div>
            <button
              type="button"
              disabled={step.slots.length <= 1}
              onClick={() =>
                onChange({
                  ...step,
                  slots: step.slots.filter((_, idx) => idx !== i),
                })
              }
              className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-30"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <TextField
        label="Distractor tiles (extra wrong numbers, comma-separated)"
        value={numbersToText(step.distractorValues)}
        onChange={(v) => onChange({ ...step, distractorValues: textToNumbers(v) })}
        placeholder="e.g. 24, 6"
      />
    </div>
  );
}

function NumericFields({
  step,
  onChange,
}: {
  step: NumericStep;
  onChange: (s: NumericStep) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="w-32">
          <label className={labelCls}>Answer value</label>
          <input
            className={inputCls}
            type="number"
            value={Number.isNaN(step.value) ? '' : step.value}
            onChange={(e) => onChange({ ...step, value: Number(e.target.value) })}
          />
        </div>
        <div className="w-32">
          <label className={labelCls}>Tolerance (±)</label>
          <input
            className={inputCls}
            type="number"
            value={step.tolerance ?? 0}
            onChange={(e) =>
              onChange({ ...step, tolerance: Number(e.target.value) })
            }
          />
        </div>
        <div className="flex-1">
          <label className={labelCls}>Unit (blank = none)</label>
          <input
            className={`${inputCls} font-mono`}
            value={step.unit ?? ''}
            onChange={(e) =>
              onChange({ ...step, unit: e.target.value || undefined })
            }
          />
        </div>
      </div>
      {step.unit && (
        <TextField
          label="Accepted unit spellings (comma-separated)"
          value={(step.acceptedUnits ?? []).join(', ')}
          onChange={(v) =>
            onChange({
              ...step,
              acceptedUnits: v
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="e.g. W, watt, watts"
        />
      )}
    </div>
  );
}

// ─── Read-only preview (reviewer's "what the scaffold looks like" view) ───────

export function SteppedQuestionPreview({
  value,
}: {
  value: SteppedQuestion | null | undefined;
}) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.steps)) {
    return (
      <p className="text-xs text-gray-400">No steps authored for this question.</p>
    );
  }
  const sq = value;
  return (
    <div className="space-y-4">
      {sq.given.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sq.given.map((g, i) => (
            <span
              key={i}
              className="text-[11px] font-mono px-2 py-1 rounded-md bg-gray-100 text-gray-600"
            >
              {g.symbol} = {g.value}
              {g.unit ? ` ${g.unit}` : ''}
            </span>
          ))}
        </div>
      )}
      {sq.steps.map((step, i) => (
        <div key={step.id || i} className="border-l-2 border-amber-200 pl-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              {i + 1}. {KIND_LABEL[step.kind]}
            </span>
          </div>
          {step.prompt && (
            <div
              className="text-sm text-gray-700"
              dangerouslySetInnerHTML={{ __html: renderMathInText(step.prompt) }}
            />
          )}
          {step.kind === 'choose_equation' &&
            step.options.map((o) => (
              <div key={o.id} className="flex items-center gap-2 text-sm">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${o.correct ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'bg-gray-50 text-gray-400'}`}
                >
                  {o.correct ? 'correct' : 'distractor'}
                </span>
                <span
                  className="text-gray-700"
                  dangerouslySetInnerHTML={{
                    __html: renderMathInText(`$${o.latex}$`),
                  }}
                />
                {!o.correct && o.hint && (
                  <span className="text-[11px] text-gray-400 italic">→ {o.hint}</span>
                )}
              </div>
            ))}
          {step.kind === 'substitute' && (
            <div className="text-sm text-gray-700 font-mono">
              {step.expression} &nbsp;→&nbsp;{' '}
              {step.slots.map((s) => `${s.slot}=${s.value}`).join(', ')}
            </div>
          )}
          {step.kind === 'numeric' && (
            <div className="text-sm text-gray-700">
              Answer: <span className="font-semibold">{step.value}</span>
              {step.unit ? ` ${step.unit}` : ''}
              {step.tolerance ? ` (±${step.tolerance})` : ''}
            </div>
          )}
          {step.hint && (
            <p className="text-[11px] text-gray-400 italic">Hint: {step.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}
