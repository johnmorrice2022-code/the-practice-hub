import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─────────────────────────────────────────────
// SHARED LATEX RULES
// ─────────────────────────────────────────────

const FOUNDATION_SHARED_LATEX_RULES = `
CRITICAL — MATHEMATICAL NOTATION:
You MUST use LaTeX notation for ALL mathematical expressions in question_text, mark_scheme criteria, and worked_solution.
In JSON strings, backslashes MUST be escaped as double backslashes (\\\\).

EXACT examples of correct JSON output with LaTeX — copy these patterns precisely:

Multiplication sign:    "$3 \\\\times 2$"
Square roots:           "$\\\\sqrt{72}$"
Fractions:              "$\\\\frac{3}{4}$"
Powers:                 "$x^2 + 5x + 6$"
Expressions:            "$2x \\\\times 3y$"

NEVER use:
- \\times with a single backslash — always double: \\\\times
- sqrt() — always use \\\\sqrt{}
- Plain text like "root 2", "x squared", "times" — always use LaTeX

WORKED SOLUTION FORMAT:
Write each step on a separate line using \\n between steps. One calculation step per line.
`;

const HIGHER_SHARED_LATEX_RULES = `
CRITICAL — MATHEMATICAL NOTATION:
You MUST use LaTeX notation for ALL mathematical expressions in question_text, mark_scheme criteria, and worked_solution.
In JSON strings, backslashes MUST be escaped as double backslashes (\\\\).

EXACT examples of correct JSON output with LaTeX — copy these patterns precisely:

Multiplication sign:        "$3 \\\\times 2$"
Square roots:               "$\\\\sqrt{72}$"
Fractions:                  "$\\\\frac{3}{4}$"
Mixed numbers:              "$3\\\\frac{1}{2}$"
Powers:                     "$x^2 + 5x + 6$"
Fractional indices:         "$27^{\\\\frac{2}{3}}$"
Negative indices:           "$x^{-2}$"
Surds:                      "$3\\\\sqrt{2}$"
Plus-minus:                 "$x = \\\\frac{-b \\\\pm \\\\sqrt{b^2 - 4ac}}{2a}$"
Standard form:              "$3.2 \\\\times 10^{-4}$"
Algebraic fraction:         "$\\\\frac{x^2 - 1}{x + 1}$"
Function notation:          "$f^{-1}(x)$"

NEVER use:
- \\times with a single backslash — always double: \\\\times
- sqrt() — always use \\\\sqrt{}
- Plain text like "root 2", "x squared", "times" — always use LaTeX

WORKED SOLUTION FORMAT:
Write each step on a separate line using \\n between steps. One calculation step per line.
`;

// ─────────────────────────────────────────────
// SHARED OUTPUT FORMATS
// ─────────────────────────────────────────────

const FOUNDATION_SINGLE_QUESTION_FORMAT = `
Return ONLY a JSON object with a single "question" key containing one question object.
The question must be one of two types:

TYPE 1 — Single part question:
{
  "question": {
    "question_text": "Javid hires a car for 10 days. He pays £45 for each day. He also pays £30 for insurance. Javid pays with ten £50 notes. Work out how much change he should get. (3 marks)",
    "marks": 3,
    "parts": [],
    "mark_scheme": [
      { "mark_type": "M", "criterion": "Correct method to find total cost ($45 \\\\times 10 + 30$)", "marks": 1 },
      { "mark_type": "A", "criterion": "Total cost = £480", "marks": 1 },
      { "mark_type": "A", "criterion": "Change = £20", "marks": 1 }
    ],
    "worked_solution": "$45 \\\\times 10 = 450$\\n$450 + 30 = 480$\\n$10 \\\\times 50 = 500$\\n$500 - 480 = £20$",
    "diagram_type": null,
    "diagram_params": null
  }
}

TYPE 2 — Multi-part question:
{
  "question": {
    "question_text": "Here are the ages, in years, of 8 children: 14 10 10 13 15 9 15 10",
    "marks": 4,
    "parts": [
      { "part_label": "a", "part_text": "Work out the mean age.", "marks": 2 },
      { "part_label": "b", "part_text": "Work out the range of the ages.", "marks": 2 }
    ],
    "mark_scheme": [
      { "mark_type": "M", "part": "a", "criterion": "Correct method: sum of all ages divided by 8", "marks": 1 },
      { "mark_type": "A", "part": "a", "criterion": "Mean = 12 years", "marks": 1 },
      { "mark_type": "M", "part": "b", "criterion": "Correct method: highest minus lowest ($15 - 9$)", "marks": 1 },
      { "mark_type": "A", "part": "b", "criterion": "Range = 6 years", "marks": 1 }
    ],
    "worked_solution": "Part (a):\\n$14 + 10 + 10 + 13 + 15 + 9 + 15 + 10 = 96$\\n$96 \\\\div 8 = 12$ years\\nPart (b):\\n$15 - 9 = 6$ years",
    "diagram_type": null,
    "diagram_params": null
  }
}

RULES:
- Use LaTeX notation as shown above — mandatory
- \\\\times must always use double escaped backslash
- For TYPE 2: question_text is the shared scenario stem ONLY. Each part_text is the sub-question only, no (a)/(b) label prefix, no mark count.
- Mark schemes must be unambiguous
- Worked solution must have one step per line, separated by \\n
- Return ONLY the JSON object — no markdown, no preamble
`;

