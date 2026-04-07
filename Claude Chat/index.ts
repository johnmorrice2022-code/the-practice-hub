// generate-questions — powered by Anthropic Claude
// Replaces Lovable/Gemini gateway. Set ANTHROPIC_API_KEY in Supabase secrets.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Fetch subtopic with its full config
    const { data: subtopic, error: stError } = await supabase
      .from("subtopics")
      .select("*")
      .eq("id", subtopicId)
      .single();

    if (stError || !subtopic) throw new Error("Subtopic not found");

    const promptConfig = subtopic.prompt_config || {};
    const difficultyProfile = subtopic.difficulty_profile || {};

    // Determine subject type for mark scheme guidance
    const isMaths =
      subtopic.subject?.toLowerCase().includes("maths") ||
      subtopic.subject?.toLowerCase().includes("math");

    const boardLabel = isMaths ? "Edexcel" : "AQA";

    const markTypeGuidance = isMaths
      ? `Mark types:
- M mark (method): awarded for a correct method even if arithmetic is wrong
- A mark (accuracy): correct answer, dependent on preceding M mark being earned
- B mark (independent): correct statement, value, or formula — not dependent on method
- ECF (error carried forward): award if student correctly uses their own incorrect earlier value`
      : `Mark types:
- B mark (recall/knowledge): correct physics statement, definition, equation, or value
- M mark (method): correct application of a formula or physical principle
- A mark (accuracy): correct numerical answer with correct units
- ECF (error carried forward): award subsequent marks if student uses their incorrect value correctly`;

    const systemPrompt = `You are a senior GCSE ${subtopic.subject} examiner writing questions for the ${boardLabel} exam board.

Your questions must be indistinguishable from real ${boardLabel} GCSE past paper questions. Every word, every mark, every step in the mark scheme must meet the standard of an official exam.

CONTEXT
Subject: ${subtopic.subject}
Exam board: ${boardLabel}
Tier: ${subtopic.tier}
Grade band: ${subtopic.grade_band}
Topic: ${subtopic.topic}
Subtopic: ${subtopic.subtopic_name}
${subtopic.description ? `Description: ${subtopic.description}` : ""}
${promptConfig.context ? `Examiner notes: ${promptConfig.context}` : ""}
${promptConfig.style ? `Preferred question style: ${promptConfig.style}` : ""}
${promptConfig.command_words ? `Command words to use: ${promptConfig.command_words}` : ""}
${promptConfig.common_mistakes ? `Common student errors to probe: ${promptConfig.common_mistakes}` : ""}
${promptConfig.system_prompt ? `\nADDITIONAL INSTRUCTIONS FROM COURSE DESIGNER:\n${promptConfig.system_prompt}` : ""}

${markTypeGuidance}

DIFFICULTY DISTRIBUTION (${count} questions, increasing difficulty)
${
  Object.keys(difficultyProfile).length > 0
    ? JSON.stringify(difficultyProfile, null, 2)
    : `Q1: accessible — entry point for the grade band, tests a single skill
Q2–Q${count - 1}: core — requires applying knowledge, multi-step reasoning typical
Q${count}: stretch — upper grade band, requires synthesis or unfamiliar application`
}

NON-NEGOTIABLE RULES
1. Write exactly ${count} questions in strictly increasing difficulty
2. Question text must read exactly like a printed GCSE exam question — precise, unambiguous, professional
3. Use correct command words: calculate, show that, explain, describe, sketch, determine, prove, etc.
4. Marks per question: 1–6, proportional to the complexity and number of steps required
5. Mark scheme: every marking point must state the mark type (M/A/B/ECF), what earns it, and how many marks. A second examiner must reach the same marks independently.
6. Worked solution: full model answer a high-achieving student would write — show all steps, no skipping
7. LaTeX notation: use $...$ for inline maths and $$...$$ for display maths
8. ${isMaths ? "Use correct notation: fractions as \\frac{}{}, surds as \\sqrt{}, vectors in bold" : "Always state units. Use SI units unless the question specifies otherwise."}
9. Vary question types and contexts across the set — no two questions should feel structurally identical
10. Do not include any explanatory text outside the JSON — return only the JSON object`;

    const userPrompt = `Generate ${count} GCSE exam questions for: "${subtopic.subtopic_name}" (${subtopic.topic}, ${boardLabel} ${subtopic.tier} tier, grade ${subtopic.grade_band}).

Return ONLY a JSON object in this exact format — no preamble, no explanation, no markdown:

{
  "questions": [
    {
      "question_text": "Full question text. Use $...$ for inline maths and $$...$$ for display maths.",
      "marks": 3,
      "mark_scheme": [
        {
          "mark_type": "M",
          "criterion": "Substitution of correct values into formula",
          "marks": 1
        },
        {
          "mark_type": "A",
          "criterion": "Correct answer: 4.5 (m/s²)",
          "marks": 1
        }
      ],
      "worked_solution": "Full step-by-step solution with LaTeX."
    }
  ]
}`;

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
        max_tokens: 4000,
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

    // Strip any markdown code fences if Claude adds them
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```\s*$/m, "")
      .trim();

    let parsed: { questions: any[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("JSON parse failed. Raw Claude output:", cleaned);
      throw new Error("Claude returned malformed JSON. Please try again.");
    }

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error("No questions returned by Claude");
    }

    const questions = parsed.questions.map((q: any, i: number) => ({
      id: crypto.randomUUID(),
      question_text: q.question_text,
      marks: q.marks,
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
