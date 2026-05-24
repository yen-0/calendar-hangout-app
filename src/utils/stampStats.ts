import { CalendarEvent } from '@/types/events';

export interface StampUsageStats {
  total: number;
  thisMonth: number;
}

/**
 * Build a usage-count lookup keyed by master-stamp id. Counts instances whose
 * originalStampId points back at a master; ignores recurrence virtual events
 * (those have an id like `${masterId}_${date}` and the originalStampId still
 * points at the master, which is what we want — they are real placements).
 *
 * "thisMonth" means the calendar month containing `now`, using local time.
 */
export function buildStampUsageMap(
  events: CalendarEvent[],
  now: Date = new Date(),
): Map<string, StampUsageStats> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const map = new Map<string, StampUsageStats>();

  for (const e of events) {
    if (!e.originalStampId) continue;
    const entry = map.get(e.originalStampId) ?? { total: 0, thisMonth: 0 };
    entry.total += 1;
    const start = new Date(e.start).getTime();
    if (start >= monthStart && start < monthEnd) entry.thisMonth += 1;
    map.set(e.originalStampId, entry);
  }

  return map;
}