const HIGHER_SINGLE_QUESTION_FORMAT = `
Return ONLY a JSON object with a single "question" key containing one question object.
The question must be one of two types:

TYPE 1 — Single part question:
{
  "question": {
    "question_text": "Simplify $\\\\sqrt{72}$. Give your answer in the form $a\\\\sqrt{b}$ where $a$ and $b$ are integers.",
    "marks": 2,
    "parts": [],
    "mark_scheme": [
      { "mark_type": "M", "criterion": "Identifies $\\\\sqrt{36}$ as a factor of 72", "marks": 1 },
      { "mark_type": "A", "criterion": "Correct answer $6\\\\sqrt{2}$", "marks": 1 }
    ],
    "worked_solution": "$\\\\sqrt{72} = \\\\sqrt{36 \\\\times 2}$\\n$= \\\\sqrt{36} \\\\times \\\\sqrt{2}$\\n$= 6\\\\sqrt{2}$",
    "diagram_type": null,
    "diagram_params": null
  }
}

TYPE 2 — Multi-part question:
{
  "question": {
    "question_text": "The cost of a first class stamp increased from 76p to 85p.",
    "marks": 4,
    "parts": [
      { "part_label": "a", "part_text": "Work out the percentage increase in the cost of a first class stamp.", "marks": 2 },
      { "part_label": "b", "part_text": "Is Filip correct? You must show all your working.", "marks": 2 }
    ],
    "mark_scheme": [
      { "mark_type": "M", "part": "a", "criterion": "Correct method: $\\\\frac{9}{76} \\\\times 100$", "marks": 1 },
      { "mark_type": "A", "part": "a", "criterion": "11.8% (accept 11.84...%)", "marks": 1 },
      { "mark_type": "M", "part": "b", "criterion": "Correct method for second class", "marks": 1 },
      { "mark_type": "C", "part": "b", "criterion": "Correct conclusion stated in words", "marks": 1 }
    ],
    "worked_solution": "Part (a):\\n$\\\\frac{85-76}{76} \\\\times 100 = 11.84...\\\\%$",
    "diagram_type": null,
    "diagram_params": null
  }
}

RULES:
- Use LaTeX notation as shown above — mandatory
- \\\\times must always use double escaped backslash
- question_text is the shared scenario stem ONLY — never list sub-questions inside question_text
- Each part_text is the sub-question only — no (a)/(b) label prefix, no mark count
- Mark schemes must be unambiguous
- Worked solution must have one step per line, separated by \\n
- Return ONLY the JSON object — no markdown, no preamble
`;

const PHYSICS_SINGLE_QUESTION_FORMAT = `
Return ONLY a JSON object with a single "question" key containing one question object.

Example:
{
  "question": {
    "question_text": "A student measures a force of 12 N acting over an area of 0.40 $m^2$. Calculate the pressure. Give your answer in Pa.",
    "marks": 2,
    "parts": [],
    "mark_scheme": [
      { "mark_type": "step", "criterion": "Correct substitution: $P = \\\\frac{12}{0.40}$", "marks": 1 },
      { "mark_type": "step", "criterion": "Correct answer with unit: 30 Pa", "marks": 1 }
    ],
    "worked_solution": "$P = \\\\frac{F}{A}$\\n$P = \\\\frac{12}{0.40}$\\n$P = 30$ Pa",
    "diagram_type": null,
    "diagram_params": null
  }
}

RULES:
- Use LaTeX notation — mandatory
- \\\\times must always use double escaped backslash
- Every mark_scheme item must use "mark_type": "step"
- Worked solution must have one step per line, separated by \\n
- Return ONLY the JSON object — no markdown, no preamble
`;

// ─────────────────────────────────────────────
// FOUNDATION MATHS PAPER PROMPT BUILDERS
// ─────────────────────────────────────────────

