'use client';

import { addWeeks, differenceInMinutes, format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { useLanguage } from '@/hooks/useLanguage';
import { CandidateSlotClient, CommonSlotClient, HangoutRequestClientState } from '@/types/hangouts';
import {
  candidateSlotKey,
  getSlotAttendanceBreakdown,
  SlotAttendanceParticipant,
} from '@/utils/hangoutUtils';
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
    detailsTitle: '\u56de\u7b54\u8a73\u7d30',
    detailsSubtitle: (slotLabel: string) => slotLabel,
    viewDetails: (slotLabel: string) => `${slotLabel} \u306e\u56de\u7b54\u3092\u8868\u793a`,
    confirmSlot: '\u3053\u306e\u5019\u88dc\u3092\u78ba\u5b9a',
    close: '\u9589\u3058\u308b',
    yesLabel: '\u53c2\u52a0\u53ef',
    maybeLabel: '\u672a\u5b9a',
    noLabel: '\u53c2\u52a0\u4e0d\u53ef',
    fallbackParticipant: '\u53c2\u52a0\u8005',
  },
  en: {
    visibleWindowTitle: 'Visible time range',
    visibleWindowDescription: 'Change the time range shown in the live results grid.',
    noCandidates: 'No candidate slots are available for this Tsudoi.',
    noResponses: 'No responses yet.',
    detailsTitle: 'Response details',
    detailsSubtitle: (slotLabel: string) => slotLabel,
    viewDetails: (slotLabel: string) => `View responses for ${slotLabel}`,
    confirmSlot: 'Confirm this slot',
    close: 'Close',
    yesLabel: 'Circle',
    maybeLabel: 'Triangle',
    noLabel: 'Cross',
    fallbackParticipant: 'Participant',
  },
} as const;

const RESULT_MARKS = {
  yes: '\u25cb',
  maybe: '\u25b3',
  no: '\u00d7',
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
  const [selectedSlot, setSelectedSlot] = useState<CandidateSlotClient | null>(null);
  const [selectedCommonSlotIndex, setSelectedCommonSlotIndex] = useState<number | undefined>();

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

  const selectedBreakdown = useMemo(
    () => (selectedSlot ? getSlotAttendanceBreakdown(selectedSlot, participants) : null),
    [participants, selectedSlot],
  );

  const selectedSlotLabel = selectedSlot
    ? `${format(selectedSlot.start, 'EEE, MMM d HH:mm')} to ${format(selectedSlot.end, 'HH:mm')}`
    : '';

  const handleOpenDetails = (slot: CandidateSlotClient, commonSlotIndex: number | undefined) => {
    setSelectedSlot(slot);
    setSelectedCommonSlotIndex(commonSlotIndex);
  };

  const handleConfirmSelectedSlot = () => {
    if (selectedCommonSlotIndex === undefined || !onSelectCommonSlot) return;
    setSelectedSlot(null);
    setSelectedCommonSlotIndex(undefined);
    onSelectCommonSlot(selectedCommonSlotIndex);
  };

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
        <span className="text-sm font-semibold text-emerald-700">{RESULT_MARKS.yes}</span>
        <span className="text-sm font-semibold">{breakdown.maybeCount}</span>
        <span className="text-sm font-semibold text-amber-700">{RESULT_MARKS.maybe}</span>
        <span className="text-sm font-semibold">{breakdown.noCount}</span>
        <span className="text-sm font-semibold text-rose-700">{RESULT_MARKS.no}</span>
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

    const className = `grid h-full min-h-[44px] w-full grid-cols-6 items-center gap-x-1 rounded-none border p-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${resultToneClass}`;

    return (
      <button
        type="button"
        aria-label={content.viewDetails(slotLabel)}
        className={className}
        onClick={() => handleOpenDetails(slot, commonSlotIndex)}
      >
        {cellContent}
      </button>
    );
  };

  const renderParticipantGroup = (
    title: string,
    mark: string,
    participantsList: SlotAttendanceParticipant[],
    toneClass: string,
  ) => (
    <div className="rounded-md border border-slate-200 bg-white">
      <div
        className={`flex items-center justify-between border-b border-slate-200 px-3 py-2 ${toneClass}`}
      >
        <span className="text-sm font-semibold">
          {mark} {title}
        </span>
        <span className="text-xs font-semibold">{participantsList.length}</span>
      </div>
      {participantsList.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {participantsList.map((participant) => (
            <li key={participant.uid} className="px-3 py-2 text-sm text-slate-700">
              {participant.displayName || content.fallbackParticipant}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-3 text-sm text-slate-400">{content.noResponses}</p>
      )}
    </div>
  );

  return (
    <>
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

      <Modal
        isOpen={!!selectedSlot}
        onClose={() => {
          setSelectedSlot(null);
          setSelectedCommonSlotIndex(undefined);
        }}
        title={content.detailsTitle}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm font-medium text-slate-600">
            {content.detailsSubtitle(selectedSlotLabel)}
          </p>

          {selectedBreakdown ? (
            <div className="space-y-3">
              {renderParticipantGroup(
                content.yesLabel,
                RESULT_MARKS.yes,
                selectedBreakdown.yesParticipants,
                'bg-emerald-50 text-emerald-900',
              )}
              {renderParticipantGroup(
                content.maybeLabel,
                RESULT_MARKS.maybe,
                selectedBreakdown.maybeParticipants,
                'bg-amber-50 text-amber-900',
              )}
              {renderParticipantGroup(
                content.noLabel,
                RESULT_MARKS.no,
                selectedBreakdown.noParticipants,
                'bg-rose-50 text-rose-900',
              )}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedSlot(null);
                setSelectedCommonSlotIndex(undefined);
              }}
            >
              {content.close}
            </Button>
            {canSelect && selectedCommonSlotIndex !== undefined && onSelectCommonSlot && (
              <Button type="button" onClick={handleConfirmSelectedSlot}>
                {content.confirmSlot}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
