import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { z } from 'zod';
import { HttpError, requireUid } from '@/lib/google/auth-helpers';
import { getAnthropic } from '@/lib/anthropic';

export const runtime = 'nodejs';

const SlotInputSchema = z.object({
  startISO: z.string(),
  endISO: z.string(),
});

const RequestBodySchema = z.object({
  hangoutName: z.string(),
  durationMinutes: z.number().int().positive(),
  memberCount: z.number().int().positive(),
  slots: z.array(SlotInputSchema).min(1).max(40),
});

const RankedResponseSchema = z.object({
  ranked: z
    .array(
      z.object({
        index: z.number().int().min(0),
        rationale: z.string().min(1),
      }),
    )
    .min(1)
    .max(3),
});

const SYSTEM_PROMPT = `You are a scheduling assistant. You rank candidate meeting slots by likely participant preference and return JSON.

Rules of thumb:
- Time of day: 10:00-12:00 and 14:00-16:00 are typically preferred. Very early (<08:00) or late (>21:00) are usually avoided.
- Day of week: Tuesday–Thursday are often easier than Monday or Friday for work meetings; weekends are usually preferred for casual hangouts.
- Avoid 12:00-13:00 (lunch) unless the hangout is explicitly a meal.
- Round-numbered start times (e.g. 14:00) feel more "real" than odd ones (e.g. 14:15).
- Prefer slots whose duration fits comfortably (not too rushed at boundaries).

Return ONLY a JSON object in this exact shape, no surrounding text or markdown:
{"ranked": [{"index": <int>, "rationale": "<one sentence>"}, ...]}

Include between 1 and 3 entries, in descending order of preference. "index" must reference the candidate slot's position in the input list (0-based). Each rationale must be a single concise sentence (max 140 chars).`;

function buildUserMessage(body: z.infer<typeof RequestBodySchema>): string {
  const slotsText = body.slots
    .map((s, i) => {
      const start = new Date(s.startISO);
      const end = new Date(s.endISO);
      return `[${i}] ${format(start, 'EEE MMM d')} ${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`;
    })
    .join('\n');
  return `Hangout: "${body.hangoutName}"
Duration: ${body.durationMinutes} min
Members needed: ${body.memberCount}

Candidate slots:
${slotsText}`;
}

function extractJson(text: string): unknown {
  // Tolerate optional code fences around the JSON.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

export async function POST(req: NextRequest) {
  try {
    await requireUid(req);
    const client = getAnthropic();
    if (!client) {
      return NextResponse.json(
        { error: 'ai_not_configured', message: 'Set ANTHROPIC_API_KEY to enable AI ranking.' },
        { status: 503 },
      );
    }

    const json = await req.json();
    const parsed = RequestBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: buildUserMessage(parsed.data) }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'no_text_response' }, { status: 502 });
    }

    let rankedObj: unknown;
    try {
      rankedObj = extractJson(textBlock.text);
    } catch {
      return NextResponse.json(
        { error: 'unparseable_response', raw: textBlock.text },
        { status: 502 },
      );
    }

    const validated = RankedResponseSchema.safeParse(rankedObj);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'invalid_response_shape', issues: validated.error.issues, raw: rankedObj },
        { status: 502 },
      );
    }

    // Filter out indices that don't match candidate slots (defensive).
    const cleaned = validated.data.ranked.filter((r) => r.index >= 0 && r.index < parsed.data.slots.length);

    return NextResponse.json({
      ranked: cleaned,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheCreateTokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