function buildFoundationP1Prompt(
  subtopic: any,
  questionIndex: number,
  totalCount: number
): string {
  const promptConfig = subtopic.prompt_config || {};
  const difficultyMap = [
    'Grade 1-2 (1-2 marks) — accessible entry, single or two-step',
    'Grade 2-3 (3-4 marks) — multi-step, named character, real-world context',
    'Grade 3-4 (4-5 marks) — multi-part question (parts a, b, c)',
    'Grade 4-5 (3-5 marks) — higher demand, may require "you must show all your working"',
  ];
  const difficulty = difficultyMap[questionIndex] || difficultyMap[3];

  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Foundation tier Paper 1 (Non-Calculator).

CRITICAL: Calculators are NOT permitted. Every calculation must be workable by hand.

Subject: ${subtopic.subject}
Tier: Foundation
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

YOUR TASK: Generate question ${questionIndex + 1} of ${totalCount}.
Difficulty for this question: ${difficulty}

COMMAND WORDS — USE THESE EXACTLY AS EDEXCEL USES THEM
- "Work out" — for any calculation requiring shown working
- "Write down" — for recall or read-off requiring no working
- "Find" — for structural or algebraic answers
- "Show that" — when the answer is given and full working with reasons is required
- "Simplify" or "Simplify fully" — for algebraic simplification
- "Factorise" or "Factorise fully" — for factorisation
- "Solve" — for equations and inequalities
- "Give a reason for your answer" — when justification is required alongside a value
- "You must show all your working" — mandatory on all 3+ mark comparison or decision questions
- "Give your answer in its simplest form" — always include after fraction or ratio answers
- "Give your answer correct to [n] decimal place(s)" — always specify rounding where required

REAL-WORLD CONTEXT RULES
Every question must use a named character and a real-world context.
Named characters: Javid, Jo, Amy, Nina, Harry, Emma, Peter, Barnie, Robyn, Aisha, Dan, Milly, Ewan, Chloe, Gita, Olly, Karim, Rohan, Filip.
Never use "a student" or "a person" — always a named individual.

MARK SCHEME RULES — PEARSON EDEXCEL FOUNDATION
M mark — method mark. A mark — accuracy mark. B mark — independent mark. C mark — communication mark. P mark — process mark.

NON-CALCULATOR NUMBER RULES
- Use clean integers, simple fractions (halves, quarters, thirds), simple decimals (0.5, 0.25, 0.1)
- Percentage calculations must use friendly percentages: 10%, 25%, 50%, 5%, 1% or combinations

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate a question that directly tests this topic at Foundation tier grade band ${subtopic.grade_band}.`}

REAL-WORLD CONTEXT OVERRIDE
If the TOPICS IN SCOPE section above specifies pure algebraic tasks with no real-world context, that overrides the general real-world context rule above.

FEW-SHOT EXAMPLES — CORRECT QUESTION STYLE
EXAMPLE 1 — Easy (1 mark): Question: "Solve $3x = 21$" Mark scheme: B1 for $x = 7$
EXAMPLE 2 — Medium (2 marks): Question: "Solve $5x + 3 = 28$" Mark scheme: M1 for $5x = 25$, A1 for $x = 5$
EXAMPLE 3 — Hard (3 marks): Question: "Solve $4(2x - 1) = 3x + 11$" Mark scheme: M1 expanding, M1 collecting, A1 $x = 3$

FORBIDDEN QUESTION TYPES — NEVER GENERATE
- Coordinate grids, graph drawing, geometric constructions, transformations on a grid
- Bar charts, frequency polygons, histograms, travel graphs, probability tree diagrams, scatter graphs
- Any question where the answer depends on reading a printed diagram

${FOUNDATION_SHARED_LATEX_RULES}

${FOUNDATION_SINGLE_QUESTION_FORMAT}`;
}

