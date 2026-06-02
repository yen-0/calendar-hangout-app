'use client';

import { addMinutes, addWeeks, endOfDay, format, startOfDay } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/useLanguage';
import { CandidateSlotClient, HangoutRequestFormData } from '@/types/hangouts';
import {
  buildTsudoiWeekGridRows,
  getSmartTsudoiVisibleWindow,
  getTsudoiCellKey,
  getTsudoiCellStart,
  getTsudoiGridStepMinutes,
  getTsudoiRowIndexFromMinutes,
  parseTsudoiCellKey,
  TsudoiTimeGridRow,
  TsudoiVisibleWindow,
} from '@/utils/tsudoiGridUtils';
import { buildTsudoiWeekDays, getTsudoiWeekStart, isTsudoiSlotInPast } from '@/utils/tsudoiWeekUtils';
import { TsudoiWeeklyGridTable } from './TsudoiWeeklyGridTable';
import { TsudoiVisibleWindowControl } from './TsudoiVisibleWindowControl';

interface Props {
  mode: 'create' | 'edit';
  initialData?: Partial<HangoutRequestFormData> & { weekStartDate?: Date };
  isLoading?: boolean;
  onCancel?: () => void;
  onSave: (formData: HangoutRequestFormData) => Promise<void>;
}

const DEFAULT_CELL_MINUTES = 60;
const MIN_CELL_HOURS = 0.25;
const CELL_HOURS_STEP = 0.25;

const copy = {
  ja: {
    requestName: '調整名',
    requestNamePlaceholder: '例: 5月の飲み会',
    requestNameRequired: '調整名を入力してください。',
    cellDuration: '1マスの長さ（時間）',
    cellDurationHelp: '15分刻みで入力できます。小数でも選べます。',
    desiredMemberCount: '希望人数',
    desiredMemberCountHelp: '未入力なら、回答を見てから人数の判断ができます。',
    gridTitle: '候補グリッド',
    gridHelp: '時間ラベルを押すと、その行を一括で選択できます。',
    windowTitle: '表示範囲',
    windowDescription: '週グリッドに表示する時間帯を調整します。',
    selectedCount: (count: number) => `${count} 個を選択中`,
    visibleRange: '表示中の範囲',
    futureOnly: '未来の候補を 1 つ以上選んでください。',
    create: '調整を作成',
    update: '調整を更新',
  },
  en: {
    requestName: 'Request name',
    requestNamePlaceholder: 'Example: May dinner',
    requestNameRequired: 'Please enter a request name.',
    cellDuration: 'Cell duration (hours)',
    cellDurationHelp: 'Enter quarter-hour steps. Decimal durations are allowed.',
    desiredMemberCount: 'Desired member count',
    desiredMemberCountHelp: 'Leave blank if you want to decide after replies come in.',
    gridTitle: 'Candidate grid',
    gridHelp: 'Click a time label to select that entire row.',
    windowTitle: 'Visible time range',
    windowDescription: 'Adjust how much of the weekly grid stays visible.',
    selectedCount: (count: number) => `${count} selected`,
    visibleRange: 'Current preview',
    futureOnly: 'Select at least one future candidate cell.',
    create: 'Create request',
    update: 'Update request',
  },
} as const;

