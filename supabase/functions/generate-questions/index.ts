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

const FOUNDATION_OUTPUT_FORMAT = `
QUESTION FORMAT
Each question must be one of two types:

TYPE 1 — Single part question:
{
  "question_text": "Javid hires a car for 10 days. He pays £45 for each day. He also pays £30 for insurance. Javid pays with ten £50 notes. Work out how much change he should get. (3 marks)",
  "marks": 3,
  "parts": [],
  "mark_scheme": [
    { "mark_type": "M", "criterion": "Correct method to find total cost ($45 \\\\times 10 + 30$)", "marks": 1 },
    { "mark_type": "A", "criterion": "Total cost = £480", "marks": 1 },
    { "mark_type": "A", "criterion": "Change = £20", "marks": 1 }
  ],
  "worked_solution": "$45 \\\\times 10 = 450$\\n$450 + 30 = 480$\\n$10 \\\\times 50 = 500$\\n$500 - 480 = £20$"
}

TYPE 2 — Multi-part question:
{
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
  "worked_solution": "Part (a):\\n$14 + 10 + 10 + 13 + 15 + 9 + 15 + 10 = 96$\\n$96 \\\\div 8 = 12$ years\\nPart (b):\\n$15 - 9 = 6$ years"
}

RULES:
1. Generate exactly {COUNT} questions in increasing difficulty
2. Questions must read exactly like real Pearson Edexcel Foundation past paper questions
3. Use LaTeX notation as shown above — mandatory
4. \\\\times must always use double escaped backslash
5. At least one question must be multi-part (TYPE 2)
5a. For TYPE 2 questions: question_text is the shared scenario stem ONLY — never include part sub-questions or mark allocations in question_text. Each part_text is the sub-question for that part only, with no (a)/(b) label prefix and no mark count.
6. Mark schemes must be unambiguous
7. Worked solution must have one step per line, separated by \\n
8. Return ONLY a JSON object: { "questions": [...] } — no markdown, no preamble
`;

const HIGHER_OUTPUT_FORMAT = `
QUESTION FORMAT
Each question must be one of two types:

TYPE 1 — Single part question:
{
  "question_text": "Simplify $\\\\sqrt{72}$. Give your answer in the form $a\\\\sqrt{b}$ where $a$ and $b$ are integers.",
  "marks": 2,
  "parts": [],
  "mark_scheme": [
    { "mark_type": "M", "criterion": "Identifies $\\\\sqrt{36}$ as a factor of 72", "marks": 1 },
    { "mark_type": "A", "criterion": "Correct answer $6\\\\sqrt{2}$", "marks": 1 }
  ],
  "worked_solution": "$\\\\sqrt{72} = \\\\sqrt{36 \\\\times 2}$\\n$= \\\\sqrt{36} \\\\times \\\\sqrt{2}$\\n$= 6\\\\sqrt{2}$"
}

TYPE 2 — Multi-part question:
{
  "question_text": "The cost of a first class stamp increased from 76p to 85p. The cost of a second class stamp increased from 65p to 66p. Filip says, \"The percentage increase in the cost of a first class stamp is more than 7 times the percentage increase in the cost of a second class stamp.\"",
  "marks": 4,
  "parts": [
    { "part_label": "a", "part_text": "Work out the percentage increase in the cost of a first class stamp.", "marks": 2 },
    { "part_label": "b", "part_text": "Is Filip correct? You must show all your working.", "marks": 2 }
  ],
  "mark_scheme": [
    { "mark_type": "M", "part": "a", "criterion": "Correct method: $\\\\frac{9}{76} \\\\times 100$", "marks": 1 },
    { "mark_type": "A", "part": "a", "criterion": "11.8% (accept 11.84...%)", "marks": 1 },
    { "mark_type": "M", "part": "b", "criterion": "Correct method for second class: $\\\\frac{1}{65} \\\\times 100$", "marks": 1 },
    { "mark_type": "C", "part": "b", "criterion": "Correct conclusion: Filip is correct, 11.84...% > 7 x 1.53...% = 10.76...%", "marks": 1 }
  ],
  "worked_solution": "Part (a):\\n$\\\\frac{85-76}{76} \\\\times 100 = 11.84...\\\\%$\\nPart (b):\\n$\\\\frac{1}{65} \\\\times 100 = 1.538...\\\\%$\\n$7 \\\\times 1.538... = 10.76...\\\\%$\\n$11.84\\\\% > 10.76\\\\%$ so Filip is correct"
}

MULTI-PART QUESTION RULES:
- question_text is the shared scenario stem ONLY — never list sub-questions or mark allocations inside question_text
- Each part_text is the sub-question for that part only — no (a)/(b) label prefix, no mark count
- The app renders the part label and mark count automatically — do not duplicate them in the text

RULES:
1. Generate exactly {COUNT} questions in increasing difficulty
2. Questions must read exactly like real Pearson Edexcel Higher past paper questions
3. Use LaTeX notation as shown above — mandatory
4. \\\\times must always use double escaped backslash
5. At least one question must be multi-part (TYPE 2)
6. Mark schemes must be unambiguous — a second examiner must reach identical marks
7. Worked solution must have one step per line, separated by \\n
8. Return ONLY a JSON object: { "questions": [...] } — no markdown, no preamble
`;

// ─────────────────────────────────────────────
// FOUNDATION MATHS PAPER PROMPT BUILDERS
// ─────────────────────────────────────────────

function buildFoundationP1Prompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Foundation tier Paper 1 (Non-Calculator). Your task is to generate exactly ${count} exam questions that are authentic Pearson Edexcel 1MA1/1F style. These questions will be marked by a separate AI examiner, so every question must include a complete mark scheme.

CRITICAL: Calculators are NOT permitted on this paper. Every calculation in every question must be workable by hand using mental arithmetic, written methods, or standard algorithms. Never include calculations requiring a calculator.

Subject: ${subtopic.subject}
Tier: Foundation
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

QUESTION DIFFICULTY GRADIENT
Question 1: Grade 1-2 (1-2 marks) — accessible entry question, single or two-step, real-world context
Question 2: Grade 2-3 (3-4 marks) — multi-step problem, named character, real-world context
Question 3: Grade 3-4 (4-5 marks) — multi-part question (parts a, b, c), applying knowledge to a scenario
Question 4: Grade 4-5 (3-5 marks) — higher demand, may require "you must show all your working"

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
Suitable contexts: car hire, concert tickets, wages and pay, DIY materials and bills, bead or craft projects, paint mixing, savings and interest, food and shopping, journey times, sports clubs.
Named characters: use common UK names such as Javid, Jo, Amy, Nina, Harry, Emma, Peter, Barnie, Robyn, Aisha, Dan, Milly, Ewan, Chloe, Gita, Olly, Karim, Rohan, Filip.
Never use "a student" or "a person" — always a named individual.

MULTI-PART QUESTION RULES
- Each part must be a genuinely independent sub-problem within the same scenario
- Part (a) is always the lower-demand entry point
- Part (b) builds on the scenario at higher demand
- Part (c) is a further extension, often involving fractions, probability, or ratio
- NEVER split a single method into parts
- question_text must contain the shared scenario stem ONLY — never list the sub-questions inside question_text
- Each part_text must contain only that part's sub-question, with no (a)/(b)/(c) label prefix and no mark count