function buildFoundationP2Prompt(
  subtopic: any,
  questionIndex: number,
  totalCount: number
): string {
  const promptConfig = subtopic.prompt_config || {};
  const difficultyMap = [
    'Grade 1-2 (1-2 marks) — accessible entry, single or two-step',
    'Grade 2-3 (3-4 marks) — multi-step, named character, real-world context',
    'Grade 3-4 (4-5 marks) — multi-part question (parts a, b, c)',
    'Grade 4-5 (4-6 marks) — higher demand, decision or comparison problem',
  ];
  const difficulty = difficultyMap[questionIndex] || difficultyMap[3];

  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Foundation tier Paper 2 (Calculator).

IMPORTANT: A calculator is permitted. Questions may include percentages, division of decimals, compound interest.

Subject: ${subtopic.subject}
Tier: Foundation
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

YOUR TASK: Generate question ${questionIndex + 1} of ${totalCount}.
Difficulty for this question: ${difficulty}

COMMAND WORDS — USE THESE EXACTLY AS EDEXCEL USES THEM
- "Work out" — for any calculation requiring shown working
- "Write down" — for recall or read-off requiring no working
- "Find" — for structural or algebraic answers
- "Show that" — when the answer is given and full working with reasons is required
- "You must show all your working" — mandatory on all 3+ mark comparison or decision questions
- "You must show how you get your answer" — use on value-for-money or better-buy comparisons
- "Give your answer in its simplest form" — always include after fraction or ratio answers
- "Give your answer correct to [n] decimal place(s)" — always specify rounding where required

REAL-WORLD CONTEXT RULES
Every question must use a named character and a real-world context.
Named characters: Javid, Jo, Amy, Nina, Harry, Emma, Peter, Barnie, Robyn, Aisha, Dan, Milly, Ewan, Chloe, Gita, Olly, Karim, Rohan, Filip.
Never use "a student" or "a person" — always a named individual.

MARK SCHEME RULES — PEARSON EDEXCEL FOUNDATION
M mark — method mark. A mark — accuracy mark. B mark — independent mark. C mark — communication mark. P mark — process mark.

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate a question that directly tests this topic at Foundation tier grade band ${subtopic.grade_band}.`}

REAL-WORLD CONTEXT OVERRIDE
If the TOPICS IN SCOPE section above specifies pure algebraic tasks with no real-world context, that overrides the general real-world context rule above.

FEW-SHOT EXAMPLES — CORRECT QUESTION STYLE
EXAMPLE 1 — Easy (1 mark): Question: "Solve $3x = 21$" Mark scheme: B1 for $x = 7$
EXAMPLE 2 — Medium (2 marks): Question: "Solve $5x + 3 = 28$" Mark scheme: M1 for $5x = 25$, A1 for $x = 5$
EXAMPLE 3 — Hard (3 marks): Question: "Solve $4(2x - 1) = 3x + 11$" Mark scheme: M1 expanding, M1 collecting, A1 $x = 3$

FORBIDDEN QUESTION TYPES — NEVER GENERATE
- Coordinate grids, graph drawing, geometric constructions, transformations on a grid
- Bar charts, frequency polygons, histograms, travel graphs, probability tree diagrams, scatter graphs
- Any question where the answer depends on reading a printed diagram

${FOUNDATION_SHARED_LATEX_RULES}

${FOUNDATION_SINGLE_QUESTION_FORMAT}`;
}

function buildFoundationP3Prompt(
  subtopic: any,
  questionIndex: number,
  totalCount: number
): string {
  const promptConfig = subtopic.prompt_config || {};
  const difficultyMap = [
    'Grade 1-2 (1-2 marks) — accessible entry, one or two steps',
    'Grade 2-3 (3-4 marks) — multi-step problem, real-world context',
    'Grade 3-4 (4-5 marks) — multi-part question (parts a, b)',
    'Grade 4-5 (4-5 marks) — higher demand, combined ratio-and-percentage problem',
  ];
  const difficulty = difficultyMap[questionIndex] || difficultyMap[3];

  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Foundation tier Paper 3 (Calculator).

IMPORTANT: A calculator is permitted. Paper 3 has a higher proportion of multi-step applied problems.

Subject: ${subtopic.subject}
Tier: Foundation
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

YOUR TASK: Generate question ${questionIndex + 1} of ${totalCount}.
Difficulty for this question: ${difficulty}

REAL-WORLD CONTEXT RULES
Every question must use a named character and a real-world context.
Named characters: Javid, Jo, Amy, Nina, Harry, Emma, Peter, Barnie, Robyn, Aisha, Dan, Milly, Ewan, Chloe, Gita, Olly, Karim, Rohan, Filip.

MARK SCHEME RULES — PEARSON EDEXCEL FOUNDATION
M mark — method mark. A mark — accuracy mark. B mark — independent mark. C mark — communication mark. P mark — process mark.

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate a question that directly tests this topic at Foundation tier grade band ${subtopic.grade_band}.`}

REAL-WORLD CONTEXT OVERRIDE
If the TOPICS IN SCOPE section above specifies pure algebraic tasks with no real-world context, that overrides the general real-world context rule above.

FEW-SHOT EXAMPLES — CORRECT QUESTION STYLE
EXAMPLE 1 — Easy (1 mark): Question: "Solve $3x = 21$" Mark scheme: B1 for $x = 7$
EXAMPLE 2 — Medium (2 marks): Question: "Solve $5x + 3 = 28$" Mark scheme: M1 for $5x = 25$, A1 for $x = 5$
EXAMPLE 3 — Hard (3 marks): Question: "Solve $4(2x - 1) = 3x + 11$" Mark scheme: M1 expanding, M1 collecting, A1 $x = 3$

FORBIDDEN QUESTION TYPES — NEVER GENERATE
- Coordinate grids, graph drawing, geometric constructions, transformations on a grid
- Frequency polygons, histograms, probability tree diagrams, scatter graphs, stem and leaf diagrams
- Any question where the answer depends on reading a printed diagram

${FOUNDATION_SHARED_LATEX_RULES}

${FOUNDATION_SINGLE_QUESTION_FORMAT}`;
}

