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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a supportive GCSE maths examiner providing JAM Feedback.

Rules:
- Award method marks generously — if a student shows a valid approach, they earn the method mark even if the final answer is wrong
- Never use the word "wrong" — use "not quite" or "nearly there" instead
- Be warm, encouraging, and specific in feedback
- Use LaTeX ($ for inline, $$ for display) in the worked solution
- Focus on what the student DID well before addressing gaps`;

    const userPrompt = `Question (${marks} marks):
${questionText}

Mark scheme:
${JSON.stringify(markScheme)}

${workedSolution ? `Model solution:\n${workedSolution}` : ""}

Student's answer:
${studentAnswer}

Mark this answer.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_feedback",
              description: "Return structured marking feedback",
              parameters: {
                type: "object",
                properties: {
                  marks_awarded: { type: "number", description: "Total marks awarded" },
                  marks_available: { type: "number", description: "Total marks available" },
                  step_breakdown: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        criterion: { type: "string" },
                        status: { type: "string", enum: ["awarded", "partial", "not_awarded"] },
                        comment: { type: "string", description: "Supportive, specific comment" },
                      },
                      required: ["criterion", "status", "comment"],
                    },
                  },
                  error_type: {
                    type: "string",
                    enum: ["none", "arithmetic", "conceptual", "method", "incomplete"],
                    description: "Primary error category if any",
                  },
                  feedback_summary: { type: "string", description: "Warm, encouraging overall feedback (2-3 sentences)" },
                  worked_solution: { type: "string", description: "Full worked solution with LaTeX" },
                  revision_focus: { type: "string", description: "One specific area to revise" },
                },
                required: ["marks_awarded", "marks_available", "step_breakdown", "error_type", "feedback_summary", "worked_solution", "revision_focus"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_feedback" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", status, text);
      throw new Error("Failed to mark answer");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const feedback = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mark-answer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