MARK SCHEME RULES — PEARSON EDEXCEL FOUNDATION
M mark — method mark. Awarded for correct method even if arithmetic is wrong.
A mark — accuracy mark. Dependent on preceding M mark.
B mark — independent mark. Awarded unconditionally for a correct value or statement.
C mark — communication mark. For a complete correct explanation stated in words.
P mark — process mark. For multi-step problems where correct process is demonstrated.
Always include a TOTAL entry as the final mark scheme item.
Note ECF explicitly where it applies: "A1 ft: correct subtraction from candidate's total"

NON-CALCULATOR NUMBER RULES
- All arithmetic must be achievable without a calculator
- Use clean integers, simple fractions (halves, quarters, thirds), simple decimals (0.5, 0.25, 0.1)
- Percentage calculations must use friendly percentages: 10%, 25%, 50%, 5%, 1% or combinations
- Ratio problems must have integer answers when divided
- Avoid awkward long division or irrational intermediate values

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate questions that directly test this topic at Foundation tier grade band ${subtopic.grade_band}.`}

FORBIDDEN QUESTION TYPES — ALWAYS SEEDED, NEVER AI-GENERATED
Never generate questions requiring:
- Coordinate grids, plotting points, or graph drawing
- Geometric constructions (bisectors, perpendiculars)
- Reflection, rotation, or translation on a grid
- Measuring angles or lengths from a diagram
- Drawing or completing bar charts, frequency polygons, or histograms
- Travel graphs or distance-time graphs
- Probability tree diagrams
- Scatter graphs or lines of best fit
- Any question where the answer depends on reading a printed diagram

${FOUNDATION_SHARED_LATEX_RULES}

${FOUNDATION_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
}

function buildFoundationP2Prompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Foundation tier Paper 2 (Calculator). Your task is to generate exactly ${count} exam questions that are authentic Pearson Edexcel 1MA1/2F style. These questions will be marked by a separate AI examiner, so every question must include a complete mark scheme.

IMPORTANT: A calculator is permitted. Questions may include percentages of amounts, division of decimals, area and volume involving pi, density, compound interest. Working must still be clearly shown.

Subject: ${subtopic.subject}
Tier: Foundation
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

QUESTION DIFFICULTY GRADIENT
Question 1: Grade 1-2 (1-2 marks) — accessible entry question, single or two-step, real-world context
Question 2: Grade 2-3 (3-4 marks) — multi-step problem, named character, real-world context
Question 3: Grade 3-4 (4-5 marks) — multi-part question (parts a, b, c), applying knowledge to a scenario
Question 4: Grade 4-5 (4-6 marks) — higher demand, often a "you must show all your working" decision, comparison, or combined algebra-and-geometry problem

COMMAND WORDS — USE THESE EXACTLY AS EDEXCEL USES THEM
- "Work out" — for any calculation requiring shown working
- "Write down" — for recall or read-off requiring no working
- "Find" — for structural or algebraic answers
- "Show that" — when the answer is given and full working with reasons is required
- "Simplify" or "Simplify fully" — for algebraic simplification
- "Factorise" or "Factorise fully" — for factorisation
- "Solve" — for equations and inequalities
- "Give a reason for your answer" — when justification required alongside a value
- "You must show all your working" — mandatory on all 3+ mark comparison or decision questions
- "You must show how you get your answer" — use on value-for-money or better-buy comparisons
- "Give your answer in its simplest form" — always include after fraction or ratio answers
- "Give your answer correct to [n] decimal place(s)" — always specify rounding where required
- "Give your answer correct to [n] significant figure(s)" — use for density or large-number questions

REAL-WORLD CONTEXT RULES
Every question must use a named character and a real-world context.
Suitable contexts: car insurance and percentage change, ticket sales, wages and bonuses, reverse percentages, DIY shop bills, map scales and real distances, savings accounts and compound interest, value-for-money comparisons including currency conversion, density and mass, sports club statistics.
Named characters: use common UK names such as Javid, Jo, Amy, Nina, Harry, Emma, Peter, Barnie, Robyn, Aisha, Dan, Milly, Ewan, Chloe, Gita, Olly, Karim, Rohan, Filip.
Never use "a student" or "a person" — always a named individual.

For value-for-money questions: always present two named options and require the student to state a conclusion. Use: "In which [location/option] is the [item] the better value for money? You must show how you get your answer."

For "Is [name] correct?" questions: always include a named person making a mathematical claim. Use: "Is [name] correct? You must show all your working."

MULTI-PART QUESTION RULES
- Each part must be a genuinely independent sub-problem within the same scenario
- Part (a) is always the lower-demand entry point
- Part (b) builds on the scenario at higher demand
- Part (c) is a further extension
- NEVER split a single method into parts
- question_text must contain the shared scenario stem ONLY — never list the sub-questions inside question_text
- Each part_text must contain only that part's sub-question, with no (a)/(b)/(c) label prefix and no mark count

MARK SCHEME RULES — PEARSON EDEXCEL FOUNDATION
M mark — method mark. Awarded for correct method even if arithmetic is wrong.
A mark — accuracy mark. Dependent on preceding M mark.
B mark — independent mark. Awarded unconditionally for a correct value or statement.
C mark — communication mark. For a complete correct conclusion stated in words.
P mark — process mark. For multi-step problems where correct process is demonstrated.
Always include a TOTAL entry as the final mark scheme item.
Note ECF explicitly where it applies.
For comparison/decision questions: always include a C1 mark for the correct conclusion explicitly stated in words.

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate questions that directly test this topic at Foundation tier grade band ${subtopic.grade_band}.`}

FORBIDDEN QUESTION TYPES — ALWAYS SEEDED, NEVER AI-GENERATED
Never generate questions requiring:
- Coordinate grids, plotting points, or graph drawing
- Drawing or completing quadratic or linear graphs
- Geometric constructions (bisectors, perpendiculars)
- Reflection, rotation, or translation on a grid
- Drawing or completing bar charts, frequency polygons, or histograms
- Travel graphs or distance-time graphs
- Probability tree diagrams (completion type)
- Scatter graphs or lines of best fit
- Reading values from a conversion graph
- Any question where the answer depends on reading a printed diagram

${FOUNDATION_SHARED_LATEX_RULES}

${FOUNDATION_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
}

function buildFoundationP3Prompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Foundation tier Paper 3 (Calculator). Your task is to generate exactly ${count} exam questions that are authentic Pearson Edexcel 1MA1/3F style. These questions will be marked by a separate AI examiner, so every question must include a complete mark scheme.

IMPORTANT: A calculator is permitted. Paper 3 has a higher proportion of multi-step applied problems involving fractions, percentages, ratio, statistics, and combined topics. Questions frequently require students to interpret and communicate results.

Subject: ${subtopic.subject}
Tier: Foundation
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

QUESTION DIFFICULTY GRADIENT
Question 1: Grade 1-2 (1-2 marks) — accessible entry question, one or two steps, real-world context
Question 2: Grade 2-3 (3-4 marks) — multi-step problem, named character, real-world context
Question 3: Grade 3-4 (4-5 marks) — multi-part question (parts a, b), may include a statistical or ratio element
Question 4: Grade 4-5 (4-5 marks) — higher demand, often a combined ratio-and-percentage problem, multi-group calculation, or percentage profit requiring a stated conclusion

