import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { subtopicId, count = 4 } = await req.json();
    if (!subtopicId) throw new Error("subtopicId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subtopic, error: stError } = await supabase
      .from("subtopics")
      .select("*")
      .eq("id", subtopicId)
      .single();

    if (stError || !subtopic) throw new Error("Subtopic not found");

    const promptConfig = subtopic.prompt_config || {};
    const isMaths = subtopic.subject?.toLowerCase().includes("maths") || subtopic.subject?.toLowerCase().includes("math");
    const boardLabel = isMaths ? "Edexcel" : "AQA";

    const markTypeGuidance = isMaths
      ? `Mark types:\n- M mark: correct method even if arithmetic is wrong\n- A mark: correct answer, dependent on M mark\n- B mark: independent correct statement or value\n- ECF: award if student uses their incorrect earlier value correctly in subsequent steps`
      : `Mark types:\n- B mark: correct physics statement, definition, or value\n- M mark: correct application of formula\n- A mark: correct answer with units\n- ECF: award if student uses their incorrect value correctly`;

    const systemPrompt = `You are a senior ${boardLabel} GCSE ${subtopic.subject} examiner writing questions for Higher tier, grade band ${subtopic.grade_band}.

Subject: ${subtopic.subject}
Exam board: ${boardLabel}
Tier: ${subtopic.tier}
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}
${subtopic.description ? `Description: ${subtopic.description}` : ""}
${promptConfig.system_prompt ? `\nEXPERT EXAMINER INSTRUCTIONS — follow these precisely:\n${promptConfig.system_prompt}` : ""}
${promptConfig.context ? `\nExaminer notes: ${promptConfig.context}` : ""}
${promptConfig.common_mistakes ? `\nCommon student errors to probe: ${promptConfig.common_mistakes}` : ""}
${promptConfig.command_words ? `\nPreferred command words: ${promptConfig.command_words}` : ""}

${markTypeGuidance}

QUESTION FORMAT
Each question must be one of two types:

TYPE 1 — Single part question:
{
  "question_text": "Full question text with LaTeX",
  "marks": 2,
  "parts": [],
  "mark_scheme": [
    { "mark_type": "M", "criterion": "string", "marks": 1 },
    { "mark_type": "A", "criterion": "string", "marks": 1 }
  ],
  "worked_solution": "Full solution with LaTeX"
}

TYPE 2 — Multi-part question (use for 'hence' questions and multi-step problems):
{
  "question_text": "Stem text shown above all parts (e.g. 'f(x) = x² - 4x + 7')",
  "marks": 3,
  "parts": [
    { "part_label": "a", "part_text": "(a) Express f(x) in the form (x + a)² + b", "marks": 2 },
    { "part_label": "b", "part_text": "(b) Hence write down the coordinates of the minimum point of y = f(x).", "marks": 1 }
  ],
  "mark_scheme": [
    { "mark_type": "M", "part": "a", "criterion": "string", "marks": 1 },
    { "mark_type": "A", "part": "a", "criterion": "string", "marks": 1 },
    { "mark_type": "B1ft", "part": "b", "criterion": "string — state ECF rule explicitly", "marks": 1 }
  ],
  "worked_solution": "Full solution covering all parts with LaTeX"
}

RULES:
1. Generate exactly ${count} questions in increasing difficulty
2. Questions must read exactly like real ${boardLabel} past paper questions
3. Use LaTeX: $inline$ and $$display$$
4. At least one question must be multi-part (TYPE 2)
5. Mark schemes must be unambiguous — a second examiner must reach identical marks
6. Return ONLY a JSON object, no markdown, no preamble`;

    const userPrompt = `Generate ${count} GCSE exam questions for: "${subtopic.subtopic_name}" (${subtopic.topic}, ${boardLabel} ${subtopic.tier} tier, grade ${subtopic.grade_band}).

Return ONLY this JSON structure:
{
  "questions": [
    {
      "question_text": "string",
      "marks": 2,
      "parts": [],
      "mark_scheme": [{ "mark_type": "M", "criterion": "string", "marks": 1 }],
      "worked_solution": "string"
    }
  ]
}`;

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
        max_tokens: 4000,
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

    let parsed: { questions: any[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("JSON parse failed:", cleaned);
      throw new Error("Claude returned malformed JSON");
    }

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error("No questions returned");
    }

    const questions = parsed.questions.map((q: any, i: number) => ({
      id: crypto.randomUUID(),
      question_text: q.question_text,
      marks: q.marks,
      parts: q.parts || [],
      mark_scheme: q.mark_scheme,
      worked_solution: q.worked_solution,
      question_order: i + 1,
    }));

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-questions error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
