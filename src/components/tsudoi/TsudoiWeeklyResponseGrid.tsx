'use client';

import { addWeeks, differenceInMinutes, format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
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
  yes: '笳・',
  maybe: '笆ｳ',
  no: 'ﾃ・',
};

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
    () =>
      candidateSlots.filter((slot) => slot.start >= weekStartDate && slot.start < weekEndDate),
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
        title="Press to select"
        className="h-full min-h-[32px] w-full rounded-none border border-transparent text-lg font-semibold text-slate-700 hover:bg-slate-50"
        onClick={() => updateResponse(key)}
      >
        {mark}
      </Button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span>Press a candidate cell to cycle through circle, triangle, and cross.</span>
        <span>Press a day header to select all candidate slots for that day.</span>
        <span className="font-semibold text-slate-700">笳・= yes, 笆ｳ = maybe, ﾃ・= no</span>
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
            title="Visible time range"
            description="Change how much of the weekly response grid is shown. Narrow the range to focus on fewer hours, or expand it to review more of the day."
          />
        }
      />
    </div>
  );
}