// ─────────────────────────────────────────────
// HIGHER MATHS PAPER PROMPT BUILDERS
// ─────────────────────────────────────────────

function buildHigherP1Prompt(
  subtopic: any,
  questionIndex: number,
  totalCount: number
): string {
  const promptConfig = subtopic.prompt_config || {};
  const difficultyMap = [
    'Grade 4-5 (2-3 marks) — accessible entry, one or two steps',
    'Grade 5-6 (3-4 marks) — multi-step, requires connecting two ideas',
    'Grade 6-7 (4-5 marks) — multi-part or extended working, reasoning required',
    'Grade 7-9 (4-6 marks) — higher demand: proof, "show that", non-routine problem',
  ];
  const difficulty = difficultyMap[questionIndex] || difficultyMap[3];

  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Higher tier Paper 1 (Non-Calculator).

CRITICAL: Calculators are NOT permitted. Use exact surds, fractions, or integer answers.

Subject: ${subtopic.subject}
Tier: Higher
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

YOUR TASK: Generate question ${questionIndex + 1} of ${totalCount}.
Difficulty for this question: ${difficulty}

COMMAND WORDS — USE THESE EXACTLY AS EDEXCEL USES THEM
- "Work out", "Find", "Simplify", "Factorise", "Solve", "Show that", "Prove", "Hence"
- "Give a reason for each stage of your working", "You must show all your working"
- "Give your answer in its simplest form", "Write down", "Explain why"

MARK SCHEME RULES — PEARSON EDEXCEL HIGHER
M mark — method mark. A mark — accuracy mark. B mark — independent mark. C mark — communication mark. P mark — process mark. ft — follow through. cao — correct answer only.

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate a question that directly tests this topic at Higher tier grade band ${subtopic.grade_band}.`}

REAL-WORLD CONTEXT OVERRIDE
If the TOPICS IN SCOPE section above specifies pure algebraic tasks with no real-world context, that overrides any real-world context convention. Always follow the subtopic-specific instruction.

FEW-SHOT EXAMPLES — CORRECT QUESTION STYLE
EXAMPLE 1 — Easy (1 mark): Question: "Solve $3x = 21$" Mark scheme: B1 for $x = 7$
EXAMPLE 2 — Medium (2 marks): Question: "Solve $5x + 3 = 28$" Mark scheme: M1 for $5x = 25$, A1 for $x = 5$
EXAMPLE 3 — Hard (3 marks): Question: "Solve $4(2x - 1) = 3x + 11$" Mark scheme: M1 expanding, M1 collecting, A1 $x = 3$

FORBIDDEN QUESTION TYPES — NEVER GENERATE
- Drawing or completing graphs, angle bisector constructions, transformations on a grid
- Frequency polygons, histograms, stem and leaf diagrams, probability tree diagrams
- Velocity-time graph area estimation, scatter graphs, circle theorem diagrams requiring a drawn figure

${HIGHER_SHARED_LATEX_RULES}

${HIGHER_SINGLE_QUESTION_FORMAT}`;
}

function buildHigherP2Prompt(
  subtopic: any,
  questionIndex: number,
  totalCount: number
): string {
  const promptConfig = subtopic.prompt_config || {};
  const difficultyMap = [
    'Grade 4-5 (2-3 marks) — accessible, single or two-step, straightforward calculator use',
    'Grade 5-6 (3-4 marks) — multi-step, forming an equation or calculating with a formula',
    'Grade 6-7 (4-5 marks) — combined topics, algebraic setup, or "is X correct?" with full working',
    'Grade 7-9 (4-6 marks) — higher demand: forming and solving equations from geometry, bounds, compound percentage',
  ];
  const difficulty = difficultyMap[questionIndex] || difficultyMap[3];

  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Higher tier Paper 2 (Calculator).

IMPORTANT: A calculator is permitted. Include calculations with decimals, trigonometry, compound interest.

Subject: ${subtopic.subject}
Tier: Higher
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

YOUR TASK: Generate question ${questionIndex + 1} of ${totalCount}.
Difficulty for this question: ${difficulty}

COMMAND WORDS — USE THESE EXACTLY AS EDEXCEL USES THEM
- "Work out", "Calculate", "Find", "Solve", "Show that"
- "Is [name] correct? You must show all your working."
- "You must show how you get your answer"
- "Give your answer correct to [n] decimal place(s)"
- "Give your answer correct to [n] significant figure(s)"

MARK SCHEME RULES — PEARSON EDEXCEL HIGHER
M mark — method mark. A mark — accuracy mark. B mark — independent mark. C mark — communication mark. P mark — process mark. ft — follow through. cao — correct answer only.

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate a question that directly tests this topic at Higher tier grade band ${subtopic.grade_band}.`}

REAL-WORLD CONTEXT OVERRIDE
If the TOPICS IN SCOPE section above specifies pure algebraic tasks with no real-world context, that overrides any real-world context convention. Always follow the subtopic-specific instruction.

FEW-SHOT EXAMPLES — CORRECT QUESTION STYLE
EXAMPLE 1 — Easy (1 mark): Question: "Solve $3x = 21$" Mark scheme: B1 for $x = 7$
EXAMPLE 2 — Medium (2 marks): Question: "Solve $5x + 3 = 28$" Mark scheme: M1 for $5x = 25$, A1 for $x = 5$
EXAMPLE 3 — Hard (3 marks): Question: "Solve $4(2x - 1) = 3x + 11$" Mark scheme: M1 expanding, M1 collecting, A1 $x = 3$

FORBIDDEN QUESTION TYPES — NEVER GENERATE
- Drawing or completing graphs, scatter graphs, histograms, frequency polygons
- Probability tree diagrams, velocity-time graphs, circle theorem proofs requiring a drawn figure
- Angle bisector or perpendicular bisector constructions, graph transformations requiring drawing on a grid

${HIGHER_SHARED_LATEX_RULES}

${HIGHER_SINGLE_QUESTION_FORMAT}`;
}

