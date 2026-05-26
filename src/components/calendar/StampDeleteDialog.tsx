'use client';

import { useState } from 'react';
import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { CalendarEvent } from '@/types/events';
import { StampDeleteMode } from '@/hooks/useCalendarStore';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  isOpen: boolean;
  stamp: CalendarEvent | null;
  instanceCount: number;
  onClose: () => void;
  onConfirm: (mode: StampDeleteMode) => Promise<void> | void;
}

/**
 * Two-path delete dialog for stamp definitions:
 *  - "Keep instances": soft-delete the definition; placed instances remain.
 *  - "Delete all": cascade-delete the definition AND every placed instance.
 *
 * Replaces the old single-confirm ConfirmationModal for stamps so users don't
 * accidentally nuke months of placed entries when they just wanted to retire
 * a template.
 */
export function StampDeleteDialog({
  isOpen,
  stamp,
  instanceCount,
  onClose,
  onConfirm,
}: Props) {
  const [busyMode, setBusyMode] = useState<StampDeleteMode | null>(null);
  const { t } = useLanguage();

  if (!stamp) return null;

  const handle = async (mode: StampDeleteMode) => {
    setBusyMode(mode);
    try {
      await onConfirm(mode);
    } finally {
      setBusyMode(null);
    }
  };

  const isBusy = busyMode !== null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.calendar.deleteStampTitle} size="sm">
      <div className="text-sm text-gray-700 mb-4">
        Delete the{' '}
        <span className="font-semibold">
          {stamp.emoji} {stamp.title}
        </span>{' '}
        stamp definition.
        {instanceCount > 0 ? (
          <>
            {' '}It&rsquo;s been placed{' '}
            <span className="font-semibold">
              {instanceCount} {instanceCount === 1 ? 'time' : 'times'}
            </span>{' '}
            on the calendar — what should happen to those?
          </>
        ) : (
          ' No instances have been placed yet.'
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          onClick={() => handle('soft')}
          isLoading={busyMode === 'soft'}
          disabled={isBusy}
          className="w-full justify-start text-left"
        >
          <div className="flex flex-col items-start">
            <span className="font-medium">Keep instances</span>
            <span className="text-xs text-gray-500">
              Retire the template — placed entries stay on your calendar.
            </span>
          </div>
        </Button>

        <Button
          variant="destructive"
          onClick={() => handle('cascade')}
          isLoading={busyMode === 'cascade'}
          disabled={isBusy}
          className="w-full justify-start text-left"
        >
          <div className="flex flex-col items-start">
            <span className="font-medium">Delete all</span>
            <span className="text-xs text-white/80">
              Remove the template AND every placed instance.
            </span>
          </div>
        </Button>
      </div>

      <div className="flex justify-end mt-4">
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>
          {t.common.cancel}
          </Button>
      </div>
    </Modal>
  );
}
