'use client';

import { format } from 'date-fns';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { FinalSelectedSlotClient } from '@/types/hangouts';

interface Props {
  slot: FinalSelectedSlotClient;
}

export function ConfirmedSlotBanner({ slot }: Props) {
  return (
    <section className="mb-8 p-6 bg-teal-50 border-2 border-teal-400 rounded-lg shadow-lg text-center">
      <h2 className="text-2xl font-bold text-teal-700 mb-3 flex items-center justify-center">
        <CheckCircleIcon className="h-7 w-7 mr-2 text-teal-600" /> Event Confirmed!
      </h2>
      <div className="text-xl text-teal-600">
        <p>{format(slot.start, 'EEE, MMM d, yyyy')}</p>
        <p>
          {format(slot.start, 'hh:mm a')} – {format(slot.end, 'hh:mm a')}
        </p>
      </div>
    </section>
  );
}
