'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { SparklesIcon } from '@heroicons/react/24/outline';
import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import {
  CommonSlotClient,
  HangoutRequestClientState,
  ParticipantDataClient,
} from '@/types/hangouts';
import { useRankSlots, RankedSlot } from '@/lib/queries/aiRanking';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  request: HangoutRequestClientState;
  slots: CommonSlotClient[];
  participants: { [uid: string]: ParticipantDataClient };
  selectedIndex: number | null;
  setSelectedIndex: (idx: number | null) => void;
  isCreator: boolean;
  isConfirming: boolean;
  onConfirm: () => void;
}

const RANK_BADGE_COLORS = ['bg-amber-500', 'bg-amber-400', 'bg-amber-300'];

export function CommonSlotsModal({
  isOpen,
  onClose,
  request,
  slots,
  participants,
  selectedIndex,
  setSelectedIndex,
  isCreator,
  isConfirming,
  onConfirm,
}: Props) {
  const allowSelection = isCreator && request.status !== 'confirmed';
  const rankMutation = useRankSlots();
  const [rankError, setRankError] = useState<string | null>(null);

  const rankByIndex = useMemo(() => {
    const map = new Map<number, { rank: number; rationale: string }>();
    rankMutation.data?.ranked.forEach((r: RankedSlot, i) => {
      map.set(r.index, { rank: i + 1, rationale: r.rationale });
    });
    return map;
  }, [rankMutation.data]);

  const handleRankSlots = async () => {
    setRankError(null);
    try {
      await rankMutation.mutateAsync({
        hangoutName: request.requestName,
        durationMinutes: request.desiredDurationMinutes,
        memberCount: request.desiredMemberCount,
        slots: slots.map((s) => ({
          startISO: s.start.toISOString(),
          endISO: s.end.toISOString(),
          availableParticipants: s.availableParticipants,
        })),
      });
    } catch (err) {
      setRankError(err instanceof Error ? err.message : 'Slot ranking failed');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Available Slots for "${request.requestName}"`}
      size="lg"
    >
      {isCreator && slots.length > 1 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-amber-900">
            <SparklesIcon className="h-4 w-4" />
            <span>
              {rankMutation.data
                ? 'Top-ranked slots are highlighted below.'
                : 'Get ranking suggestions for which slot to pick.'}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRankSlots}
            isLoading={rankMutation.isPending}
            disabled={rankMutation.isPending}
          >
            {rankMutation.data ? 'Re-rank' : 'Rank slots'}
          </Button>
        </div>
      )}
      {rankError && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
          {rankError}
        </div>
      )}

      <div className="max-h-[60vh] overflow-y-auto space-y-3 p-1">
        {slots.length === 0 ? (
          <div className="text-center text-slate-500 py-4 px-6 bg-slate-50 rounded-md">
            No common slots available.
          </div>
        ) : (
          slots.map((slot, index) => {
            const isSelected = selectedIndex === index;
            const rankInfo = rankByIndex.get(index);
            return (
              <div
                key={index}
                className={`relative p-4 border rounded-lg transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-300 shadow-md'
                    : rankInfo
                      ? 'bg-amber-50 border-amber-300 hover:bg-amber-100 hover:shadow-sm'
                      : 'bg-green-50 border-green-300 hover:bg-green-100 hover:shadow-sm'
                }`}
                onClick={() => allowSelection && setSelectedIndex(index)}
              >
                {rankInfo && (
                  <span
                    className={`absolute -top-2 -left-2 inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold shadow ${
                      RANK_BADGE_COLORS[rankInfo.rank - 1] ?? 'bg-amber-300'
                    }`}
                    title={`Rank #${rankInfo.rank}`}
                  >
                    #{rankInfo.rank}
                  </span>
                )}
                <p className="font-semibold text-green-700 text-md">
                  {format(slot.start, 'EEE, MMM d, yyyy')}
                </p>
                <p className="text-lg text-green-800">
                  {format(slot.start, 'hh:mm a')} â€“ {format(slot.end, 'hh:mm a')}
                </p>
                {rankInfo && (
                  <p className="mt-2 text-xs text-amber-900 italic flex items-start gap-1">
                    <SparklesIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{rankInfo.rationale}</span>
                  </p>
                )}
                {slot.availableParticipants && slot.availableParticipants.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-slate-600">
                      Available ({slot.availableParticipants.length} / {request.desiredMemberCount}):
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {slot.availableParticipants.map((pid) => (
                        <span
                          key={pid}
                          className="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full"
                        >
                          {participants[pid]?.displayName || `User ${pid.substring(0, 6)}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {isSelected && allowSelection && (
                  <div className="mt-3 text-center">
                    <CheckCircleIcon className="h-6 w-6 text-blue-600 inline-block mr-1" />
                    <span className="text-blue-700 font-semibold">Selected for Confirmation</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="mt-6 pt-4 border-t flex justify-between items-center">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        {isCreator && slots.length > 0 && (
          <Button
            onClick={onConfirm}
            disabled={isConfirming || selectedIndex === null}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Confirm Selected Slot &amp; Send Invites
          </Button>
        )}
      </div>
    </Modal>
  );
}
