import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─────────────────────────────────────────────
// FOUNDATION PAPER BASE PROMPTS
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
Suitable contexts: hourly wage and overtime pay, percentage profit on buying and selling, multi-group percentage problems (children and adults at an event), train or bus timetable reasoning, compound interest savings, prime factorisation and HCF, statistical comparisons between two groups, unit conversion problems, simple algebraic expressions from a real scenario.
Named characters: use common UK names such as Javid, Jo, Amy, Nina, Harry, Emma, Peter, Barnie, Robyn, Aisha, Dan, Milly, Ewan, Chloe, Gita, Olly, Karim, Rohan, Filip.
Never use "a student" or "a person" — always a named individual.

For multi-group problems: always set up the problem so both groups require separate calculations before combining. The final question should ask for the total or a comparison.

For percentage profit/loss questions: always provide buying price and selling price. Always include "Give your answer correct to 1 decimal place" and "You must show all your working."

For "Is [name] correct?" statistical misconception questions: set up a scenario where a named person makes a common error (e.g. confusing the highest frequency with the modal value). Part (a) requires calculation. Part (b) requires evaluating the claim with a reason.

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
// LEGACY PROMPT BUILDER (Higher + Physics)
// ─────────────────────────────────────────────

function buildLegacyPrompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  const isMaths =
    subtopic.subject?.toLowerCase().includes('maths') ||
    subtopic.subject?.toLowerCase().includes('math');
  const boardLabel = isMaths ? 'Edexcel' : 'AQA';

  const markTypeGuidance = isMaths
    ? `MARK TYPES FOR EDEXCEL MATHS:
- M mark: method mark — awarded for a correct method even if arithmetic is wrong
- P mark: process mark — awarded for a correct process step in a problem solving question
- A mark: accuracy mark — awarded for the correct answer, dependent on the preceding M or P mark
- B mark: unconditional accuracy mark — awarded for a correct answer with no method required
- C mark: communication mark — awarded for a fully correct written explanation or statement
Use ft (follow through) where a subsequent mark should be awarded using the student's earlier answer.
Use cao (correct answer only) where only the exact answer is acceptable.`
    : `MARK TYPES FOR AQA PHYSICS:
Every mark is a standalone 1-mark criterion. There are no M, A or B labels.
Each mark is awarded for a specific correct step: correct substitution, correct calculation, correct answer with unit, correct recall, correct reasoning.
Do not label marks with M, A or B. Each criterion in the mark scheme is simply worth 1 mark.`;

  return `You are a senior ${boardLabel} GCSE ${subtopic.subject} examiner writing questions for ${subtopic.tier} tier, grade band ${subtopic.grade_band}.

Subject: ${subtopic.subject}
Exam board: ${boardLabel}
Tier: ${subtopic.tier}
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}
${subtopic.description ? `Description: ${subtopic.description}` : ''}
${promptConfig.system_prompt ? `\nEXPERT EXAMINER INSTRUCTIONS — follow these precisely:\n${promptConfig.system_prompt}` : ''}
${promptConfig.context ? `\nExaminer notes: ${promptConfig.context}` : ''}
${promptConfig.common_mistakes ? `\nCommon student errors to probe: ${promptConfig.common_mistakes}` : ''}
${promptConfig.command_words ? `\nPreferred command words: ${promptConfig.command_words}` : ''}

${markTypeGuidance}

CRITICAL — MATHEMATICAL NOTATION:
You MUST use LaTeX notation for ALL mathematical expressions in question_text, mark_scheme criteria, and worked_solution.
In JSON strings, backslashes MUST be escaped as double backslashes (\\\\).

EXACT examples of correct JSON output with LaTeX — copy these patterns precisely:

Multiplication sign:    "$3 \\\\times 2$"
Square roots:           "$\\\\sqrt{72}$"
Fractions:              "$\\\\frac{6}{\\\\sqrt{3}}$"
Powers:                 "$27^{\\\\frac{2}{3}}$"
Expressions:            "$x^2 + 5x + 6$"
Plus-minus:             "$x = \\\\frac{-b \\\\pm \\\\sqrt{b^2 - 4ac}}{2a}$"
Multiplication of surds: "$3\\\\sqrt{2} \\\\times 2\\\\sqrt{2} = 6 \\\\times 2 = 12$"
Indices:                "$3x^4 \\\\times 2x^3 = 6x^7$"

NEVER use:
- \\times with a single backslash — always double: \\\\times
- sqrt() — always use \\\\sqrt{}
- Plain text like "root 2", "x squared", "times" — always use LaTeX

WORKED SOLUTION FORMAT:
Write each step on a separate line using \\n between steps. One calculation step per line.
Example: "$E_k = \\\\frac{1}{2}mv^2$\\n$E_k = \\\\frac{1}{2} \\\\times 0.42 \\\\times 15^2$\\n$E_k = 47.25$ J"

QUESTION FORMAT
Each question must be one of two types:

TYPE 1 — Single part question:
{
  "question_text": "Simplify $\\\\sqrt{72}$",
  "marks": 2,
  "parts": [],
  "mark_scheme": [
    { "mark_type": "M", "criterion": "Identifies $\\\\sqrt{36}$ as a factor", "marks": 1 },
    { "mark_type": "A", "criterion": "Correct answer $6\\\\sqrt{2}$", "marks": 1 }
  ],
  "worked_solution": "$\\\\sqrt{72} = \\\\sqrt{36 \\\\times 2}$\\n$= \\\\sqrt{36} \\\\times \\\\sqrt{2}$\\n$= 6\\\\sqrt{2}$"
}

TYPE 2 — Multi-part question:
{
  "question_text": "Stem text with $LaTeX$ — shared scenario only, no sub-questions listed here",
  "marks": 3,
  "parts": [
    { "part_label": "a", "part_text": "Sub-question for part a only, no (a) prefix, no mark count", "marks": 2 },
    { "part_label": "b", "part_text": "Sub-question for part b only, no (b) prefix, no mark count", "marks": 1 }
  ],
  "mark_scheme": [
    { "mark_type": "M", "part": "a", "criterion": "criterion with $LaTeX$", "marks": 1 },
    { "mark_type": "A", "part": "a", "criterion": "criterion with $LaTeX$", "marks": 1 },
    { "mark_type": "B", "part": "b", "criterion": "criterion with $LaTeX$", "marks": 1 }
  ],
  "worked_solution": "Part (a):\\n$step 1$\\n$step 2$\\nPart (b):\\n$step 1$"
}

MULTI-PART QUESTION RULES:
- question_text is the shared scenario stem ONLY — never list sub-questions or mark allocations inside question_text
- Each part_text is the sub-question for that part only — no (a)/(b) label prefix, no mark count
- The app renders the part label and mark count automatically — do not duplicate them in the text

RULES:
1. Generate exactly ${count} questions in increasing difficulty
2. Questions must read exactly like real ${boardLabel} past paper questions
3. Use LaTeX notation as shown above — mandatory, not optional
4. \\\\times must always use double escaped backslash — never single
5. At least one question must be multi-part (TYPE 2)
6. Mark schemes must be unambiguous — a second examiner must reach identical marks
7. Worked solution must have one step per line, separated by \\n
8. Return ONLY a JSON object, no markdown, no preamble`;
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { headers: corsHeaders });

  try {
    // Read calculatorAllowed from the request body
    const {
      subtopicId,
      count = 4,
      calculatorAllowed = false,
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
    const isMaths =
      subtopic.subject?.toLowerCase().includes('maths') ||
      subtopic.subject?.toLowerCase().includes('math');

    // Route to the correct prompt builder
    let systemPrompt: string;

    if (isFoundation && isMaths) {
      if (calculatorAllowed) {
        // Calculator sessions alternate between P2 and P3 style randomly
        // to give students variety across both calculator paper types
        systemPrompt =
          Math.random() < 0.5
            ? buildFoundationP2Prompt(subtopic, count)
            : buildFoundationP3Prompt(subtopic, count);
      } else {
        systemPrompt = buildFoundationP1Prompt(subtopic, count);
      }
    } else {
      // Higher Maths and all Physics use the legacy prompt
      systemPrompt = buildLegacyPrompt(subtopic, count);
    }

    const userPrompt = `Generate ${count} GCSE exam questions for: "${subtopic.subtopic_name}" (${subtopic.topic}, Pearson Edexcel Foundation tier, grade ${subtopic.grade_band}).

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
      "mark_scheme": [{ "mark_type": "M", "criterion": "string with $LaTeX$", "marks": 1 }],
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
