'use client';

import { useState } from 'react';
import { Drawer } from 'vaul';
import { CalendarEvent } from '@/types/events';
import { Button } from '@/components/ui/button';
import type { StampUsageStats } from '@/utils/stampStats';
import type { StampPreset } from '@/lib/stampPresets';
import { StampPalette } from './StampPalette';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  stamps: CalendarEvent[];
  selectedStamp: CalendarEvent | null;
  onSelect: (stamp: CalendarEvent | null) => void;
  onEdit: (stamp: CalendarEvent) => void;
  onNewStamp: () => void;
  onTogglePin?: (stamp: CalendarEvent) => void;
  onDragStartStamp?: (stamp: CalendarEvent) => void;
  onDragEndStamp?: () => void;
  usage?: Map<string, StampUsageStats>;
  onAddPreset?: (preset: StampPreset) => void;
  onSharePack?: () => void;
}

/**
 * Responsive shell around StampPalette. Renders both layouts and lets CSS pick
 * one — avoids a hydration flash that a JS-driven media-query check would cause.
 *  - md+ (>= 768px): sidebar inline.
 *  - < md: nothing inline; a FAB at bottom-right opens a vaul drawer holding
 *    the same palette content. Tapping a stamp closes the drawer so the user
 *    can immediately tap a day on the now-visible calendar.
 */
export function StampPaletteSheet(props: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  const handleSheetSelect = (stamp: CalendarEvent | null) => {
    props.onSelect(stamp);
    if (stamp) setOpen(false);
  };

  const handleSheetNewStamp = () => {
    setOpen(false);
    props.onNewStamp();
  };

  const handleSheetEdit = (stamp: CalendarEvent) => {
    setOpen(false);
    props.onEdit(stamp);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <StampPalette {...props} variant="sidebar" />
      </div>

      {/* Mobile: FAB + drawer */}
      <div className="md:hidden">
        <Drawer.Root open={open} onOpenChange={setOpen}>
          <Drawer.Trigger asChild>
              <Button
                type="button"
                className="fixed right-4 z-40 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 flex items-center gap-2"
                style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
                aria-label={t.stamps.openStamps(props.stamps.length)}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  🏷️
                </span>
              <span className="text-sm font-medium">{t.stamps.yourStamps}</span>
              {props.stamps.length > 0 && (
                <span className="text-xs bg-white/20 rounded-full px-1.5 py-0.5">
                  {props.stamps.length}
                </span>
              )}
            </Button>
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
            <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mt-24 flex h-[85vh] flex-col rounded-t-2xl bg-white outline-none">
              <div className="mx-auto my-2 h-1.5 w-12 flex-shrink-0 rounded-full bg-gray-300" />
              <div className="px-4 pb-2 flex items-center justify-between border-b">
                <Drawer.Title className="text-lg font-semibold">{t.stamps.yourStamps}</Drawer.Title>
                <Drawer.Description className="sr-only">
                  Tap a stamp to arm it for placement, then tap days on the calendar.
                </Drawer.Description>
              </div>
              <div
                className="px-4 py-3 flex-1 overflow-y-auto"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
              >
                <StampPalette
                  {...props}
                  variant="sheet"
                  onSelect={handleSheetSelect}
                  onEdit={handleSheetEdit}
                  onNewStamp={handleSheetNewStamp}
                />
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    </>
  );
}
