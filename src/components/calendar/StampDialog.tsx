'use client';

import dynamic from 'next/dynamic';
import Modal from '@/components/ui/modal';
import { CalendarEvent, CalendarEventUpdate } from '@/types/events';

const DynamicStampForm = dynamic(() => import('@/components/calendar/StampForm'), {
  ssr: false,
  loading: () => <p className="p-6 text-center">Loading stamp form…</p>,
});

interface Props {
  isOpen: boolean;
  stamp: CalendarEvent | null;
  onClose: () => void;
  onSave: (data: CalendarEventUpdate & { id?: string; title: string; start: Date; end: Date }) => Promise<void> | void;
  onRequestDelete?: () => void;
  existingCategories?: string[];
}

export function StampDialog({
  isOpen,
  stamp,
  onClose,
  onSave,
  onRequestDelete,
  existingCategories,
}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={stamp ? 'Edit Stamp' : 'Create New Stamp'}
      size="lg"
    >
      {isOpen && (
        <DynamicStampForm
          stamp={stamp}
          onSave={onSave}
          onCancel={onClose}
          onDelete={stamp ? onRequestDelete : undefined}
          existingCategories={existingCategories}
        />
      )}
    </Modal>
  );
}
