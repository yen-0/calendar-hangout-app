// src/components/calendar/CalendarView.tsx
'use client';

import React from 'react';
import {
    Calendar,
    dateFnsLocalizer,
    Views,
    View,
    EventProps,
    // DateHeaderProps, // Not currently used
} from 'react-big-calendar';
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
}

// Custom component for the date cell wrapper in Month View (for colored dots)
const CustomDateCellWrapper = ({
  children,
  value: date, // This is the date for the current cell
  events,       // This should be ALL events passed to the Calendar
  isSimpleMode
}: { children: React.ReactNode, value: Date, events: CalendarEvent[], isSimpleMode: boolean }) => {

  if (!isSimpleMode || !children) {
    return <div className="rbc-day-bg">{children}</div>;
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
    <div className="rbc-day-bg relative">
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
}: CalendarViewProps) => {

  const eventPropGetter = (event: CalendarEvent) => { // Removed unused start, end, isSelected for simplicity
    let style: React.CSSProperties = {
      backgroundColor: event.color || '#3174ad',
      borderRadius: '4px',
      opacity: 0.9,
      color: 'white',
      border: '0px',
      display: 'block',
    };

    if (currentView === Views.AGENDA) {
      return { style: {} };
    }

    if (isSimpleMode && currentView === Views.MONTH) {
      style = {
        display: 'none', // Hide the event bars in simple month view
      };
    } else {
      style.fontSize = '0.75em';
      style.padding = '1px 3px';
      // Ensure backgroundColor is set if not in simple month view (already handled by initial style)
    }
    return { style };
  };

  const CustomEvent = ({ event }: EventProps<CalendarEvent>) => {
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
        {event.isStamp && event.emoji && <span className="mr-1 text-xs">{event.emoji}</span>}
        <span className="truncate text-xs">{event.title}</span>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-200px)]">
      <Calendar
        localizer={localizer}
        events={events}
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
        components={{
          event: CustomEvent,
          dateCellWrapper: (props) => (
            <CustomDateCellWrapper {...props} events={events} isSimpleMode={isSimpleMode} />
          ),
        }}
        eventPropGetter={eventPropGetter}
      />
    </div>
  );
};