COMMAND WORDS — USE THESE EXACTLY AS EDEXCEL USES THEM
- "Work out" — for any calculation requiring shown working
- "Write down" — for recall or read-off requiring no working
- "Find" — for structural or algebraic answers
- "Show that" — when the answer is given and full working with reasons is required
- "Write an expression, in terms of [variable(s)], for..." — for algebraic modelling
- "Give a reason for your answer" — when justification required alongside a value
- "You must show all your working" — mandatory on all 3+ mark percentage profit, percentage change, or decision questions
- "Give your answer correct to [n] decimal place(s)" — always specify rounding where required
- "Is [name] correct? Give a reason for your answer." — for statistical misconception questions
- "Compare the distribution of..." — for statistics comparison questions
- "What effect does this have on...?" — for follow-on reasoning questions

REAL-WORLD CONTEXT RULES
Every question must use a named character and a real-world context.
Suitable contexts: hourly wage and overtime pay, percentage profit on buying and selling, multi-group percentage problems (children and adults at an event), train or bus timetable reasoning, compound interest savings, statistical comparisons between two groups, unit conversion problems, simple algebraic expressions from a real scenario.
Named characters: use common UK names such as Javid, Jo, Amy, Nina, Harry, Emma, Peter, Barnie, Robyn, Aisha, Dan, Milly, Ewan, Chloe, Gita, Olly, Karim, Rohan, Filip.
Never use "a student" or "a person" — always a named individual.

MULTI-PART QUESTION RULES
- Each part must be a genuinely independent sub-problem within the same scenario
- Part (a) is always the lower-demand entry point
- Part (b) builds on the scenario at higher demand
- NEVER split a single method into parts
- question_text must contain the shared scenario stem ONLY — never list the sub-questions inside question_text
- Each part_text must contain only that part's sub-question, with no (a)/(b) label prefix and no mark count

MARK SCHEME RULES — PEARSON EDEXCEL FOUNDATION
M mark — method mark. Awarded for correct method even if arithmetic is wrong.
A mark — accuracy mark. Dependent on preceding M mark.
B mark — independent mark. Awarded unconditionally for a correct value or statement.
C mark — communication mark. For a complete correct conclusion, reason, or comparison stated in words.
P mark — process mark. For multi-step problems where correct process is demonstrated.
Always include a TOTAL entry as the final mark scheme item.
Note ECF explicitly where it applies.
For "Is X correct?" questions: always include a C1 or B1 for the correct evaluative statement in words.
For "Compare the distribution" questions: award one mark for comparing an average, one for spread, one for a contextual conclusion.

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate questions that directly test this topic at Foundation tier grade band ${subtopic.grade_band}.`}

FORBIDDEN QUESTION TYPES — ALWAYS SEEDED, NEVER AI-GENERATED
Never generate questions requiring:
- Coordinate grids, plotting points, or graph drawing
- Drawing or completing frequency polygons or histograms
- Geometric constructions (angle bisectors, perpendicular bisectors)
- Reflection, rotation, or translation on a grid
- Completing probability tree diagrams
- Drawing travel graphs or distance-time graphs
- Scatter graphs or lines of best fit
- Reading values from a conversion graph
- Any question where the answer depends on reading a printed diagram
- Stem and leaf diagrams (reading or drawing)

${FOUNDATION_SHARED_LATEX_RULES}

${FOUNDATION_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
}

// ─────────────────────────────────────────────
// HIGHER MATHS PAPER PROMPT BUILDERS
// Built from November 2024: 1MA1/1H, 1MA1/2H, 1MA1/3H
// ─────────────────────────────────────────────

function buildHigherP1Prompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Higher tier Paper 1 (Non-Calculator). Your task is to generate exactly ${count} exam questions that are authentic Pearson Edexcel 1MA1/1H style. These questions will be marked by a separate AI examiner, so every question must include a complete mark scheme.

CRITICAL: Calculators are NOT permitted on this paper. Every calculation must be workable by hand or with exact arithmetic. Use exact surds, fractions, or integer answers — never rounded decimals that would require a calculator.

Subject: ${subtopic.subject}
Tier: Higher
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

QUESTION DIFFICULTY GRADIENT
Question 1: Grade 4-5 (2-3 marks) — accessible entry, one or two steps, straightforward application of a technique
Question 2: Grade 5-6 (3-4 marks) — multi-step, requires connecting two ideas or setting up before solving
Question 3: Grade 6-7 (4-5 marks) — multi-part or extended working, reasoning or algebraic manipulation required
Question 4: Grade 7-9 (4-6 marks) — higher demand: proof, "show that", non-routine problem, or combined topics

COMMAND WORDS — USE THESE EXACTLY AS EDEXCEL USES THEM
- "Work out" — calculation requiring shown working
- "Find" — algebraic or structural answer
- "Simplify" / "Simplify fully" — algebraic simplification or surd simplification
- "Factorise" / "Factorise fully" — factorisation
- "Solve" — equations, simultaneous equations, inequalities
- "Show that" — answer is given, full working with reasons required; must reach the stated result explicitly
- "Prove" — formal algebraic or geometric proof with all steps and reasons stated
- "Hence" — must follow directly from the previous result
- "Give a reason for each stage of your working" — geometry angle chains
- "You must show all your working" — decision or comparison questions
- "Give your answer in its simplest form" — after fractions, ratios, surds
- "Give your answer in the form $a\\\\sqrt{b}$" or "in the form $p + q\\\\sqrt{r}$" — surd form answers
- "Give your answer in standard form" — standard form answers
- "Write down" — no working needed, recall or read-off
- "Explain why" — one-line reason required, not a calculation

NON-CALCULATOR ARITHMETIC RULES
- All arithmetic achievable without a calculator
- Use exact surds, fractions, or integers as answers — not rounded decimals
- Percentage calculations: use multipliers or build from 10%/1% steps
- Fraction arithmetic: convert to common denominators, show all steps
- Powers: integer bases with integer or simple fractional exponents
- Avoid sin/cos/tan of non-special angles, long decimal division, or irrational intermediate results

HIGHER TIER TOPIC CONVENTIONS
- Surds: simplify, rationalise the denominator, expand brackets with surds
- Indices: fractional, negative, laws of indices — all exact
- Functions: inverse $f^{-1}(x)$, composite $fg(x)$, notation $f(x)$
- Algebraic fractions: simplify, add, subtract — always show common denominator
- Factorising: single bracket, double bracket, difference of two squares, grouping (four terms)
- Proof: always use general algebraic expressions — never verify with a specific example
- Angle geometry: always require reasons stated at each step
- Sequences: nth term of arithmetic and quadratic sequences
- Estimation: round to 1 s.f., calculate, state whether under/overestimate with a reason

"IS [NAME] CORRECT?" FORMAT
- State the claim as a direct quote in question_text
- Student must calculate to verify or refute
- Always include a C mark for the correct conclusion stated in words
- Named characters: Javid, Jo, Amy, Nina, Harry, Emma, Peter, Barnie, Robyn, Aisha, Dan, Milly, Ewan, Chloe, Gita, Olly, Karim, Rohan, Filip, Kate, Sian, Nadia

"SHOW THAT" FORMAT
- The target answer is given in the question
- Full working with every step is required
- Must end with a concluding statement matching the given result
- Never just state the result — every intermediate step must be shown

MARK SCHEME RULES — PEARSON EDEXCEL HIGHER
M mark — method mark. Awarded for correct method even if arithmetic is wrong.
A mark — accuracy mark. Dependent on preceding M mark.
B mark — independent mark. Awarded unconditionally for a correct value or statement.
C mark — communication mark. For a complete correct conclusion or explanation stated in words.
P mark — process mark. For multi-step problems where correct process is demonstrated.
ft — follow through. Award if correct method applied to candidate's earlier answer.
cao — correct answer only. No follow through.
Always include a TOTAL entry as the final mark scheme item.
ECF: note explicitly where error carried forward applies.

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate questions that directly test this topic at Higher tier grade band ${subtopic.grade_band}.`}

