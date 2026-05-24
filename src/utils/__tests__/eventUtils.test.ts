import { describe, expect, it } from 'vitest';
import { dayKeyToDayIndex, expandRecurringEvents } from '../eventUtils';
import { CalendarEvent } from '@/types/events';

describe('dayKeyToDayIndex', () => {
  it('maps day keys to date-fns indices (Sunday=0)', () => {
    expect(dayKeyToDayIndex('SUN')).toBe(0);
    expect(dayKeyToDayIndex('MON')).toBe(1);
    expect(dayKeyToDayIndex('SAT')).toBe(6);
  });
});

describe('expandRecurringEvents', () => {
  const viewStart = new Date('2026-05-18T00:00:00'); // Monday
  const viewEnd = new Date('2026-05-31T23:59:59'); // Sunday — two weeks

  it('passes through a non-recurring event unchanged', () => {
    const events: CalendarEvent[] = [
      {
        id: 'e1',
        title: 'Standup',
        start: new Date('2026-05-20T09:00:00'),
        end: new Date('2026-05-20T09:30:00'),
      },
    ];
    const result = expandRecurringEvents(events, viewStart, viewEnd);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });

  it('expands a stamp recurring on Mon/Wed/Fri into instances within the window', () => {
    const stamp: CalendarEvent = {
      id: 'stamp_gym',
      title: 'Gym',
      start: new Date('2026-05-18T07:00:00'),
      end: new Date('2026-05-18T08:00:00'),
      isStamp: true,
      repeatDays: ['MON', 'WED', 'FRI'],
      repeatEndDate: new Date('2026-06-30T23:59:59'),
    };
    const result = expandRecurringEvents([stamp], viewStart, viewEnd);
    // Two weeks contains: Mon May 18, Wed May 20, Fri May 22, Mon May 25, Wed May 27, Fri May 29 → 6 instances
    expect(result.length).toBe(6);
    for (const occ of result) {
      expect(occ.originalStampId).toBe('stamp_gym');
      expect(occ.start.getHours()).toBe(7);
      expect(occ.end.getHours()).toBe(8);
      expect(occ.id).not.toBe('stamp_gym');
    }
  });

  it('respects repeatEndDate — no instances after the series ends', () => {
    const stamp: CalendarEvent = {
      id: 'stamp_short',
      title: 'Short series',
      start: new Date('2026-05-18T07:00:00'),
      end: new Date('2026-05-18T08:00:00'),
      isStamp: true,
      repeatDays: ['MON'],
      repeatEndDate: new Date('2026-05-19T23:59:59'), // ends day after first Monday
    };
    const result = expandRecurringEvents([stamp], viewStart, viewEnd);
    expect(result).toHaveLength(1);
    expect(result[0].start.getDate()).toBe(18);
  });

  it('does not include the master stamp itself among occurrences', () => {
    const stamp: CalendarEvent = {
      id: 'stamp_only',
      title: 'Daily-ish',
      start: new Date('2026-05-18T07:00:00'),
      end: new Date('2026-05-18T08:00:00'),
      isStamp: true,
      repeatDays: ['MON'],
      repeatEndDate: new Date('2026-05-25T23:59:59'),
    };
    const result = expandRecurringEvents([stamp], viewStart, viewEnd);
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('stamp_only');
  });

  it('skips a stamp with invalid (negative) duration', () => {
    const stamp: CalendarEvent = {
      id: 'broken',
      title: 'Bad',
      start: new Date('2026-05-18T08:00:00'),
      end: new Date('2026-05-18T07:00:00'),
      isStamp: true,
      repeatDays: ['MON'],
      repeatEndDate: new Date('2026-05-25T23:59:59'),
    };
    const result = expandRecurringEvents([stamp], viewStart, viewEnd);
    expect(result).toHaveLength(0);
  });

  it('passes through a previously-applied stamp instance', () => {
    const instance: CalendarEvent = {
      id: 'applied_1',
      title: 'Gym',
      start: new Date('2026-05-20T07:00:00'),
      end: new Date('2026-05-20T08:00:00'),
      isStamp: true,
      originalStampId: 'stamp_gym',
      occurrenceDate: new Date('2026-05-20T07:00:00'),
    };
    const result = expandRecurringEvents([instance], viewStart, viewEnd);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('applied_1');
  });
});
