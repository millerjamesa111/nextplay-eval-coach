import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/system-prompt';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { transcript, repName, callType } = await request.json();

    if (!transcript || !repName) {
      return Response.json({ error: 'Missing transcript or repName' }, { status: 400 });
    }

    const supabase = createServerSupabase();

    // Get custom system prompt if exists
    const { data: promptData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'system_prompt')
      .single();

    const systemPrompt = promptData?.value || DEFAULT_SYSTEM_PROMPT;

    // Get objection handling doc if exists
    const { data: objectionData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'objection_doc')
      .single();

    let fullSystemPrompt = systemPrompt;
    if (objectionData?.value) {
      fullSystemPrompt += `\n\n---\n\n## OBJECTION HANDLING REFERENCE\n\nWhen suggesting sharper versions for objection moments, reference these examples for tone and approach:\n\n${objectionData.value}`;
    }

    // Prepend the selected call type so the prompt's branching fires automatically
    const callTypeHeader = callType ? `CALL TYPE: ${callType}\n\n` : '';
    const userContent = `${callTypeHeader}${transcript}`;

    // Create streaming response
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 2500,
      system: fullSystemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullText = '';

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            fullText += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, fullText })}\n\n`));
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, fullText })}\n\n`));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    return Response.json({ error: 'Failed to analyze transcript' }, { status: 500 });
  }
}