FORBIDDEN QUESTION TYPES — ALWAYS SEEDED, NEVER AI-GENERATED
Never generate questions requiring:
- Drawing or completing graphs on a coordinate grid
- Angle bisector or perpendicular bisector constructions
- Transformations on a grid (reflection, rotation, translation, enlargement)
- Drawing frequency polygons, histograms, or cumulative frequency graphs
- Stem and leaf diagrams
- Drawing or completing probability tree diagrams
- Velocity-time graph area estimation
- Scatter graphs or lines of best fit
- Circle theorem diagrams requiring a drawn figure
- Vector geometry requiring a labelled diagram
- 3D trigonometry or pyramid/cone problems requiring a diagram
- Graph sketching on a provided grid

${HIGHER_SHARED_LATEX_RULES}

${HIGHER_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
}

function buildHigherP2Prompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Higher tier Paper 2 (Calculator). Your task is to generate exactly ${count} exam questions that are authentic Pearson Edexcel 1MA1/2H style. These questions will be marked by a separate AI examiner, so every question must include a complete mark scheme.

IMPORTANT: A calculator is permitted. Questions should exploit this — include calculations with decimals, trigonometry, standard form arithmetic, density/pressure/volume, compound interest and depreciation, and answers requiring rounding to a specified degree of accuracy.

Subject: ${subtopic.subject}
Tier: Higher
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

QUESTION DIFFICULTY GRADIENT
Question 1: Grade 4-5 (2-3 marks) — accessible, single or two-step, straightforward calculator use
Question 2: Grade 5-6 (3-4 marks) — multi-step, forming an equation or calculating with a formula
Question 3: Grade 6-7 (4-5 marks) — combined topics, algebraic setup, or "is X correct?" with full working
Question 4: Grade 7-9 (4-6 marks) — higher demand: forming and solving equations from geometry, bounds, compound percentage finding rate, or non-routine reasoning

COMMAND WORDS — USE THESE EXACTLY AS EDEXCEL USES THEM
- "Work out" — calculation requiring shown working
- "Calculate" — use your calculator, show key steps
- "Find" — algebraic or structural answer
- "Solve" — equations, simultaneous equations (linear)
- "Show that" — answer given, full working required
- "Is [name] correct? You must show all your working." — always include a C mark for the conclusion
- "You must show how you get your answer" — value-for-money or comparison questions
- "Give your answer correct to [n] decimal place(s)" — always specify rounding
- "Give your answer correct to [n] significant figure(s)" — for large/small numbers, density, standard form
- "Give your answer in standard form" — standard form questions
- "Prove" — formal proof with all reasons stated

CALCULATOR PAPER QUESTION TYPES — PRIORITISE THESE
- Value-for-money comparisons with currency conversion or unit conversion — always require a stated conclusion
- Compound interest and depreciation: find rate or time, not just the amount
- Density, pressure, force, area calculations
- Trigonometry with non-special angles (sin, cos, tan, sine rule, cosine rule)
- Direct and inverse proportion — find k, then calculate for a new value
- Iterative/recursive sequences — find $u_n$ using a given formula
- Simultaneous equations (linear) — must show full algebraic working
- "Is [name] correct?" percentage/ratio claims — always require full calculation and a stated conclusion
- Forming and solving equations from geometric contexts (perimeter, area, equal sides)
- Standard form: evaluate complex expressions, round to specified accuracy
- Combinatorics / systematic counting — how many games, arrangements, or outcomes

"IS [NAME] CORRECT?" FORMAT
- State the claim as a direct quote in question_text
- Full calculation required to verify or refute
- Always include a C1 mark for the correct conclusion stated in words
- Named characters: Javid, Jo, Amy, Nina, Harry, Emma, Peter, Barnie, Robyn, Aisha, Dan, Milly, Ewan, Chloe, Gita, Olly, Karim, Rohan, Filip, Kate, Sian, Nadia

VALUE-FOR-MONEY FORMAT
- Always present two named options (two shops, two sizes, two cities)
- Always require a stated conclusion: "In which [option] is [item] the better value for money?"
- Add: "You must show how you get your answer"
- Always include a C1 mark for the correct conclusion

