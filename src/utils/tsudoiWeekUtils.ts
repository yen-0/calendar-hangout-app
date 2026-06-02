import { addDays, format, isBefore, startOfDay, startOfWeek } from 'date-fns';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface TsudoiWeekDay {
  index: number;
  date: Date;
  label: string;
}

export function getTsudoiWeekStart(date: Date): Date {
  return startOfDay(startOfWeek(date, { weekStartsOn: 1 }));
}

export function buildTsudoiWeekDays(weekStartDate: Date): TsudoiWeekDay[] {
  const monday = getTsudoiWeekStart(weekStartDate);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    return {
      index,
      date,
      label: `${WEEKDAY_LABELS[index]} ${format(date, 'M/d')}`,
    };
  });
}

export function formatTsudoiWeekRange(weekStartDate: Date): string {
  const monday = getTsudoiWeekStart(weekStartDate);
  const sunday = addDays(monday, 6);
  return `${format(monday, 'MMM d, yyyy')} - ${format(sunday, 'MMM d, yyyy')}`;
}

export function isTsudoiSlotInPast(slotStart: Date, now: Date): boolean {
  return isBefore(slotStart, now);
}
