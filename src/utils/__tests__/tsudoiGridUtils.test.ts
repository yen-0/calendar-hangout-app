import { describe, expect, it } from 'vitest';
import {
  buildTsudoiWeekGridRows,
  formatTsudoiTimeLabel,
  formatTsudoiVisibleWindowLabel,
  getSmartTsudoiVisibleWindow,
  getTsudoiCellKey,
  getTsudoiGridStepMinutes,
  normalizeTsudoiVisibleWindow,
  parseTsudoiCellKey,
  TSUDOI_DEFAULT_VISIBLE_END_MINUTES,
  TSUDOI_DEFAULT_VISIBLE_START_MINUTES,
} from '../tsudoiGridUtils';

describe('tsudoiGridUtils', () => {
  it('uses hourly rows for 1 hour or longer and quarter-hour rows for shorter durations', () => {
    expect(getTsudoiGridStepMinutes(30)).toBe(15);
    expect(getTsudoiGridStepMinutes(60)).toBe(60);
    expect(getTsudoiGridStepMinutes(90)).toBe(60);
  });

  it('clips to the default work window unless candidate slots extend beyond it', () => {
    expect(getSmartTsudoiVisibleWindow([])).toEqual({
      startMinutes: TSUDOI_DEFAULT_VISIBLE_START_MINUTES,
      endMinutes: TSUDOI_DEFAULT_VISIBLE_END_MINUTES,
    });

    expect(
      getSmartTsudoiVisibleWindow([
        {
          start: new Date('2026-05-25T07:00:00'),
          end: new Date('2026-05-25T08:00:00'),
        },
        {
          start: new Date('2026-05-29T20:00:00'),
          end: new Date('2026-05-29T21:00:00'),
        },
      ]),
    ).toEqual({
      startMinutes: 420,
      endMinutes: 1260,
    });
  });

  it('treats slots that end at midnight as extending to 24:00', () => {
    expect(
      getSmartTsudoiVisibleWindow([
        {
          start: new Date('2026-05-29T23:00:00'),
          end: new Date('2026-05-30T00:00:00'),
        },
      ]),
    ).toEqual({
      startMinutes: TSUDOI_DEFAULT_VISIBLE_START_MINUTES,
      endMinutes: 24 * 60,
    });
  });

  it('normalizes the visible window to the current grid step', () => {
    expect(
      normalizeTsudoiVisibleWindow(
        {
          startMinutes: 9 * 60 + 10,
          endMinutes: 17 * 60 + 5,
        },
        15,
      ),
    ).toEqual({
      startMinutes: 9 * 60,
      endMinutes: 17 * 60 + 15,
    });
    expect(formatTsudoiVisibleWindowLabel({ startMinutes: 9 * 60, endMinutes: 18 * 60 })).toBe(
      '09:00 - 18:00',
    );
  });

  it('builds only visible time rows within the selected window', () => {
    const rows = buildTsudoiWeekGridRows({ startMinutes: 9 * 60, endMinutes: 18 * 60 }, 60);

    expect(rows).toHaveLength(9);
    expect(rows[0]).toMatchObject({ kind: 'time', startMinutes: 9 * 60, label: '09:00' });
    expect(rows[rows.length - 1]).toMatchObject({
      kind: 'time',
      startMinutes: 17 * 60,
      label: '17:00',
    });
  });

  it('round-trips grid cell keys', () => {
    const key = getTsudoiCellKey(new Date('2026-05-25T00:00:00'), 36);
    expect(parseTsudoiCellKey(key)).toEqual({
      date: new Date('2026-05-25T00:00:00'),
      rowIndex: 36,
    });
    expect(formatTsudoiTimeLabel(9 * 60)).toBe('09:00');
  });
});
