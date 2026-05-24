// src/components/calendar/CalendarView.tsx
'use client';

import React, { useState } from 'react';
import {
    Calendar,
    dateFnsLocalizer,
    Views,
    View,
    EventProps,
    // DateHeaderProps, // Not currently used
} from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format } from 'date-fns/format';
import { parse } from 'date-fns/parse';
import { startOfWeek } from 'date-fns/startOfWeek';
import { getDay } from 'date-fns/getDay';
import { enUS } from 'date-fns/locale/en-US';
import { CalendarEvent } from '@/types/events';
import {
    isSameDay,
    startOfDay,
    isBefore,
    // isWithinInterval, // Replaced with startOfDay logic for allDay events
    // endOfDay // Not strictly needed for the revised allDay logic
} from 'date-fns';
import { DayContextMenu } from './DayContextMenu';
import type { TravelBufferEntry, TravelBufferKey } from '@/hooks/useTravelBuffers';

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar as never);

/** Discriminator put on the `resource` of synthetic travel chips. */
interface TravelChipResource {
  type: 'travel';
  minutes: number;
  mode: 'transit' | 'walk' | 'drive';
  fromName: string;
  toName: string;
  overflow: boolean;
}

const TRAVEL_MODE_EMOJI: Record<TravelChipResource['mode'], string> = {
  transit: '🚆',
  walk: '🚶',
  drive: '🚗',
};

function isTravelEvent(e: CalendarEvent): e is CalendarEvent & { resource: TravelChipResource } {
  const r = e.resource as { type?: string } | undefined;
  return !!r && r.type === 'travel';
}

/**
 * Materialize travel chips as synthetic events RBC can render in its native
 * grid. start = fromEnd; end = toStart for the normal case (chip fills the gap).
 * Overflow case (travel > gap): chip spans `toStart - travel → toStart` and is
 * styled as a warning so the user sees "you're going to be late."
 */
function buildTravelEvents(buffers: Map<TravelBufferKey, TravelBufferEntry>): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const [key, b] of buffers) {
    const gapMs = b.toStart.getTime() - b.fromEnd.getTime();
    const travelMs = b.route.minutes * 60_000;
    const overflow = travelMs > gapMs;
    const start = overflow
      ? new Date(b.toStart.getTime() - travelMs)
      : new Date(b.fromEnd);
    const end = new Date(b.toStart);
    out.push({
      id: `travel:${key}`,
      title: `${TRAVEL_MODE_EMOJI[b.route.mode]} ${b.route.minutes} min`,
      start,
      end,
      allDay: false,
      resource: {
        type: 'travel',
        minutes: b.route.minutes,
        mode: b.route.mode,
        fromName: b.fromLocationName,
        toName: b.toLocationName,
        overflow,
      } satisfies TravelChipResource,
    });
  }
  return out;
}

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enUS }),
  getDay,
  locales,
});

interface CalendarViewProps {
  events: CalendarEvent[];
  currentView?: View;
  onView?: (view: View) => void;
  currentDate?: Date;
  onNavigate?: (newDate: Date, view: View, action: string) => void; // Added action for handleNavigate compatibility
  onRangeChange?: (range: Date[] | { start: Date; end: Date }) => void; // For viewWindow updates
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date; slots: Date[] | string[]; action: 'select' | 'click' | 'doubleClick' }) => void;
  isSimpleMode: boolean;
  /** Fires when an external item (e.g. a palette stamp) is dropped onto a day cell. */
  onDropFromOutside?: (slotInfo: { start: Date | string; end: Date | string; allDay: boolean }) => void;
  /**
   * When provided, right-clicking a day cell opens a context menu listing
   * these stamps. Empty array hides the menu entirely.
   */
  contextStamps?: CalendarEvent[];
  /** Called when a stamp is chosen from the day context menu. */
  onApplyStampToDay?: (stamp: CalendarEvent, date: Date) => void;
  /**
   * Pre-computed travel times between adjacent same-day located events.
   * When present and view is week/day/agenda, the calendar renders dotted
   * "🚆 22 min" chips in the gaps. Hidden in month view (no time scale).
   */
  travelBuffers?: Map<TravelBufferKey, TravelBufferEntry>;
}

