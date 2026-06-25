import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Phase 3 (deterministic marking, STEPPED_QUESTIONS.md). Converts EXISTING live
// AI-marked calculation questions into stepped_calculation drafts, preserving the
// original prose and numbers. Drafts go into pending_questions tagged with
// source_question_id; on approval the Review Queue updates the original live row
// IN PLACE (no duplicate). Non-calculation questions (recall/explain) are skipped
// — they stay AI-marked until select_steps generation exists. Nothing here marks a
// student answer; a teacher reviews every draft before it goes live.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// One of several places the model id lives — keep in sync (see CLAUDE.md).
const MODEL = 'claude-sonnet-4-6';

// Shared scaffold schema (matches generate-stepped-questions).
const SCHEMA_SPEC = `A stepped scaffold breaks a calculation into deterministic steps the platform marks itself: choose the equation, substitute the values, give the final answer with its unit.

"steps" is { "given":[{"symbol":"I","value":2,"unit":"A","label":"current"}], "show_givens":true, "steps":[ <ordered steps> ] }. For a calculation use this order:

1) choose_equation:
{"id":"equation","kind":"choose_equation","prompt":"Which equation links ...?","options":[{"id":"o1","latex":"P = I \\\\times V","correct":true},{"id":"o2","latex":"P = \\\\frac{V}{I}","hint":"<misconception nudge, never the answer>"},{"id":"o3","latex":"...","hint":"..."}],"hint":"<gentle nudge>"}
- EXACTLY ONE option has "correct":true; the rest are plausible wrong formulas, each with a misconception "hint".

2) substitute:
{"id":"substitute","kind":"substitute","prompt":"Substitute into $P = I \\\\times V$.","expression":"P = [I] \\\\times [V]","slots":[{"slot":"I","value":2},{"slot":"V","value":12}],"distractorValues":[6,24],"hint":"..."}
- EVERY [slot] in "expression" MUST appear in "slots" with its correct value.
- EVERY value-carrying symbol on the right MUST be a [slot] — NEVER leave a bare symbol. If the unknown is not the subject, REARRANGE first so the chosen equation and the expression are already solved for the unknown (e.g. "a = \\\\frac{[F]}{[m]}").

3) numeric — the ONE final answer (the ONLY numeric step):
{"id":"answer","kind":"numeric","prompt":"Calculate ... Give the unit.","value":24,"tolerance":0,"unit":"W","acceptedUnits":["W","watt","watts"],"hint":"...","distractors":[{"value":6,"hint":"<misconception nudge>"}]}
- "value" = the correct arithmetic result. "distractors" are common WRONG answers, each with a hint.

EXACTLY ONE FINAL ANSWER — the scaffold has exactly ONE numeric step. Even a 5-6 mark question has ONE final answer; the marks are for the working, not extra answers. Intermediate values (a temperature change Δθ = T2 − T1, a unit conversion, a first-equation result like P before E) are WORKING: compute the value yourself, put the RESULT straight into the substitute slot (with a distractor tile for the common wrong value), and show it in worked_solution — NEVER add a numeric step for it. COMBINE multi-equation methods into one expression where clean (e.g. "E = [I] \\\\times [V] \\\\times [t]", not P=IV then E=Pt).

LaTeX in JSON: EVERY backslash doubled — "\\\\times", "\\\\frac{a}{b}", "\\\\Delta", "\\\\Omega".

ALL numeric values — every given "value", substitute slot "value", "distractorValues", numeric "value"/"tolerance", and distractor "value" — MUST be plain JSON numbers, e.g. 334000 or 3.34e5. NEVER write a value as LaTeX or standard-form text such as "3.34 \\\\times 10^5". For specific latent heat / large quantities use the plain number (334000) or e-notation (3.34e5).`;

function buildConvertPrompt(
  subtopic: any,
  batch: { index: number; question_text: string; worked_solution: string; marks: number }[]
): string {
  const list = batch
    .map(
      (b) =>
        `--- QUESTION ${b.index} (marks: ${b.marks}) ---\nTEXT: ${b.question_text}\nWORKED SOLUTION (for the correct method + numbers): ${b.worked_solution || '(none provided)'}`
    )
    .join('\n\n');

  return `You are a senior AQA GCSE Physics examiner converting EXISTING questions for The Hub Jam into deterministic stepped scaffolds — AQA 8463, topic "${subtopic.topic}", subtopic "${subtopic.subtopic_name}".

${SCHEMA_SPEC}

YOUR TASK: For each numbered question below, decide if it is a SINGLE-ANSWER NUMERIC CALCULATION.
- If YES: author a stepped scaffold for it, using the SAME numbers, equation and final answer as the original (take them from the worked solution). Also write a "worked_solution" (the full method as the breakdown — one line per step, $…$ LaTeX, \\n between lines, including any Δθ / conversion working) and a "mark_scheme" (AQA style, ONE mark per genuine step, array of {"mark":"step","criterion":"..."}, count matching the marks). Output ONE line: {"index":<N>,"worked_solution":"...","mark_scheme":[...],"steps":{ ... }}
- If NO (it asks to explain / describe / state / name / compare, or has no single numeric answer): output ONE line: {"index":<N>,"skip":true}

CRITICAL:
- Keep the original question's numbers and final answer EXACTLY — you are scaffolding the existing question, not inventing a new one.
- Internal consistency: given values = substitute slot values; numeric "value" = the correct computation.
- Output one JSON object per line (NDJSON), one per question, no array, no markdown, no preamble. Cover every question index ${batch[0].index} to ${batch[batch.length - 1].index}.

QUESTIONS:
${list}`;
}

