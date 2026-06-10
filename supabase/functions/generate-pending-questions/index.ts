import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ─────────────────────────────────────────────
// SHARED CONSTANTS
// ─────────────────────────────────────────────

const FOUNDATION_SHARED_LATEX_RULES = `
CRITICAL — MATHEMATICAL NOTATION:
You MUST use LaTeX notation for ALL mathematical expressions in question_text, mark_scheme criteria, and worked_solution.
In JSON strings, backslashes MUST be escaped as double backslashes (\\\\).

Correct JSON examples:
Multiplication sign: "$3 \\\\times 2$"
Fractions: "$\\\\frac{3}{4}$"
Powers: "$x^2$", "$10^3$"
Square root: "$\\\\sqrt{50}$"
Units: "$cm^2$", "$m/s$"

NEVER use single backslashes in JSON strings.
NEVER use plain text for mathematical expressions.
`;

const HIGHER_SHARED_LATEX_RULES = FOUNDATION_SHARED_LATEX_RULES;

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

NEVER use \\times with a single backslash — always use \\\\times
NEVER use plain text such as "v squared" — use $v^2$
NEVER use plain text fractions such as "12/0.4" — use $\\\\frac{12}{0.4}$ where appropriate

WORKED SOLUTION FORMAT:
Write each step on a separate line using \\n between steps.
One calculation step per line.
`;

const FOUNDATION_OUTPUT_FORMAT = `
OUTPUT FORMAT — CRITICAL:
Output exactly {COUNT} JSON objects, one per line, no wrapping array, no markdown, no preamble.

Each JSON object must follow this exact structure:
{"question_text":"...","marks":2,"parts":[],"mark_scheme":[{"mark_type":"M","criterion":"...","marks":1},{"mark_type":"A","criterion":"...","marks":1},{"mark_type":"TOTAL","criterion":"TOTAL","marks":2}],"worked_solution":"..."}

For multi-part questions:
{"question_text":"shared stem only","marks":5,"parts":[{"part_label":"a","part_text":"...","marks":2,"mark_scheme":[...],"worked_solution":"..."},{"part_label":"b","part_text":"...","marks":3,"mark_scheme":[...],"worked_solution":"..."}],"mark_scheme":[],"worked_solution":""}
`;

const HIGHER_OUTPUT_FORMAT = `
OUTPUT FORMAT — CRITICAL:
Output exactly {COUNT} JSON objects, one per line, no wrapping array, no markdown, no preamble.

Each JSON object must follow this exact structure:
{"question_text":"...","marks":2,"parts":[],"mark_scheme":[{"mark_type":"M","criterion":"...","marks":1},{"mark_type":"A","criterion":"...","marks":1},{"mark_type":"TOTAL","criterion":"TOTAL","marks":2}],"worked_solution":"..."}

For multi-part questions:
{"question_text":"shared stem only","marks":5,"parts":[{"part_label":"a","part_text":"...","marks":2,"mark_scheme":[...],"worked_solution":"..."},{"part_label":"b","part_text":"...","marks":3,"mark_scheme":[...],"worked_solution":"..."}],"mark_scheme":[],"worked_solution":""}

OPTIONAL DIAGRAM FIELDS:
For a quadratic inequality question whose worked solution uses the sketch-the-curve method, add two extra top-level fields so the platform can render the sketch alongside the worked solution:
"diagram_component":"quadratic-inequality-graph","diagram_params":{"roots":[r1,r2],"a":1,"inequality":"<"}
- "roots": the two critical values (x-intercepts) as numbers, smaller value first
- "a": the leading coefficient of the quadratic (e.g. 1 or -1), determines whether the parabola opens upwards or downwards
- "inequality": one of "<", ">", "<=", ">=" — the direction of the original inequality after rearranging so one side is zero
Omit both fields entirely for any question that is not a quadratic inequality solved by sketching a parabola.
`;

const PHYSICS_OUTPUT_FORMAT = `
OUTPUT FORMAT — CRITICAL:
Output exactly {COUNT} JSON objects, one per line, no wrapping array, no markdown, no preamble.

Each JSON object must follow this exact structure:
{"question_text":"...","marks":2,"parts":[],"mark_scheme":[{"mark_type":"step","criterion":"...","marks":1},{"mark_type":"step","criterion":"...","marks":1},{"mark_type":"step","criterion":"TOTAL","marks":2}],"worked_solution":"..."}