// Custom component for the date cell wrapper in Month View (for colored dots)
const CustomDateCellWrapper = ({
  children,
  value: date, // This is the date for the current cell
  events,       // This should be ALL events passed to the Calendar
  isSimpleMode,
  onContextMenu,
}: { children: React.ReactNode, value: Date, events: CalendarEvent[], isSimpleMode: boolean, onContextMenu?: (e: React.MouseEvent, date: Date) => void }) => {
  const handleContext = onContextMenu
    ? (e: React.MouseEvent) => onContextMenu(e, date)
    : undefined;

  if (!isSimpleMode || !children) {
    return <div className="rbc-day-bg" onContextMenu={handleContext}>{children}</div>;
  }

  const eventsOnDay = events.filter(event => {
    const cellDateStart = startOfDay(date);
    const eventStartDay = startOfDay(event.start);

    if (event.allDay && event.start && event.end) {
        // For all-day events, RBC often sets event.end to the start of the *next* day.
        // We want to include the event if the cellDate is on or after event.start
        // AND strictly before event.end (when event.end is start of next day).
        const eventEffectiveEnd = startOfDay(event.end);
        return !isBefore(cellDateStart, eventStartDay) && isBefore(cellDateStart, eventEffectiveEnd);
    }
    // For non-all-day events (or single all-day events where end might not be properly set for multi-day logic)
    return isSameDay(cellDateStart, eventStartDay);
  });

  const uniqueColors: string[] = [];
  if (eventsOnDay.length > 0) {
    const colors = eventsOnDay
      .map(event => event.color || '#3174ad')
      .filter((color, index, self) => self.indexOf(color) === index);
    uniqueColors.push(...colors.slice(0, 4)); // Max 4 dots
  }

  return (
    <div className="rbc-day-bg relative" onContextMenu={handleContext}>
      {children}
      {uniqueColors.length > 0 && ( // isSimpleMode is already true if we reach here
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex space-x-1 justify-center w-full px-1">
          {uniqueColors.map((color, index) => (
            <span
              key={`${format(date, 'yyyy-MM-dd')}-dot-${index}`}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: color }}
              title={eventsOnDay.filter(e => (e.color || '#3174ad') === color).map(e => e.title).join(', ')}
            ></span>
          ))}
        </div>
      )}
    </div>
  );
};