async function callClaude(systemPrompt: string): Promise<string> {
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
      model: MODEL,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content:
            'Convert the questions now. One JSON object per line, every index covered, double-escaped LaTeX backslashes, numbers matching the originals.',
        },
      ],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API returned ${response.status}: ${text}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

function num(v: any): any {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t !== '' && !Number.isNaN(Number(t))) return Number(t); // "334000", "3.34e5"
    // Standard form written as text: "3.34 \times 10^5", "3.34 × 10^{-3}".
    const m = t.match(
      /^(-?\d*\.?\d+)\s*(?:\\times|×|x|\*)\s*10\s*\^?\s*\{?(-?\d+)\}?$/i
    );
    if (m) return Number(m[1]) * Math.pow(10, Number(m[2]));
  }
  return v;
}
function normaliseSteps(sq: any): any {
  if (sq && typeof sq === 'object') {
    if (Array.isArray(sq.given))
      sq.given.forEach((g: any) => (g.value = num(g.value)));
    if (Array.isArray(sq.steps))
      sq.steps.forEach((s: any) => {
        if (s.kind === 'substitute' && Array.isArray(s.slots)) {
          s.slots.forEach((sl: any) => (sl.value = num(sl.value)));
          if (Array.isArray(s.distractorValues))
            s.distractorValues = s.distractorValues.map(num);
        }
        if (s.kind === 'numeric') {
          s.value = num(s.value);
          if (s.tolerance !== undefined) s.tolerance = num(s.tolerance);
          if (Array.isArray(s.distractors))
            s.distractors.forEach((d: any) => (d.value = num(d.value)));
        }
      });
  }
  return sq;
}

