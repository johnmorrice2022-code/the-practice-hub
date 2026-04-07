// mark-answer — powered by Anthropic Claude
// Replaces Lovable/Gemini gateway. Set ANTHROPIC_API_KEY in Supabase secrets.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { questionText, markScheme, workedSolution, studentAnswer, marks } = await req.json();

    if (!questionText || !studentAnswer) {
      throw new Error("questionText and studentAnswer are required");
    }

    const systemPrompt = `You are a supportive, expert GCSE examiner providing structured feedback to a student.

Your job is to mark the student's answer against the mark scheme — fairly, accurately, and encouragingly.

MARKING PRINCIPLES
- Award M marks (method) generously: if the student demonstrates a valid method or approach, award the M mark even if their arithmetic is wrong
- A marks depend on the preceding M mark being earned — apply standard ECF (error carried forward) rules
- B marks are independent — award them if the criterion is met regardless of the rest of the answer
- ECF: if a student carries forward an incorrect value but applies it correctly in subsequent steps, award ECF marks
- Never penalise the same error twice
- When in doubt about a borderline answer, lean toward awarding the mark (benefit of the doubt)

FEEDBACK TONE
- Warm, specific, and constructive — like a good teacher, not a machine
- Never use the word "wrong" — use "not quite", "nearly there", "this needed one more step", etc.
- Always lead with what the student did correctly before addressing gaps
- Be precise: reference the specific step or concept, not vague praise
- Keep the feedback_summary to 2–3 sentences maximum — clear and actionable

RESPONSE FORMAT
Return ONLY a JSON object — no preamble, no explanation, no markdown fences:

{
  "marks_awarded": number,
  "marks_available": number,
  "step_breakdown": [
    {
      "mark_type": "M" | "A" | "B" | "ECF",
      "criterion": "string — what this mark was for",
      "status": "awarded" | "partial" | "not_awarded",
      "comment": "string — specific, encouraging comment about this step"
    }
  ],
  "error_type": "none" | "arithmetic" | "conceptual" | "method" | "incomplete" | "unit",
  "feedback_summary": "string — 2–3 warm, specific sentences summarising performance",
  "worked_solution": "string — full model solution with LaTeX",
  "revision_focus": "string — one specific, actionable thing to practise"
}`;

    const userPrompt = `QUESTION (${marks} marks total):
${questionText}

MARK SCHEME:
${JSON.stringify(markScheme, null, 2)}

MODEL SOLUTION:
${workedSolution || "Not provided — use your knowledge to construct an accurate solution."}

STUDENT'S ANSWER:
${studentAnswer}

Mark this answer against the mark scheme. Apply ECF where appropriate. Return only the JSON object.`;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured in Supabase secrets");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 401) {
        return new Response(
          JSON.stringify({ error: "Anthropic API key invalid. Check ANTHROPIC_API_KEY in Supabase secrets." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Anthropic API error:", status, text);
      throw new Error(`Anthropic API returned ${status}`);
    }

    const result = await response.json();
    const rawText = result.content?.[0]?.text;
    if (!rawText) throw new Error("Empty response from Claude");

    const cleaned = rawText
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```\s*$/m, "")
      .trim();

    let feedback: any;
    try {
      feedback = JSON.parse(cleaned);
    } catch {
      console.error("JSON parse failed. Raw Claude output:", cleaned);
      throw new Error("Claude returned malformed JSON. Please try again.");
    }

    // Validate essential fields exist
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
