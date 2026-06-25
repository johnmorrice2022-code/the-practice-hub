import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Phase 2 of the deterministic-marking project (STEPPED_QUESTIONS.md).
//
// Proposes stepped_calculation DRAFTS — equation choice + substitution +
// final numeric answer, with misconception distractors and pre-written hints —
// straight into pending_questions for review in the Review Queue. The platform
// (not this function, and never the marking AI) checks these answers
// deterministically once published; this function only AUTHORS the scaffold.
//
// Every draft is structurally validated here before insert; malformed ones are
// dropped and counted. The Review Queue editor (validateSteppedQuestion) is the
// second gate and a teacher is the third — nothing reaches a student unreviewed.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// One of 6 places the model id lives — keep in sync (see CLAUDE.md "All AI
// functions returning 500 simultaneously").
const MODEL = 'claude-sonnet-4-6';

// ─────────────────────────────────────────────
// PROMPT
// ─────────────────────────────────────────────

function buildSteppedPrompt(
  subtopic: any,
  count: number,
  tier: 'foundation' | 'higher'
): string {
  const promptConfig = subtopic.prompt_config || {};
  const tierLabel = tier === 'higher' ? 'Higher' : 'Foundation';

  // The examiner-flagged misconceptions for this subtopic — the best source for
  // spec-accurate distractor equations, distractor tiles and wrong-answer hints.
  const misconceptions = [
    promptConfig.marking_guidance,
    promptConfig.common_mistakes,
  ]
    .filter((x: any) => typeof x === 'string' && x.trim())
    .join('\n');

  const tierGuidance =
    tier === 'higher'
      ? `These are HIGHER tier. Challenge through the PHYSICS, never by removing the scaffold:
- rearrangement (e.g. ask for current from P and V, so the chosen equation is I = P / V),
- multi-equation chains (e.g. P = I V then E = P t — an intermediate numeric step feeds the next substitute),
- unit conversion built into a step (minutes to seconds, kW to W, cm to m),
- less friendly numbers.`
      : `These are FOUNDATION tier. Keep the physics gentle:
- one equation, used in its given form (no rearrangement),
- direct substitution,
- friendly whole numbers that divide/multiply cleanly,
- one idea per question.`;

  return `You are a senior AQA GCSE Physics examiner authoring STEPPED CALCULATION questions for The Hub Jam — AQA 8463 ${tierLabel} tier.

Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}

A stepped question breaks a calculation into deterministic steps the platform can mark itself: choose the equation, substitute the values, give the final answer with its unit. A wrong step shows a pre-written misconception hint. Your job is to author ${count} of these, well-formed and internally consistent.

${tierGuidance}

PHYSICS CONTEXT FOR THIS SUBTOPIC (equations, vocabulary, scope):
${promptConfig.system_prompt || `Calculations within ${subtopic.subtopic_name}.`}
${
  misconceptions
    ? `\nKNOWN MISCONCEPTIONS FOR THIS SUBTOPIC (from the subtopic's marking guidance) — base your DISTRACTORS and HINTS on these so they target the mistakes a real AQA examiner sees, not generic ones: the wrong choose_equation options, the substitute distractorValues, and the numeric "distractors"/"hint" text should reflect a misconception listed here whenever a relevant one exists:\n${misconceptions}\n`
    : ''
}
OUTPUT — one JSON object PER LINE (NDJSON). No array, no markdown, no preamble. Each object EXACTLY:
{"question_text":"<exam-style prose containing the numbers and units>","marks":<int>,"worked_solution":"<full method, one line per step, $…$ LaTeX, \\n between lines>","mark_scheme":[{"mark":"step","criterion":"..."}],"steps":{"given":[{"symbol":"I","value":2,"unit":"A","label":"current"}],"show_givens":true,"steps":[ <ordered steps> ]}}

The "steps.steps" array is the scaffold. For a calculation use this order (ending in ONE numeric final answer):

1) choose_equation — pick the correct formula:
{"id":"equation","kind":"choose_equation","prompt":"Which equation links power, current and potential difference?","options":[{"id":"o1","latex":"P = I \\\\times V","correct":true},{"id":"o2","latex":"P = \\\\frac{V}{I}","hint":"Power isn't a ratio here — look at how the two quantities combine."},{"id":"o3","latex":"P = I^2 R","hint":"That one needs resistance — check what the question actually gives you."}],"hint":"Look at the two quantities you are given and the one you need."}
- EXACTLY ONE option has "correct":true. The others are plausible wrong formulas, each with a misconception "hint" that NEVER states the answer.

