import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { subtopicId, count = 5 } = await req.json();
    if (!subtopicId) throw new Error("subtopicId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch subtopic with its config
    const { data: subtopic, error: stError } = await supabase
      .from("subtopics")
      .select("*")
      .eq("id", subtopicId)
      .single();

    if (stError || !subtopic) throw new Error("Subtopic not found");

    const promptConfig = subtopic.prompt_config || {};
    const difficultyProfile = subtopic.difficulty_profile || {};

    const systemPrompt = `You are an expert GCSE ${subtopic.subject} examiner for the ${subtopic.exam_board} exam board.
You create exam-style questions for the ${subtopic.tier} tier, grade band ${subtopic.grade_band}.

Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}
${subtopic.description ? `Description: ${subtopic.description}` : ""}
${promptConfig.context ? `Additional context: ${promptConfig.context}` : ""}
${promptConfig.style ? `Question style: ${promptConfig.style}` : ""}

Difficulty distribution: ${JSON.stringify(difficultyProfile)}

Rules:
- Write exactly ${count} questions in increasing difficulty
- Each question must have marks (1-6) appropriate to difficulty
- Use LaTeX notation wrapped in $ for inline and $$ for display math
- Provide a detailed mark_scheme as an array of marking points, each with: criterion (string), marks (number)
- Provide a worked_solution using LaTeX where appropriate
- Questions must be authentic GCSE style, not generic textbook problems
- Ensure mathematical notation is precise and uses proper symbols`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
          { role: "user", content: `Generate ${count} GCSE exam questions for "${subtopic.subtopic_name}".` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_questions",
              description: "Return generated exam questions",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question_text: { type: "string", description: "The question text with LaTeX math notation" },
                        marks: { type: "number", description: "Total marks for this question" },
                        mark_scheme: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              criterion: { type: "string" },
                              marks: { type: "number" },
                            },
                            required: ["criterion", "marks"],
                          },
                        },
                        worked_solution: { type: "string", description: "Step-by-step solution with LaTeX" },
                      },
                      required: ["question_text", "marks", "mark_scheme", "worked_solution"],
                    },
                  },
                },
                required: ["questions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_questions" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", status, text);
      throw new Error("Failed to generate questions");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const parsed = JSON.parse(toolCall.function.arguments);
    const questions = parsed.questions.map((q: any, i: number) => ({
      ...q,
      question_order: i + 1,
      id: crypto.randomUUID(),
    }));

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
