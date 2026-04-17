import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { headers: corsHeaders });

  try {
    const { subtopicId, count = 4 } = await req.json();
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

    const systemPrompt = `You are a senior ${boardLabel} GCSE ${subtopic.subject} examiner writing questions for ${subtopic.tier} tier, grade band ${subtopic.grade_band}.

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
  "question_text": "Stem text with $LaTeX$",
  "marks": 3,
  "parts": [
    { "part_label": "a", "part_text": "(a) Part text with $LaTeX$", "marks": 2 },
    { "part_label": "b", "part_text": "(b) Part text with $LaTeX$", "marks": 1 }
  ],
  "mark_scheme": [
    { "mark_type": "M", "part": "a", "criterion": "criterion with $LaTeX$", "marks": 1 },
    { "mark_type": "A", "part": "a", "criterion": "criterion with $LaTeX$", "marks": 1 },
    { "mark_type": "B", "part": "b", "criterion": "criterion with $LaTeX$", "marks": 1 }
  ],
  "worked_solution": "Part (a):\\n$step 1$\\n$step 2$\\nPart (b):\\n$step 1$"
}

RULES:
1. Generate exactly ${count} questions in increasing difficulty
2. Questions must read exactly like real ${boardLabel} past paper questions
3. Use LaTeX notation as shown above — mandatory, not optional
4. \\\\times must always use double escaped backslash — never single
5. At least one question must be multi-part (TYPE 2)
6. Mark schemes must be unambiguous — a second examiner must reach identical marks
7. Worked solution must have one step per line, separated by \\n
8. Return ONLY a JSON object, no markdown, no preamble`;

    const userPrompt = `Generate ${count} GCSE exam questions for: "${subtopic.subtopic_name}" (${subtopic.topic}, ${boardLabel} ${subtopic.tier} tier, grade ${subtopic.grade_band}).

REMINDER: All mathematical expressions MUST use LaTeX with double-escaped backslashes in JSON.

Critical examples:
- Multiplication: "$3x^4 \\\\times 2x^3$" — NOT "$3x^4 \\times 2x^3$"
- Square root: "$\\\\sqrt{50}$" — NOT "$\\sqrt{50}$"
- Fraction: "$\\\\frac{3}{4}$" — NOT "$\\frac{3}{4}$"
- Times symbol: "$\\\\times$" — NOT "$\\times$"

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