function buildHigherP3Prompt(
  subtopic: any,
  questionIndex: number,
  totalCount: number
): string {
  const promptConfig = subtopic.prompt_config || {};
  const difficultyMap = [
    'Grade 4-5 (2-3 marks) — accessible entry, one or two steps',
    'Grade 5-6 (3-4 marks) — multi-step calculation, ratio or percentage setup',
    'Grade 6-7 (4-5 marks) — multi-part or combined topic, algebraic rearrangement',
    'Grade 7-9 (4-6 marks) — higher demand: non-linear simultaneous equations, rearranging complex formulae',
  ];
  const difficulty = difficultyMap[questionIndex] || difficultyMap[3];

  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Higher tier Paper 3 (Calculator).

IMPORTANT: A calculator is permitted. Paper 3 Higher has a high proportion of applied and multi-topic questions.

Subject: ${subtopic.subject}
Tier: Higher
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

YOUR TASK: Generate question ${questionIndex + 1} of ${totalCount}.
Difficulty for this question: ${difficulty}

COMMAND WORDS — USE THESE EXACTLY AS EDEXCEL USES THEM
- "Work out", "Calculate", "Find", "Solve", "Make [variable] the subject"
- "Prove algebraically that...", "Show that", "Give a reason for your answer"
- "You must show all your working", "Give your answer correct to [n] decimal place(s)"

MARK SCHEME RULES — PEARSON EDEXCEL HIGHER
M mark — method mark. A mark — accuracy mark. B mark — independent mark. C mark — communication mark. P mark — process mark. ft — follow through. cao — correct answer only.

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate a question that directly tests this topic at Higher tier grade band ${subtopic.grade_band}.`}

REAL-WORLD CONTEXT OVERRIDE
If the TOPICS IN SCOPE section above specifies pure algebraic tasks with no real-world context, that overrides any real-world context convention. Always follow the subtopic-specific instruction.

FEW-SHOT EXAMPLES — CORRECT QUESTION STYLE
EXAMPLE 1 — Easy (1 mark): Question: "Solve $3x = 21$" Mark scheme: B1 for $x = 7$
EXAMPLE 2 — Medium (2 marks): Question: "Solve $5x + 3 = 28$" Mark scheme: M1 for $5x = 25$, A1 for $x = 5$
EXAMPLE 3 — Hard (3 marks): Question: "Solve $4(2x - 1) = 3x + 11$" Mark scheme: M1 expanding, M1 collecting, A1 $x = 3$

FORBIDDEN QUESTION TYPES — NEVER GENERATE
- Drawing or completing graphs, histograms, frequency polygons, stem and leaf diagrams
- Probability tree diagrams, angle bisector constructions, transformations on a grid
- Velocity-time graph area estimation, scatter graphs, circle theorem diagrams requiring a drawn figure

${HIGHER_SHARED_LATEX_RULES}

${HIGHER_SINGLE_QUESTION_FORMAT}`;
}

// ─────────────────────────────────────────────
// PHYSICS PROMPT BUILDERS — AQA 8463
// ─────────────────────────────────────────────

const PHYSICS_SHARED_LATEX_RULES = `
CRITICAL — MATHEMATICAL NOTATION:
You MUST use LaTeX notation for ALL mathematical expressions in question_text, mark_scheme criteria, and worked_solution.
In JSON strings, backslashes MUST be escaped as double backslashes (\\\\).

Correct JSON examples:
Multiplication sign: "$3 \\\\times 2$"
Fractions: "$\\\\frac{12}{0.4}$"
Powers: "$v^2$", "$10^3$"
Standard form: "$2.6 \\\\times 10^{-8}$"
Units: "$m/s^2$", "$N/m$", "$kg/m^3$"

NEVER use:
- \\times with a single backslash — always use \\\\times
- Plain text such as "v squared" — use $v^2$

WORKED SOLUTION FORMAT:
Write each step on a separate line using \\n between steps. One calculation step per line.
`;

