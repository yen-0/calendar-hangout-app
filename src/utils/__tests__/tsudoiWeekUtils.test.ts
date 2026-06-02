import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import {
  buildTsudoiWeekDays,
  formatTsudoiWeekRange,
  getTsudoiWeekStart,
  isTsudoiSlotInPast,
} from '../tsudoiWeekUtils';

describe('tsudoiWeekUtils', () => {
  it('normalizes any date to the Monday of that week', () => {
    const weekStart = getTsudoiWeekStart(new Date('2026-05-27T15:30:00'));
    expect(format(weekStart, 'yyyy-MM-dd HH:mm')).toBe('2026-05-25 00:00');
  });

  it('builds a Monday-through-Sunday week grid', () => {
    const days = buildTsudoiWeekDays(new Date('2026-05-27T15:30:00'));
    expect(days).toHaveLength(7);
    expect(days[0].label).toBe('Mon 5/25');
    expect(days[6].label).toBe('Sun 5/31');
  });

  it('formats the visible week range', () => {
    expect(formatTsudoiWeekRange(new Date('2026-05-27T15:30:00'))).toBe(
      'May 25, 2026 - May 31, 2026',
    );
  });

  it('marks slots before the current time as past', () => {
    expect(
      isTsudoiSlotInPast(
        new Date('2026-05-27T10:00:00'),
        new Date('2026-05-27T10:30:00'),
      ),
    ).toBe(true);
    expect(
      isTsudoiSlotInPast(
        new Date('2026-05-27T11:00:00'),
        new Date('2026-05-27T10:30:00'),
      ),
    ).toBe(false);
  });
});
