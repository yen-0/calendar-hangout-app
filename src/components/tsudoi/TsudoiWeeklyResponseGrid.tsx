'use client';

import { addWeeks, differenceInMinutes, format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import { CandidateSlotClient, SlotResponseStatus } from '@/types/hangouts';
import {
  buildTsudoiWeekGridRows,
  getSmartTsudoiVisibleWindow,
  getTsudoiCellKey,
  getTsudoiCellStart,
  getTsudoiGridStepMinutes,
  getTsudoiRowIndexFromMinutes,
  TsudoiTimeGridRow,
  TsudoiVisibleWindow,
} from '@/utils/tsudoiGridUtils';
import { buildTsudoiWeekDays, getTsudoiWeekStart } from '@/utils/tsudoiWeekUtils';
import { TsudoiWeeklyGridTable } from './TsudoiWeeklyGridTable';
import { TsudoiVisibleWindowControl } from './TsudoiVisibleWindowControl';

interface Props {
  candidateSlots: CandidateSlotClient[];
  responses: Record<string, SlotResponseStatus>;
  isLoading?: boolean;
  readOnly?: boolean;
  onChange?: (responses: Record<string, SlotResponseStatus>) => void;
}

const RESPONSE_MARKS: Record<SlotResponseStatus, string> = {
  yes: '\u25cb',
  maybe: '\u25b3',
  no: '\u00d7',
};

const RESPONSE_CELL_CLASSES: Record<SlotResponseStatus, string> = {
  yes: 'border-emerald-500 bg-emerald-100 text-emerald-900 hover:bg-emerald-200',
  maybe: 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200',
  no: 'border-rose-500 bg-rose-100 text-rose-900 hover:bg-rose-200',
};

const copy = {
  ja: {
    instructions:
      '\u5019\u88dc\u30bb\u30eb\u3092\u62bc\u3059\u3068\u3001\u25cb\u3001\u25b3\u3001\u00d7 \u306e\u9806\u3067\u5207\u308a\u66ff\u308f\u308a\u307e\u3059\u3002',
    dayHeader:
      '\u65e5\u4ed8\u898b\u51fa\u3057\u3092\u62bc\u3059\u3068\u3001\u305d\u306e\u65e5\u306e\u5019\u88dc\u3092\u307e\u3068\u3081\u3066\u9078\u629e\u3067\u304d\u307e\u3059\u3002',
    legend: '\u25cb = \u53c2\u52a0\u53ef, \u25b3 = \u672a\u5b9a, \u00d7 = \u53c2\u52a0\u4e0d\u53ef',
    visibleWindowTitle: '\u8868\u793a\u7bc4\u56f2',
    visibleWindowDescription:
      '\u9031\u306e\u56de\u7b54\u30b0\u30ea\u30c3\u30c9\u306b\u8868\u793a\u3059\u308b\u6642\u9593\u5e2f\u3092\u5207\u308a\u66ff\u3048\u307e\u3059\u3002\u6642\u9593\u3092\u7d5e\u308b\u3068\u898b\u3084\u3059\u304f\u3001\u5e83\u3052\u308b\u3068\u4e00\u65e5\u5168\u4f53\u3092\u78ba\u8a8d\u3057\u3084\u3059\u304f\u306a\u308a\u307e\u3059\u3002',
    pressToSelect: '\u9078\u629e\u3059\u308b\u306b\u306f\u62bc\u3057\u3066\u304f\u3060\u3055\u3044',
  },
  en: {
    instructions: 'Press a candidate cell to cycle through circle, triangle, and cross.',
    dayHeader: 'Press a day header to select all candidate slots for that day.',
    legend: '\u25cb = yes, \u25b3 = maybe, \u00d7 = no',
    visibleWindowTitle: 'Visible time range',
    visibleWindowDescription:
      'Change how much of the weekly response grid is shown. Narrow the range to focus on fewer hours, or expand it to review more of the day.',
    pressToSelect: 'Press to select',
  },
} as const;

function nextResponseStatus(status: SlotResponseStatus): SlotResponseStatus {
  if (status === 'yes') return 'maybe';
  if (status === 'maybe') return 'no';
  return 'yes';
}

export function TsudoiWeeklyResponseGrid({
  candidateSlots,
  responses,
  isLoading = false,
  readOnly = false,
  onChange,
}: Props) {
  const { language } = useLanguage();
  const content = copy[language];
  const initialWeekStartDate = useMemo(() => {
    if (candidateSlots.length === 0) return getTsudoiWeekStart(new Date());
    const earliestSlot = candidateSlots.reduce(
      (earliest, slot) => (slot.start < earliest.start ? slot : earliest),
      candidateSlots[0],
    );
    return getTsudoiWeekStart(earliestSlot.start);
  }, [candidateSlots]);
  const [weekStartDate, setWeekStartDate] = useState(initialWeekStartDate);

  const candidateDurationMinutes = useMemo(() => {
    if (candidateSlots[0]) {
      return Math.max(15, differenceInMinutes(candidateSlots[0].end, candidateSlots[0].start));
    }
    return 60;
  }, [candidateSlots]);

  const gridStepMinutes = useMemo(
    () => getTsudoiGridStepMinutes(candidateDurationMinutes),
    [candidateDurationMinutes],
  );

  const weekDays = useMemo(() => buildTsudoiWeekDays(weekStartDate), [weekStartDate]);
  const weekEndDate = useMemo(() => addWeeks(weekStartDate, 1), [weekStartDate]);
  const weekSlots = useMemo(
    () => candidateSlots.filter((slot) => slot.start >= weekStartDate && slot.start < weekEndDate),
    [candidateSlots, weekEndDate, weekStartDate],
  );
  const visibleWindow = useMemo(() => getSmartTsudoiVisibleWindow(weekSlots), [weekSlots]);
  const [visibleWindowState, setVisibleWindowState] = useState<TsudoiVisibleWindow>(visibleWindow);

  const rows = useMemo(
    () => buildTsudoiWeekGridRows(visibleWindowState, gridStepMinutes),
    [gridStepMinutes, visibleWindowState],
  );

  const slotMap = useMemo(() => {
    const map = new Map<string, CandidateSlotClient>();
    for (const slot of weekSlots) {
      const minutesFromMidnight = slot.start.getHours() * 60 + slot.start.getMinutes();
      const rowIndex = getTsudoiRowIndexFromMinutes(minutesFromMidnight, gridStepMinutes);
      map.set(getTsudoiCellKey(slot.start, rowIndex), slot);
    }
    return map;
  }, [gridStepMinutes, weekSlots]);

  const updateResponse = (slotKey: string) => {
    if (readOnly || !onChange) return;
    const current = responses[slotKey] ?? 'yes';
    onChange({ ...responses, [slotKey]: nextResponseStatus(current) });
  };

  const selectDay = (dayLabel: string) => {
    if (readOnly || !onChange) return;

    const daySlots = weekSlots.filter((slot) => format(slot.start, 'EEE M/d') === dayLabel);
    if (daySlots.length === 0) return;

    const nextResponses = { ...responses };
    for (const slot of daySlots) {
      const minutesFromMidnight = slot.start.getHours() * 60 + slot.start.getMinutes();
      const rowIndex = getTsudoiRowIndexFromMinutes(minutesFromMidnight, gridStepMinutes);
      nextResponses[getTsudoiCellKey(slot.start, rowIndex)] = 'yes';
    }

    onChange(nextResponses);
  };

  if (candidateSlots.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No candidate slots are available for this Tsudoi.
      </div>
    );
  }

  const renderCell = (day: { date: Date; label: string }, row: TsudoiTimeGridRow) => {
    const rowIndex = getTsudoiRowIndexFromMinutes(row.startMinutes, gridStepMinutes);
    const key = getTsudoiCellKey(day.date, rowIndex);
    const slot = slotMap.get(key);
    const current = responses[key] ?? 'yes';

    if (!slot) {
      return <div className="min-h-[32px] bg-white" />;
    }

    const slotStart = getTsudoiCellStart(day.date, rowIndex, gridStepMinutes);
    const slotEnd = new Date(slotStart.getTime() + candidateDurationMinutes * 60_000);
    const mark = RESPONSE_MARKS[current];

    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isLoading || readOnly}
        aria-label={`${format(slotStart, 'EEE, MMM d HH:mm')} to ${format(
          slotEnd,
          'HH:mm',
        )}. Press to cycle to ${nextResponseStatus(current)}.`}
        title={content.pressToSelect}
        className={`h-full min-h-[32px] w-full rounded-none border text-lg font-semibold ${RESPONSE_CELL_CLASSES[current]}`}
        onClick={() => updateResponse(key)}
      >
        {mark}
      </Button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span>{content.instructions}</span>
        <span>{content.dayHeader}</span>
        <span className="font-semibold text-slate-700">{content.legend}</span>
      </div>

      <TsudoiWeeklyGridTable
        weekDays={weekDays}
        rows={rows}
        onPreviousWeek={() => {
          setWeekStartDate((current) => getTsudoiWeekStart(addWeeks(current, -1)));
        }}
        onNextWeek={() => {
          setWeekStartDate((current) => getTsudoiWeekStart(addWeeks(current, 1)));
        }}
        renderCell={renderCell}
        onDayLabelClick={selectDay}
        timeHeaderContent={
          <TsudoiVisibleWindowControl
            visibleWindow={visibleWindowState}
            gridStepMinutes={gridStepMinutes}
            onChange={setVisibleWindowState}
            title={content.visibleWindowTitle}
            description={content.visibleWindowDescription}
          />
        }
      />
    </div>
  );
}
