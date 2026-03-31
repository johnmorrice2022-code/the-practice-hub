import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { questionText, markScheme, workedSolution, studentAnswer, marks } = await req.json();

    if (!questionText || !studentAnswer) throw new Error("questionText and studentAnswer are required");

    const systemPrompt = `You are a supportive GCSE examiner marking a student's answer.

MARKING RULES:
- Award M marks generously if the student shows a valid method, even with arithmetic errors
- A marks depend on the preceding M mark
- B marks are independent — award if the criterion is met
- Apply ECF: if a student uses their incorrect earlier value correctly, award subsequent marks
- Never penalise the same error twice
- When in doubt, award the mark

FEEDBACK TONE:
- Warm and encouraging — like a good teacher
- Never use the word "wrong" — use "not quite" or "nearly there"
- Lead with what the student did correctly
- Be specific, not vague

Return ONLY a JSON object, no markdown, no preamble:
{
  "marks_awarded": number,
  "marks_available": number,
  "step_breakdown": [
    {
      "mark_type": "M" | "A" | "B" | "ECF",
      "criterion": "string",
      "status": "awarded" | "partial" | "not_awarded",
      "comment": "string"
    }
  ],
  "error_type": "none" | "arithmetic" | "conceptual" | "method" | "incomplete" | "unit",
  "feedback_summary": "string — 2-3 warm encouraging sentences",
  "worked_solution": "string — full solution with LaTeX",
  "revision_focus": "string — one specific actionable thing to practise"
}`;

    const userPrompt = `QUESTION (${marks} marks):
${questionText}

MARK SCHEME:
${JSON.stringify(markScheme, null, 2)}

MODEL SOLUTION:
${workedSolution || "Not provided."}

STUDENT'S ANSWER:
${studentAnswer}

Mark this answer. Return only the JSON object.`;

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
