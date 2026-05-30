'use client';
import { parseISO, startOfWeek } from 'date-fns';
import { useMemo, useState } from 'react';
import { addDays, addWeeks, addMinutes, endOfDay, format, startOfDay } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/useLanguage';
import { CandidateSlotClient, HangoutRequestFormData } from '@/types/hangouts';
interface Props {
  mode: 'create' | 'edit';
  initialData?: Partial<HangoutRequestFormData> & { weekStartDate?: Date };
  isLoading?: boolean;
  onCancel?: () => void;
  onSave: (formData: HangoutRequestFormData) => Promise<void>;
}

const DEFAULT_CELL_MINUTES = 60;
const DURATION_OPTIONS = [15, 30, 60] as const;
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function slotKey(date: Date, rowIndex: number) {
  return `${format(startOfDay(date), 'yyyy-MM-dd')}|${rowIndex}`;
}

function parseSlotKey(key: string) {
  const [dateKey, rowIndexString] = key.split('|');
  return {
    date: parseISO(`${dateKey}T00:00:00`),
    rowIndex: Number(rowIndexString),
  };
}

export function TsudoiRequestEditor({
  mode,
  initialData,
  isLoading = false,
  onCancel,
  onSave,
}: Props) {
  const { t } = useLanguage();
  const [requestName, setRequestName] = useState(initialData?.requestName ?? '');
  const [weekStartDate, setWeekStartDate] = useState(
    initialData?.weekStartDate ? startOfDay(initialData.weekStartDate) : startOfDay(new Date()),
  );
  const [cellMinutes, setCellMinutes] = useState<number>(
    initialData?.candidateSlotMinutes ?? DEFAULT_CELL_MINUTES,
  );
  const [desiredMemberCount, setDesiredMemberCount] = useState(
    initialData?.desiredMemberCount && initialData.desiredMemberCount > 0
      ? String(initialData.desiredMemberCount)
      : '',
  );
  const [selectedCells, setSelectedCells] = useState<Set<string>>(() => {
    const next = new Set<string>();
    for (const slot of initialData?.candidateSlots ?? []) {
      const minutesFromMidnight =
        slot.start.getHours() * 60 + slot.start.getMinutes();
      const rowIndex = Math.floor(minutesFromMidnight / (initialData?.candidateSlotMinutes ?? DEFAULT_CELL_MINUTES));
      next.add(slotKey(slot.start, rowIndex));
    }
    return next;
  });

  const gridRows = useMemo(() => Math.round((24 * 60) / cellMinutes), [cellMinutes]);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(startOfDay(weekStartDate), index);
        return {
          index,
          date,
          label: `${WEEK_DAYS[index]} ${format(date, 'M/d')}`,
        };
      }),
    [weekStartDate],
  );

  const moveWeek = (weeks: number) => {
    setWeekStartDate((current) => startOfWeek(addWeeks(current, weeks)));
  };

  const previewSlots = useMemo(() => {
    const slots: CandidateSlotClient[] = [];
    for (const cell of selectedCells) {
      const { date, rowIndex } = parseSlotKey(cell);
      const start = addMinutes(startOfDay(date), rowIndex * cellMinutes);
      slots.push({
        start,
        end: addMinutes(start, cellMinutes),
      });
    }
    return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [cellMinutes, selectedCells]);

  const toggleCell = (dayIndex: number, rowIndex: number) => {
    const key = slotKey(addDays(startOfDay(weekStartDate), dayIndex), rowIndex);
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestName.trim()) {
      alert(t.forms.titleRequired);
      return;
    }
    if (selectedCells.size === 0) {
      alert('Select at least one candidate cell.');
      return;
    }

    const candidateSlots = previewSlots;
    const slotStart = candidateSlots[0].start;
    const slotEnd = candidateSlots[candidateSlots.length - 1].end;
    const requestDateRangeStart = startOfDay(slotStart);
    const requestDateRangeEnd = endOfDay(slotEnd);

    await onSave({
      requestName,
      desiredDurationMinutes: cellMinutes,
      desiredMarginMinutes: 0,
      desiredMemberCount: desiredMemberCount ? Number(desiredMemberCount) : 0,
      dateRanges: [{ start: requestDateRangeStart, end: requestDateRangeEnd }],
      timeRanges: [{ start: '00:00', end: '24:00' }],
      candidateSlotMinutes: cellMinutes,
      candidateSlots,
      recipientUids: initialData?.recipientUids,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="requestName">{t.forms.requestName}</Label>
          <Input
            id="requestName"
            value={requestName}
            onChange={(event) => setRequestName(event.target.value)}
            placeholder="Tsudoi request"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weekStartDate">Week start</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => moveWeek(-1)}
              aria-label="Previous week"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Input
              id="weekStartDate"
              type="date"
              value={toDateInputValue(weekStartDate)}
              onChange={(event) => setWeekStartDate(startOfDay(new Date(`${event.target.value}T00:00:00`)))}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => moveWeek(1)}
              aria-label="Next week"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-slate-500">Viewing week of {format(weekStartDate, 'MMM d, yyyy')}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cellMinutes">Cell duration</Label>
          <select
            id="cellMinutes"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={cellMinutes}
            onChange={(event) => setCellMinutes(Number(event.target.value))}
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} minutes
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="desiredMemberCount">{t.forms.desiredMemberCount}</Label>
          <Input
            id="desiredMemberCount"
            type="number"
            min="1"
            value={desiredMemberCount}
            onChange={(event) => setDesiredMemberCount(event.target.value)}
            placeholder="Not decided"
          />
          <p className="text-xs text-slate-500">
            Leave blank if you want to evaluate the best date after everyone answers.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Weekly candidate grid</p>
            <p className="text-xs text-slate-500">Click any cell to include it as a candidate.</p>
          </div>
          <p className="text-sm text-slate-600">{selectedCells.size} cells selected</p>
        </div>

        <div className="overflow-auto">
          <div
            className="grid min-w-[860px] gap-px rounded-xl border border-slate-200 bg-slate-200"
            style={{
              gridTemplateColumns: `72px repeat(7, minmax(96px, 1fr))`,
              gridTemplateRows: `40px repeat(${gridRows}, minmax(32px, 1fr))`,
            }}
          >
            <div className="sticky left-0 top-0 z-10 bg-slate-100 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Time
            </div>
            {weekDays.map((day) => (
              <div
                key={day.index}
                className="sticky top-0 z-10 bg-slate-100 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                {day.label}
              </div>
            ))}

            {Array.from({ length: gridRows }, (_, rowIndex) => {
              const rowStartMinutes = rowIndex * cellMinutes;
              const rowLabel = `${String(Math.floor(rowStartMinutes / 60)).padStart(2, '0')}:${String(
                rowStartMinutes % 60,
              ).padStart(2, '0')}`;

              return (
                <div key={`row-${rowIndex}`} className="contents">
                  <div className="sticky left-0 z-10 flex items-start bg-white px-2 py-2 text-[11px] text-slate-500">
                    {rowIndex % Math.max(1, Math.round(60 / cellMinutes)) === 0 ? rowLabel : ''}
                  </div>
                  {weekDays.map((day) => {
                    const key = slotKey(day.index, rowIndex);
                    const isSelected = selectedCells.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleCell(day.index, rowIndex)}
                        className={[
                          'min-h-[32px] border border-transparent transition',
                          isSelected
                            ? 'bg-sky-500 text-white ring-2 ring-inset ring-sky-600 hover:bg-sky-600'
                            : 'bg-white hover:bg-sky-50',
                        ].join(' ')}
                      >
                        <span className="sr-only">
                          {day.label} {rowLabel} to {String(Math.floor((rowStartMinutes + cellMinutes) / 60)).padStart(2, '0')}:
                          {String((rowStartMinutes + cellMinutes) % 60).padStart(2, '0')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t pt-4 md:flex-row md:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            {t.common.cancel}
          </Button>
        )}
        <Button type="submit" className="bg-sky-600 text-white hover:bg-sky-700" isLoading={isLoading} disabled={isLoading}>
          {mode === 'edit' ? 'Update Tsudoi request' : 'Create Tsudoi request'}
        </Button>
      </div>
    </form>
  );
}

