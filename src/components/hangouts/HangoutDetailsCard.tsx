'use client';

import { format } from 'date-fns';
import { HangoutRequestClientState } from '@/types/hangouts';

interface Props {
  request: HangoutRequestClientState;
}

export function HangoutDetailsCard({ request }: Props) {
  const participantCount = Object.keys(request.participants || {}).length;
  const candidateSlotCount = request.candidateSlots?.length ?? 0;

  return (
    <>
      <header className="mb-8 border-b border-gray-200 pb-4">
        <h1 className="text-4xl font-bold tracking-tight text-slate-800">{request.requestName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Created by <span className="font-semibold text-slate-600">{request.creatorName}</span> on{' '}
          {format(request.createdAt, 'PPP')}
        </p>
      </header>

      <section className="mb-8 space-y-6">
        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-700">Tsudoi candidates</h2>
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div>
              <h3 className="font-medium text-slate-600">Week range:</h3>
              <ul className="list-inside list-disc pl-4 text-slate-500">
                {request.dateRanges.map((dr, i) => (
                  <li key={i}>
                    {format(dr.start, 'EEE, MMM d, yyyy')} to {format(dr.end, 'EEE, MMM d, yyyy')}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-slate-600">Daily windows:</h3>
              <ul className="list-inside list-disc pl-4 text-slate-500">
                {candidateSlotCount > 0 ? (
                  <li>{candidateSlotCount} exact candidate cell(s) selected.</li>
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
            <span className="font-semibold text-slate-600">Duration:</span> {request.desiredDurationMinutes} min
          </p>
          <p>
            <span className="font-semibold text-slate-600">Margin:</span> {request.desiredMarginMinutes} min
          </p>
          <p>
            <span className="font-semibold text-slate-600">Members:</span> {participantCount} / {request.desiredMemberCount} joined
          </p>
          <p className="md:col-span-3">
            <span className="font-semibold text-slate-600">Current Status:</span>{' '}
            <span className="font-medium capitalize text-blue-600">{request.status.replace(/_/g, ' ')}</span>
          </p>
        </div>
      </section>
    </>
  );
}
