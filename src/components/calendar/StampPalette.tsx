'use client';

import { useMemo, useState } from 'react';
import { CalendarEvent } from '@/types/events';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { StampUsageStats } from '@/utils/stampStats';
import { STAMP_PRESETS, StampPreset } from '@/lib/stampPresets';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  stamps: CalendarEvent[];
  selectedStamp: CalendarEvent | null;
  onSelect: (stamp: CalendarEvent | null) => void;
  onEdit: (stamp: CalendarEvent) => void;
  onNewStamp: () => void;
  /** Toggle the pinned flag for a stamp. Pinned stamps render in a "Pinned" group on top. */
  onTogglePin?: (stamp: CalendarEvent) => void;
  /** Called when a stamp row begins an HTML5 drag (desktop drag-to-calendar). */
  onDragStartStamp?: (stamp: CalendarEvent) => void;
  /** Called when the drag ends (drop succeeded, failed, or cancelled). */
  onDragEndStamp?: () => void;
  /** Per-stamp usage counts keyed by master stamp id. */
  usage?: Map<string, StampUsageStats>;
  /** One-tap preset add. When provided, the empty-state shows the starter gallery. */
  onAddPreset?: (preset: StampPreset) => void;
  /** Opens the share-pack dialog. When omitted (e.g. guest mode), the button is hidden. */
  onSharePack?: () => void;
  /**
   * 'sidebar' — current desktop sidebar chrome (card, fixed width).
   * 'sheet' — bare content for a bottom drawer; no card chrome, scroll managed by container.
   */
  variant?: 'sidebar' | 'sheet';
}

const matchesQuery = (stamp: CalendarEvent, q: string): boolean => {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    stamp.title.toLowerCase().includes(needle) ||
    (stamp.emoji ?? '').includes(needle) ||
    (stamp.stampCategory ?? '').toLowerCase().includes(needle)
  );
};

