import { describe, it, expect } from 'vitest';
import {
  checkChooseEquation,
  checkSubstitute,
  checkNumeric,
  checkStep,
  validateSteppedQuestion,
  type ChooseEquationStep,
  type SubstituteStep,
  type NumericStep,
  type SteppedQuestion,
} from './steppedQuestion';

// The canonical P = I × V pilot question (lamp: I = 2 A, V = 12 V -> 24 W).
const equationStep: ChooseEquationStep = {
  id: 'equation',
  kind: 'choose_equation',
  prompt: 'Which equation links power, current and pd?',
  options: [
    { id: 'a', latex: 'P = I \\times V', correct: true },
    { id: 'b', latex: 'P = V / I', correct: false, hint: 'Power here is not a ratio.' },
    { id: 'c', latex: 'P = I^2 R', correct: false },
  ],
  hint: 'Look at what the question gives you.',
};

const substituteStep: SubstituteStep = {
  id: 'substitute',
  kind: 'substitute',
  prompt: 'Put the values into P = I × V',
  expression: 'P = [I] \\times [V]',
  slots: [
    { slot: 'I', value: 2 },
    { slot: 'V', value: 12 },
  ],
  distractorValues: [24, 6],
  hint: 'Current goes where I is; pd goes where V is.',
};

const numericStep: NumericStep = {
  id: 'answer',
  kind: 'numeric',
  prompt: 'Calculate the power. Give the unit.',
  value: 24,
  tolerance: 0,
  unit: 'W',
  acceptedUnits: ['W', 'watt', 'watts'],
  hint: 'Multiply your two numbers, then add the unit.',
};

describe('checkChooseEquation', () => {
  it('awards the correct option', () => {
    expect(checkChooseEquation(equationStep, { kind: 'choose_equation', optionId: 'a' }))
      .toEqual({ correct: true });
  });

  it('returns the option-specific hint on a wrong pick', () => {
    const r = checkChooseEquation(equationStep, { kind: 'choose_equation', optionId: 'b' });
    expect(r.correct).toBe(false);
    expect(r.hint).toBe('Power here is not a ratio.');
  });

  it('falls back to the step hint when the wrong option has none', () => {
    const r = checkChooseEquation(equationStep, { kind: 'choose_equation', optionId: 'c' });
    expect(r.correct).toBe(false);
    expect(r.hint).toBe('Look at what the question gives you.');
  });

  it('treats no selection as wrong', () => {
    expect(checkChooseEquation(equationStep, { kind: 'choose_equation', optionId: null }).correct)
      .toBe(false);
  });
});

describe('checkSubstitute', () => {
  it('awards correct slot assignments', () => {
    const r = checkSubstitute(substituteStep, {
      kind: 'substitute',
      assignments: { I: 2, V: 12 },
    });
    expect(r).toEqual({ correct: true, wrongSlots: [] });
  });

  it('flags exactly the wrong slots (swapped values)', () => {
    const r = checkSubstitute(substituteStep, {
      kind: 'substitute',
      assignments: { I: 12, V: 2 },
    });
    expect(r.correct).toBe(false);
    expect(r.wrongSlots).toEqual(['I', 'V']);
    expect(r.hint).toBe(substituteStep.hint);
  });

  it('flags a single wrong slot and leaves the right one', () => {
    const r = checkSubstitute(substituteStep, {
      kind: 'substitute',
      assignments: { I: 2, V: 24 },
    });
    expect(r.wrongSlots).toEqual(['V']);
  });

  it('treats a blank slot as wrong', () => {
    const r = checkSubstitute(substituteStep, {
      kind: 'substitute',
      assignments: { I: 2, V: null },
    });
    expect(r.wrongSlots).toEqual(['V']);
  });
});

describe('checkNumeric', () => {
  it('awards the exact value with an accepted unit spelling', () => {
    expect(checkNumeric(numericStep, { kind: 'numeric', value: 24, unit: 'watts' }))
      .toMatchObject({ correct: true, valueOk: true, unitOk: true });
  });

  it('is case/space-insensitive on units', () => {
    expect(checkNumeric(numericStep, { kind: 'numeric', value: 24, unit: '  W ' }).correct)
      .toBe(true);
  });

  it('rejects the right value with the wrong unit', () => {
    const r = checkNumeric(numericStep, { kind: 'numeric', value: 24, unit: 'J' });
    expect(r.correct).toBe(false);
    expect(r.valueOk).toBe(true);
    expect(r.unitOk).toBe(false);
  });

  it('rejects the wrong value with the right unit', () => {
    const r = checkNumeric(numericStep, { kind: 'numeric', value: 6, unit: 'W' });
    expect(r.correct).toBe(false);
    expect(r.valueOk).toBe(false);
    expect(r.unitOk).toBe(true);
  });

  it('honours tolerance for rounding leeway', () => {
    const step: NumericStep = { ...numericStep, value: 3.33, tolerance: 0.01, unit: undefined };
    expect(checkNumeric(step, { kind: 'numeric', value: 3.34 }).correct).toBe(true);
    expect(checkNumeric(step, { kind: 'numeric', value: 3.4 }).correct).toBe(false);
  });

  it('ignores units when the step has none', () => {
    const step: NumericStep = { id: 'x', kind: 'numeric', prompt: '', value: 5 };
    expect(checkNumeric(step, { kind: 'numeric', value: 5 }).correct).toBe(true);
  });
});

describe('checkStep dispatch', () => {
  it('routes by kind', () => {
    expect(checkStep(numericStep, { kind: 'numeric', value: 24, unit: 'W' }).correct).toBe(true);
  });

  it('throws on a kind mismatch (a wiring bug)', () => {
    expect(() =>
      checkStep(numericStep, { kind: 'substitute', assignments: {} })
    ).toThrow(/mismatch/);
  });
});

describe('validateSteppedQuestion', () => {
  const valid: SteppedQuestion = {
    given: [
      { symbol: 'I', value: 2, unit: 'A' },
      { symbol: 'V', value: 12, unit: 'V' },
    ],
    steps: [equationStep, substituteStep, numericStep],
  };

  it('passes a well-formed question', () => {
    expect(validateSteppedQuestion(valid)).toEqual([]);
  });

  it('rejects an empty steps array', () => {
    expect(validateSteppedQuestion({ given: [], steps: [] }))
      .toContain('`steps` must be a non-empty array');
  });

  it('catches duplicate step ids', () => {
    const dup = { ...valid, steps: [equationStep, { ...substituteStep, id: 'equation' }] };
    expect(validateSteppedQuestion(dup).some((e) => e.includes('duplicate id'))).toBe(true);
  });

  it('requires exactly one correct option on a choose step', () => {
    const twoCorrect: ChooseEquationStep = {
      ...equationStep,
      options: [
        { id: 'a', latex: 'x', correct: true },
        { id: 'b', latex: 'y', correct: true },
      ],
    };
    expect(validateSteppedQuestion({ given: [], steps: [twoCorrect] }).some((e) =>
      e.includes('exactly one correct')
    )).toBe(true);
  });

  it('flags an unknown step kind', () => {
    const bad = { given: [], steps: [{ id: 's', kind: 'mystery' }] };
    expect(validateSteppedQuestion(bad).some((e) => e.includes('unknown step kind'))).toBe(true);
  });
});
