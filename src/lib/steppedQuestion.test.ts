import { describe, it, expect } from 'vitest';
import {
  checkChooseEquation,
  checkSubstitute,
  checkNumeric,
  checkSelectSteps,
  checkStep,
  buildWorking,
  buildSelectStepsReveal,
  numericDistractorHint,
  validateSteppedQuestion,
  type ChooseEquationStep,
  type SubstituteStep,
  type NumericStep,
  type SelectStepsStep,
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

// A 4-mark required-practical method: 4 correct points + 2 distractors.
const methodStep: SelectStepsStep = {
  id: 'method',
  kind: 'select_steps',
  prompt: 'Describe a method to investigate the resistance of a thermistor.',
  maxMarks: 4,
  options: [
    { id: 's1', text: 'Set up the thermistor in series with an ammeter.', correct: true, order: 1 },
    { id: 's2', text: 'Heat the thermistor in a water bath.', correct: true, order: 2 },
    { id: 's3', text: 'Record current and temperature at intervals.', correct: true, order: 3 },
    { id: 's4', text: 'Repeat and calculate resistance with R = V/I.', correct: true, order: 4 },
    { id: 'd1', text: 'Measure the mass of the water.', correct: false },
    { id: 'd2', text: 'Add salt to the water.', correct: false },
  ],
  hint: 'Think set up → change → measure → process.',
};

describe('checkSelectSteps', () => {
  it('awards full marks for all correct and no distractors', () => {
    const r = checkSelectSteps(methodStep, {
      kind: 'select_steps',
      selected: ['s1', 's2', 's3', 's4'],
    });
    expect(r).toMatchObject({
      correct: true,
      marksAwarded: 4,
      maxMarks: 4,
      missed: [],
      wrongPicks: [],
    });
    expect(r.hits).toEqual(['s1', 's2', 's3', 's4']);
  });

  it('out-of-order selection awards content marks but flags orderCorrect false', () => {
    const r = checkSelectSteps(methodStep, {
      kind: 'select_steps',
      selected: ['s4', 's1', 's3', 's2'],
    });
    expect(r.correct).toBe(false);
    expect(r.orderCorrect).toBe(false);
    expect(r.marksAwarded).toBe(4);
  });

  it('in-order selection is fully correct', () => {
    const r = checkSelectSteps(methodStep, {
      kind: 'select_steps',
      selected: ['s1', 's2', 's3', 's4'],
    });
    expect(r.correct).toBe(true);
    expect(r.orderCorrect).toBe(true);
    expect(r.marksAwarded).toBe(4);
  });

  it('gives partial marks with a distractor (correct − wrong)', () => {
    const r = checkSelectSteps(methodStep, {
      kind: 'select_steps',
      selected: ['s1', 's2', 's3', 'd1'],
    });
    expect(r.correct).toBe(false);
    expect(r.marksAwarded).toBe(2); // 3 correct − 1 wrong
    expect(r.hits).toEqual(['s1', 's2', 's3']);
    expect(r.missed).toEqual(['s4']);
    expect(r.wrongPicks).toEqual(['d1']);
  });

  it('selecting everything does not earn full marks', () => {
    const r = checkSelectSteps(methodStep, {
      kind: 'select_steps',
      selected: ['s1', 's2', 's3', 's4', 'd1', 'd2'],
    });
    expect(r.correct).toBe(false);
    expect(r.marksAwarded).toBe(2); // 4 − 2
  });

  it('clamps at zero when wrong picks exceed correct', () => {
    const r = checkSelectSteps(methodStep, {
      kind: 'select_steps',
      selected: ['s1', 'd1', 'd2'],
    });
    expect(r.marksAwarded).toBe(0); // max(0, 1 − 2)
  });

  it('gives partial marks for some-but-not-all correct', () => {
    const r = checkSelectSteps(methodStep, {
      kind: 'select_steps',
      selected: ['s1', 's2'],
    });
    expect(r.marksAwarded).toBe(2);
    expect(r.correct).toBe(false);
    expect(r.missed).toEqual(['s3', 's4']);
  });
});

describe('buildSelectStepsReveal', () => {
  it('lists correct points in canonical order, marking hits and misses', () => {
    const r = checkSelectSteps(methodStep, {
      kind: 'select_steps',
      selected: ['s3', 's1'],
    });
    const reveal = buildSelectStepsReveal(methodStep, r);
    // Correct points always shown in order regardless of selection order.
    expect(reveal.slice(0, 4).map((x) => x.text)).toEqual([
      'Set up the thermistor in series with an ammeter.',
      'Heat the thermistor in a water bath.',
      'Record current and temperature at intervals.',
      'Repeat and calculate resistance with R = V/I.',
    ]);
    expect(reveal[0].status).toBe('awarded'); // s1 hit
    expect(reveal[1].status).toBe('not_awarded'); // s2 missed
    expect(reveal[2].status).toBe('awarded'); // s3 hit
    expect(reveal[3].status).toBe('not_awarded'); // s4 missed
  });

  it('reveal shows only correct statements, not distractors', () => {
    const r = checkSelectSteps(methodStep, {
      kind: 'select_steps',
      selected: ['s1', 's2', 's3', 's4', 'd1'],
    });
    const reveal = buildSelectStepsReveal(methodStep, r);
    expect(reveal).toHaveLength(4);
    expect(reveal.every((x) => !x.wronglySelected)).toBe(true);
  });
});

describe('buildWorking', () => {
  it('assembles equation, substitution and answer from the steps', () => {
    const working = buildWorking({
      given: [],
      steps: [equationStep, substituteStep, numericStep],
    });
    expect(working).toBe(
      ['$P = I \\times V$', '$P = 2 \\times 12$', '$= 24\\ \\text{W}$'].join('\n')
    );
  });

  it('omits the unit when the numeric step has none', () => {
    const working = buildWorking({
      given: [],
      steps: [{ id: 'a', kind: 'numeric', prompt: '', value: 5 }],
    });
    expect(working).toBe('$= 5$');
  });
});

describe('numericDistractorHint', () => {
  const step: NumericStep = {
    ...numericStep,
    distractors: [
      { value: 6, hint: 'Looks like you divided instead of multiplying.' },
      { value: 14, hint: 'Looks like you added the two numbers.' },
    ],
  };
  it('returns the hint for a matching wrong value', () => {
    expect(numericDistractorHint(step, 6)).toMatch(/divided/);
  });
  it('returns null for an unanticipated wrong value', () => {
    expect(numericDistractorHint(step, 99)).toBeNull();
  });
  it('returns null when no distractors are authored', () => {
    expect(numericDistractorHint(numericStep, 6)).toBeNull();
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

  it('rejects a calculation with more than one numeric step', () => {
    const twoAnswers = {
      ...valid,
      steps: [equationStep, substituteStep, numericStep, { ...numericStep, id: 'answer2' }],
    };
    expect(
      validateSteppedQuestion(twoAnswers).some((e) =>
        e.includes('exactly one numeric')
      )
    ).toBe(true);
  });

  it('rejects a calculation with no numeric (final answer) step', () => {
    expect(
      validateSteppedQuestion({ given: [], steps: [equationStep, substituteStep] }).some(
        (e) => e.includes('exactly one numeric')
      )
    ).toBe(true);
  });

  it('passes a well-formed select_steps step (no numeric required)', () => {
    expect(validateSteppedQuestion({ given: [], steps: [methodStep] })).toEqual([]);
  });

  it('requires at least one correct option on a select_steps step', () => {
    const noCorrect: SelectStepsStep = {
      ...methodStep,
      options: [
        { id: 'd1', text: 'x', correct: false },
        { id: 'd2', text: 'y', correct: false },
      ],
    };
    expect(
      validateSteppedQuestion({ given: [], steps: [noCorrect] }).some((e) =>
        e.includes('at least one correct')
      )
    ).toBe(true);
  });

  it('requires a positive maxMarks on a select_steps step', () => {
    const badMarks: SelectStepsStep = { ...methodStep, maxMarks: 0 };
    expect(
      validateSteppedQuestion({ given: [], steps: [badMarks] }).some((e) =>
        e.includes('maxMarks must be a positive number')
      )
    ).toBe(true);
  });
});
