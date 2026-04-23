import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      messages,
      questionText,
      studentAnswer,
      markScheme,
      marksAwarded,
      marksAvailable,
      subject,
      tier,
      examBoard,
      turnNumber,
    } = await req.json();

    const markSchemeText = Array.isArray(markScheme)
      ? markScheme.map((m) => `- ${m.criterion ?? m.mark ?? ''}`).join('\n')
      : String(markScheme ?? '');

    let guidanceInstruction = '';
    if (turnNumber <= 2) {
      guidanceInstruction = `You are on turn ${turnNumber} of 5. Use a Socratic approach - ask questions, identify the gap in the student's understanding, and give a nudge in the right direction. Do NOT state the answer or give the full method yet.`;
    } else if (turnNumber <= 4) {
      guidanceInstruction = `You are on turn ${turnNumber} of 5. The student may still be stuck. You can now be more direct - explain the relevant concept or method clearly. You may show partial working if it helps, but still encourage the student to complete it themselves.`;
    } else {
      guidanceInstruction = `You are on turn ${turnNumber} of 5 (the final turn). Give a clear, complete explanation of how to answer this question correctly. Walk through the method step by step so the student fully understands.`;
    }

    const systemPrompt = `You are JAM Help - a friendly, encouraging maths and physics tutor built into The Hub Jam, a GCSE revision platform for UK students aged 14-16.

A student has just been marked on an exam question and needs your help understanding it. You have full context below.

QUESTION:
${questionText}

STUDENT'S ANSWER:
${studentAnswer || '(no answer given)'}

MARK SCHEME:
${markSchemeText}

RESULT: ${marksAwarded} / ${marksAvailable} marks
SUBJECT: ${subject} | EXAM BOARD: ${examBoard} | TIER: ${tier}

YOUR ROLE:
${guidanceInstruction}

RULES YOU MUST FOLLOW:
- Keep responses short and conversational - this is a chat, not an essay. 3-5 sentences maximum unless showing working.
- Always be warm and encouraging. Never make the student feel stupid.
- Only discuss this specific question. Do not act as a general AI assistant.
- Do not discuss other questions, topics, or anything unrelated to this question.
- Use plain language appropriate for a ${tier} tier GCSE student.
- Never mention that you are Claude or that you are an AI. You are JAM Help.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message ?? 'Claude API error');
    }

    const reply = data.content?.[0]?.text ?? '';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