function inferPhysicsPaper(subtopic: any): 'paper1' | 'paper2' {
  const promptConfig = subtopic.prompt_config || {};
  const explicitPaper = String(
    promptConfig.paper || promptConfig.physics_paper || ''
  ).toLowerCase();
  if (
    explicitPaper === 'paper1' ||
    explicitPaper === 'paper 1' ||
    explicitPaper === 'p1'
  )
    return 'paper1';
  if (
    explicitPaper === 'paper2' ||
    explicitPaper === 'paper 2' ||
    explicitPaper === 'p2'
  )
    return 'paper2';
  const haystack =
    `${subtopic.topic || ''} ${subtopic.subtopic_name || ''} ${subtopic.slug || ''}`.toLowerCase();
  const paper1Terms = [
    'energy',
    'electricity',
    'current',
    'charge',
    'resistance',
    'potential difference',
    'mains',
    'circuit',
    'thermistor',
    'particle',
    'density',
    'specific heat',
    'specific latent',
    'latent heat',
    'gas pressure',
    'atomic',
    'radioactive',
    'radioactivity',
    'radiation',
    'half-life',
    'nuclear',
    'fission',
    'fusion',
  ];
  if (paper1Terms.some((term) => haystack.includes(term))) return 'paper1';
  return 'paper2';
}

function normalisePhysicsTier(
  subtopic: any,
  studentPhysicsTier?: string
): 'foundation' | 'higher' {
  const fromRequest = String(studentPhysicsTier || '').toLowerCase();
  if (fromRequest.includes('foundation')) return 'foundation';
  if (fromRequest.includes('higher')) return 'higher';
  const fromSubtopic = String(subtopic.tier || '').toLowerCase();
  if (fromSubtopic.includes('foundation')) return 'foundation';
  if (fromSubtopic.includes('higher')) return 'higher';
  return 'foundation';
}

function buildPhysicsPrompt(
  subtopic: any,
  questionIndex: number,
  totalCount: number,
  physicsTier: 'foundation' | 'higher',
  physicsPaper: 'paper1' | 'paper2'
): string {
  const promptConfig = subtopic.prompt_config || {};
  const tierLabel = physicsTier === 'foundation' ? 'Foundation' : 'Higher';
  const paperLabel = physicsPaper === 'paper1' ? 'Paper 1' : 'Paper 2';

  const difficultyMap =
    physicsTier === 'foundation'
      ? [
          '1-2 marks — accessible, tick-box or fill-in-the-blank style',
          '2-3 marks — short calculation with equation given',
          '3-4 marks — multi-part, explanation or comparison',
          '4-6 marks — multi-part, may include a required practical method',
        ]
      : [
          '2-3 marks — accessible, equation selection and substitution',
          '3-4 marks — multi-step calculation, may include unit conversion',
          '4-5 marks — multi-part, explanation plus calculation',
          '5-6 marks — higher demand: multi-step, rearrangement, or graph interpretation',
        ];
  const difficulty = difficultyMap[questionIndex] || difficultyMap[3];

  return `You are a senior AQA GCSE Physics examiner writing questions for AQA 8463 ${tierLabel} Tier ${paperLabel}.

Subject: ${subtopic.subject}
Exam board: AQA
Tier: ${tierLabel}
Paper: ${paperLabel}
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

YOUR TASK: Generate question ${questionIndex + 1} of ${totalCount}.
Difficulty for this question: ${difficulty}

TOPICS IN SCOPE FOR THIS SUBTOPIC:
${promptConfig.system_prompt || `Generate a question that directly tests ${subtopic.subtopic_name} within ${subtopic.topic}.`}

${promptConfig.marking_guidance ? `\nSUBTOPIC-SPECIFIC MARKING GUIDANCE — highest priority:\n${promptConfig.marking_guidance}` : ''}

MARK SCHEME RULES — AQA PHYSICS:
Every mark is a standalone 1-mark criterion. Use mark_type: "step" for every mark.
Do not use Edexcel M, A, B, C or P marks.

FORBIDDEN FOR AI-GENERATED PHYSICS QUESTIONS:
Do not generate questions requiring a custom diagram not provided.
Do not ask students to draw arrows, complete ray diagrams, or plot graphs.

${PHYSICS_SHARED_LATEX_RULES}

${PHYSICS_SINGLE_QUESTION_FORMAT}`;
}

// ─────────────────────────────────────────────
// CALL CLAUDE FOR A SINGLE QUESTION
// ─────────────────────────────────────────────

