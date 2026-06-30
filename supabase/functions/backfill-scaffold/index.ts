import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Backfills the `scaffold` field (STEPPED_QUESTIONS.md §8) onto EXISTING, already
// published ai_freeresponse questions that predate the Scaffold feature (28/06/2026).
// Additive only — never touches question_text, mark_scheme, worked_solution, or
// marks, so it does not reopen pedagogical review of already-approved content.
// Updates the live `questions` row directly (no pending_questions draft/review
// step) because the scaffold itself carries no marking-point content — it is
// vocabulary + a sentence starter, reviewed by construction (the prompt forbids
// answer-revealing content), matching the trust model used everywhere else in
// the deterministic-marking system for non-verdict AI output.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// One of several places the model id lives — keep in sync (see CLAUDE.md).
const MODEL = 'claude-sonnet-4-6';

function buildPrompt(
  subtopic: any,
  batch: { index: number; question_text: string; mark_scheme: any }[]
): string {
  const list = batch
    .map((b) => {
      const scheme = Array.isArray(b.mark_scheme)
        ? b.mark_scheme.map((m: any) => m?.criterion).filter(Boolean).join(' | ')
        : '';
      return `--- QUESTION ${b.index} ---\nTEXT: ${b.question_text}\nMARK SCHEME (context only — do not reveal): ${scheme || '(none)'}`;
    })
    .join('\n\n');

  return `You are authoring a lightweight "Need a hand?" scaffold for EXISTING, already-published AQA GCSE Physics questions — topic "${subtopic.topic}", subtopic "${subtopic.subtopic_name}". These questions stay AI-marked; the scaffold is a static support panel shown to a student who isn't ready to write the answer unaided, and who isn't ready to articulate a JAM Help question either.

STEP 1 — DECIDE IF THIS QUESTION CAN BE USEFULLY SCAFFOLDED AT ALL.
A scaffold only helps when the answer is a CONSTRUCTED SENTENCE (Explain / Describe / Compare / "state two reasons" / "state and explain" style). It does NOT help when the answer is a single word, a name, or a short fixed fact with no sentence to build — for these, output {"index":<N>,"skip":true}. Examples that MUST be skipped:
- "Name component X" / "Name the component that..." (the answer is just a component name — there is nothing to scaffold; the question may even reference a diagram you cannot see)
- "State the unit of..." (the answer is a unit symbol/name)
- Any other single-word, single-number, or single-symbol recall answer

STEP 2 — FOR QUESTIONS THAT PASS STEP 1, output ONE line of JSON:
{"index":<N>,"vocabulary":["term1","term2","term3"],"sentence_starter":"..."}

RULES (strict — low-quality or leaking scaffolds get rejected and re-run):
- "vocabulary": 3-5 terms that genuinely help build the answer. NEVER just repeat words that already appear in the question text — that adds nothing. Think: what related concept, comparison word, or piece of terminology does the student need that ISN'T already given to them? (e.g. for a question about how a thermistor's resistance changes with temperature, useless vocabulary is "thermistor, resistance, temperature" — those are already in the question. Useful vocabulary is something like "directly proportional, inversely proportional, charge carriers".)
- "sentence_starter": ONE short, GENUINE sentence opener — it must read like the natural first words of a real answer, not a generic template. Banned patterns: "Looking at X, I think it is...", "I think this happens because...", or anything that could be pasted onto ANY question unchanged. The starter should be specific enough that swapping in a different question would make it nonsensical. Stop BEFORE any content that would give a marking-point away.
- **NEVER state, paraphrase, or imply the content of ANY mark scheme criterion shown above — not just the final/concluding one. EVERY criterion is off-limits, including ones that look like simple observations** (e.g. if a criterion says "Wave B has a shorter wavelength than Wave A", do not write a sentence_starter that states or assumes this — it is itself a mark, not background context).
- **If the question or its mark scheme depends on something the student must read off a diagram you cannot see** (e.g. "compare the two waves shown", "using the graph...", "from the diagram, state..."), do NOT guess, assume, or commit to which option/value/wave is correct. Only scaffold the GENERAL method or relationship the student needs (e.g. the wave equation $v = f\\lambda$, or "compare the two patterns by counting squares/measuring distances") — never a specific factual claim about what the diagram shows.
- If you cannot satisfy every rule above with genuine, question-specific, non-leaking content, output {"index":<N>,"skip":true} instead of forcing something generic or risky. A skip is always better than a leak.
- Output one JSON object per line (NDJSON), no wrapping array, no markdown, no preamble. Cover every question index ${batch[0].index} to ${batch[batch.length - 1].index}.

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
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content:
            'Draft the scaffolds now. One JSON object per line, every index covered. Skip pure recall/naming questions and any question where you cannot write genuine, question-specific vocabulary and a sentence starter — a skip is better than generic filler.',
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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Deterministic safety net — don't rely on the model alone to avoid leaking a
// mark scheme criterion into the sentence starter. Flags a direct containment
// match, or a 4+ consecutive-word overlap (catches near-verbatim restatement).
function leaksMarkScheme(sentenceStarter: string, markScheme: any): boolean {
  const criteria = Array.isArray(markScheme)
    ? markScheme
        .map((m: any) => m?.criterion)
        .filter((c: any) => typeof c === 'string' && c.toLowerCase() !== 'total')
    : [];
  const normStarter = normalise(sentenceStarter);
  if (!normStarter) return false;

  for (const c of criteria) {
    const normC = normalise(c);
    if (normC.length < 8) continue;
    if (normStarter.includes(normC)) return true;

    const words = normC.split(' ');
    for (let i = 0; i + 4 <= words.length; i++) {
      const window = words.slice(i, i + 4).join(' ');
      if (window.length > 10 && normStarter.includes(window)) return true;
    }
  }
  return false;
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

    // Candidates: live, AI-marked, single-part (no parts), no scaffold yet.
    const { data: liveQs, error: qErr } = await supabase
      .from('questions')
      .select('id, question_text, mark_scheme, parts, answer_model, scaffold')
      .eq('subtopic_id', subtopicId)
      .eq('answer_model', 'ai_freeresponse')
      .is('scaffold', null);
    if (qErr) throw new Error(`Failed to load questions: ${qErr.message}`);

    const candidates = (liveQs ?? []).filter(
      (q: any) => !q.parts || (Array.isArray(q.parts) && q.parts.length === 0)
    );

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, dropped: 0, message: 'No candidates — nothing to backfill.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const indexed = candidates.map((q: any, i: number) => ({ ...q, index: i }));
    const byIndex = new Map(indexed.map((q: any) => [q.index, q]));

    let updated = 0;
    let skipped = 0;
    const dropped: string[] = [];

    for (const group of chunk(indexed, 10)) {
      const raw = await callClaude(buildPrompt(subtopic, group));
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

        const vocabulary = Array.isArray(parsed.vocabulary)
          ? parsed.vocabulary.filter((v: any) => typeof v === 'string')
          : [];
        const sentenceStarter =
          typeof parsed.sentence_starter === 'string' ? parsed.sentence_starter : '';

        if (vocabulary.length === 0 && !sentenceStarter) {
          dropped.push(`"${(orig.question_text || '').slice(0, 40)}…": empty scaffold`);
          continue;
        }

        if (leaksMarkScheme(sentenceStarter, orig.mark_scheme)) {
          dropped.push(
            `"${(orig.question_text || '').slice(0, 40)}…": sentence_starter leaks a mark scheme criterion — "${sentenceStarter}"`
          );
          continue;
        }

        const { error: updErr } = await supabase
          .from('questions')
          .update({
            scaffold: { vocabulary, sentence_starter: sentenceStarter },
          })
          .eq('id', orig.id);
        if (updErr) {
          dropped.push(`"${(orig.question_text || '').slice(0, 40)}…": ${updErr.message}`);
          continue;
        }
        updated += 1;
      }
    }

    return new Response(
      JSON.stringify({
        candidates: candidates.length,
        updated,
        skipped,
        dropped: dropped.length,
        droppedReasons: dropped,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('backfill-scaffold error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