For multi-part questions:
{"question_text":"shared stem only","marks":5,"parts":[{"part_label":"a","part_text":"...","marks":2,"mark_scheme":[...],"worked_solution":"..."},{"part_label":"b","part_text":"...","marks":3,"mark_scheme":[...],"worked_solution":"..."}],"mark_scheme":[],"worked_solution":""}
`;

// ─────────────────────────────────────────────
// PROMPT BUILDERS — copied from generate-questions
// ─────────────────────────────────────────────

function buildFoundationP1Prompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Foundation tier Paper 1 (Non-Calculator). Your task is to generate exactly ${count} exam questions that are authentic Pearson Edexcel 1MA1/1F style. These questions will be reviewed by a qualified teacher before students see them.

Subject: ${subtopic.subject}
Tier: Foundation
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate questions that directly test this topic at Foundation tier grade band ${subtopic.grade_band}.`}

${promptConfig.marking_guidance ? `SUBTOPIC-SPECIFIC MARKING GUIDANCE — apply this when writing the mark scheme and worked solution, highest priority:\n${promptConfig.marking_guidance}\n` : ''}
${FOUNDATION_SHARED_LATEX_RULES}
${FOUNDATION_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
}

function buildFoundationP2Prompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Foundation tier Paper 2 (Calculator). Your task is to generate exactly ${count} exam questions that are authentic Pearson Edexcel 1MA1/2F style. These questions will be reviewed by a qualified teacher before students see them.

Subject: ${subtopic.subject}
Tier: Foundation
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate questions that directly test this topic at Foundation tier grade band ${subtopic.grade_band}.`}

${promptConfig.marking_guidance ? `SUBTOPIC-SPECIFIC MARKING GUIDANCE — apply this when writing the mark scheme and worked solution, highest priority:\n${promptConfig.marking_guidance}\n` : ''}
${FOUNDATION_SHARED_LATEX_RULES}
${FOUNDATION_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
}

function buildFoundationP3Prompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Foundation tier Paper 3 (Calculator). Your task is to generate exactly ${count} exam questions that are authentic Pearson Edexcel 1MA1/3F style. These questions will be reviewed by a qualified teacher before students see them.

Subject: ${subtopic.subject}
Tier: Foundation
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate questions that directly test this topic at Foundation tier grade band ${subtopic.grade_band}.`}

${promptConfig.marking_guidance ? `SUBTOPIC-SPECIFIC MARKING GUIDANCE — apply this when writing the mark scheme and worked solution, highest priority:\n${promptConfig.marking_guidance}\n` : ''}
${FOUNDATION_SHARED_LATEX_RULES}
${FOUNDATION_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
}

function buildHigherP1Prompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Higher tier Paper 1 (Non-Calculator). Your task is to generate exactly ${count} exam questions that are authentic Pearson Edexcel 1MA1/1H style. These questions will be reviewed by a qualified teacher before students see them.

Subject: ${subtopic.subject}
Tier: Higher
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate questions that directly test this topic at Higher tier grade band ${subtopic.grade_band}.`}

${promptConfig.marking_guidance ? `SUBTOPIC-SPECIFIC MARKING GUIDANCE — apply this when writing the mark scheme and worked solution, highest priority:\n${promptConfig.marking_guidance}\n` : ''}
${HIGHER_SHARED_LATEX_RULES}
${HIGHER_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
}

function buildHigherP2Prompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Higher tier Paper 2 (Calculator). Your task is to generate exactly ${count} exam questions that are authentic Pearson Edexcel 1MA1/2H style. These questions will be reviewed by a qualified teacher before students see them.

Subject: ${subtopic.subject}
Tier: Higher
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate questions that directly test this topic at Higher tier grade band ${subtopic.grade_band}.`}

${promptConfig.marking_guidance ? `SUBTOPIC-SPECIFIC MARKING GUIDANCE — apply this when writing the mark scheme and worked solution, highest priority:\n${promptConfig.marking_guidance}\n` : ''}
${HIGHER_SHARED_LATEX_RULES}
${HIGHER_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
}

