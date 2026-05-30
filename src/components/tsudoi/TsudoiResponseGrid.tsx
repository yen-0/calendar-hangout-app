'use client';

import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { CandidateSlotClient, SlotResponseStatus } from '@/types/hangouts';
import { candidateSlotKey } from '@/utils/hangoutUtils';

interface Props {
  candidateSlots: CandidateSlotClient[];
  responses: Record<string, SlotResponseStatus>;
  isLoading?: boolean;
  readOnly?: boolean;
  onChange?: (responses: Record<string, SlotResponseStatus>) => void;
}

const RESPONSE_OPTIONS: Array<{
  status: SlotResponseStatus;
  mark: string;
  label: string;
  selectedClass: string;
}> = [
  {
    status: 'yes',
    mark: '○',
    label: 'Yes',
    selectedClass: 'border-emerald-600 bg-emerald-600 text-white',
  },
  {
    status: 'maybe',
    mark: '△',
    label: 'Maybe',
    selectedClass: 'border-amber-500 bg-amber-500 text-white',
  },
  {
    status: 'no',
    mark: '×',
    label: 'No',
    selectedClass: 'border-rose-600 bg-rose-600 text-white',
  },
];

export function TsudoiResponseGrid({
  candidateSlots,
  responses,
  isLoading = false,
  readOnly = false,
  onChange,
}: Props) {
  const updateResponse = (slotKey: string, status: SlotResponseStatus) => {
    if (readOnly || !onChange) return;
    onChange({ ...responses, [slotKey]: status });
  };

  if (candidateSlots.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No candidate slots are available for this Tsudoi.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[minmax(150px,1fr)_minmax(180px,220px)] border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Candidate slot</span>
        <span className="text-center">Your answer</span>
      </div>
      <div className="divide-y divide-slate-100">
        {candidateSlots.map((slot) => {
          const key = candidateSlotKey(slot);
          const current = responses[key] ?? 'yes';
          return (
            <div
              key={key}
              className="grid grid-cols-[minmax(150px,1fr)_minmax(180px,220px)] items-center gap-3 px-3 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {format(slot.start, 'EEE, MMM d')}
                </p>
                <p className="text-sm text-slate-600">
                  {format(slot.start, 'HH:mm')} - {format(slot.end, 'HH:mm')}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {RESPONSE_OPTIONS.map((option) => {
                  const isSelected = current === option.status;
                  return (
                    <Button
                      key={option.status}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLoading || readOnly}
                      aria-pressed={isSelected}
                      aria-label={`${option.label} for ${format(slot.start, 'MMM d HH:mm')}`}
                      title={option.label}
                      className={`h-10 min-w-0 border text-lg ${
                        isSelected
                          ? option.selectedClass
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                      onClick={() => updateResponse(key, option.status)}
                    >
                      {option.mark}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

