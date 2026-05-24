'use client';

import { format } from 'date-fns';
import { HangoutRequestClientState } from '@/types/hangouts';

interface Props {
  request: HangoutRequestClientState;
}

export function HangoutDetailsCard({ request }: Props) {
  const participantCount = Object.keys(request.participants || {}).length;

  return (
    <>
      <header className="mb-8 pb-4 border-b border-gray-200">
        <h1 className="text-4xl font-bold tracking-tight text-slate-800">{request.requestName}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Created by <span className="font-semibold text-slate-600">{request.creatorName}</span> on{' '}
          {format(request.createdAt, 'PPP')}
        </p>
      </header>

      <section className="space-y-6 mb-8">
        <div>
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Proposed Dates &amp; Times</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium text-slate-600">Date Ranges:</h3>
              <ul className="list-disc list-inside pl-4 text-slate-500">
                {request.dateRanges.map((dr, i) => (
                  <li key={i}>
                    {format(dr.start, 'EEE, MMM d, yyyy')} to {format(dr.end, 'EEE, MMM d, yyyy')}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-slate-600">Daily Time Ranges:</h3>
              <ul className="list-disc list-inside pl-4 text-slate-500">
                {request.timeRanges.map((tr, i) => (
                  <li key={i}>
                    {tr.start} – {tr.end}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm border-t pt-4 mt-4">
          <p>
            <span className="font-semibold text-slate-600">Duration:</span>{' '}
            {request.desiredDurationMinutes} min
          </p>
          <p>
            <span className="font-semibold text-slate-600">Margin:</span>{' '}
            {request.desiredMarginMinutes} min
          </p>
          <p>
            <span className="font-semibold text-slate-600">Members:</span> {participantCount} /{' '}
            {request.desiredMemberCount} joined
          </p>
          <p className="md:col-span-3">
            <span className="font-semibold text-slate-600">Current Status:</span>{' '}
            <span className="capitalize font-medium text-blue-600">
              {request.status.replace(/_/g, ' ')}
            </span>
          </p>
        </div>
      </section>
    </>
  );
}
