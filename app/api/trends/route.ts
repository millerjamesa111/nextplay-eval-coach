import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { replayMoments } = await request.json();

    if (!replayMoments || replayMoments.length < 2) {
      return Response.json({ error: 'Need at least 2 submissions' }, { status: 400 });
    }

    const analysisPrompt = `You are analyzing coaching feedback from ${replayMoments.length} athlete interview calls for a high-ticket football recruiting mentorship program called Next Play.

Below are the "Replay These Moments" sections from each call — these are the moments where the interviewer's posture slipped, a redirect was soft, or an opportunity was missed.

Your job is to identify PATTERNS — what issues keep showing up across multiple calls?

${replayMoments.map((r: any, i: number) => `
---
CALL ${i + 1}: ${r.athleteName} (Rep: ${r.repName}, Grade: ${r.grade})
${r.moments}
`).join('\n')}

---

Analyze these and return a JSON object with this exact structure:
{
  "patterns": [
    {
      "issue": "Short title of the pattern (e.g., 'Soft on price redirect')",
      "count": <number of calls where this appeared>,
      "percentage": <percentage of total calls>,
      "description": "1-2 sentence description of what's happening",
      "examples": ["Brief quote or description from call 1", "Brief quote from call 2"]
    }
  ],
  "recommendation": "1-2 sentence training recommendation based on the most common issue",
  "totalCalls": ${replayMoments.length}
}

Return ONLY the JSON object, no other text. Identify the top 3-5 patterns, ordered by frequency.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const report = JSON.parse(jsonMatch[0]);
        return Response.json(report);
      }
    }

    return Response.json({ error: 'Could not parse response' }, { status: 500 });
  } catch (error) {
    console.error('Error generating trends:', error);
    return Response.json({ error: 'Failed to generate trends' }, { status: 500 });
  }
}
