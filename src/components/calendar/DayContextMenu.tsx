'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CalendarEvent } from '@/types/events';

interface Props {
  /** Anchor coordinates in viewport space. */
  x: number;
  y: number;
  /** Day the menu is acting on. */
  date: Date;
  /** Stamps to surface, in display order. Pass at most 5–6 for readability. */
  stamps: CalendarEvent[];
  onApply: (stamp: CalendarEvent, date: Date) => void;
  onClose: () => void;
}

/**
 * Lightweight floating menu shown on right-click of a day cell. Lists a small
 * set of stamps (pinned + most-used) and applies the chosen one to the day.
 * Closes on outside click, ESC, or scroll. Renders via portal so it sits above
 * everything in CalendarView's stacking context.
 */
export function DayContextMenu({ x, y, date, stamps, onApply, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  // Clamp to viewport so the menu doesn't overflow off the right or bottom edge.
  const MENU_W = 220;
  const MENU_H = 56 + stamps.length * 36; // crude estimate; clamp below also forgives
  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top = Math.min(y, window.innerHeight - MENU_H - 8);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[60] bg-white rounded-md shadow-xl border border-gray-200 py-1 text-sm"
      style={{ left, top, width: MENU_W }}
      role="menu"
      aria-label="Apply stamp to day"
    >
      <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-gray-500 border-b">
        Apply stamp to{' '}
        {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </div>
      {stamps.length === 0 && (
        <div className="px-3 py-2 text-xs text-gray-500">No stamps available.</div>
      )}
      {stamps.map((stamp) => (
        <button
          key={stamp.id}
          type="button"
          role="menuitem"
          onClick={() => {
            onApply(stamp, date);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 text-left"
        >
          <span className="text-lg flex-shrink-0">{stamp.emoji}</span>
          <span className="truncate">{stamp.title}</span>
          {stamp.stampPinned && (
            <span className="ml-auto text-[10px] text-yellow-500" aria-hidden="true">
              ★
            </span>
          )}
        </button>
      ))}
    </div>,
    document.body,
  );
}