2) substitute — put the numbers into the formula:
{"id":"substitute","kind":"substitute","prompt":"Substitute the values into $P = I \\\\times V$.","expression":"P = [I] \\\\times [V]","slots":[{"slot":"I","value":2},{"slot":"V","value":12}],"distractorValues":[6,24],"hint":"The current goes where I is; the potential difference where V is."}
- "expression" is the formula in LaTeX with [slot] placeholders.
- EVERY [slot] in "expression" MUST appear in "slots" with its correct value (= the matching given value).
- "distractorValues" are extra wrong number tiles (common slips), not the right values.

3) numeric — the ONE final answer and its unit (this is the ONLY numeric step):
{"id":"answer","kind":"numeric","prompt":"Calculate the power. Give the unit.","value":24,"tolerance":0,"unit":"W","acceptedUnits":["W","watt","watts"],"hint":"Multiply your two numbers, then give the unit of power.","distractors":[{"value":6,"hint":"Check whether you divided — power here multiplies the two quantities."}]}
- "value" MUST be the correct arithmetic result of the substitution.
- "acceptedUnits" lists accepted spellings of the unit.
- "distractors" are common WRONG final answers, each with a specific misconception hint.

RULES — read carefully:
- INTERNAL CONSISTENCY IS CRITICAL: every given value = its substitute slot value; the numeric "value" = the correct computation of the substituted expression. Double-check the arithmetic before writing the line.
- THE SUBSTITUTE EXPRESSION MUST BE FULLY SUBSTITUTABLE: every quantity on the right-hand side MUST be a [slot]. NEVER leave a bare symbol (e.g. do not write "F = [m] \\\\times a"). If the unknown is NOT the subject of the standard formula (e.g. you are given F and m and must find a), REARRANGE first: make the correct choose_equation option the rearranged form (e.g. "a = \\\\frac{F}{m}") and substitute into THAT, so the expression becomes "a = \\\\frac{[F]}{[m]}". This applies at Foundation too — present the equation already rearranged for the unknown.
- EXACTLY ONE FINAL ANSWER: the scaffold contains exactly ONE numeric step — the final answer. A 5-6 mark question STILL has only ONE final answer; the extra marks reward the WORKING (more than one equation, or a rearrangement), NOT extra answers. NEVER add a numeric step for an intermediate value.
- INTERMEDIATE VALUES ARE WORKING, NOT ANSWERS: a temperature change (Δθ = T2 − T1), a unit conversion (minutes → seconds, g → kg), or a first-equation result (P before E) is working. Compute it YOURSELF and put the RESULT straight into the substitute slot value, adding a distractor tile for the common wrong value (e.g. the final temperature instead of Δθ, or 650 instead of 0.65). Show that computation in worked_solution — never as a numeric step.
- COMBINE multi-equation methods into ONE expression wherever clean: find E from I, V, t with "E = [I] \\\\times [V] \\\\times [t]" (one substitute, one answer), NOT P=IV then E=Pt as two answers; find F from m, v, u, t with "F = \\\\frac{[m] \\\\times ([v] - [u])}{[t]}". One choose_equation (the combined/rearranged form), one substitute, one numeric.
- worked_solution = the FULL method as the breakdown: one line per step, $…$ LaTeX, \\n between lines — state the equation, show the substitution with the real numbers (including any Δθ / conversion working), then the final answer with unit. This is what the student sees on the mark screen.
- mark_scheme = AQA style, ONE mark per genuine step, as an array of {"mark":"step","criterion":"..."} (e.g. computes Δθ; substitutes into the equation; correct final answer with unit). The count of marking points should equal "marks".
- "marks" = what AQA would award: typically 2-3 for a one-equation calculation, 4-6 for a method needing a rearrangement or two combined equations — but always ONE final answer.
- Misconception hints must NEVER reveal the answer — they nudge. Where a KNOWN MISCONCEPTION is listed above, your distractors and hints must reflect it.
- "question_text" is natural exam prose that contains the numbers and units. Do NOT pre-label them as "given: I = 2 A" — the student extracts them. Still list them in "given" for the scaffold.
- LaTeX in JSON: EVERY backslash MUST be doubled — write "\\\\times", "\\\\frac{a}{b}", "\\\\Delta", "\\\\Omega". Never a single backslash.
- ALL numeric values — every given "value", substitute slot "value", "distractorValues", numeric "value"/"tolerance", and distractor "value" — MUST be plain JSON numbers, e.g. 334000 or 3.34e5. NEVER write a value as LaTeX or standard-form text such as "3.34 \\\\times 10^5" (common for specific latent heat / large quantities — use 334000 or 3.34e5 instead).
- step "id"s must be unique within a question.
- Output EXACTLY ${count} objects, one per line.`;
}

// ─────────────────────────────────────────────
// CLAUDE CALL
// ─────────────────────────────────────────────

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
            'Author the stepped calculation questions now. One JSON object per line, internally consistent arithmetic, double-escaped LaTeX backslashes.',
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

// ─────────────────────────────────────────────
// PARSE + VALIDATE
// ─────────────────────────────────────────────

function parseStepped(raw: string): any[] {
  const out: any[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const q = JSON.parse(trimmed);
      if (q && q.question_text && q.steps) out.push(normaliseStepped(q));
    } catch {
      // skip malformed lines
    }
  }
  return out;
}

// Claude occasionally emits a numeric field as a string (e.g. distractor
// "value":"0.067"). Coerce numeric-looking strings so the deterministic checker
// (strict ===) matches student input. Leaves genuine non-numbers untouched so
// validation can still reject them.
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
function normaliseStepped(q: any): any {
  const sq = q.steps;
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
  q.marks = num(q.marks);
  return q;
}

// Structural gate — mirrors src/lib/steppedQuestion.ts validateSteppedQuestion,
// plus calculation-specific checks (slot-in-expression, ends with numeric).
function validateStepped(q: any): string[] {
  const errors: string[] = [];
  if (typeof q.marks !== 'number' || q.marks < 1)
    errors.push('marks must be a positive number');

  const sq = q.steps;
  if (!sq || typeof sq !== 'object') return [...errors, 'steps is not an object'];
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
      case 'substitute':
        if (!Array.isArray(step.slots) || step.slots.length === 0) {
          errors.push(`${where}: needs at least one slot`);
        } else {
          for (const s of step.slots) {
            if (!String(step.expression || '').includes(`[${s.slot}]`))
              errors.push(`${where}: slot "${s.slot}" not found in expression`);
            if (typeof s.value !== 'number')
              errors.push(`${where}: slot "${s.slot}" value must be a number`);
          }
          // The right-hand side must be fully substitutable: every value-carrying
          // symbol is a [slot]. A bare leftover variable (e.g. "F = [m] \times a"
          // when solving for a non-subject quantity) is un-fillable and confusing
          // — reject it. Strip placeholders, LaTeX commands, numbers and operators;
          // any remaining letter is an unfilled variable.
          const rhs = String(step.expression || '').split('=').slice(1).join('=');
          const residue = rhs
            .replace(/\[[^\]]*\]/g, '') // [slot] placeholders
            .replace(/\\[a-zA-Z]+/g, '') // \times, \frac, \Delta, …
            .replace(/[0-9.]/g, '')
            .replace(/[+\-*/()=^_{}\s,]/g, '');
          if (/[a-zA-Z]/.test(residue))
            errors.push(
              `${where}: expression has a non-slot symbol "${residue}" — every value on the right must be a [slot] (rearrange the equation so the unknown is the subject)`
            );
        }
        break;
      case 'numeric':
        if (typeof step.value !== 'number')
          errors.push(`${where}: numeric value must be a number`);
        break;
      default:
        errors.push(`${where}: unsupported step kind "${step.kind}"`);
    }
  });

  // Exactly ONE final answer — intermediate values are working, not answers.
  const numericCount = sq.steps.filter((s: any) => s?.kind === 'numeric').length;
  if (numericCount !== 1)
    errors.push(
      `a calculation must have exactly one numeric (final answer) step — found ${numericCount}`
    );
  if (sq.steps[sq.steps.length - 1]?.kind !== 'numeric')
    errors.push('the final step must be the numeric answer');

  return errors;
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { headers: corsHeaders });

  try {
    const { subtopicId, count = 6 } = await req.json();
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

    const tierRaw = (subtopic.tier || '').toLowerCase();
    const promptVersion = `stepped-v1-${tierRaw || 'both'}`;

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

    // Generate. "Both" tier → split Foundation + Higher, mirroring the AI pipeline.
    let drafts: any[] = [];
    try {
      const calls: { tier: 'foundation' | 'higher'; n: number }[] =
        tierRaw === 'higher'
          ? [{ tier: 'higher', n: count }]
          : tierRaw === 'foundation'
            ? [{ tier: 'foundation', n: count }]
            : [
                { tier: 'foundation', n: Math.ceil(count / 2) },
                { tier: 'higher', n: Math.floor(count / 2) },
              ];

      for (const c of calls) {
        if (c.n < 1) continue;
        const raw = await callClaude(buildSteppedPrompt(subtopic, c.n, c.tier));
        const tierLabel = c.tier === 'higher' ? 'Higher' : 'Foundation';
        for (const q of parseStepped(raw)) {
          drafts.push({ ...q, tier: tierLabel });
        }
      }
    } catch (genError) {
      await supabase
        .from('generation_batches')
        .update({ status: 'failed' })
        .eq('id', batch.id);
      throw genError;
    }

    // Validate; drop malformed drafts (logged for the response).
    const valid: any[] = [];
    const dropped: string[] = [];
    for (const q of drafts) {
      const errs = validateStepped(q);
      if (errs.length === 0) valid.push(q);
      else dropped.push(`"${(q.question_text || '').slice(0, 50)}…": ${errs.join('; ')}`);
    }
    if (dropped.length)
      console.warn('generate-stepped-questions dropped drafts:', dropped);

    if (valid.length === 0) {
      await supabase
        .from('generation_batches')
        .update({ status: 'failed' })
        .eq('id', batch.id);
      throw new Error(
        `No valid stepped drafts parsed (parsed ${drafts.length}, all failed validation)`
      );
    }

    const rows = valid.map((q) => ({
      batch_id: batch.id,
      subtopic_id: subtopicId,
      question_text: q.question_text,
      marks: q.marks,
      // Store the authored examiner breakdown so the mark screen shows the full
      // method (the question itself has ONE final answer).
      mark_scheme: Array.isArray(q.mark_scheme) ? q.mark_scheme : [],
      worked_solution: typeof q.worked_solution === 'string' ? q.worked_solution : '',
      parts: [],
      // Stepped questions are calculator-agnostic; the player bypasses the
      // calculator filter regardless of this flag.
      calculator_allowed: true,
      answer_model: 'stepped_calculation',
      steps: q.steps,
      tier: q.tier ?? null,
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

    await supabase
      .from('generation_batches')
      .update({ status: 'complete', question_count: valid.length })
      .eq('id', batch.id);

    return new Response(
      JSON.stringify({
        batchId: batch.id,
        questionCount: valid.length,
        dropped: dropped.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('generate-stepped-questions error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
