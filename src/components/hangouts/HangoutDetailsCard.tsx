'use client';

import { format } from 'date-fns';
import { HangoutRequestClientState } from '@/types/hangouts';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  request: HangoutRequestClientState;
}

const copy = {
  ja: {
    createdBy: '作成者',
    on: '作成日',
    candidates: 'Tsudoi 候補',
    weekRange: '対象期間',
    dailyWindows: '候補時間',
    exactCells: (count: number) => `${count} 件の候補セルが選択されています。`,
    to: '〜',
    duration: '長さ',
    margin: '前後余白',
    members: '参加者',
    joined: '回答済み',
    targetNotDecided: '（目標人数未設定）',
    currentStatus: '現在の状態',
    status: {
      pending: '受付中',
      pending_calculation: '集計中',
      results_ready: '結果あり',
      no_slots_found: '候補なし',
      confirmed: '確定済み',
      closed: '終了',
    },
  },
  en: {
    createdBy: 'Created by',
    on: 'on',
    candidates: 'Tsudoi candidates',
    weekRange: 'Week range',
    dailyWindows: 'Daily windows',
    exactCells: (count: number) => `${count} exact candidate cell(s) selected.`,
    to: 'to',
    duration: 'Duration',
    margin: 'Margin',
    members: 'Members',
    joined: 'joined',
    targetNotDecided: ' (target not decided)',
    currentStatus: 'Current status',
    status: {
      pending: 'Open',
      pending_calculation: 'Updating',
      results_ready: 'Results ready',
      no_slots_found: 'No slots found',
      confirmed: 'Confirmed',
      closed: 'Closed',
    },
  },
} as const;

export function HangoutDetailsCard({ request }: Props) {
  const { language } = useLanguage();
  const content = copy[language] ?? copy.en;
  const participantCount = Object.keys(request.participants || {}).length;
  const candidateSlotCount = request.candidateSlots?.length ?? 0;
  const memberTarget =
    request.desiredMemberCount > 0
      ? `${participantCount} / ${request.desiredMemberCount}`
      : `${participantCount}`;
  const statusLabel = content.status[request.status] ?? content.status.pending;

  return (
    <>
      <header className="mb-8 border-b border-gray-200 pb-4">
        <h1 className="text-4xl font-bold tracking-tight text-slate-800">{request.requestName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {content.createdBy}{' '}
          <span className="font-semibold text-slate-600">{request.creatorName}</span> {content.on}{' '}
          {format(request.createdAt, 'PPP')}
        </p>
      </header>

      <section className="mb-8 space-y-6">
        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-700">{content.candidates}</h2>
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div>
              <h3 className="font-medium text-slate-600">{content.weekRange}</h3>
              <ul className="list-inside list-disc pl-4 text-slate-500">
                {request.dateRanges.map((dr, i) => (
                  <li key={i}>
                    {format(dr.start, 'EEE, MMM d, yyyy')} {content.to}{' '}
                    {format(dr.end, 'EEE, MMM d, yyyy')}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-slate-600">{content.dailyWindows}</h3>
              <ul className="list-inside list-disc pl-4 text-slate-500">
                {candidateSlotCount > 0 ? (
                  <li>{content.exactCells(candidateSlotCount)}</li>
                ) : (
                  request.timeRanges.map((tr, i) => (
                    <li key={i}>
                      {tr.start} - {tr.end}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 text-sm md:grid-cols-3">
          <p>
            <span className="font-semibold text-slate-600">{content.duration}:</span>{' '}
            {request.desiredDurationMinutes} min
          </p>
          <p>
            <span className="font-semibold text-slate-600">{content.margin}:</span>{' '}
            {request.desiredMarginMinutes} min
          </p>
          <p>
            <span className="font-semibold text-slate-600">{content.members}:</span> {memberTarget}{' '}
            {content.joined}
            {request.desiredMemberCount <= 0 ? content.targetNotDecided : ''}
          </p>
          <p className="md:col-span-3">
            <span className="font-semibold text-slate-600">{content.currentStatus}:</span>{' '}
            <span className="font-medium text-blue-600">{statusLabel}</span>
          </p>
        </div>
      </section>
    </>
  );
}