export const CalendarView = ({
  events,
  currentView = Views.MONTH,
  onView,
  currentDate = new Date(),
  onNavigate,
  onRangeChange,
  onSelectEvent,
  onSelectSlot,
  isSimpleMode, // Relies on CalendarPage to pass the correct boolean value
  onDropFromOutside,
  contextStamps,
  onApplyStampToDay,
  travelBuffers,
}: CalendarViewProps) => {
  const [menu, setMenu] = useState<{ x: number; y: number; date: Date } | null>(null);

  // Month view has no time scale, so travel chips would just clutter. Other
  // views render the chips inline with the real events.
  const augmentedEvents = React.useMemo(() => {
    if (!travelBuffers || travelBuffers.size === 0 || currentView === Views.MONTH) {
      return events;
    }
    return [...events, ...buildTravelEvents(travelBuffers)];
  }, [events, travelBuffers, currentView]);

  const handleCellContext = onApplyStampToDay && contextStamps && contextStamps.length > 0
    ? (e: React.MouseEvent, date: Date) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, date });
      }
    : undefined;

  const eventPropGetter = (event: CalendarEvent) => {
    if (isTravelEvent(event)) {
      const overflow = event.resource.overflow;
      const fg = overflow ? '#b91c1c' : '#4b5563';
      const bg = overflow ? 'rgba(254, 226, 226, 0.85)' : 'rgba(241, 245, 249, 0.85)';
      return {
        style: {
          backgroundColor: bg,
          color: fg,
          border: `1px dashed ${overflow ? '#dc2626' : '#94a3b8'}`,
          borderRadius: '999px',
          padding: '0 6px',
          fontSize: '0.7em',
          fontWeight: 500,
          // No drag for chips; they're computed.
          pointerEvents: 'none' as const,
          boxShadow: 'none',
        },
        className: 'rbc-travel-chip',
      };
    }

    const isGcal = event.source === 'gcal';
    const baseColor = event.color || (isGcal ? '#9ca3af' : '#3174ad');
    let style: React.CSSProperties = {
      backgroundColor: baseColor,
      borderRadius: '4px',
      opacity: isGcal ? 0.75 : 0.9,
      color: 'white',
      border: isGcal ? '1px dashed rgba(255,255,255,0.6)' : '0px',
      display: 'block',
    };

    if (currentView === Views.AGENDA) {
      return { style: {} };
    }

    if (isSimpleMode && currentView === Views.MONTH) {
      style = { display: 'none' };
    } else {
      style.fontSize = '0.75em';
      style.padding = '1px 3px';
    }
    return { style };
  };

  const CustomEvent = ({ event }: EventProps<CalendarEvent>) => {
    if (isTravelEvent(event)) {
      const { minutes, mode, fromName, toName, overflow } = event.resource;
      const tooltip = `${TRAVEL_MODE_EMOJI[mode]} ${minutes} min — ${fromName} → ${toName}${overflow ? ' (tight!)' : ''}`;
      return (
        <div title={tooltip} className="flex items-center justify-center gap-1 truncate">
          <span aria-hidden="true">{TRAVEL_MODE_EMOJI[mode]}</span>
          <span>{minutes} min</span>
          {overflow && <span aria-hidden="true" title="Travel exceeds gap">⚠️</span>}
        </div>
      );
    }

    if (currentView === Views.AGENDA) {
      return (
        <div 
          style={{ 
            backgroundColor: event.color || '#3174ad', 
            color: 'white', 
            padding: '3px 6px',
            borderRadius: '4px', 
            display: 'inline-block',
            fontSize: '0.8em'
          }}
          title={event.title}
        >
          {event.isStamp && event.emoji && <span className="mr-1">{event.emoji}</span>}
          <span>{event.title}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center" title={event.title}>
        {event.source === 'gcal' && (
          <span
            className="mr-1 text-[10px] font-bold rounded bg-white/30 px-1"
            title="From Google Calendar"
          >
            G
          </span>
        )}
        {event.isStamp && event.emoji && <span className="mr-1 text-xs">{event.emoji}</span>}
        <span className="truncate text-xs">{event.title}</span>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-200px)]">
      <DnDCalendar
        localizer={localizer}
        events={augmentedEvents}
        startAccessor="start"
        endAccessor="end"
        allDayAccessor="allDay"
        style={{ height: '100%' }}
        view={currentView}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        date={currentDate}
        onView={onView}
        onNavigate={onNavigate}
        onRangeChange={onRangeChange} // Prop for CalendarPage to manage viewWindow
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        selectable
        onDropFromOutside={onDropFromOutside}
        components={{
          event: CustomEvent,
          dateCellWrapper: (props) => (
            <CustomDateCellWrapper
              {...props}
              events={events}
              isSimpleMode={isSimpleMode}
              onContextMenu={handleCellContext}
            />
          ),
        }}
        eventPropGetter={eventPropGetter}
      />
      {menu && onApplyStampToDay && contextStamps && (
        <DayContextMenu
          x={menu.x}
          y={menu.y}
          date={menu.date}
          stamps={contextStamps}
          onApply={onApplyStampToDay}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
};