'use client';

import { addWeeks, differenceInMinutes, format, isSameDay } from 'date-fns';
import { useMemo, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { CandidateSlotClient, SlotResponseStatus } from '@/types/hangouts';
import { candidateSlotKey } from '@/utils/hangoutUtils';
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
import { buildTsudoiWeekDays, getTsudoiWeekStart, TsudoiWeekDay } from '@/utils/tsudoiWeekUtils';
import { TsudoiVisibleWindowControl } from './TsudoiVisibleWindowControl';
import { TsudoiWeeklyGridTable } from './TsudoiWeeklyGridTable';

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
    instructions: '候補セルを押すと、○、△、× の順で切り替わります。',
    dayHeader: '日付見出しを押すと、その日の候補をまとめて選択できます。',
    rowHeader: '時刻見出しを押すと、その時刻の候補をまとめて選択できます。',
    legend: '○ = 参加可, △ = 未定, × = 参加不可',
    visibleWindowTitle: '表示範囲',
    visibleWindowDescription:
      '週の回答グリッドに表示する時間帯を切り替えます。時間を絞ると見やすく、広げると一日全体を確認しやすくなります。',
    pressToSelect: '選択するには押してください',
    noCandidates: 'この Tsudoi には候補時間がありません。',
  },
  en: {
    instructions: 'Press a candidate cell to cycle through circle, triangle, and cross.',
    dayHeader: 'Press a day header to switch that whole column.',
    rowHeader: 'Press a time label to switch that whole row.',
    legend: '\u25cb = yes, \u25b3 = maybe, \u00d7 = no',
    visibleWindowTitle: 'Visible time range',
    visibleWindowDescription:
      'Change how much of the weekly response grid is shown. Narrow the range to focus on fewer hours, or expand it to review more of the day.',
    pressToSelect: 'Press to select',
    noCandidates: 'No candidate slots are available for this Tsudoi.',
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
  const content = copy[language] ?? copy.en;
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

  const getCurrentSlotResponse = (slot: CandidateSlotClient) => {
    const responseKey = candidateSlotKey(slot);
    const minutesFromMidnight = slot.start.getHours() * 60 + slot.start.getMinutes();
    const rowIndex = getTsudoiRowIndexFromMinutes(minutesFromMidnight, gridStepMinutes);
    const legacyKey = getTsudoiCellKey(slot.start, rowIndex);
    return responses[responseKey] ?? responses[legacyKey] ?? 'yes';
  };

  const updateSlotGroup = (slots: CandidateSlotClient[]) => {
    if (readOnly || !onChange || slots.length === 0) return;

    const currentStatuses = slots.map(getCurrentSlotResponse);
    const firstStatus = currentStatuses[0];
    const nextStatus = currentStatuses.every((status) => status === firstStatus)
      ? nextResponseStatus(firstStatus)
      : 'yes';
    const nextResponses = { ...responses };

    for (const slot of slots) {
      nextResponses[candidateSlotKey(slot)] = nextStatus;
    }

    onChange(nextResponses);
  };

  const selectDay = (day: TsudoiWeekDay) => {
    const daySlots = weekSlots.filter((slot) => isSameDay(slot.start, day.date));
    updateSlotGroup(daySlots);
  };

  const selectTimeRow = (row: TsudoiTimeGridRow) => {
    const rowSlots = weekSlots.filter((slot) => {
      const minutesFromMidnight = slot.start.getHours() * 60 + slot.start.getMinutes();
      const rowIndex = getTsudoiRowIndexFromMinutes(minutesFromMidnight, gridStepMinutes);
      return rowIndex === getTsudoiRowIndexFromMinutes(row.startMinutes, gridStepMinutes);
    });
    updateSlotGroup(rowSlots);
  };

  if (candidateSlots.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        {content.noCandidates}
      </div>
    );
  }

  const renderCell = (day: { date: Date; label: string }, row: TsudoiTimeGridRow) => {
    const rowIndex = getTsudoiRowIndexFromMinutes(row.startMinutes, gridStepMinutes);
    const key = getTsudoiCellKey(day.date, rowIndex);
    const slot = slotMap.get(key);

    if (!slot) {
      return <div className="min-h-[32px] bg-white" />;
    }

    const responseKey = candidateSlotKey(slot);
    const current = responses[responseKey] ?? responses[key] ?? 'yes';
    const slotStart = getTsudoiCellStart(day.date, rowIndex, gridStepMinutes);
    const slotEnd = new Date(slotStart.getTime() + candidateDurationMinutes * 60_000);
    const mark = RESPONSE_MARKS[current];

    return (
      <button
        type="button"
        disabled={isLoading || readOnly}
        aria-label={`${format(slotStart, 'EEE, MMM d HH:mm')} to ${format(
          slotEnd,
          'HH:mm',
        )}. Press to cycle to ${nextResponseStatus(current)}.`}
        title={content.pressToSelect}
        className={`flex h-full min-h-[32px] w-full items-center justify-center border text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${RESPONSE_CELL_CLASSES[current]}`}
        onClick={() => updateResponse(responseKey)}
      >
        {mark}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span>{content.instructions}</span>
        <span>{content.dayHeader}</span>
        <span>{content.rowHeader}</span>
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
        onTimeLabelClick={selectTimeRow}
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
