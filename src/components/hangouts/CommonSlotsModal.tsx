'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { SparklesIcon } from '@heroicons/react/24/outline';
import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { CommonSlotClient, HangoutRequestClientState, ParticipantDataClient } from '@/types/hangouts';
import { useRankSlots, RankedSlot } from '@/lib/queries/aiRanking';
import { useLanguage } from '@/hooks/useLanguage';

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
  const { t, language } = useLanguage();

  const text =
    language === 'ja'
      ? {
          rankHint: rankMutation.data ? '上位の候補を下にハイライトしています。' : 'どの候補を選ぶとよいかを順位付きで提案します。',
          rankButton: rankMutation.data ? '再ランキング' : '候補を順位付け',
          noCommonSlots: '共通の候補はありません。',
          available: '参加可能',
          selected: '確定対象として選択済み',
        }
      : {
          rankHint: rankMutation.data ? 'Top-ranked slots are highlighted below.' : 'Get ranking suggestions for which slot to pick.',
          rankButton: rankMutation.data ? 'Re-rank' : 'Rank slots',
          noCommonSlots: 'No common slots available.',
          available: 'Available',
          selected: 'Selected for Confirmation',
        };

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
    <Modal isOpen={isOpen} onClose={onClose} title={`${request.requestName} - ${t.calendar.confirmSelectedSlot}`} size="lg">
      {isCreator && slots.length > 1 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-amber-900">
            <SparklesIcon className="h-4 w-4" />
            <span>{text.rankHint}</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleRankSlots} isLoading={rankMutation.isPending} disabled={rankMutation.isPending}>
            {text.rankButton}
          </Button>
        </div>
      )}
      {rankError && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{rankError}</div>}

      <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
        {slots.length === 0 ? (
          <div className="rounded-md bg-slate-50 px-6 py-4 text-center text-slate-500">
            {text.noCommonSlots}
          </div>
        ) : (
          slots.map((slot, index) => {
            const isSelected = selectedIndex === index;
            const rankInfo = rankByIndex.get(index);
            return (
              <div
                key={index}
                className={`relative cursor-pointer rounded-lg border p-4 transition-all ${
                  isSelected
                    ? 'border-blue-400 bg-blue-100 ring-2 ring-blue-300 shadow-md'
                    : rankInfo
                      ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 hover:shadow-sm'
                      : 'border-green-300 bg-green-50 hover:bg-green-100 hover:shadow-sm'
                }`}
                onClick={() => allowSelection && setSelectedIndex(index)}
              >
                {rankInfo && (
                  <span
                    className={`absolute -top-2 -left-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow ${RANK_BADGE_COLORS[rankInfo.rank - 1] ?? 'bg-amber-300'}`}
                    title={`Rank #${rankInfo.rank}`}
                  >
                    #{rankInfo.rank}
                  </span>
                )}
                <p className="text-md font-semibold text-green-700">{format(slot.start, 'EEE, MMM d, yyyy')}</p>
                <p className="text-lg text-green-800">
                  {format(slot.start, 'hh:mm a')} - {format(slot.end, 'hh:mm a')}
                </p>
                {rankInfo && (
                  <p className="mt-2 flex items-start gap-1 text-xs italic text-amber-900">
                    <SparklesIcon className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span>{rankInfo.rationale}</span>
                  </p>
                )}
                {slot.availableParticipants && slot.availableParticipants.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-slate-600">
                      {text.available} ({slot.availableParticipants.length} / {request.desiredMemberCount}):
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {slot.availableParticipants.map((pid) => (
                        <span key={pid} className="rounded-full bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">
                          {participants[pid]?.displayName || `User ${pid.substring(0, 6)}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {isSelected && allowSelection && (
                  <div className="mt-3 text-center">
                    <CheckCircleIcon className="mr-1 inline-block h-6 w-6 text-blue-600" />
                    <span className="font-semibold text-blue-700">{text.selected}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <Button variant="outline" onClick={onClose}>
          {t.common.close}
        </Button>
        {isCreator && slots.length > 0 && (
          <Button onClick={onConfirm} disabled={isConfirming || selectedIndex === null} className="bg-green-600 text-white hover:bg-green-700">
            {t.calendar.confirmSelectedSlot}
          </Button>
        )}
      </div>
    </Modal>
  );
}