function validateSteps(sq: any): string[] {
  const errors: string[] = [];
  if (!sq || typeof sq !== 'object') return ['steps is not an object'];
  if (!Array.isArray(sq.given)) errors.push('given must be an array');
  if (!Array.isArray(sq.steps) || sq.steps.length === 0)
    return [...errors, 'steps.steps must be a non-empty array'];

  const ids = new Set<string>();
  sq.steps.forEach((step: any, i: number) => {
    const where = `step ${i + 1}`;
    if (!step || typeof step !== 'object') {
      errors.push(`${where}: not an object`);
      return;
    }
    if (!step.id) errors.push(`${where}: missing id`);
    else if (ids.has(step.id)) errors.push(`${where}: duplicate id "${step.id}"`);
    else ids.add(step.id);

    switch (step.kind) {
      case 'choose_equation':
        if (!Array.isArray(step.options) || step.options.length < 2)
          errors.push(`${where}: needs at least 2 options`);
        else if (step.options.filter((o: any) => o.correct).length !== 1)
          errors.push(`${where}: must have exactly one correct option`);
        break;
      case 'substitute': {
        if (!Array.isArray(step.slots) || step.slots.length === 0) {
          errors.push(`${where}: needs at least one slot`);
          break;
        }
        for (const s of step.slots) {
          if (!String(step.expression || '').includes(`[${s.slot}]`))
            errors.push(`${where}: slot "${s.slot}" not in expression`);
          if (typeof s.value !== 'number')
            errors.push(`${where}: slot "${s.slot}" value must be a number`);
        }
        const rhs = String(step.expression || '').split('=').slice(1).join('=');
        const residue = rhs
          .replace(/\[[^\]]*\]/g, '')
          .replace(/\\[a-zA-Z]+/g, '')
          .replace(/[0-9.]/g, '')
          .replace(/[+\-*/()=^_{}\s,]/g, '');
        if (/[a-zA-Z]/.test(residue))
          errors.push(`${where}: non-slot symbol "${residue}" on the right`);
        break;
      }
      case 'numeric':
        if (typeof step.value !== 'number')
          errors.push(`${where}: numeric value must be a number`);
        break;
      default:
        errors.push(`${where}: unsupported step kind "${step.kind}"`);
    }
  });
  const numericCount = sq.steps.filter((s: any) => s?.kind === 'numeric').length;
  if (numericCount !== 1)
    errors.push(
      `a calculation must have exactly one numeric (final answer) step — found ${numericCount}`
    );
  if (sq.steps[sq.steps.length - 1]?.kind !== 'numeric')
    errors.push('the final step must be the numeric answer');
  return errors;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { headers: corsHeaders });

  try {
    const { subtopicId } = await req.json();
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

    // Candidate legacy questions: live, AI-marked, single-answer (no parts).
    const { data: liveQs, error: qErr } = await supabase
      .from('questions')
      .select('id, question_text, worked_solution, marks, tier, parts, diagram_component, diagram_params, answer_model')
      .eq('subtopic_id', subtopicId)
      .eq('answer_model', 'ai_freeresponse');
    if (qErr) throw new Error(`Failed to load questions: ${qErr.message}`);

    // Skip questions that already have a pending conversion (idempotent re-runs).
    const { data: existingPending } = await supabase
      .from('pending_questions')
      .select('source_question_id')
      .eq('subtopic_id', subtopicId)
      .eq('status', 'pending')
      .not('source_question_id', 'is', null);
    const alreadyPending = new Set(
      (existingPending ?? []).map((r: any) => r.source_question_id)
    );

    const candidates = (liveQs ?? []).filter(
      (q: any) =>
        (!q.parts || (Array.isArray(q.parts) && q.parts.length === 0)) &&
        !alreadyPending.has(q.id)
    );

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          converted: 0,
          skipped: 0,
          dropped: 0,
          message: 'No new single-answer AI-marked questions to convert.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const indexed = candidates.map((q: any, i: number) => ({ ...q, index: i }));
    const byIndex = new Map(indexed.map((q: any) => [q.index, q]));

    const batch = await supabase
      .from('generation_batches')
      .insert({
        subtopic_id: subtopicId,
        tier: subtopic.tier,
        prompt_version: 'convert-stepped-v1',
        question_count: 0,
        status: 'pending',
      })
      .select()
      .single();
    const batchId = batch.data?.id ?? null;

    // Author scaffolds in small chunks so each Claude response stays within tokens.
    let converted = 0;
    let skipped = 0;
    const dropped: string[] = [];
    const rows: any[] = [];

    try {
      for (const group of chunk(indexed, 5)) {
        const raw = await callClaude(buildConvertPrompt(subtopic, group));
        for (const line of raw.split('\n')) {
          const t = line.trim();
          if (!t) continue;
          let parsed: any;
          try {
            parsed = JSON.parse(t);
          } catch {
            continue;
          }
          if (typeof parsed.index !== 'number') continue;
          const orig: any = byIndex.get(parsed.index);
          if (!orig) continue;

          if (parsed.skip) {
            skipped += 1;
            continue;
          }
          const steps = normaliseSteps(parsed.steps);
          const errs = validateSteps(steps);
          if (errs.length) {
            dropped.push(
              `"${(orig.question_text || '').slice(0, 40)}…": ${errs.join('; ')}`
            );
            continue;
          }
          rows.push({
            batch_id: batchId,
            subtopic_id: subtopicId,
            question_text: orig.question_text,
            marks: orig.marks,
            // Authored breakdown for the mark screen (the question has ONE answer).
            mark_scheme: Array.isArray(parsed.mark_scheme)
              ? parsed.mark_scheme
              : [],
            worked_solution:
              typeof parsed.worked_solution === 'string'
                ? parsed.worked_solution
                : '',
            parts: [],
            calculator_allowed: true,
            answer_model: 'stepped_calculation',
            steps,
            tier: orig.tier ?? null,
            diagram_component: orig.diagram_component ?? null,
            diagram_params: orig.diagram_params ?? null,
            source_question_id: orig.id,
            status: 'pending',
            prompt_version: 'convert-stepped-v1',
          });
          converted += 1;
        }
      }
    } catch (genErr) {
      if (batchId)
        await supabase
          .from('generation_batches')
          .update({ status: 'failed' })
          .eq('id', batchId);
      throw genErr;
    }

    if (rows.length) {
      const { error: insErr } = await supabase
        .from('pending_questions')
        .insert(rows);
      if (insErr) {
        if (batchId)
          await supabase
            .from('generation_batches')
            .update({ status: 'failed' })
            .eq('id', batchId);
        throw new Error(`Failed to insert drafts: ${insErr.message}`);
      }
    }

    if (batchId)
      await supabase
        .from('generation_batches')
        .update({ status: 'complete', question_count: converted })
        .eq('id', batchId);

    if (dropped.length)
      console.warn('convert-legacy-to-stepped dropped:', dropped);

    return new Response(
      JSON.stringify({
        converted,
        skipped,
        dropped: dropped.length,
        droppedReasons: dropped,
        candidates: candidates.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('convert-legacy-to-stepped error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