MARK SCHEME RULES — PEARSON EDEXCEL HIGHER
M mark — method mark. Awarded for correct method even if arithmetic is wrong.
A mark — accuracy mark. Dependent on preceding M mark.
B mark — independent mark. Awarded unconditionally for a correct value or statement.
C mark — communication mark. For a complete correct conclusion or explanation stated in words.
P mark — process mark. For multi-step problems where correct process is demonstrated.
ft — follow through. Award if correct method applied to candidate's earlier answer.
cao — correct answer only. No follow through.
Always include a TOTAL entry as the final mark scheme item.
ECF: note explicitly where error carried forward applies.
For comparison/decision questions: always include a C1 mark for the correct conclusion explicitly stated in words.

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate questions that directly test this topic at Higher tier grade band ${subtopic.grade_band}.`}

FORBIDDEN QUESTION TYPES — ALWAYS SEEDED, NEVER AI-GENERATED
Never generate questions requiring:
- Drawing or completing graphs on a coordinate grid (quadratic, linear, cubic)
- Completing or drawing scatter graphs or lines of best fit
- Drawing or completing histograms or frequency polygons
- Describing transformations that require reading coordinates from a diagram
- Drawing probability tree diagrams
- Drawing velocity-time graphs or estimating area under a curve by reading graph coordinates
- Completing Venn diagrams with a given diagram
- Circle theorem proofs requiring a labelled figure
- 3D trigonometry questions requiring a drawn 3D diagram
- Angle bisector or perpendicular bisector constructions
- Graph transformations requiring drawing on a grid

${HIGHER_SHARED_LATEX_RULES}

${HIGHER_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
}

function buildHigherP3Prompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Higher tier Paper 3 (Calculator). Your task is to generate exactly ${count} exam questions that are authentic Pearson Edexcel 1MA1/3H style. These questions will be marked by a separate AI examiner, so every question must include a complete mark scheme.

IMPORTANT: A calculator is permitted. Paper 3 Higher has a high proportion of applied and multi-topic questions. It frequently combines algebra with geometry, or requires non-routine reasoning. Questions often need a stated conclusion or justification, and commonly test: trigonometry, proportion, rearranging complex formulae, compound percentage, algebraic proof, and non-linear simultaneous equations.

Subject: ${subtopic.subject}
Tier: Higher
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

QUESTION DIFFICULTY GRADIENT
Question 1: Grade 4-5 (2-3 marks) — accessible entry, one or two steps, applying a technique directly
Question 2: Grade 5-6 (3-4 marks) — multi-step calculation, ratio or percentage setup, reverse calculation
Question 3: Grade 6-7 (4-5 marks) — multi-part or combined topic, algebraic rearrangement, or proportion
Question 4: Grade 7-9 (4-6 marks) — higher demand: non-linear simultaneous equations, rearranging complex formulae with the subject appearing twice, completing the square with a parameter, arc/sector with algebraic expressions, proof with recurring decimals, or estimation/sampling

COMMAND WORDS — USE THESE EXACTLY AS EDEXCEL USES THEM
- "Work out" — calculation requiring shown working
- "Calculate" — use your calculator, show key steps
- "Find" — algebraic or structural answer
- "Solve" — equations, simultaneous equations including non-linear
- "Make [variable] the subject" — rearranging formulae (subject may appear more than once)
- "Prove algebraically that..." — recurring decimal to fraction proof, or algebraic identity
- "Show that" — answer given, every step required; must reach the stated result
- "State one assumption you have made" — sampling or estimation questions
- "Give a reason for your answer" — justification alongside a value
- "You must show all your working" — percentage profit, comparison, decision questions
- "Give your answer correct to [n] decimal place(s) / significant figure(s)" — always specify
- "Compare the distribution of..." — always compare average AND spread, with context
- "Is [name] correct? Give a reason for your answer." — evaluating a mathematical claim

PAPER 3H QUESTION TYPES — AUTHENTICALLY HIGHER 3H
- Reverse percentage: find original price before a percentage reduction or increase
- Compound interest: multi-year with different rates; or find rate x% given start and end values
- Rearranging complex formulae where the subject appears twice — e.g. make $p$ the subject of $t = \\\\frac{2(2p-3)}{5-2p}$
- Proving a recurring decimal equals a given fraction — algebraic proof with multiplier strategy
- Arc length and sector area — find angle or radius given perimeter or area of sector
- Similar triangles: find the area of a trapezium formed between two similar triangles
- Non-linear simultaneous equations (one linear, one quadratic): solve algebraically, give answers to 3 s.f.
- Direct/inverse proportion: establish k, calculate a new value, sketch the graph shape
- Capture-recapture or sampling estimation with a stated assumption
- Index laws: simplify expressions with negative and fractional indices
- Cosine rule/sine rule applied to a triangle with all three sides given — find angle, then find area
- Error intervals: given a truncated or rounded value, state the correct interval
- Completing the square with a parameter: find coordinates of turning point in terms of the parameter

"IS [NAME] CORRECT?" FORMAT (statistics variant)
- A named person makes a statistical claim (e.g. confuses modal class with highest frequency)
- Part (a): calculate the correct value
- Part (b): evaluate the claim with a stated reason
- Always include a B1 or C1 for the correct evaluative statement

COMPARE DISTRIBUTIONS FORMAT
- Always compare both an average (mean or median) AND spread (range or IQR)
- Each comparison must reference the context — not just "A has a higher median"
- Award one mark per valid contextual comparison

MARK SCHEME RULES — PEARSON EDEXCEL HIGHER
M mark — method mark. Awarded for correct method even if arithmetic is wrong.
A mark — accuracy mark. Dependent on preceding M mark.
B mark — independent mark. Awarded unconditionally for a correct value or statement.
C mark — communication mark. For a complete correct conclusion, reason, or comparison stated in words.
P mark — process mark. For multi-step problems where correct process is demonstrated.
ft — follow through. Award if correct method applied to candidate's earlier answer.
cao — correct answer only. No follow through.
Always include a TOTAL entry as the final mark scheme item.
ECF: note explicitly where error carried forward applies.
For recurring decimal proofs: M1 for correct multiplier strategy, A1 for correct fraction, B1 for simplified form.
For non-linear simultaneous equations: M1 correct substitution, M1 forming quadratic, A1 A1 for each solution pair.

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate questions that directly test this topic at Higher tier grade band ${subtopic.grade_band}.`}

FORBIDDEN QUESTION TYPES — ALWAYS SEEDED, NEVER AI-GENERATED
Never generate questions requiring:
- Drawing or completing graphs on a coordinate grid
- Drawing frequency polygons, histograms, or cumulative frequency graphs
- Completing stem and leaf diagrams
- Drawing or completing probability tree diagrams
- Angle bisector or perpendicular bisector constructions
- Transformations on a coordinate grid
- Velocity-time graph area estimation by reading coordinates
- Circle theorem diagrams requiring a drawn figure
- 3D trigonometry questions requiring a drawn 3D diagram
- Graph transformations requiring drawing on a grid
- Scatter graphs or lines of best fit

${HIGHER_SHARED_LATEX_RULES}

${HIGHER_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
}

// ─────────────────────────────────────────────
// PHYSICS PROMPT BUILDERS — AQA 8463
// Strong AQA-style version built from June 2024 papers:
// 8463/1F, 8463/2F, 8463/1H, 8463/2H
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
- Plain text fractions such as "12/0.4" — use $\\\\frac{12}{0.4}$ where appropriate

WORKED SOLUTION FORMAT:
Write each step on a separate line using \\n between steps.
One calculation step per line.
`;

const PHYSICS_OUTPUT_FORMAT = `
QUESTION FORMAT
Each question must be one of two types:

TYPE 1 — Single part question:
{
  "question_text": "A student measures a force of 12 N acting over an area of 0.40 $m^2$. Calculate the pressure. Give your answer in Pa.",
  "marks": 2,
  "parts": [],
  "mark_scheme": [
    { "mark_type": "step", "criterion": "Correct substitution: $P = \\\\frac{12}{0.40}$", "marks": 1 },
    { "mark_type": "step", "criterion": "Correct answer with unit: 30 Pa", "marks": 1 },
    { "mark_type": "step", "criterion": "TOTAL", "marks": 2 }
  ],
  "worked_solution": "$P = \\\\frac{F}{A}$\\n$P = \\\\frac{12}{0.40}$\\n$P = 30$ Pa"
}

TYPE 2 — Multi-part question:
{
  "question_text": "A student investigates how the resistance of a wire depends on the length of the wire. The student uses a cell, an ammeter, a voltmeter, a switch and a length of resistance wire.",
  "marks": 5,
  "parts": [
    { "part_label": "a", "part_text": "Name the independent variable in this investigation.", "marks": 1 },
    { "part_label": "b", "part_text": "Describe how the student should collect results for this investigation.", "marks": 4 }
  ],
  "mark_scheme": [
    { "mark_type": "step", "part": "a", "criterion": "Length of the wire", "marks": 1 },
    { "mark_type": "step", "part": "b", "criterion": "Measure the length of wire between the contacts", "marks": 1 },
    { "mark_type": "step", "part": "b", "criterion": "Measure current and potential difference for each length", "marks": 1 },
    { "mark_type": "step", "part": "b", "criterion": "Calculate resistance using $R = \\\\frac{V}{I}$", "marks": 1 },
    { "mark_type": "step", "part": "b", "criterion": "Repeat for several lengths and plot a graph of resistance against length", "marks": 1 },
    { "mark_type": "step", "criterion": "TOTAL", "marks": 5 }
  ],
  "worked_solution": "Part (a):\\nThe independent variable is the length of the wire.\\nPart (b):\\nMeasure the length of wire between the contacts.\\nMeasure the current and potential difference.\\nCalculate resistance using $R = \\\\frac{V}{I}$.\\nRepeat for several lengths and plot a graph."
}

