// src/components/calendar/CalendarView.tsx
'use client';

import React from 'react'; // Explicitly import React if not already
import { 
    Calendar, 
    dateFnsLocalizer, 
    Views, 
    View, 
    EventProps, 
    // DateHeaderProps, // Not currently used in the latest version of your code
    // DayLayoutAlgorithm, // You commented out its usage
    // DayLayoutFunction // You commented out its usage
} from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import { CalendarEvent } from '@/types/events';
import { isSameDay, isWithinInterval } from 'date-fns';

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
  currentView?: View; // This prop is crucial
  onView?: (view: View) => void;
  currentDate?: Date;
  onNavigate?: (newDate: Date, view: View) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date; slots: Date[] | string[]; action: 'select' | 'click' | 'doubleClick' }) => void;
  isSimpleMode: boolean;
}

// Custom component for the date cell wrapper in Month View (for colored dots)
// Assuming this component is correct and working as intended from previous steps.
const CustomDateCellWrapper = ({ children, value: date, events, isSimpleMode }: { children: React.ReactNode, value: Date, events: CalendarEvent[], isSimpleMode: boolean }) => {
  if (!isSimpleMode || !children) {
    return <div className="rbc-day-bg">{children}</div>;
  }

  const eventsOnDay = events.filter(event => {
    if (event.allDay && event.start && event.end) {
        // For allDay events, RBC often sets end to the start of the next day.
        // isWithinInterval is exclusive for end, so adjust if needed or use isSameDay logic carefully.
        // Let's consider an allDay event to be on a day if the day is between its start (inclusive) and end (exclusive)
        // or if it's a single allDay event, it's just on event.start.
        const eventEndForCheck = new Date(event.end);
        // If event.end is midnight (e.g. for an allDay event ending "on" a day), subtract 1ms for isWithinInterval
        if (eventEndForCheck.getHours() === 0 && eventEndForCheck.getMinutes() === 0 && eventEndForCheck.getSeconds() === 0) {
            eventEndForCheck.setTime(eventEndForCheck.getTime() -1);
        }
        return isWithinInterval(date, { start: event.start, end: eventEndForCheck }) || isSameDay(event.start, date);
    }
    return isSameDay(event.start, date);
  });

  const uniqueColors: string[] = [];
  if (eventsOnDay.length > 0) {
    const colors = eventsOnDay
      .map(event => event.color || '#3174ad')
      .filter((color, index, self) => self.indexOf(color) === index);
    uniqueColors.push(...colors.slice(0, 4));
  }

  return (
    <div className="rbc-day-bg relative">
      {children}
      {isSimpleMode && uniqueColors.length > 0 && (
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
  currentView = Views.MONTH, // Default value, but CalendarPage should control this via state
  onView,
  currentDate = new Date(),   // Default value, but CalendarPage should control this via state
  onNavigate,
  onSelectEvent,
  onSelectSlot,
  isSimpleMode
}: CalendarViewProps) => {

  const eventPropGetter = (event: CalendarEvent, start: Date, end: Date, isSelected: boolean) => {
    // Base styles, mostly for Month/Week/Day event bars
    let style: React.CSSProperties = {
      backgroundColor: event.color || '#3174ad',
      borderRadius: '4px',
      opacity: 0.9,
      color: 'white',
      border: '0px',
      display: 'block', // Good for event bars, problematic for Agenda TR
    };

    // If currentView is Agenda, return empty styles for the TR to prevent breaking table layout
    if (currentView === Views.AGENDA) {
      return { style: {} }; // This is the key change for Agenda TR styling
    }

    // Logic for other views
    if (isSimpleMode && currentView === Views.MONTH) {
      style = {
        // For simple mode month view, we hide the event bars.
        // No need to spread ...style if we are completely overriding display.
        display: 'none',
      };
    } else { // This 'else' covers Detailed Month, Week, Day (regardless of simple/detailed for W/D)
      style.fontSize = '0.75em';
      style.padding = '1px 3px';
      // Ensure backgroundColor is set if not in simple month view
      if (event.color) {
        style.backgroundColor = event.color;
      } else {
        style.backgroundColor = '#3174ad'; // Default if no event.color
      }
    }

    return { style };
  };

  // Custom component for rendering the event itself (title, emoji)
  // This component is used *inside* the event container (e.g., inside the bar, or inside the Agenda event cell)
  const CustomEvent = ({ event }: EventProps<CalendarEvent>) => {
    if (currentView === Views.AGENDA) {
      // Specific rendering for Agenda view: apply colors/padding to this inner div
      return (
        <div 
          style={{ 
            backgroundColor: event.color || '#3174ad', 
            color: 'white', 
            padding: '3px 6px',
            borderRadius: '4px', 
            display: 'inline-block', // Makes it look like a "pill" or "tag"
            fontSize: '0.8em' // Readable font size for agenda list
          }}
          title={event.title}
        >
          {event.isStamp && event.emoji && <span className="mr-1">{event.emoji}</span>}
          <span>{event.title}</span> {/* No truncate here, let the cell width and word-wrap handle it */}
        </div>
      );
    }

    // Default rendering for Month (Detailed), Week, Day views (as bars)
    return (
      <div className="flex items-center" title={event.title}>
        {event.isStamp && event.emoji && <span className="mr-1 text-xs">{event.emoji}</span>}
        <span className="truncate text-xs">{event.title}</span>
      </div>
    );
  };

  // You had dayLayoutAlgorithm commented out, so I'll keep it that way unless you plan to use it.
  // const dayLayoutAlgorithm = ... ;

  return (
    <div className="h-[calc(100vh-200px)]"> {/* Ensure this height is appropriate */}
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        allDayAccessor="allDay"
        style={{ height: '100%' }}
        view={currentView} // Controlled by parent state
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        date={currentDate} // Controlled by parent state
        onView={onView}
        onNavigate={onNavigate}
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        selectable
        components={{
          event: CustomEvent, // Use our view-aware CustomEvent
          month: {
            dateCellWrapper: (props) => (
              <CustomDateCellWrapper {...props} events={events} isSimpleMode={isSimpleMode} />
            ),
          },
          // No custom agenda.date or agenda.time, let RBC handle those with rowspan
        }}
        eventPropGetter={eventPropGetter} // Use our view-aware eventPropGetter
        // dayLayoutAlgorithm={dayLayoutAlgorithm} // If you re-enable, ensure it's compatible
      />
    </div>
  );
};