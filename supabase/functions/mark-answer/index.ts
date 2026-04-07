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
      parts,
      markScheme,
      workedSolution,
      studentAnswer,
      marks,
      markingGuidance,
    } = await req.json();
    if (!questionText || !studentAnswer)
      throw new Error('questionText and studentAnswer are required');

    const isMultiPart = parts && parts.length > 0;

    const systemPrompt = `You are a strict GCSE examiner marking a student's answer against an official mark scheme.

CORE MARKING RULES:
- The mark scheme is a CLOSED LIST. You may only award marks that appear in the mark scheme provided. Do not invent B marks, B1ft marks, or any other mark type not listed in the scheme.
- Count the marks in the scheme — that is the absolute maximum. step_breakdown must contain exactly those entries and no more.
- M marks: award if the student shows a valid method, even with arithmetic errors
- A marks: dependent on the preceding M mark — only award if the M mark was awarded
- B marks: independent — only award if explicitly listed in the mark scheme
- ECF (error carried forward): if a student uses their incorrect earlier answer correctly in a subsequent step, award that mark with ECF
- Never penalise the same error twice
- A correct reason or theorem statement stated alongside wrong working earns zero marks — reasons only earn marks when attached to correct method
${isMultiPart ? '- This is a multi-part question. Apply ECF between parts — if part (a) is wrong but part (b) uses their part (a) answer correctly, award the follow-through mark.' : ''}
${markingGuidance ? `\nSUBJECT-SPECIFIC MARKING RULES (these take priority over all general rules above):\n${markingGuidance}` : ''}

FEEDBACK TONE:
- Warm and encouraging — like a good teacher, not a marking machine
- Never use the word "wrong" — use "not quite", "nearly there", "this needed one more step"
- Always acknowledge what the student did correctly before addressing gaps
- Be specific — reference the exact step or concept, not vague praise
- Keep feedback_summary to 2-3 sentences — clear and actionable

Return ONLY a JSON object, no markdown, no preamble:
{
  "marks_awarded": number,
  "marks_available": number,
  "step_breakdown": [
    {
      "mark_type": "M" | "A" | "B" | "ECF",
      "part": "a" | "b" | null,
      "criterion": "string",
      "status": "awarded" | "not_awarded",
      "comment": "string — specific encouraging comment"
    }
  ],
  "error_type": "none" | "arithmetic" | "conceptual" | "method" | "incomplete" | "unit",
  "feedback_summary": "string — 2-3 warm specific sentences",
  "worked_solution": "string — full solution with LaTeX",
  "revision_focus": "string — one specific actionable thing to practise"
}`;

    const userPrompt = `QUESTION (${marks} marks total):
${questionText}
${isMultiPart ? `\nPARTS:\n${parts.map((p: any) => `(${p.part_label}) [${p.marks} marks]: ${p.part_text}`).join('\n')}` : ''}

MARK SCHEME (these are the ONLY marks available — do not add any others):
${JSON.stringify(
  markScheme.filter((m: any) => m.mark !== 'TOTAL'),
  null,
  2
)}

TOTAL MARKS AVAILABLE: ${marks}

MODEL SOLUTION:
${workedSolution || 'Not provided.'}

STUDENT'S ANSWER:
${studentAnswer}

Mark this answer strictly against the mark scheme above. Do not award marks not listed. Return only the JSON object.`;

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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
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

    let feedback: any;
    try {
      feedback = JSON.parse(cleaned);
    } catch {
      console.error('JSON parse failed:', cleaned);
      throw new Error('Claude returned malformed JSON');
    }

    if (
      typeof feedback.marks_awarded !== 'number' ||
      !Array.isArray(feedback.step_breakdown)
    ) {
      throw new Error('Claude response missing required fields');
    }

    // Strip any invented steps beyond the mark scheme length
    const schemeLength = Array.isArray(markScheme)
      ? markScheme.filter((m: any) => m.mark !== 'TOTAL').length
      : marks;
    if (feedback.step_breakdown.length > schemeLength) {
      feedback.step_breakdown = feedback.step_breakdown.slice(0, schemeLength);
    }

    // Recalculate marks_awarded from step_breakdown — source of truth
    feedback.marks_awarded = feedback.step_breakdown.filter(
      (s: any) => s.status === 'awarded'
    ).length;

    // Final hard cap
    if (feedback.marks_awarded > marks) {
      feedback.marks_awarded = marks;
    }

    return new Response(JSON.stringify({ feedback }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('mark-answer error:', e);
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