function buildHigherP3Prompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  return `You are an expert Pearson Edexcel GCSE Mathematics question writer for Higher tier Paper 3 (Calculator). Your task is to generate exactly ${count} exam questions that are authentic Pearson Edexcel 1MA1/3H style. These questions will be reviewed by a qualified teacher before students see them.

Subject: ${subtopic.subject}
Tier: Higher
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

TOPICS IN SCOPE FOR THIS SUBTOPIC
${promptConfig.system_prompt || `Topic: ${subtopic.subtopic_name}. Generate questions that directly test this topic at Higher tier grade band ${subtopic.grade_band}.`}

${promptConfig.marking_guidance ? `SUBTOPIC-SPECIFIC MARKING GUIDANCE — apply this when writing the mark scheme and worked solution, highest priority:\n${promptConfig.marking_guidance}\n` : ''}
${HIGHER_SHARED_LATEX_RULES}
${HIGHER_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
}

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
  if (paper1Terms.some((term) => haystack.includes(term))) return 'paper1';
  return 'paper2';
}

function normalisePhysicsTier(subtopic: any): 'foundation' | 'higher' {
  const fromSubtopic = String(subtopic.tier || '').toLowerCase();
  if (fromSubtopic.includes('higher')) return 'higher';
  return 'foundation';
}

function buildPhysicsPrompt(subtopic: any, count: number): string {
  const promptConfig = subtopic.prompt_config || {};
  const tier = normalisePhysicsTier(subtopic);
  const paper = inferPhysicsPaper(subtopic);
  const tierLabel = tier === 'foundation' ? 'Foundation' : 'Higher';
  const paperLabel = paper === 'paper1' ? 'Paper 1' : 'Paper 2';

  return `You are a senior AQA GCSE Physics examiner writing questions for AQA 8463 ${tierLabel} Tier ${paperLabel}.
Your task is to generate exactly ${count} exam-style questions for The Hub Jam. These questions will be reviewed by a qualified teacher before students see them.

Subject: ${subtopic.subject}
Exam board: AQA
Tier: ${tierLabel}
Paper: ${paperLabel}
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

TOPICS IN SCOPE FOR THIS SUBTOPIC:
${promptConfig.system_prompt || `Generate questions that directly test ${subtopic.subtopic_name} within ${subtopic.topic}.`}

${promptConfig.marking_guidance ? `\nSUBTOPIC-SPECIFIC MARKING GUIDANCE:\n${promptConfig.marking_guidance}` : ''}

${PHYSICS_SHARED_LATEX_RULES}
${PHYSICS_OUTPUT_FORMAT.replace('{COUNT}', String(count))}`;
}

// ─────────────────────────────────────────────
// CLAUDE CALL — collect full response (no streaming)
// ─────────────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
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
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API returned ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

// ─────────────────────────────────────────────
// PARSE NDJSON RESPONSE
// ─────────────────────────────────────────────

function parseQuestions(raw: string): any[] {
  const questions: any[] = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const q = JSON.parse(trimmed);
      if (q.question_text && q.marks !== undefined) {
        questions.push(q);
      }
    } catch {
      // skip malformed lines
    }
  }
  return questions;
}

// ─────────────────────────────────────────────
// BUILD PROMPTS FOR A BATCH
// Two Claude calls for Maths: one non-calc, one calc
// One Claude call for Physics
// ─────────────────────────────────────────────

function buildUserPrompt(
  subtopic: any,
  count: number,
  isPhysics: boolean
): string {
  const examBoard = isPhysics ? 'AQA' : 'Pearson Edexcel';
  const markTypeExample = isPhysics ? 'step' : 'M';

  return `Generate ${count} GCSE exam questions for: "${subtopic.subtopic_name}" (${subtopic.topic}, ${examBoard} ${subtopic.tier} tier, grade ${subtopic.grade_band}).

REMINDER: All mathematical expressions MUST use LaTeX with double-escaped backslashes in JSON.

Critical examples:
- Multiplication: "$3x^4 \\\\times 2x^3$" — NOT "$3x^4 \\times 2x^3$"
- Square root: "$\\\\sqrt{50}$" — NOT "$\\sqrt{50}$"
- Fraction: "$\\\\frac{3}{4}$" — NOT "$\\frac{3}{4}$"

MANDATORY COUNT REQUIREMENT:
You MUST output EXACTLY ${count} JSON objects — one per line.
Count them before finishing. Do not stop until all ${count} questions are written.

