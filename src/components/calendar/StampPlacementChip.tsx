'use client';

import { useEffect } from 'react';
import { CalendarEvent } from '@/types/events';
import { Button } from '@/components/ui/button';

interface Props {
  stamp: CalendarEvent | null;
  onCancel: () => void;
}

/**
 * Floating bottom-center chip shown while a stamp is "armed" for placement.
 * Visible across the whole app shell so the user always knows what they'll drop,
 * including on mobile where the palette is scrolled off-screen.
 */
export function StampPlacementChip({ stamp, onCancel }: Props) {
  // ESC clears placement on desktop. Cheap to wire globally — only listens when armed.
  useEffect(() => {
    if (!stamp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stamp, onCancel]);

  if (!stamp) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      // safe-area padding for iOS home-indicator
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
    >
      <div
        className="pointer-events-auto flex items-center gap-3 rounded-full bg-gray-900 text-white shadow-lg px-4 py-2 max-w-[92vw]"
        style={{ borderLeft: `4px solid ${stamp.color || '#4f46e5'}` }}
      >
        <span className="text-xl leading-none" aria-hidden="true">
          {stamp.emoji}
        </span>
        <div className="flex flex-col text-sm leading-tight min-w-0">
          <span className="font-medium truncate">{stamp.title}</span>
          <span className="text-xs text-gray-300 hidden sm:inline">
            Tap a day to place · ESC to cancel
          </span>
          <span className="text-xs text-gray-300 sm:hidden">Tap days to place</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="ml-1 h-8 px-3 text-white hover:bg-white/10"
        >
          Done
        </Button>
      </div>
    </div>
  );
}
