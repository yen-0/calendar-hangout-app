import { CalendarEvent } from '@/types/events';
import { PackedStamp } from '@/types/stampPacks';

/** Serialize a stamp definition into the timezone-free pack format. */
export function packStamp(stamp: CalendarEvent): PackedStamp {
  const start = new Date(stamp.start);
  const end = new Date(stamp.end);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const durationMs = end.getTime() - start.getTime();
  const durationMinutes = Math.max(1, Math.round(durationMs / 60_000));
  const result: PackedStamp = {
    title: stamp.title,
    startMinutes,
    durationMinutes,
  };
  if (stamp.emoji) result.emoji = stamp.emoji;
  if (stamp.color) result.color = stamp.color;
  if (stamp.stampCategory) result.category = stamp.stampCategory;
  if (stamp.stampAvailability && stamp.stampAvailability !== 'busy') {
    result.availability = stamp.stampAvailability;
  }
  return result;
}

/** Materialize a packed stamp into a new local CalendarEvent definition. */
export function unpackStamp(p: PackedStamp): Omit<CalendarEvent, 'id'> {
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    Math.floor(p.startMinutes / 60),
    p.startMinutes % 60,
    0,
    0,
  );
  const end = new Date(start.getTime() + p.durationMinutes * 60_000);
  return {
    title: p.title,
    emoji: p.emoji,
    color: p.color,
    start,
    end,
    isStamp: true,
    allDay: false,
    stampCategory: p.category,
    stampAvailability: p.availability ?? 'busy',
  };
}
