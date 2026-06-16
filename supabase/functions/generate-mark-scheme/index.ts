// supabase/functions/generate-mark-scheme/index.ts
//
// Generates a JSON mark scheme array for a seeded question.
// Called from AdminProbabilityQuestions.tsx when the admin clicks
// "Generate mark scheme".
//
// Input:
//   questionText   - the full question text
//   marksAvailable - total marks for the question
//   workedSolution - the model worked solution
//   diagramComponent - e.g. 'probability-tree'
//   diagramParams  - the full diagram_params JSONB object
//   examBoard      - 'Edexcel' or 'AQA'
//   subject        - 'Maths' or 'Physics'
//   tier           - 'Foundation' or 'Higher'
//
// Output:
//   { markScheme: Array<{ criterion: string }> }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { headers: corsHeaders });

  try {
    const {
      questionText,
      marksAvailable,
      workedSolution,
      diagramComponent,
      diagramParams,
      examBoard = 'Edexcel',
      subject = 'Maths',
      tier = 'Foundation',
    } = await req.json();

    if (!questionText || !marksAvailable) {
      throw new Error('questionText and marksAvailable are required');
    }

    const isProbabilityTree = diagramComponent === 'probability-tree';

    // Build a description of hidden branches for the prompt
    let hiddenBranchDescription = '';
    if (isProbabilityTree && diagramParams?.stages) {
      const hiddenBranches: string[] = [];
      const stages = diagramParams.stages as Array<{
        branches?: Array<{
          outcome?: string;
          probability?: { num: number; den: number };
          hidden?: boolean;
          fromOutcome?: string;
        }>;
      }>;

      stages.forEach((stage, stageIdx) => {
        stage.branches?.forEach((b) => {
          if (b.hidden) {
            const label =
              stageIdx === 0
                ? `P(${b.outcome}) on first event = ${b.probability?.num}/${b.probability?.den}`
                : `P(${b.outcome} | ${b.fromOutcome}) on second event = ${b.probability?.num}/${b.probability?.den}`;
            hiddenBranches.push(label);
          }
        });
      });

      if (hiddenBranches.length > 0) {
        hiddenBranchDescription = `\n\nHIDDEN BRANCHES (student must fill these in):\n${hiddenBranches.map((b, i) => `${i + 1}. ${b}`).join('\n')}`;
      }
    }

    const systemPrompt = `You are an experienced ${examBoard} GCSE ${subject} examiner writing a mark scheme for a ${tier} tier question.

Your job is to write a mark scheme as a JSON array of criterion objects. Each object has a single "criterion" field containing the mark description in plain English suitable for a 14-16 year old student to read.

RULES:
1. Write exactly ${marksAvailable} criterion objects — one per mark.
2. Use plain English. No branch IDs like s1-0 or s2-2. Describe branches by what they represent (e.g. "P(Red) on first spin").
3. For probability tree questions with hidden branches:
   - The first mark is ALWAYS for completing the tree correctly (all hidden branches correct, all or nothing). State the correct values explicitly.
   - Subsequent marks are for method (written multiplication shown) and accuracy (correct final answer).
   - The tree completion mark must say "Award 1 mark only if ALL entries are correct. Not awarded if any branch is incorrect or missing."
   - Method marks must say "Must be explicitly shown in written working — not awarded if working area is blank."
   - Accuracy marks must say "Not awarded if working area is blank."
4. For non-diagram questions: follow standard ${examBoard} mark type conventions (M, A, B marks for Maths; step marks for Physics).
5. Do not include a TOTAL row.
6. Return ONLY a JSON array. No markdown, no preamble, no explanation.

Example output for a 3-mark probability tree question:
[
  {"criterion": "All hidden branches correctly filled: P(Red) on first spin = 4/6 or 2/3, P(Red) on second spin after Red = 4/6 or 2/3. Award 1 mark only if ALL entries are correct. Not awarded if any branch is incorrect or missing."},
  {"criterion": "Written working shows multiplication along the correct path, e.g. (4/6) × (4/6) or equivalent. Must be explicitly shown in written working — not awarded if working area is blank."},
  {"criterion": "Correct final answer: 16/36 or 4/9 or equivalent. Not awarded if working area is blank."}
]`;

    const userPrompt = `Write a ${marksAvailable}-mark mark scheme for this question.

QUESTION:
${questionText}
${hiddenBranchDescription}

WORKED SOLUTION:
${workedSolution || 'Not provided.'}

Return only the JSON array of ${marksAvailable} criterion objects.`;

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API returned ${response.status}: ${text}`);
    }

    const result = await response.json();
    const rawText = result.content?.[0]?.text;
    if (!rawText) throw new Error('Empty response from Claude');

    const cleaned = rawText
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    let markScheme: unknown;
    try {
      markScheme = JSON.parse(cleaned);
    } catch {
      throw new Error('Claude returned malformed JSON');
    }

    if (!Array.isArray(markScheme)) {
      throw new Error('Claude response is not an array');
    }

    return new Response(JSON.stringify({ markScheme }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-mark-scheme error:', e);
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
