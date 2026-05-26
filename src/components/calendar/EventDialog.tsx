'use client';

import dynamic from 'next/dynamic';
import Modal from '@/components/ui/modal';
import { CalendarEvent, CalendarEventUpdate } from '@/types/events';
import { useLanguage } from '@/hooks/useLanguage';

const DynamicEventForm = dynamic(() => import('@/components/calendar/EventForm'), {
  ssr: false,
  loading: () => <p className="p-6 text-center">Loading form…</p>,
});

interface Props {
  isOpen: boolean;
  mode: 'create' | 'edit';
  event: CalendarEvent | null;
  defaultStart?: Date;
  defaultEnd?: Date;
  onClose: () => void;
  onSave: (data: CalendarEventUpdate & { id?: string; title?: string; start?: Date; end?: Date }) => Promise<void> | void;
  onRequestDelete?: () => void;
  onConvertToStamp?: (draft: { title: string; start: Date; end: Date; color: string }) => void;
}

export function EventDialog({
  isOpen,
  mode,
  event,
  defaultStart,
  defaultEnd,
  onClose,
  onSave,
  onRequestDelete,
  onConvertToStamp,
}: Props) {
  const { t } = useLanguage();
  return (
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? t.calendar.editEvent : t.calendar.createEvent}
      size="lg"
    >
      {isOpen && (
        <DynamicEventForm
          event={event}
          onSave={onSave}
          onCancel={onClose}
          onDelete={mode === 'edit' && event ? onRequestDelete : undefined}
          onConvertToStamp={onConvertToStamp}
          defaultStartDate={defaultStart}
          defaultEndDate={defaultEnd}
        />
      )}
    </Modal>
  );
}