async function generateSingleQuestion(
  systemPrompt: string,
  userPrompt: string,
  questionIndex: number,
  apiKey: string
): Promise<any> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Anthropic API returned ${response.status} for question ${questionIndex + 1}`
    );
  }

  const result = await response.json();
  const rawText = result.content?.[0]?.text;
  if (!rawText)
    throw new Error(`Empty response for question ${questionIndex + 1}`);

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  const parsed = JSON.parse(cleaned);
  const q = parsed.question || parsed.questions?.[0];
  if (!q)
    throw new Error(
      `No question object in response for question ${questionIndex + 1}`
    );

  return {
    id: crypto.randomUUID(),
    question_text: q.question_text,
    marks: q.marks,
    parts: q.parts || [],
    mark_scheme: q.mark_scheme,
    worked_solution: q.worked_solution,
    diagram_type: q.diagram_type || null,
    diagram_params: q.diagram_params || null,
    question_order: questionIndex + 1,
  };
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { headers: corsHeaders });

  try {
    const {
      subtopicId,
      count = 4,
      calculatorAllowed = false,
      studentTier,
      physicsTier,
    } = await req.json();
    if (!subtopicId) throw new Error('subtopicId is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: subtopic, error: stError } = await supabase
      .from('subtopics')
      .select('*')
      .eq('id', subtopicId)
      .single();
    if (stError || !subtopic) throw new Error('Subtopic not found');

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY)
      throw new Error('ANTHROPIC_API_KEY is not configured');

    const isFoundation = subtopic.tier?.toLowerCase() === 'foundation';
    const isHigher = subtopic.tier?.toLowerCase() === 'higher';
    const isMaths =
      subtopic.subject?.toLowerCase().includes('maths') ||
      subtopic.subject?.toLowerCase().includes('math');
    const isPhysics = subtopic.subject?.toLowerCase().includes('physics');

    const examBoardLabel = isPhysics ? 'AQA' : 'Pearson Edexcel';
    const tierLabelForPrompt = isPhysics
      ? normalisePhysicsTier(subtopic, physicsTier || studentTier)
      : subtopic.tier;
    const markTypeExample = isPhysics ? 'step' : 'M';

    // Build per-question system prompts and user prompts
    const questionConfigs = Array.from({ length: count }, (_, i) => {
      let systemPrompt: string;

      if (isMaths && isFoundation) {
        if (calculatorAllowed) {
          systemPrompt =
            Math.random() < 0.5
              ? buildFoundationP2Prompt(subtopic, i, count)
              : buildFoundationP3Prompt(subtopic, i, count);
        } else {
          systemPrompt = buildFoundationP1Prompt(subtopic, i, count);
        }
      } else if (isMaths && isHigher) {
        if (calculatorAllowed) {
          systemPrompt =
            Math.random() < 0.5
              ? buildHigherP2Prompt(subtopic, i, count)
              : buildHigherP3Prompt(subtopic, i, count);
        } else {
          systemPrompt = buildHigherP1Prompt(subtopic, i, count);
        }
      } else if (isPhysics) {
        const resolvedTier = normalisePhysicsTier(
          subtopic,
          physicsTier || studentTier
        );
        const resolvedPaper = inferPhysicsPaper(subtopic);
        systemPrompt = buildPhysicsPrompt(
          subtopic,
          i,
          count,
          resolvedTier,
          resolvedPaper
        );
      } else {
        systemPrompt = buildPhysicsPrompt(
          subtopic,
          i,
          count,
          'foundation',
          'paper1'
        );
      }

      const userPrompt = `Generate question ${i + 1} of ${count} for: "${subtopic.subtopic_name}" (${subtopic.topic}, ${examBoardLabel} ${tierLabelForPrompt} tier, grade ${subtopic.grade_band}).

REMINDER: All mathematical expressions MUST use LaTeX with double-escaped backslashes in JSON.
- Multiplication: "$3x^4 \\\\times 2x^3$"
- Square root: "$\\\\sqrt{50}$"
- Fraction: "$\\\\frac{3}{4}$"

Return ONLY the JSON object with a "question" key. No markdown, no preamble.`;

      return { systemPrompt, userPrompt, index: i };
    });

    // Stream each question to the client as NDJSON as soon as it resolves
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        await Promise.all(
          questionConfigs.map(({ systemPrompt, userPrompt, index }) =>
            generateSingleQuestion(
              systemPrompt,
              userPrompt,
              index,
              ANTHROPIC_API_KEY
            )
              .then(async (question) => {
                await writer.write(
                  encoder.encode(JSON.stringify(question) + '\n')
                );
              })
              .catch((e) => {
                console.error(`Question ${index + 1} failed:`, e);
                // Don't block the stream — just skip failed questions
              })
          )
        );
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/x-ndjson',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    console.error('generate-questions error:', e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
