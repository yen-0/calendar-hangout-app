import { NextRequest, NextResponse } from 'next/server';
import { differenceInMinutes, getDay, isWeekend } from 'date-fns';
import { z } from 'zod';
import { HttpError, requireUid } from '@/lib/google/auth-helpers';

export const runtime = 'nodejs';

const SlotInputSchema = z.object({
  startISO: z.string(),
  endISO: z.string(),
  availableParticipants: z.array(z.string()).optional().default([]),
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

type SlotInput = z.infer<typeof SlotInputSchema>;

type RankedSlot = {
  index: number;
  rationale: string;
  score: number;
};

function isWorkLike(name: string): boolean {
  return /meet|meeting|work|sync|standup|review|planning|project|call|strategy/i.test(name);
}

function isCasual(name: string): boolean {
  return /hangout|party|dinner|lunch|brunch|coffee|drinks|game|movie|chat|social|hang/i.test(name);
}

function buildRationale(parts: string[]): string {
  const sentence = parts
    .filter(Boolean)
    .join(' ');
  return sentence.length > 140 ? sentence.slice(0, 139).trimEnd() : sentence;
}

function describeAvailability(availableCount: number, memberCount: number): { label: string; score: number } {
  if (availableCount <= 0) {
    return { label: 'Availability is thin here.', score: -2 };
  }

  if (availableCount >= memberCount) {
    return {
      label: `${availableCount} people are available, which clears the target.`,
      score: 5 + (availableCount - memberCount) * 0.5,
    };
  }

  const ratio = availableCount / Math.max(1, memberCount);
  if (ratio >= 0.8) {
    return {
      label: `${availableCount} of ${memberCount} people are available here.`,
      score: 3.5,
    };
  }

  if (availableCount >= 2) {
    return {
      label: 'A few people are free, but this is a narrower slot.',
      score: 1.5,
    };
  }

  return {
    label: 'Only a small part of the group is free here.',
    score: 0.5,
  };
}

function describeDay(date: Date, workLike: boolean, casual: boolean): { label: string; score: number } {
  const day = getDay(date);

  if (workLike) {
    if (day >= 2 && day <= 4) return { label: 'Midweek timing fits a work-style hangout.', score: 4 };
    if (day === 1 || day === 5) return { label: 'A weekday slot keeps this practical.', score: 1 };
    if (isWeekend(date)) return { label: 'Weekend timing is less ideal for a work-style hangout.', score: -2 };
  }

  if (casual) {
    if (isWeekend(date)) return { label: 'Weekend timing fits a casual hangout.', score: 4 };
    if (day === 5) return { label: 'Friday can work well for a casual hangout.', score: 2 };
    if (day >= 2 && day <= 4) return { label: 'Midweek timing is still reasonable here.', score: 1 };
  }

  if (day >= 2 && day <= 4) return { label: 'Midweek timing is generally favorable.', score: 3 };
  if (isWeekend(date)) return { label: 'Weekend timing is a decent fit.', score: 2 };
  return { label: 'A standard weekday slot keeps it simple.', score: 1 };
}

function describeTime(start: Date, end: Date, workLike: boolean, casual: boolean): { label: string; score: number } {
  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;

  if (startHour < 8 || endHour > 21) {
    return { label: 'The time is a bit outside the comfortable range.', score: -3 };
  }

  if (startHour >= 10 && endHour <= 12) {
    return {
      label: workLike
        ? 'Late-morning timing works well for a work-style hangout.'
        : 'Late-morning timing is a strong fit.',
      score: 4,
    };
  }

  if (startHour >= 14 && endHour <= 16) {
    return {
      label: workLike
        ? 'Afternoon timing is a strong work-friendly window.'
        : 'Afternoon timing lands in a comfortable window.',
      score: 4,
    };
  }

  if (startHour >= 12 && endHour <= 13) {
    return {
      label: casual ? 'Lunch timing fits a meal-style hangout.' : 'Lunch hour is usually a harder slot.',
      score: casual ? 2 : -3,
    };
  }

  if (startHour >= 18 && endHour <= 20) {
    return {
      label: casual ? 'Early evening timing works for a casual plan.' : 'Early evening timing is still usable.',
      score: casual ? 3 : 1,
    };
  }

  return { label: 'The timing is acceptable.', score: 1 };
}

function describeStart(start: Date): { label: string; score: number } {
  const minute = start.getMinutes();
  if (minute === 0) return { label: 'A clean top-of-hour start feels easy to read.', score: 1.5 };
  if (minute === 30) return { label: 'A clean half-hour start keeps the slot tidy.', score: 1.25 };
  if (minute === 15 || minute === 45) return { label: 'The start time is still fairly tidy.', score: 0.5 };
  return { label: 'The start time is a little unusual.', score: 0 };
}

function describeBuffer(durationMinutes: number, requestedMinutes: number): { label: string; score: number } {
  const extra = durationMinutes - requestedMinutes;
  if (extra >= 60) return { label: 'There is plenty of extra room in the slot.', score: 2 };
  if (extra >= 30) return { label: 'There is a comfortable amount of extra room.', score: 1.5 };
  if (extra >= 0) return { label: 'The slot is long enough for the request.', score: 1 };
  return { label: 'This slot is shorter than the requested duration.', score: -3 };
}

function scoreSlot(slot: SlotInput, index: number, body: z.infer<typeof RequestBodySchema>): RankedSlot {
  const start = new Date(slot.startISO);
  const end = new Date(slot.endISO);
  const durationMinutes = Math.max(1, differenceInMinutes(end, start));
  const workLike = isWorkLike(body.hangoutName);
  const casual = isCasual(body.hangoutName);

  const availability = describeAvailability(slot.availableParticipants.length, body.memberCount);
  const day = describeDay(start, workLike, casual);
  const time = describeTime(start, end, workLike, casual);
  const startStyle = describeStart(start);
  const buffer = describeBuffer(durationMinutes, body.durationMinutes);

  const score =
    availability.score * 10 +
    day.score * 4 +
    time.score * 5 +
    startStyle.score * 2 +
    buffer.score * 3 -
    index * 0.001;

  const rationale = buildRationale([
    availability.label,
    time.label,
    day.label,
  ]);

  return {
    index,
    score,
    rationale,
  };
}

export async function POST(req: NextRequest) {
  try {
    await requireUid(req);

    const json = await req.json();
    const parsed = RequestBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }

    const ranked = parsed.data.slots
      .map((slot, index) => scoreSlot(slot, index, parsed.data))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, Math.min(3, parsed.data.slots.length))
      .map(({ index, rationale }) => ({ index, rationale }));

    const validated = RankedResponseSchema.safeParse({ ranked });
    if (!validated.success) {
      return NextResponse.json(
        { error: 'ranking_failed', issues: validated.error.issues },
        { status: 500 },
      );
    }

    return NextResponse.json({ ranked: validated.data.ranked });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
