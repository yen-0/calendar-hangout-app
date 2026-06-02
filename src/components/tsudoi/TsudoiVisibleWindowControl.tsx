'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import {
  formatTsudoiVisibleWindowLabel,
  normalizeTsudoiVisibleWindow,
  TSUDOI_DEFAULT_VISIBLE_END_MINUTES,
  TSUDOI_DEFAULT_VISIBLE_START_MINUTES,
  TSUDOI_FULL_DAY_MINUTES,
  TsudoiVisibleWindow,
} from '@/utils/tsudoiGridUtils';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  visibleWindow: TsudoiVisibleWindow;
  gridStepMinutes: number;
  onChange: (visibleWindow: TsudoiVisibleWindow) => void;
  title?: string;
  description?: string;
}

const copy = {
  ja: {
    workday: '勤務時間',
    fullDay: '終日',
    reset: 'リセット',
    current: '現在の表示',
    showFrom: '開始時刻',
    showTo: '終了時刻',
    trigger: (label: string) => `表示範囲: ${label}`,
  },
  en: {
    workday: 'Workday',
    fullDay: 'Full day',
    reset: 'Reset',
    current: 'Current preview',
    showFrom: 'Show from',
    showTo: 'Show to',
    trigger: (label: string) => `Visible time range: ${label}`,
  },
} as const;

function formatInputMinutes(totalMinutes: number): string {
  return (totalMinutes / 60).toString();
}

function parseInputMinutes(value: string): number {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return 0;
  return Math.max(0, Math.min(TSUDOI_FULL_DAY_MINUTES, Math.round(hours * 60)));
}

export function TsudoiVisibleWindowControl({
  visibleWindow,
  gridStepMinutes,
  onChange,
  title,
  description,
}: Props) {
  const { language } = useLanguage();
  const content = copy[language];
  const [isOpen, setIsOpen] = useState(false);
  const [draftWindow, setDraftWindow] = useState(visibleWindow);

  useEffect(() => {
    if (isOpen) {
      setDraftWindow(visibleWindow);
    }
  }, [isOpen, visibleWindow]);

  const normalizedDraft = useMemo(
    () => normalizeTsudoiVisibleWindow(draftWindow, gridStepMinutes),
    [draftWindow, gridStepMinutes],
  );

  const applyDraft = () => {
    onChange(normalizedDraft);
    setIsOpen(false);
  };

  const visibleWindowLabel = formatTsudoiVisibleWindowLabel(visibleWindow);
  const triggerTitle = content.trigger(visibleWindowLabel);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={triggerTitle}
        aria-label={triggerTitle}
        className="h-8 w-8 rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-100"
        onClick={() => setIsOpen(true)}
      >
        <ChevronDownIcon className="h-4 w-4" />
        <span className="sr-only">{visibleWindowLabel}</span>
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={title ?? content.current} size="md">
        <div className="space-y-5">
          <p className="text-sm text-slate-600">{description ?? content.current}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">{content.showFrom}</span>
              <input
                type="number"
                min="0"
                max="24"
                step={gridStepMinutes / 60}
                value={formatInputMinutes(draftWindow.startMinutes)}
                onChange={(event) =>
                  setDraftWindow((current) => ({
                    ...current,
                    startMinutes: parseInputMinutes(event.target.value),
                  }))
                }
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none ring-0 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">{content.showTo}</span>
              <input
                type="number"
                min="0"
                max="24"
                step={gridStepMinutes / 60}
                value={formatInputMinutes(draftWindow.endMinutes)}
                onChange={(event) =>
                  setDraftWindow((current) => ({
                    ...current,
                    endMinutes: parseInputMinutes(event.target.value),
                  }))
                }
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none ring-0 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDraftWindow({
                  startMinutes: TSUDOI_DEFAULT_VISIBLE_START_MINUTES,
                  endMinutes: TSUDOI_DEFAULT_VISIBLE_END_MINUTES,
                })
              }
            >
              {content.workday}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDraftWindow({
                  startMinutes: 0,
                  endMinutes: TSUDOI_FULL_DAY_MINUTES,
                })
              }
            >
              {content.fullDay}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDraftWindow(visibleWindow)}>
              {content.reset}
            </Button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {content.current}:{' '}
            <span className="font-semibold text-slate-800">
              {formatTsudoiVisibleWindowLabel(normalizedDraft)}
            </span>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={applyDraft}>
              Apply
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