export function TsudoiRequestEditor({ mode, initialData, isLoading = false, onCancel, onSave }: Props) {
  const { language } = useLanguage();
  const content = copy[language];
  const [requestName, setRequestName] = useState(initialData?.requestName ?? '');
  const [weekStartDate, setWeekStartDate] = useState(() =>
    getTsudoiWeekStart(initialData?.weekStartDate ?? new Date()),
  );
  const [cellHoursInput, setCellHoursInput] = useState(
    String((initialData?.candidateSlotMinutes ?? DEFAULT_CELL_MINUTES) / 60),
  );
  const [desiredMemberCount, setDesiredMemberCount] = useState(
    initialData?.desiredMemberCount && initialData.desiredMemberCount > 0 ? String(initialData.desiredMemberCount) : '',
  );
  const [now, setNow] = useState(() => new Date());

  const cellMinutes = useMemo(() => {
    const parsedHours = Number(cellHoursInput);
    return Number.isFinite(parsedHours) && parsedHours >= MIN_CELL_HOURS
      ? Math.round(parsedHours * 60)
      : DEFAULT_CELL_MINUTES;
  }, [cellHoursInput]);

  const gridStepMinutes = useMemo(() => getTsudoiGridStepMinutes(cellMinutes), [cellMinutes]);
  const weekDays = useMemo(() => buildTsudoiWeekDays(weekStartDate), [weekStartDate]);
  const initialVisibleWindow = useMemo(
    () => getSmartTsudoiVisibleWindow(initialData?.candidateSlots ?? []),
    [initialData?.candidateSlots],
  );
  const [visibleWindow, setVisibleWindow] = useState<TsudoiVisibleWindow>(initialVisibleWindow);

  const initialSelectedCells = useMemo(() => {
    const next = new Set<string>();
    for (const slot of initialData?.candidateSlots ?? []) {
      const minutesFromMidnight = slot.start.getHours() * 60 + slot.start.getMinutes();
      const rowIndex = getTsudoiRowIndexFromMinutes(minutesFromMidnight, gridStepMinutes);
      next.add(getTsudoiCellKey(slot.start, rowIndex));
    }
    return next;
  }, [gridStepMinutes, initialData?.candidateSlots]);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(() => initialSelectedCells);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedCells(new Set());
  }, [cellMinutes]);

  useEffect(() => {
    setVisibleWindow(initialVisibleWindow);
  }, [initialVisibleWindow]);

  const rows = useMemo(() => buildTsudoiWeekGridRows(visibleWindow, gridStepMinutes), [gridStepMinutes, visibleWindow]);

  const moveWeek = (weeks: number) => {
    setWeekStartDate((current) => getTsudoiWeekStart(addWeeks(current, weeks)));
  };

  const previewSlots = useMemo(() => {
    const slots: CandidateSlotClient[] = [];
    for (const cell of selectedCells) {
      const { date, rowIndex } = parseTsudoiCellKey(cell);
      const start = getTsudoiCellStart(date, rowIndex, gridStepMinutes);
      slots.push({ start, end: addMinutes(start, cellMinutes) });
    }
    return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [cellMinutes, gridStepMinutes, selectedCells]);

  const saveableSlots = useMemo(
    () => previewSlots.filter((slot) => !isTsudoiSlotInPast(slot.start, now)),
    [now, previewSlots],
  );

  const toggleCell = (dayDate: Date, row: TsudoiTimeGridRow) => {
    const rowIndex = getTsudoiRowIndexFromMinutes(row.startMinutes, gridStepMinutes);
    const cellStart = getTsudoiCellStart(dayDate, rowIndex, gridStepMinutes);
    if (isTsudoiSlotInPast(cellStart, now)) return;

    const key = getTsudoiCellKey(dayDate, rowIndex);
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleRow = (row: TsudoiTimeGridRow) => {
    const rowIndex = getTsudoiRowIndexFromMinutes(row.startMinutes, gridStepMinutes);
    const keys = weekDays.map((day) => getTsudoiCellKey(day.date, rowIndex));
    const selectableKeys = keys.filter((key) => {
      const { date, rowIndex: parsedRowIndex } = parseTsudoiCellKey(key);
      return !isTsudoiSlotInPast(getTsudoiCellStart(date, parsedRowIndex, gridStepMinutes), now);
    });

    if (selectableKeys.length === 0) return;

    setSelectedCells((prev) => {
      const allSelected = selectableKeys.every((key) => prev.has(key));
      const next = new Set(prev);
      if (allSelected) {
        selectableKeys.forEach((key) => next.delete(key));
      } else {
        selectableKeys.forEach((key) => next.add(key));
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestName.trim()) {
      alert(content.requestNameRequired);
      return;
    }
    if (saveableSlots.length === 0) {
      alert(content.futureOnly);
      return;
    }

    const slotStart = saveableSlots[0].start;
    const slotEnd = saveableSlots[saveableSlots.length - 1].end;

    await onSave({
      requestName,
      desiredDurationMinutes: cellMinutes,
      desiredMarginMinutes: 0,
      desiredMemberCount: desiredMemberCount ? Number(desiredMemberCount) : 0,
      dateRanges: [{ start: startOfDay(slotStart), end: endOfDay(slotEnd) }],
      timeRanges: [{ start: '00:00', end: '24:00' }],
      candidateSlotMinutes: cellMinutes,
      candidateSlots: saveableSlots,
      recipientUids: initialData?.recipientUids,
    });
  };

  const renderCell = (day: { date: Date; label: string }, row: TsudoiTimeGridRow) => {
    const rowIndex = getTsudoiRowIndexFromMinutes(row.startMinutes, gridStepMinutes);
    const key = getTsudoiCellKey(day.date, rowIndex);
    const isSelected = selectedCells.has(key);
    const slotStart = getTsudoiCellStart(day.date, rowIndex, gridStepMinutes);
    const slotEnd = addMinutes(slotStart, cellMinutes);
    const isPast = isTsudoiSlotInPast(slotStart, now);

    return (
      <button
        key={key}
        type="button"
        aria-pressed={isSelected}
        disabled={isPast}
        onClick={() => toggleCell(day.date, row)}
        className={[
          'flex min-h-[32px] w-full items-center justify-center border border-transparent transition',
          isPast
            ? isSelected
              ? 'cursor-not-allowed bg-slate-200 text-slate-500 opacity-80 ring-1 ring-inset ring-slate-300'
              : 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-80'
            : isSelected
              ? 'bg-cyan-500 text-white ring-2 ring-inset ring-cyan-600 hover:bg-cyan-600'
              : 'bg-white hover:bg-cyan-50',
        ].join(' ')}
      >
        <span className="sr-only">
          {day.label} {format(slotStart, 'HH:mm')} to {format(slotEnd, 'HH:mm')}
        </span>
      </button>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="requestName">{content.requestName}</Label>
          <Input
            id="requestName"
            value={requestName}
            onChange={(event) => setRequestName(event.target.value)}
            placeholder={content.requestNamePlaceholder}
            required
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cellMinutes">{content.cellDuration}</Label>
          <Input
            id="cellMinutes"
            type="number"
            min={MIN_CELL_HOURS}
            step={CELL_HOURS_STEP}
            value={cellHoursInput}
            onChange={(event) => setCellHoursInput(event.target.value)}
            placeholder="1"
          />
          <p className="text-xs text-slate-500">{content.cellDurationHelp}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desiredMemberCount">{content.desiredMemberCount}</Label>
          <Input
            id="desiredMemberCount"
            type="number"
            min="1"
            value={desiredMemberCount}
            onChange={(event) => setDesiredMemberCount(event.target.value)}
            placeholder={language === 'ja' ? '未定' : 'Not decided'}
          />
          <p className="text-xs text-slate-500">{content.desiredMemberCountHelp}</p>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">{content.gridTitle}</p>
            <p className="text-xs text-slate-500">{content.gridHelp}</p>
          </div>
          <div className="flex items-center gap-3">
            <TsudoiVisibleWindowControl
              visibleWindow={visibleWindow}
              gridStepMinutes={gridStepMinutes}
              onChange={setVisibleWindow}
              title={content.windowTitle}
              description={content.windowDescription}
            />
            <p className="text-sm text-slate-600">{content.selectedCount(selectedCells.size)}</p>
          </div>
        </div>

        <TsudoiWeeklyGridTable
          weekDays={weekDays}
          rows={rows}
          onPreviousWeek={() => moveWeek(-1)}
          onNextWeek={() => moveWeek(1)}
          onTimeLabelClick={toggleRow}
          renderCell={renderCell}
        />
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 md:flex-row md:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button type="submit" className="bg-slate-950 text-white hover:bg-slate-800" isLoading={isLoading} disabled={isLoading}>
          {mode === 'edit' ? content.update : content.create}
        </Button>
      </div>
    </form>
  );
}