MULTI-PART QUESTION RULES:
- question_text is the shared scenario stem ONLY
- Do not list sub-questions inside question_text
- Each part_text is the sub-question only
- Do not include "(a)" or "(b)" in part_text
- Do not include mark counts inside part_text
- The app renders labels and mark counts automatically

RULES:
1. Generate exactly {COUNT} questions in increasing difficulty
2. Questions must read like real AQA GCSE Physics 8463 questions, not generic textbook questions
3. Use LaTeX notation — mandatory
4. \\\\times must always use double escaped backslash
5. At least one question must be multi-part
6. Mark schemes must use AQA-style standalone marking points
7. Do not use Edexcel M/A/B/C/P mark types for Physics
8. Every mark_scheme item must use "mark_type": "step"
9. Every mark scheme must include a final TOTAL item
10. Worked solution must have one step per line, separated by \\n
11. Return ONLY a JSON object: { "questions": [...] } — no markdown, no preamble
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
  ) {
    return 'paper1';
  }

  if (
    explicitPaper === 'paper2' ||
    explicitPaper === 'paper 2' ||
    explicitPaper === 'p2'
  ) {
    return 'paper2';
  }

  const haystack = `${subtopic.topic || ''} ${subtopic.subtopic_name || ''} ${
    subtopic.slug || ''
  }`.toLowerCase();

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
    'iv',
    'i-v',
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
    'half life',
    'nuclear',
    'fission',
    'fusion',
  ];

  if (paper1Terms.some((term) => haystack.includes(term))) {
    return 'paper1';
  }

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

function buildPhysicsFoundationP1Prompt(subtopic: any, count: number): string {
  return buildPhysicsPromptVariant(subtopic, count, 'foundation', 'paper1');
}

function buildPhysicsFoundationP2Prompt(subtopic: any, count: number): string {
  return buildPhysicsPromptVariant(subtopic, count, 'foundation', 'paper2');
}

function buildPhysicsHigherP1Prompt(subtopic: any, count: number): string {
  return buildPhysicsPromptVariant(subtopic, count, 'higher', 'paper1');
}

function buildPhysicsHigherP2Prompt(subtopic: any, count: number): string {
  return buildPhysicsPromptVariant(subtopic, count, 'higher', 'paper2');
}