export function StampPalette({
  stamps,
  selectedStamp,
  onSelect,
  onEdit,
  onNewStamp,
  onTogglePin,
  onDragStartStamp,
  onDragEndStamp,
  usage,
  onAddPreset,
  onSharePack,
  variant = 'sidebar',
}: Props) {
  const [query, setQuery] = useState('');
  const { t } = useLanguage();

  const { pinned, others } = useMemo(() => {
    const filtered = stamps.filter((s) => matchesQuery(s, query));
    return {
      pinned: filtered.filter((s) => s.stampPinned),
      others: filtered.filter((s) => !s.stampPinned),
    };
  }, [stamps, query]);

  const totalAfterFilter = pinned.length + others.length;
  const isSheet = variant === 'sheet';

  const shellClasses = isSheet
    ? 'w-full flex flex-col gap-3'
    : 'w-full md:w-64 lg:w-72 flex-shrink-0 bg-white p-4 rounded-lg shadow';

  const listMaxHeight = isSheet
    ? 'max-h-[60vh] overflow-y-auto'
    : 'max-h-[calc(100vh-350px)] overflow-y-auto';

  return (
    <div className={shellClasses}>
      <div
        className={`flex justify-between items-center gap-2 ${isSheet ? '' : 'border-b pb-2 mb-3'}`}
      >
        {!isSheet && <h2 className="text-lg font-semibold">{t.stamps.yourStamps}</h2>}
        <div className={`flex items-center gap-2 ${isSheet ? 'ml-auto' : ''}`}>
          {onSharePack && stamps.length > 0 && (
            <Button
              onClick={onSharePack}
              size="sm"
              variant="ghost"
              className="whitespace-nowrap text-xs"
              title={t.stamps.sharePack}
            >
              {t.stamps.share}
            </Button>
          )}
          <Button onClick={onNewStamp} size="sm" variant="outline" className="whitespace-nowrap">
            {t.stamps.addNewStamp}
          </Button>
        </div>
      </div>

      {stamps.length > 0 && (
        <Input
          type="search"
          placeholder={t.stamps.searchStamps}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={isSheet ? '' : 'mb-3'}
          aria-label={t.stamps.searchStamps}
        />
      )}

      {stamps.length === 0 && !onAddPreset && (
        <p className="text-xs text-gray-500 mb-3 text-center py-2">
          {t.stamps.noStamps}
        </p>
      )}
      {stamps.length === 0 && onAddPreset && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">{t.stamps.startWithPreset}</p>
          <div className="grid grid-cols-2 gap-2">
            {STAMP_PRESETS.map((preset) => (
              <button
                key={preset.title}
                type="button"
                onClick={() => onAddPreset(preset)}
                className="flex items-center gap-2 p-2 rounded border hover:bg-gray-50 text-left transition-colors"
                style={{ borderColor: preset.color }}
                title={`${preset.title} (${preset.category})`}
              >
                <span className="text-xl flex-shrink-0">{preset.emoji}</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium truncate">{preset.title}</span>
                  <span className="text-[10px] text-gray-500 truncate">{preset.category}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {stamps.length > 0 && !selectedStamp && totalAfterFilter > 0 && (
        <p className="text-xs text-gray-500">{t.stamps.dragHint}</p>
      )}
      {stamps.length > 0 && totalAfterFilter === 0 && (
        <p className="text-xs text-gray-500 text-center py-2">
          {t.stamps.noMatchesQuery(query)}
        </p>
      )}

      {totalAfterFilter > 0 && (
        <div className={`space-y-3 ${listMaxHeight}`}>
          {pinned.length > 0 && (
            <StampGroup
              label={t.stamps.pinned}
              stamps={pinned}
              selectedStamp={selectedStamp}
              onSelect={onSelect}
              onEdit={onEdit}
              onTogglePin={onTogglePin}
              onDragStartStamp={onDragStartStamp}
              onDragEndStamp={onDragEndStamp}
              usage={usage}
            />
          )}
          {others.length > 0 && (
            <StampGroup
              label={pinned.length > 0 ? t.stamps.allStamps : undefined}
              stamps={others}
              selectedStamp={selectedStamp}
              onSelect={onSelect}
              onEdit={onEdit}
              onTogglePin={onTogglePin}
              onDragStartStamp={onDragStartStamp}
              onDragEndStamp={onDragEndStamp}
              usage={usage}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface StampGroupProps {
  label?: string;
  stamps: CalendarEvent[];
  selectedStamp: CalendarEvent | null;
  onSelect: (stamp: CalendarEvent | null) => void;
  onEdit: (stamp: CalendarEvent) => void;
  onTogglePin?: (stamp: CalendarEvent) => void;
  onDragStartStamp?: (stamp: CalendarEvent) => void;
  onDragEndStamp?: () => void;
  usage?: Map<string, StampUsageStats>;
}

function StampGroup({
  label,
  stamps,
  selectedStamp,
  onSelect,
  onEdit,
  onTogglePin,
  onDragStartStamp,
  onDragEndStamp,
  usage,
}: StampGroupProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-2">
      {label && (
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-1">
          {label}
        </h3>
      )}
      {stamps.map((stamp) => {
        const isSelected = selectedStamp?.id === stamp.id;
        return (
          <div
            key={stamp.id}
            title={isSelected ? t.stamps.selectedTooltip(stamp.title) : t.stamps.unselectedTooltip(stamp.title)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'copy';
              e.dataTransfer.setData('text/plain', stamp.id);
              onDragStartStamp?.(stamp);
            }}
            onDragEnd={() => onDragEndStamp?.()}
            className={`p-2 rounded border hover:bg-gray-100 flex items-center transition-all cursor-grab active:cursor-grabbing ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
            style={{ borderColor: stamp.color || '#ccc' }}
          >
            <div
              className="flex-grow flex items-center cursor-pointer min-w-0"
              onClick={() => onSelect(isSelected ? null : stamp)}
            >
              <span className="text-xl mr-2 flex-shrink-0">{stamp.emoji}</span>
              <div className="flex flex-col min-w-0">
                <span className="text-sm truncate flex items-center gap-1.5">
                  <span className="truncate">{stamp.title}</span>
                  {stamp.stampCategory && (
                    <span className="flex-shrink-0 text-[10px] uppercase tracking-wide rounded bg-gray-100 text-gray-600 px-1.5 py-0.5">
                      {stamp.stampCategory}
                    </span>
                  )}
                </span>
                {usage && (() => {
                  const stats = usage.get(stamp.id);
                  if (!stats || stats.total === 0) return null;
                  return (
                    <span className="text-[10px] text-gray-500 leading-tight">
                      {t.stamps.placedStats(stats.total, stats.thisMonth)}
                    </span>
                  );
                })()}
              </div>
            </div>
            <span
              className="w-3 h-3 rounded-full inline-block mr-2 flex-shrink-0"
              style={{ backgroundColor: stamp.color }}
            />
            {onTogglePin && (
              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 p-0 ${stamp.stampPinned ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-gray-600'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(stamp);
                }}
                title={stamp.stampPinned ? t.stamps.unpinStamp : t.stamps.pinStamp}
                aria-pressed={!!stamp.stampPinned}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill={stamp.stampPinned ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={1.6}
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                  />
                </svg>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-500 hover:text-gray-700 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(stamp);
              }}
              title={t.stamps.editStamp}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.502a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.886 1.343Z" />
              </svg>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
