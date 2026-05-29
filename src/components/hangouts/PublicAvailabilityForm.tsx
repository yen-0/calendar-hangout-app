'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { XCircleIcon, PlusCircleIcon } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ParticipantEventClient } from '@/types/hangouts';
import { useLanguage } from '@/hooks/useLanguage';

type BusyBlockState = {
  date: string;
  start: string;
  end: string;
};

function toDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function toTimeInputValue(date: Date): string {
  return format(date, 'HH:mm');
}

function buildInitialBlocks(events: ParticipantEventClient[] | undefined): BusyBlockState[] {
  if (!events || events.length === 0) {
    return [{ date: '', start: '', end: '' }];
  }
  return events.map((event) => ({
    date: toDateInputValue(event.start),
    start: toTimeInputValue(event.start),
    end: toTimeInputValue(event.end),
  }));
}

interface Props {
  initialName?: string;
  initialEvents?: ParticipantEventClient[];
  isLoading?: boolean;
  submitLabel: string;
  onSubmit: (data: { displayName: string; events: ParticipantEventClient[] }) => Promise<void>;
}

export function PublicAvailabilityForm({
  initialName = '',
  initialEvents,
  isLoading = false,
  submitLabel,
  onSubmit,
}: Props) {
  const { t } = useLanguage();
  const [displayName, setDisplayName] = useState(initialName);
  const [blocks, setBlocks] = useState<BusyBlockState[]>(() => buildInitialBlocks(initialEvents));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(initialName);
  }, [initialName]);

  useEffect(() => {
    setBlocks(buildInitialBlocks(initialEvents));
  }, [initialEvents]);

  const addBlock = () => {
    setBlocks((prev) => [...prev, { date: '', start: '09:00', end: '10:00' }]);
  };

  const removeBlock = (index: number) => {
    setBlocks((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ date: '', start: '', end: '' }];
    });
  };

  const updateBlock = (index: number, field: keyof BusyBlockState, value: string) => {
    setBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, [field]: value } : block)),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setLocalError(t.replyPage.displayNameRequired);
      return;
    }

    const invalidBlock = blocks.find((block) => !block.date || !block.start || !block.end || block.end <= block.start);
    if (invalidBlock) {
      setLocalError(t.replyPage.busyBlockInvalid);
      return;
    }

    const events: ParticipantEventClient[] = blocks.map((block) => {
      const start = new Date(`${block.date}T${block.start}:00`);
      const end = new Date(`${block.date}T${block.end}:00`);
      return {
        title: t.replyPage.busyBlockTitle,
        start,
        end,
      };
    });

    await onSubmit({ displayName: trimmedName, events });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg bg-slate-50 p-6">
      <div>
        <h2 className="mb-1 text-xl font-semibold text-slate-700">{t.replyPage.yourParticipation}</h2>
        <p className="text-sm text-slate-500">{t.replyPage.publicParticipationHelp}</p>
      </div>

      <div>
        <Label htmlFor="displayName">{t.replyPage.displayNameLabel}</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t.replyPage.displayNamePlaceholder}
          required
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label>{t.replyPage.busyBlocksTitle}</Label>
            <p className="text-sm text-slate-500">{t.replyPage.busyBlocksHelp}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={addBlock} className="text-blue-600">
            <PlusCircleIcon className="mr-1 h-5 w-5" />
            {t.replyPage.addBusyBlock}
          </Button>
        </div>

        {blocks.map((block, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end"
          >
            <div>
              <Label htmlFor={`busy-date-${index}`}>{t.replyPage.busyDate}</Label>
              <Input
                id={`busy-date-${index}`}
                type="date"
                value={block.date}
                onChange={(e) => updateBlock(index, 'date', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor={`busy-start-${index}`}>{t.replyPage.busyStart}</Label>
              <Input
                id={`busy-start-${index}`}
                type="time"
                value={block.start}
                onChange={(e) => updateBlock(index, 'start', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor={`busy-end-${index}`}>{t.replyPage.busyEnd}</Label>
              <Input
                id={`busy-end-${index}`}
                type="time"
                value={block.end}
                onChange={(e) => updateBlock(index, 'end', e.target.value)}
                required
              />
            </div>
            <div className="md:pb-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeBlock(index)}
                className="text-red-500"
                aria-label={t.replyPage.removeBusyBlock}
              >
                <XCircleIcon className="h-6 w-6" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {localError && <p className="text-sm text-red-600">{localError}</p>}

      <div className="flex justify-end border-t pt-4">
        <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700" isLoading={isLoading} disabled={isLoading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
