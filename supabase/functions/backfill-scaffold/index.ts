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

  return `You are authoring a lightweight "Need a hand?" scaffold for EXISTING, already-published AQA GCSE Physics questions — topic "${subtopic.topic}", subtopic "${subtopic.subtopic_name}". These questions are Explain/State/Describe/Compare style and stay AI-marked; the scaffold is a static support panel shown to a student who isn't ready to write the answer unaided, and who isn't ready to articulate a JAM Help question either.

For each question below, output ONE line of JSON:
{"index":<N>,"vocabulary":["term1","term2","term3"],"sentence_starter":"..."}

RULES:
- "vocabulary": 3-5 key terms the answer should use — the building blocks of the answer, NEVER the answer's content or conclusion.
- "sentence_starter": ONE short sentence opener that gets the student writing, stopping BEFORE any content that would give a marking-point away. Example: "The current increases because..." is fine; "...because resistance decreases" is NOT (that IS the answer).
- This is scaffolding, not the answer. If you cannot write a sentence_starter without giving away the answer, make it more generic (e.g. "I think this happens because...").
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
            'Draft the scaffolds now. One JSON object per line, every index covered, no answer-revealing content.',
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

        const vocabulary = Array.isArray(parsed.vocabulary)
          ? parsed.vocabulary.filter((v: any) => typeof v === 'string')
          : [];
        const sentenceStarter =
          typeof parsed.sentence_starter === 'string' ? parsed.sentence_starter : '';

        if (vocabulary.length === 0 && !sentenceStarter) {
          dropped.push(`"${(orig.question_text || '').slice(0, 40)}…": empty scaffold`);
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