function buildPhysicsPromptVariant(
  subtopic: any,
  count: number,
  physicsTier: 'foundation' | 'higher',
  physicsPaper: 'paper1' | 'paper2'
): string {
  const promptConfig = subtopic.prompt_config || {};

  const tierLabel = physicsTier === 'foundation' ? 'Foundation' : 'Higher';
  const paperLabel = physicsPaper === 'paper1' ? 'Paper 1' : 'Paper 2';

  const contentProfile =
    physicsPaper === 'paper1'
      ? `
PAPER 1 CONTENT PROFILE:
Energy, electricity, particle model of matter, atomic structure, radiation, radioactivity and nuclear physics.

Use Paper 1-style contexts such as:
- static electricity generators, sparks, domes, charge transfer and electric fields
- vending machines, thermistors, components, current, potential difference and resistance
- bungee rides, springs, elastic potential energy, kinetic energy and gravitational potential energy
- measuring cylinders, balances, density and volume displacement
- syringes, gas pressure, particles and temperature change
- radioactive rocks, background radiation, alpha/beta/gamma radiation and half-life
- plugs, fuses, three-core cables, charge flow and latent heat
- I-V characteristics, filament lamps, resistors and unknown components
- wind turbines, energy resources, energy storage methods and climate change
- nuclear fission, nuclear power stations and radioactive waste
`
      : `
PAPER 2 CONTENT PROFILE:
Forces, motion, waves, magnetism, electromagnetism and space physics.

Use Paper 2-style contexts such as:
- galaxies, the Sun, stars, fusion, red-shift and the expanding Universe
- bar magnets, plotting compasses, magnetic fields and current-carrying wires
- trolleys, acceleration, mass, resultant force and variables
- transverse waves, longitudinal waves, frequency, period, wavelength and sound
- distance-time graphs and velocity-time graphs
- electromagnetic spectrum, colour, filters, reflection and refraction
- swimming pools, pressure, weight, springs and acceleration
- glass blocks, protractors, angles of incidence/refraction and ray diagrams
- baby walkers, work done, moments and gears
- seismic waves, P-waves and S-waves
- generator effect, moving-coil microphones and induced current
`;

  const foundationArchetypes =
    physicsPaper === 'paper1'
      ? `
FOUNDATION PAPER 1 QUESTION ARCHETYPES:
Use these patterns heavily:

1. Recognition / sentence completion:
- "Complete the sentence. Choose the answer from the box."
- "Which particles are transferred..."
- "What is the frequency/potential difference of the mains supply..."

2. Guided calculation:
- Give the equation directly.
- Provide two known quantities.
- Ask for the result and unit.
- Usually 2 or 3 marks.

3. Table or graph reading:
- Give a small text table.
- Ask for a difference, mean, change, or relationship.
- Do not require the student to see a drawn graph unless the values are described in text.

4. Practical method:
- Ask how a student could measure or investigate something.
- Mark points should include apparatus, measurements, repeats, control variable and graph.

5. Energy store / transfer:
- Ask for a named store OR a transfer pathway, never confuse the two.
`
      : `
FOUNDATION PAPER 2 QUESTION ARCHETYPES:
Use these patterns heavily:

1. Recognition / recall:
- "Which of the following..."
- "Complete the sentence. Choose the answer from the box."
- "Give one example..."

2. Diagram interpretation converted to typed form:
- Describe the diagram in words rather than relying on an actual image.
- Ask for direction, strongest field, scalar/vector, amplitude/wavelength, etc.

3. Guided calculation:
- Give the equation directly.
- Use accessible numbers.
- Ask for result and unit.

4. Graph/data interpretation:
- Give values in text or a small table.
- Ask for total distance, average speed, gradient meaning, change, or relationship.

5. Practical method:
- Ask for a concrete method: apparatus, measurement, changing one variable, repeats, graph.
`;

  const higherArchetypes =
    physicsPaper === 'paper1'
      ? `
HIGHER PAPER 1 QUESTION ARCHETYPES:
Use these patterns heavily:

1. Compare with calculations:
- Compare two methods, devices or energy resources.
- Require at least one calculation and a written advantage/disadvantage.

2. Multi-step equation calculation:
- Students may need to select/rearrange equations from the Physics Equations Sheet.
- Include unit conversion where appropriate.

3. Mechanism explanation:
- Ask "Explain why..." for particles, static electricity, electric fields, energy losses or pressure.

4. Practical/data interpretation:
- Ask for method, error, resolution, uncertainty, repeatability, line of best fit or relationship.

5. Graph/table determination:
- Provide small text tables or described graph data.
- Ask students to determine a value and explain how they used the data.

6. Radiation/nuclear:
- Ask about contamination vs irradiation, alpha/beta/gamma penetration, half-life, activity or nuclear fission.
`
      : `
HIGHER PAPER 2 QUESTION ARCHETYPES:
Use these patterns heavily:

1. Required practical / method:
- Refraction, force and acceleration, wave speed, or other Paper 2 practicals.
- Include variables, measurements, repeats, graph and relationship.

2. Multi-step calculation:
- Pressure in liquids, moments, wave speed, distance from velocity-time graph, braking distance or work done.
- Include unit conversion where appropriate.

3. Graph interpretation:
- Ask students to determine distance from area, acceleration/deceleration from gradient, or compare sections.

4. Explanation using data:
- Ask students to explain braking force, red-shift, seismic waves, generator effect or electromagnetic radiation.

5. Space physics:
- Ask about objects in the solar system, red-shift, galaxy motion, stellar fusion and formation of elements.

6. Electromagnetism:
- Ask about induced current, generator effect, direction changes, microphones and magnetic fields.
`;

  const tierStyle =
    physicsTier === 'foundation'
      ? `
FOUNDATION TIER STYLE — STRICT:
Write in the style of AQA GCSE Physics Foundation Tier.

Foundation questions are scaffolded question groups. They often break one context into short parts before asking for a calculation or explanation.

Use these formats frequently:
- "Complete the sentence. Choose the answer from the box."
- "Tick one box."
- "Tick two boxes."
- "Write down..."
- "State..."
- "Use the equation:"
- "Use the Physics Equations Sheet to answer..."
- "Calculate..."
- "Give a reason for your answer."
- "Suggest one..."
- "Describe a method..."

Foundation demand profile:
- Mostly 1-mark and 2-mark parts
- Calculations are usually 2 or 3 marks
- Give the equation directly for many Foundation calculations
- Keep numbers manageable
- Keep wording concrete and familiar
- Keep explanation questions tightly bounded
- Avoid long abstract textbook questions
- Avoid making students select from many equations unless the question explicitly says "Use the Physics Equations Sheet"

Foundation session structure:
Question 1: very accessible recall/recognition, 1-2 marks
Question 2: short scaffolded application, 2-3 marks
Question 3: calculation or data handling, 2-4 marks
Question 4: multi-part AQA-style question group, 4-6 marks
`
      : `
HIGHER TIER STYLE — STRICT:
Write in the style of AQA GCSE Physics Higher Tier.

Higher questions are less scaffolded and should require interpretation, calculation or explanation.

Use these command words frequently:
- "Calculate"
- "Determine"
- "Explain"
- "Suggest"
- "Describe"
- "Compare"
- "Use information from..."
- "Use the Physics Equations Sheet."

Higher demand profile:
- Fewer tick-box questions than Foundation
- More 3-mark, 4-mark, 5-mark and 6-mark tasks
- Include multi-step calculations
- Include unit conversions where appropriate
- Include graph/table interpretation where possible
- Explanation questions must test physical mechanisms, not vague recall
- Practical questions must test variables, resolution, uncertainty, repeatability, graph skills and proportionality
- Do not simply make Foundation questions with harder numbers

Higher session structure:
Question 1: accessible but still Higher-style, 2-3 marks
Question 2: interpretation or calculation, 3-4 marks
Question 3: multi-step calculation or explanation, 4-5 marks
Question 4: demanding AQA-style question group, 5-6 marks
`;

  const energyStoreAbsoluteRules = `
ENERGY STORES ABSOLUTE RULE — NON-NEGOTIABLE:
When writing or marking any question about energy stores, you must use ONLY the eight AQA energy stores:

1. magnetic
2. electrostatic potential
3. chemical potential
4. kinetic
5. gravitational potential
6. elastic potential
7. nuclear
8. thermal

The word "potential" is required for:
- electrostatic potential
- chemical potential
- gravitational potential
- elastic potential

Never write, imply, accept or include in a mark scheme:
- electrical energy store
- electrical store
- light energy store
- sound energy store
- heat energy store
- potential energy store on its own

Electricity, light and sound are transfer pathways, not energy stores.

Battery rule:
- A charged battery stores energy in its chemical potential store.
- During charging, energy is transferred electrically to the chemical potential store of the battery.
- Do not ask for "the energy store in the charger".
- Do not write "electrical store / mains electricity" in a mark scheme.
- Correct wording: "energy is transferred electrically from the mains/charger to the chemical potential store of the battery."

Capacitor/static charge rule:
- Electrostatic potential store is for separated charges / charged objects, not ordinary phone batteries.

Before returning JSON, check your own mark schemes. If any criterion contains "electrical store", "light store" or "sound store", rewrite it before returning.
`;

  const practicalRules = `
AQA PRACTICAL SKILLS RULES:
Include practical/data-handling questions when suitable for the subtopic.

Practical questions may test:
- independent, dependent and control variables
- measuring instruments and resolution
- repeat readings and calculating a mean
- identifying anomalies
- reducing random error
- zero error and systematic error
- drawing or interpreting a line of best fit
- recognising direct proportionality
- describing a method step by step
- safety precautions

For 6-mark practical method questions:
The mark scheme should reward six standalone points such as:
1. suitable apparatus or setup
2. measurement of independent variable
3. measurement of dependent variable
4. control variable
5. repeat readings / calculate mean
6. plot graph or describe relationship
`;

  const markingRules = `
MARK SCHEME RULES — AQA PHYSICS:
Every mark is a standalone 1-mark criterion.
Do not use Edexcel M, A, B, C or P marks.
Use mark_type: "step" for every Physics mark.

Award marks for:
- correct recall statement
- correct equation selected or written, only when the question asks for the equation
- correct substitution
- correct rearrangement
- correct unit conversion
- correct calculation
- correct final answer
- correct unit
- correct comparison or conclusion
- correct explanation point

Important AQA convention:
If the equation is given in the question, do not award a separate mark simply for writing the equation again.
If the question asks "Write down the equation which links...", then award 1 mark for the correct equation.

For calculations:
- If 2 marks: usually substitution/process + answer/unit
- If 3 marks: equation/rearrangement or conversion + substitution + answer/unit
- If 4+ marks: break the process into clear standalone points
- Apply error carried forward where appropriate and state it in the criterion, e.g. "Correct calculation using the candidate's value from part (a)"

For explanations:
- Each mark should correspond to one clear physics idea
- Avoid vague criteria like "good explanation"
- Do not require exact wording unless the scientific term is essential

Always include a final TOTAL item:
{ "mark_type": "step", "criterion": "TOTAL", "marks": total_marks }
`;

  const antiGenericRules = `
ANTI-GENERIC QUESTION RULES:
Do not generate bland textbook questions such as:
- "Explain energy transfers in a device."
- "State the energy store in X and where it came from."
- "Describe how electricity works."
- "What is energy?"
- "Explain forces in everyday life."

Every question must have an AQA-style exam-paper shape:
- a concrete scenario
- precise command wording
- clear mark allocation
- a mark scheme with standalone points
- no invented stores or vague physics language

Do not generate repeated phone-charger questions.
If using a battery context, it must test chemical potential store and electrical transfer correctly.
`;

  return `You are a senior AQA GCSE Physics examiner writing questions for AQA 8463 ${tierLabel} Tier ${paperLabel}.

Your task is to generate exactly ${count} exam-style question groups for The Hub Jam. The questions will be marked by a separate AI examiner, so every question must include a complete, unambiguous AQA-style mark scheme.

Subject: ${subtopic.subject}
Exam board: AQA
Tier: ${tierLabel}
Paper: ${paperLabel}
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}
${subtopic.description ? `Description: ${subtopic.description}` : ''}

${contentProfile}

TOPICS IN SCOPE FOR THIS SUBTOPIC:
${promptConfig.system_prompt || `Generate questions that directly test ${subtopic.subtopic_name} within ${subtopic.topic}. Stay tightly within this subtopic.`}

${promptConfig.marking_guidance ? `\nSUBTOPIC-SPECIFIC MARKING GUIDANCE — highest priority:\n${promptConfig.marking_guidance}` : ''}

${promptConfig.context ? `\nExaminer notes:\n${promptConfig.context}` : ''}

${promptConfig.common_mistakes ? `\nCommon student errors to probe:\n${promptConfig.common_mistakes}` : ''}

${tierStyle}

${physicsTier === 'foundation' ? foundationArchetypes : higherArchetypes}

${energyStoreAbsoluteRules}

${practicalRules}

${markingRules}

${antiGenericRules}

QUESTION STRUCTURE:
Generate ${count} questions in increasing difficulty.
Each generated question may be single-part or multi-part.
At least one question must be multi-part.
Each question should feel like a short AQA exam-paper question group, not a generic textbook exercise.

AQA WORDING STYLE:
Use simple, direct AQA-style language.
Prefer concrete contexts over abstract prompts.
Use "student", "teacher", "child", "person", "machine", "appliance", "source", "object" and similar AQA-style nouns.
Do not force named characters in Physics. AQA Physics usually uses "a student", "a teacher", "a person", etc.

FORBIDDEN FOR AI-GENERATED PHYSICS QUESTIONS:
Do not generate questions that require the app to display a complex custom diagram unless diagram_params are explicitly provided.
Do not ask students to draw arrows, complete ray diagrams, plot graphs, or draw lines of best fit unless the response can be typed.
Do not make the answer depend on seeing an image that has not been generated.
You may describe simple tables or data in text.
You may include small data tables in question_text using plain text.

FINAL SELF-CHECK BEFORE RETURNING JSON:
Before returning the JSON, check:
1. Does every question stay inside the requested subtopic?
2. Does the style match ${tierLabel} Tier ${paperLabel}?
3. Does every Physics mark use "mark_type": "step"?
4. Does every mark scheme include TOTAL?
5. Have you avoided "electrical store", "light store" and "sound store"?
6. Are transfer pathways described as transfers, not stores?
7. Are the questions AQA-shaped rather than generic?

${PHYSICS_SHARED_LATEX_RULES}

${PHYSICS_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
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

    const isFoundation = subtopic.tier?.toLowerCase() === 'foundation';
    const isHigher = subtopic.tier?.toLowerCase() === 'higher';

    const isMaths =
      subtopic.subject?.toLowerCase().includes('maths') ||
      subtopic.subject?.toLowerCase().includes('math');

    const isPhysics = subtopic.subject?.toLowerCase().includes('physics');

    let systemPrompt: string;

    if (isMaths && isFoundation) {
      if (calculatorAllowed) {
        systemPrompt =
          Math.random() < 0.5
            ? buildFoundationP2Prompt(subtopic, count)
            : buildFoundationP3Prompt(subtopic, count);
      } else {
        systemPrompt = buildFoundationP1Prompt(subtopic, count);
      }
    } else if (isMaths && isHigher) {
      if (calculatorAllowed) {
        systemPrompt =
          Math.random() < 0.5
            ? buildHigherP2Prompt(subtopic, count)
            : buildHigherP3Prompt(subtopic, count);
      } else {
        systemPrompt = buildHigherP1Prompt(subtopic, count);
      }
    } else if (isPhysics) {
      const resolvedPhysicsTier = normalisePhysicsTier(
        subtopic,
        physicsTier || studentTier
      );

      const resolvedPhysicsPaper = inferPhysicsPaper(subtopic);

      if (
        resolvedPhysicsTier === 'foundation' &&
        resolvedPhysicsPaper === 'paper1'
      ) {
        systemPrompt = buildPhysicsFoundationP1Prompt(subtopic, count);
      } else if (
        resolvedPhysicsTier === 'foundation' &&
        resolvedPhysicsPaper === 'paper2'
      ) {
        systemPrompt = buildPhysicsFoundationP2Prompt(subtopic, count);
      } else if (
        resolvedPhysicsTier === 'higher' &&
        resolvedPhysicsPaper === 'paper1'
      ) {
        systemPrompt = buildPhysicsHigherP1Prompt(subtopic, count);
      } else {
        systemPrompt = buildPhysicsHigherP2Prompt(subtopic, count);
      }
    } else {
      systemPrompt = buildPhysicsPromptVariant(
        subtopic,
        count,
        'foundation',
        'paper1'
      );
    }

    const examBoardLabel = isPhysics ? 'AQA' : 'Pearson Edexcel';
    const tierLabelForPrompt = isPhysics
      ? normalisePhysicsTier(subtopic, physicsTier || studentTier)
      : subtopic.tier;

    const markTypeExample = isPhysics ? 'step' : 'M';

    const userPrompt = `Generate ${count} GCSE exam questions for: "${subtopic.subtopic_name}" (${subtopic.topic}, ${examBoardLabel} ${tierLabelForPrompt} tier, grade ${subtopic.grade_band}).

REMINDER: All mathematical expressions MUST use LaTeX with double-escaped backslashes in JSON.

Critical examples:
- Multiplication: "$3x^4 \\\\times 2x^3$" — NOT "$3x^4 \\times 2x^3$"
- Square root: "$\\\\sqrt{50}$" — NOT "$\\sqrt{50}$"
- Fraction: "$\\\\frac{3}{4}$" — NOT "$\\frac{3}{4}$"
- Times symbol: "$\\\\times$" — NOT "$\\times$"

REMINDER FOR MULTI-PART QUESTIONS:
- question_text = shared scenario stem ONLY (no sub-questions listed)
- part_text = sub-question text only, no (a)/(b) prefix, no mark count

Return ONLY this JSON structure:
{
  "questions": [
    {
      "question_text": "string with $LaTeX$",
      "marks": 2,
      "parts": [],
      "mark_scheme": [{ "mark_type": "${markTypeExample}", "criterion": "string with $LaTeX$", "marks": 1 }],
      "worked_solution": "one step per line using \\n",
      "diagram_type": null,
      "diagram_params": null
    }
  ]
}`;

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY)
      throw new Error('ANTHROPIC_API_KEY is not configured');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error('Anthropic error:', status, text);
      throw new Error(`Anthropic API returned ${status}`);
    }

    const result = await response.json();
    const rawText = result.content?.[0]?.text;
    if (!rawText) throw new Error('Empty response from Claude');

    const cleaned = rawText
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    let parsed: { questions: any[] };

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('JSON parse failed:', cleaned);
      throw new Error('Claude returned malformed JSON');
    }

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error('No questions returned');
    }

    const questions = parsed.questions.map((q: any, i: number) => ({
      id: crypto.randomUUID(),
      question_text: q.question_text,
      marks: q.marks,
      parts: q.parts || [],
      mark_scheme: q.mark_scheme,
      worked_solution: q.worked_solution,
      diagram_type: q.diagram_type || null,
      diagram_params: q.diagram_params || null,
      question_order: i + 1,
    }));

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
