'use client';

import { addWeeks, differenceInMinutes, format } from 'date-fns';
import { useMemo, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { CandidateSlotClient, CommonSlotClient, HangoutRequestClientState } from '@/types/hangouts';
import { candidateSlotKey, getSlotAttendanceBreakdown } from '@/utils/hangoutUtils';
import {
  buildTsudoiWeekGridRows,
  getSmartTsudoiVisibleWindow,
  getTsudoiCellKey,
  getTsudoiGridStepMinutes,
  getTsudoiRowIndexFromMinutes,
  TsudoiTimeGridRow,
  TsudoiVisibleWindow,
} from '@/utils/tsudoiGridUtils';
import { buildTsudoiWeekDays, getTsudoiWeekStart } from '@/utils/tsudoiWeekUtils';
import { TsudoiVisibleWindowControl } from './TsudoiVisibleWindowControl';
import { TsudoiWeeklyGridTable } from './TsudoiWeeklyGridTable';

interface Props {
  candidateSlots: CandidateSlotClient[];
  commonSlots: CommonSlotClient[];
  participants: HangoutRequestClientState['participants'];
  canSelect?: boolean;
  onSelectCommonSlot?: (index: number) => void;
}

const copy = {
  ja: {
    visibleWindowTitle: '\u8868\u793a\u7bc4\u56f2',
    visibleWindowDescription:
      '\u30e9\u30a4\u30d6\u7d50\u679c\u30b0\u30ea\u30c3\u30c9\u306b\u8868\u793a\u3059\u308b\u6642\u9593\u5e2f\u3092\u5207\u308a\u66ff\u3048\u307e\u3059\u3002',
    noCandidates:
      '\u3053\u306e Tsudoi \u306b\u5019\u88dc\u6642\u9593\u304c\u3042\u308a\u307e\u305b\u3093\u3002',
    noResponses: '\u307e\u3060\u56de\u7b54\u304c\u3042\u308a\u307e\u305b\u3093\u3002',
  },
  en: {
    visibleWindowTitle: 'Visible time range',
    visibleWindowDescription: 'Change the time range shown in the live results grid.',
    noCandidates: 'No candidate slots are available for this Tsudoi.',
    noResponses: 'No responses yet.',
  },
} as const;

function getResultCellClass({
  yesCount,
  maybeCount,
  noCount,
  totalCount,
  isViable,
}: {
  yesCount: number;
  maybeCount: number;
  noCount: number;
  totalCount: number;
  isViable: boolean;
}) {
  if (totalCount === 0) {
    return 'border-slate-100 bg-slate-50 text-slate-500';
  }

  const quality = (yesCount + maybeCount * 0.5) / totalCount;

  if (!isViable || quality < 0.35) {
    return 'border-rose-300 bg-rose-50 text-rose-950 hover:bg-rose-100';
  }
  if (quality < 0.6) {
    return 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100';
  }
  if (quality < 0.85 || noCount > 0) {
    return 'border-sky-300 bg-sky-50 text-sky-950 hover:bg-sky-100';
  }

  return 'border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100';
}

export function TsudoiLiveResultsGrid({
  candidateSlots,
  commonSlots,
  participants,
  canSelect = false,
  onSelectCommonSlot,
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
    if (!candidateSlots[0]) return 60;
    return Math.max(15, differenceInMinutes(candidateSlots[0].end, candidateSlots[0].start));
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
  const defaultVisibleWindow = useMemo(() => getSmartTsudoiVisibleWindow(weekSlots), [weekSlots]);
  const [visibleWindow, setVisibleWindow] = useState<TsudoiVisibleWindow>(defaultVisibleWindow);

  const rows = useMemo(
    () => buildTsudoiWeekGridRows(visibleWindow, gridStepMinutes),
    [gridStepMinutes, visibleWindow],
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

  const commonSlotIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    commonSlots.forEach((slot, index) => {
      map.set(candidateSlotKey(slot), index);
    });
    return map;
  }, [commonSlots]);

  if (candidateSlots.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        {content.noCandidates}
      </div>
    );
  }

  const hasParticipants = Object.keys(participants).length > 0;

  const renderCell = (day: { date: Date; label: string }, row: TsudoiTimeGridRow) => {
    const rowIndex = getTsudoiRowIndexFromMinutes(row.startMinutes, gridStepMinutes);
    const key = getTsudoiCellKey(day.date, rowIndex);
    const slot = slotMap.get(key);

    if (!slot) {
      return <div className="min-h-[44px] bg-white" />;
    }

    const slotKey = candidateSlotKey(slot);
    const commonSlotIndex = commonSlotIndexByKey.get(slotKey);
    const isViable = commonSlotIndex !== undefined;
    const breakdown = getSlotAttendanceBreakdown(slot, participants);
    const totalCount = breakdown.participants.length;
    const slotLabel = `${format(slot.start, 'EEE, MMM d HH:mm')} to ${format(slot.end, 'HH:mm')}`;
    const cellContent = hasParticipants ? (
      <>
        <span className="text-sm font-semibold">{breakdown.yesCount}</span>
        <span className="text-[11px] text-emerald-700">yes</span>
        <span className="text-sm font-semibold">{breakdown.maybeCount}</span>
        <span className="text-[11px] text-amber-700">maybe</span>
        <span className="text-sm font-semibold">{breakdown.noCount}</span>
        <span className="text-[11px] text-rose-700">no</span>
      </>
    ) : (
      <span className="col-span-6 text-xs text-slate-400">{content.noResponses}</span>
    );
    const resultToneClass = getResultCellClass({
      yesCount: breakdown.yesCount,
      maybeCount: breakdown.maybeCount,
      noCount: breakdown.noCount,
      totalCount,
      isViable,
    });

    const className = `grid h-full min-h-[44px] w-full grid-cols-6 items-center gap-x-1 rounded-none border p-1 text-center ${resultToneClass}`;

    if (canSelect && isViable && onSelectCommonSlot) {
      return (
        <button
          type="button"
          aria-label={`Select ${slotLabel}`}
          className={className}
          onClick={() => onSelectCommonSlot(commonSlotIndex)}
        >
          {cellContent}
        </button>
      );
    }

    return (
      <div aria-label={slotLabel} className={className}>
        {cellContent}
      </div>
    );
  };

  return (
    <TsudoiWeeklyGridTable
      weekDays={weekDays}
      rows={rows}
      onPreviousWeek={() =>
        setWeekStartDate((current) => getTsudoiWeekStart(addWeeks(current, -1)))
      }
      onNextWeek={() => setWeekStartDate((current) => getTsudoiWeekStart(addWeeks(current, 1)))}
      renderCell={renderCell}
      timeHeaderContent={
        <TsudoiVisibleWindowControl
          visibleWindow={visibleWindow}
          gridStepMinutes={gridStepMinutes}
          onChange={setVisibleWindow}
          title={content.visibleWindowTitle}
          description={content.visibleWindowDescription}
        />
      }
    />
  );
}
