import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { questionText, parts, markScheme, workedSolution, studentAnswer, marks } = await req.json();
    if (!questionText || !studentAnswer) throw new Error("questionText and studentAnswer are required");

    const isMultiPart = parts && parts.length > 0;

    const systemPrompt = `You are a supportive GCSE examiner marking a student's answer against an official mark scheme.

MARKING RULES:
- Award M marks generously: if the student shows a valid method, award the M mark even with arithmetic errors
- A marks depend on the preceding M mark — apply standard rules
- B marks are independent — award if the criterion is met regardless of other errors
- ECF (error carried forward): if a student uses their incorrect earlier answer correctly in subsequent steps, award the ECF/follow-through marks
- Never penalise the same error twice
- When in doubt, award the mark — benefit of the doubt to the student
${isMultiPart ? "- This is a multi-part question. Apply ECF between parts — if part (a) is wrong but part (b) uses their part (a) answer correctly, award the follow-through mark." : ""}

FEEDBACK TONE:
- Warm and encouraging — like a good teacher, not a marking machine
- Never use the word \"wrong\" — use \"not quite\", \"nearly there\", \"this needed one more step\"
- Always acknowledge what the student did correctly before addressing gaps
- Be specific — reference the exact step or concept, not vague praise
- Keep feedback_summary to 2-3 sentences — clear and actionable

Return ONLY a JSON object, no markdown, no preamble:
{
  "marks_awarded": number,
  "marks_available": number,
  "step_breakdown": [
    {
      "mark_type": "M" | "A" | "B" | "B1ft" | "ECF",
      "part": "a" | "b" | null,
      "criterion": "string",
      "status": "awarded" | "partial" | "not_awarded",
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
${isMultiPart ? `\nPARTS:\n${parts.map((p: any) => `(${p.part_label}) [${p.marks} marks]: ${p.part_text}`).join("\n")}` : ""}

MARK SCHEME:
${JSON.stringify(markScheme, null, 2)}

MODEL SOLUTION:
${workedSolution || "Not provided."}

STUDENT'S ANSWER:
${studentAnswer}

Mark this answer. Apply ECF where appropriate. Return only the JSON object.`;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("Anthropic error:", status, text);
      throw new Error(`Anthropic API returned ${status}`);
    }

    const result = await response.json();
    const rawText = result.content?.[0]?.text;
    if (!rawText) throw new Error("Empty response from Claude");

    const cleaned = rawText.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();

    let feedback: any;
    try {
      feedback = JSON.parse(cleaned);
    } catch {
      console.error("JSON parse failed:", cleaned);
      throw new Error("Claude returned malformed JSON");
    }

    if (typeof feedback.marks_awarded !== "number" || !Array.isArray(feedback.step_breakdown)) {
      throw new Error("Claude response missing required fields");
    }

    return new Response(JSON.stringify({ feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("mark-answer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
