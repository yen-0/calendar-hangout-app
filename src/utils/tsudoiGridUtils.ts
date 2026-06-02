import { addMinutes, format, startOfDay } from 'date-fns';
import { CandidateSlotClient } from '@/types/hangouts';

export const TSUDOI_DEFAULT_VISIBLE_START_MINUTES = 9 * 60;
export const TSUDOI_DEFAULT_VISIBLE_END_MINUTES = 18 * 60;
export const TSUDOI_FULL_DAY_MINUTES = 24 * 60;

export interface TsudoiTimeGridRow {
  kind: 'time';
  startMinutes: number;
  label: string;
}
export type TsudoiGridRow = TsudoiTimeGridRow;

export interface TsudoiVisibleWindow {
  startMinutes: number;
  endMinutes: number;
}

export function getTsudoiGridStepMinutes(cellMinutes: number): number {
  return Number.isFinite(cellMinutes) && cellMinutes >= 60 ? 60 : 15;
}

export function formatTsudoiTimeLabel(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getTsudoiCellKey(date: Date, rowIndex: number): string {
  return `${format(startOfDay(date), 'yyyy-MM-dd')}|${rowIndex}`;
}

export function parseTsudoiCellKey(key: string): { date: Date; rowIndex: number } {
  const [dateKey, rowIndexString] = key.split('|');
  return {
    date: new Date(`${dateKey}T00:00:00`),
    rowIndex: Number(rowIndexString),
  };
}

export function getTsudoiCellStart(dayDate: Date, rowIndex: number, stepMinutes: number): Date {
  return addMinutes(startOfDay(dayDate), rowIndex * stepMinutes);
}

export function getTsudoiRowIndexFromMinutes(totalMinutes: number, stepMinutes: number): number {
  return Math.floor(totalMinutes / stepMinutes);
}

export function snapTsudoiMinutesDown(totalMinutes: number, stepMinutes: number): number {
  return Math.max(0, Math.floor(totalMinutes / stepMinutes) * stepMinutes);
}

export function snapTsudoiMinutesUp(totalMinutes: number, stepMinutes: number): number {
  return Math.min(TSUDOI_FULL_DAY_MINUTES, Math.ceil(totalMinutes / stepMinutes) * stepMinutes);
}

export function normalizeTsudoiVisibleWindow(
  visibleWindow: TsudoiVisibleWindow,
  stepMinutes: number,
): TsudoiVisibleWindow {
  const startMinutes = snapTsudoiMinutesDown(visibleWindow.startMinutes, stepMinutes);
  const endMinutes = Math.max(
    startMinutes + stepMinutes,
    snapTsudoiMinutesUp(visibleWindow.endMinutes, stepMinutes),
  );

  return {
    startMinutes,
    endMinutes,
  };
}

export function formatTsudoiVisibleWindowLabel(visibleWindow: TsudoiVisibleWindow): string {
  return `${formatTsudoiTimeLabel(visibleWindow.startMinutes)} - ${formatTsudoiTimeLabel(
    visibleWindow.endMinutes,
  )}`;
}

export function buildTsudoiWeekGridRows(
  visibleWindow: TsudoiVisibleWindow,
  stepMinutes: number,
): TsudoiGridRow[] {
  const rows: TsudoiTimeGridRow[] = [];
  const normalizedWindow = normalizeTsudoiVisibleWindow(visibleWindow, stepMinutes);

  for (
    let startMinutes = normalizedWindow.startMinutes;
    startMinutes < normalizedWindow.endMinutes;
    startMinutes += stepMinutes
  ) {
    rows.push({
      kind: 'time',
      startMinutes,
      label: formatTsudoiTimeLabel(startMinutes),
    });
  }

  return rows;
}

export function getSmartTsudoiVisibleWindow(
  candidateSlots: CandidateSlotClient[],
): TsudoiVisibleWindow {
  if (candidateSlots.length === 0) {
    return {
      startMinutes: TSUDOI_DEFAULT_VISIBLE_START_MINUTES,
      endMinutes: TSUDOI_DEFAULT_VISIBLE_END_MINUTES,
    };
  }

  const earliestStart = Math.min(
    ...candidateSlots.map((slot) => slot.start.getHours() * 60 + slot.start.getMinutes()),
  );
  const latestEnd = Math.max(
    ...candidateSlots.map((slot) => slot.end.getHours() * 60 + slot.end.getMinutes()),
  );

  return {
    startMinutes: Math.min(TSUDOI_DEFAULT_VISIBLE_START_MINUTES, earliestStart),
    endMinutes: Math.max(TSUDOI_DEFAULT_VISIBLE_END_MINUTES, latestEnd),
  };
}