Output ${count} JSON objects, one per line, no wrapping array. No markdown, no preamble.
Mark type to use: "${markTypeExample}"`;
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { headers: corsHeaders });

  try {
    const { subtopicId, count = 20 } = await req.json();

    if (!subtopicId) throw new Error('subtopicId is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch subtopic
    const { data: subtopic, error: stError } = await supabase
      .from('subtopics')
      .select('*')
      .eq('id', subtopicId)
      .single();

    if (stError || !subtopic) throw new Error('Subtopic not found');

    const isMaths = subtopic.subject?.toLowerCase().includes('math');
    const isPhysics = subtopic.subject?.toLowerCase().includes('physics');
    const promptVersion = `v1-${subtopic.tier?.toLowerCase()}-${isMaths ? 'maths' : 'physics'}`;

    // ── Create batch record ──
    const { data: batch, error: batchError } = await supabase
      .from('generation_batches')
      .insert({
        subtopic_id: subtopicId,
        tier: subtopic.tier,
        prompt_version: promptVersion,
        question_count: 0,
        status: 'pending',
      })
      .select()
      .single();

    if (batchError || !batch) throw new Error('Failed to create batch record');

    // ── Generate questions ──
    let allQuestions: any[] = [];

    try {
      if (isMaths) {
        // Non-calculator half
        const nonCalcCount = Math.ceil(count / 2);
        const calcCount = Math.floor(count / 2);

        const isFoundation = subtopic.tier?.toLowerCase() === 'foundation';
        const isHigher = subtopic.tier?.toLowerCase() === 'higher';

        // Non-calculator call (P1)
        const p1Prompt = isFoundation
          ? buildFoundationP1Prompt(subtopic, nonCalcCount)
          : buildHigherP1Prompt(subtopic, nonCalcCount);

        const p1Raw = await callClaude(
          p1Prompt,
          buildUserPrompt(subtopic, nonCalcCount, false)
        );
        const p1Questions = parseQuestions(p1Raw).map((q) => ({
          ...q,
          calculator_allowed: false,
        }));

        // Calculator call (P2 or P3, alternating)
        const useP2 = Math.random() < 0.5;
        const calcPrompt = isFoundation
          ? useP2
            ? buildFoundationP2Prompt(subtopic, calcCount)
            : buildFoundationP3Prompt(subtopic, calcCount)
          : useP2
            ? buildHigherP2Prompt(subtopic, calcCount)
            : buildHigherP3Prompt(subtopic, calcCount);

        const calcRaw = await callClaude(
          calcPrompt,
          buildUserPrompt(subtopic, calcCount, false)
        );
        const calcQuestions = parseQuestions(calcRaw).map((q) => ({
          ...q,
          calculator_allowed: true,
        }));

        allQuestions = [...p1Questions, ...calcQuestions];
      } else if (isPhysics) {
        const physicsPrompt = buildPhysicsPrompt(subtopic, count);
        const raw = await callClaude(
          physicsPrompt,
          buildUserPrompt(subtopic, count, true)
        );
        allQuestions = parseQuestions(raw);
      }
    } catch (genError) {
      // Mark batch as failed
      await supabase
        .from('generation_batches')
        .update({ status: 'failed' })
        .eq('id', batch.id);
      throw genError;
    }

    if (allQuestions.length === 0) {
      await supabase
        .from('generation_batches')
        .update({ status: 'failed' })
        .eq('id', batch.id);
      throw new Error('No questions parsed from Claude response');
    }

    // ── Insert pending questions ──
    const rows = allQuestions.map((q, i) => ({
      batch_id: batch.id,
      subtopic_id: subtopicId,
      question_text: q.question_text,
      marks: q.marks,
      mark_scheme: q.mark_scheme ?? [],
      worked_solution: q.worked_solution ?? '',
      parts: q.parts ?? [],
      calculator_allowed: q.calculator_allowed ?? null,
      diagram_component: q.diagram_component ?? null,
      diagram_params: q.diagram_params ?? null,
      status: 'pending',
      prompt_version: promptVersion,
    }));

    const { error: insertError } = await supabase
      .from('pending_questions')
      .insert(rows);

    if (insertError) {
      await supabase
        .from('generation_batches')
        .update({ status: 'failed' })
        .eq('id', batch.id);
      throw new Error(`Failed to insert questions: ${insertError.message}`);
    }

    // ── Update batch as complete ──
    await supabase
      .from('generation_batches')
      .update({ status: 'complete', question_count: allQuestions.length })
      .eq('id', batch.id);

    return new Response(
      JSON.stringify({ batchId: batch.id, questionCount: allQuestions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('generate-pending-questions error:', e);
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
