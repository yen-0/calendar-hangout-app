'use client';

import { ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { TsudoiGridRow, TsudoiTimeGridRow } from '@/utils/tsudoiGridUtils';
import { TsudoiWeekDay } from '@/utils/tsudoiWeekUtils';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  weekDays: TsudoiWeekDay[];
  rows: TsudoiGridRow[];
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onTimeLabelClick?: (row: TsudoiTimeGridRow) => void;
  onDayLabelClick?: (dayLabel: string) => void;
  renderCell: (day: TsudoiWeekDay, row: TsudoiTimeGridRow) => ReactNode;
  timeHeaderContent?: ReactNode;
}

const copy = {
  ja: {
    time: '時間',
    previous: '前の週',
    next: '次の週',
    selectRow: (label: string) => `${label} の候補をまとめて選択`,
    selectDay: (label: string) => `${label} の候補をすべて選択`,
  },
  en: {
    time: 'Time',
    previous: 'Previous week',
    next: 'Next week',
    selectRow: (label: string) => `Select all cells for ${label}`,
    selectDay: (label: string) => `Select all candidate slots for ${label}`,
  },
} as const;

export function TsudoiWeeklyGridTable({
  weekDays,
  rows,
  onPreviousWeek,
  onNextWeek,
  onTimeLabelClick,
  onDayLabelClick,
  renderCell,
  timeHeaderContent,
}: Props) {
  const { language } = useLanguage();
  const content = copy[language];

  return (
    <div className="overflow-auto">
      <div
        className="grid min-w-[860px] gap-px rounded-xl border border-slate-200 bg-slate-200"
        style={{
          gridTemplateColumns: '72px repeat(7, minmax(96px, 1fr))',
          gridTemplateRows: `40px repeat(${rows.length}, minmax(32px, auto))`,
        }}
      >
        <div className="sticky left-0 top-0 z-10 flex items-center justify-between gap-2 bg-slate-100 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>{content.time}</span>
          {timeHeaderContent ? <div className="shrink-0">{timeHeaderContent}</div> : null}
        </div>

        {weekDays.map((day) => {
          const isMonday = day.index === 0;
          const isSunday = day.index === 6;

          return (
            <div
              key={day.index}
              className="sticky top-0 z-10 flex items-center justify-center gap-1 bg-slate-100 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600"
            >
              {isMonday && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onPreviousWeek}
                  aria-label={content.previous}
                  className="h-8 w-8 shrink-0"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
              )}
              {onDayLabelClick ? (
                <button
                  type="button"
                  onClick={() => onDayLabelClick(day.label)}
                  aria-label={content.selectDay(day.label)}
                  className="flex min-w-0 flex-1 items-center justify-center rounded px-1 py-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-200/70"
                >
                  <span className="whitespace-nowrap">{day.label}</span>
                </button>
              ) : (
                <span className="whitespace-nowrap">{day.label}</span>
              )}
              {isSunday && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onNextWeek}
                  aria-label={content.next}
                  className="h-8 w-8 shrink-0"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}

        {rows.map((row) => (
          <div key={row.startMinutes} className="contents">
            {onTimeLabelClick ? (
              <button
                type="button"
                onClick={() => onTimeLabelClick(row)}
                aria-label={content.selectRow(row.label)}
                className="sticky left-0 z-10 flex min-h-[32px] items-start justify-start bg-white px-2 py-2 text-[11px] text-slate-500 transition hover:bg-slate-100"
              >
                {row.label}
              </button>
            ) : (
              <div className="sticky left-0 z-10 flex min-h-[32px] items-start justify-start bg-white px-2 py-2 text-[11px] text-slate-500">
                {row.label}
              </div>
            )}
            {weekDays.map((day) => (
              <div key={`${day.index}-${row.startMinutes}`} className="bg-white">
                {renderCell(day, row)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
