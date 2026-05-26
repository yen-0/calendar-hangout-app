'use client';

import { format } from 'date-fns';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { FinalSelectedSlotClient } from '@/types/hangouts';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  slot: FinalSelectedSlotClient;
}

export function ConfirmedSlotBanner({ slot }: Props) {
  const { language } = useLanguage();

  return (
    <section className="mb-8 rounded-lg border-2 border-teal-400 bg-teal-50 p-6 text-center shadow-lg">
      <h2 className="mb-3 flex items-center justify-center text-2xl font-bold text-teal-700">
        <CheckCircleIcon className="mr-2 h-7 w-7 text-teal-600" />
        {language === 'ja' ? 'イベントが確定しました！' : 'Event Confirmed!'}
      </h2>
      <div className="text-xl text-teal-600">
        <p>{format(slot.start, 'EEE, MMM d, yyyy')}</p>
        <p>{format(slot.start, 'hh:mm a')} – {format(slot.end, 'hh:mm a')}</p>
      </div>
    </section>
  );
}

