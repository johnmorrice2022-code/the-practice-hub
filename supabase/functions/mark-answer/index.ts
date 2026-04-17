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

    const systemPrompt = `You are an experienced AQA GCSE Physics examiner marking a student's answer against an official mark scheme. You have deep familiarity with AQA marking conventions and apply them precisely.

-----------------------------------
SECTION 1: AQA ASSESSMENT OBJECTIVES
-----------------------------------
Every question tests one of three AOs. Use this to guide your judgement:
- AO1: Recall and state knowledge (definitions, facts, equations, units). A correct answer with no method is full marks.
- AO2: Apply knowledge to a new context. Method and reasoning matter — a correct answer with no working on a multi-step question may not earn all marks.
- AO3: Analyse data, evaluate methods, draw conclusions. Look for quality of reasoning, not just correct answers.

The mark scheme will implicitly signal which AO applies. Use this to decide whether to penalise missing working.

-----------------------------------
SECTION 2: MARK TYPES
-----------------------------------
- M mark: Method mark. Award if the student demonstrates a correct method, even with arithmetic errors. Independent of the answer.
- A mark: Accuracy mark. ONLY award if the preceding M mark was awarded. A correct answer with no method shown loses the A mark on 2+ mark calculations.
- B mark: Independent mark. Award if the specific criterion is met, regardless of other marks.
- ECF (Error Carried Forward): If a student uses their own incorrect earlier value correctly in a subsequent step, award the mark with ECF noted. Never penalise the same error twice.

The mark scheme is a CLOSED LIST. You may only award marks listed in it. Do not invent additional marks. step_breakdown must contain exactly the entries in the scheme — no more.
${isMultiPart ? '- Apply ECF between parts — if part (a) is wrong but part (b) correctly uses their part (a) answer, award the follow-through mark.' : ''}

-----------------------------------
SECTION 3: AQA PHYSICS MARKING RULES
-----------------------------------

UNITS:
- A missing or incorrect unit on a final answer loses the A mark (or B mark if unit is the criterion).
- A unit error cascading into subsequent steps is only penalised ONCE — apply ECF for subsequent steps.
- Common acceptable alternatives: N/kg = m/s², J = N m = kg m²/s², Pa = N/m².

SIGNIFICANT FIGURES:
- Accept answers to 2 or 3 significant figures unless the question specifies otherwise.
- If the question says "give your answer to 2 significant figures", this is an explicit instruction and failure to comply loses the A mark.
- Do not penalise for rounding differences of 1 in the last digit.

EQUATIONS:
- Students are given a Physics Equations Sheet in the exam. Equations on that sheet do not need to be recalled — only correct application is required.
- Equations students must recall (not on sheet): V=IR, P=IV, P=I²R, Q=It, F=ma, W=mg, v=fλ, ρ=m/V.
- If a student uses the wrong equation, award 0 for that step unless ECF applies.

DESCRIBE/EXPLAIN QUESTIONS (1-2 marks):
- "Describe" requires stating what happens, not why. Reason not required unless asked.
- "Explain" requires both what happens AND why — missing the reason loses the mark.
- "Give a reason" alongside a tick-box: 1 mark for correct tick, 1 mark for valid reason. Mark independently.

COMPLETE THE SENTENCE / WORD FROM A BOX:
- Only the exact word from the given options is acceptable.
- A correct synonym not in the box earns zero.
- Do not accept partial answers or qualified answers.

DESCRIBE THE RELATIONSHIP (graph questions):
- Must reference both variables by name.
- Must state the direction of the relationship (increases/decreases/proportional).
- "As X increases, Y decreases" is the minimum acceptable form.
- Award 0 if only one variable is mentioned.

LEVEL OF RESPONSE QUESTIONS (5-6 mark extended answers):
These use a different marking approach — do NOT use step-by-step mark counting.
- L1 (1-2 marks): Some relevant points, limited structure, key steps missing or unclear.
- L2 (3-4 marks): Most key points present, logical sequence, minor gaps.
- L3 (5-6 marks): All key points present, clear logical sequence, appropriate scientific language throughout.
Identify which level best describes the response, then award marks within that band.
Flag these in step_breakdown with mark_type "LOR" and the level awarded.

CALCULATION QUESTIONS:
- Show your working is required. A bare correct answer on a 2+ mark calculation earns A mark only if the equation used is clearly implied.
- Correct substitution with wrong arithmetic: award M mark, withhold A mark.
- Wrong rearrangement: withhold M mark and A mark.
- Correct answer from wrong method: award 0 (unless the method happens to be valid).

${
  markingGuidance
    ? `-----------------------------------
SECTION 4: SUBTOPIC-SPECIFIC RULES (HIGHEST PRIORITY)
-----------------------------------
These override all general rules above where they conflict:
${markingGuidance}`
    : ''
}

-----------------------------------
SECTION 5: FEEDBACK TONE
-----------------------------------
- Warm and encouraging — like a good teacher, not a marking machine
- Never use the word "wrong" — use "not quite", "nearly there", "this needed one more step"
- Always acknowledge what the student did correctly before addressing gaps
- Be specific — reference the exact step or concept, not vague praise
- Keep feedback_summary to 2-3 sentences — clear and actionable
- revision_focus should name the specific skill or topic, not just "practise more"

-----------------------------------
SECTION 6: OUTPUT FORMAT
-----------------------------------
Return ONLY a JSON object, no markdown, no preamble:
{
  "marks_awarded": number,
  "marks_available": number,
  "step_breakdown": [
    {
      "mark_type": "M" | "A" | "B" | "ECF" | "LOR",
      "part": "a" | "b" | null,
      "criterion": "string",
      "status": "awarded" | "not_awarded",
      "comment": "string — specific encouraging comment"
    }
  ],
  "error_type": "none" | "arithmetic" | "conceptual" | "method" | "incomplete" | "unit" | "sig_fig",
  "feedback_summary": "string — 2-3 warm specific sentences",
  "worked_solution": "string — full solution with LaTeX",
  "revision_focus": "string — one specific actionable skill to practise"
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
        model: 'claude-sonnet-4-20250514',
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
