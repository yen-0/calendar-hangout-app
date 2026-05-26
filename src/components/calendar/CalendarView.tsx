// src/components/calendar/CalendarView.tsx
'use client';

import React, { useMemo, useState } from 'react';
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  View,
  EventProps,
} from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, isSameDay, startOfDay, isBefore } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { ja } from 'date-fns/locale/ja';
import { CalendarEvent } from '@/types/events';
import { DayContextMenu } from './DayContextMenu';
import type { TravelBufferEntry, TravelBufferKey } from '@/hooks/useTravelBuffers';
import { useLanguage } from '@/hooks/useLanguage';

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar as never);

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

function buildTravelEvents(buffers: Map<TravelBufferKey, TravelBufferEntry>): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const [key, b] of buffers) {
    const gapMs = b.toStart.getTime() - b.fromEnd.getTime();
    const travelMs = b.route.minutes * 60_000;
    const overflow = travelMs > gapMs;
    const start = overflow ? new Date(b.toStart.getTime() - travelMs) : new Date(b.fromEnd);
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

interface CalendarViewProps {
  events: CalendarEvent[];
  currentView?: View;
  onView?: (view: View) => void;
  currentDate?: Date;
  onNavigate?: (newDate: Date, view: View, action: string) => void;
  onRangeChange?: (range: Date[] | { start: Date; end: Date }) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: {
    start: Date;
    end: Date;
    slots: Date[] | string[];
    action: 'select' | 'click' | 'doubleClick';
  }) => void;
  isSimpleMode: boolean;
  onDropFromOutside?: (slotInfo: { start: Date | string; end: Date | string; allDay: boolean }) => void;
  contextStamps?: CalendarEvent[];
  onApplyStampToDay?: (stamp: CalendarEvent, date: Date) => void;
  travelBuffers?: Map<TravelBufferKey, TravelBufferEntry>;
}

const CustomDateCellWrapper = ({
  children,
  value: date,
  events,
  isSimpleMode,
  onContextMenu,
}: {
  children: React.ReactNode;
  value: Date;
  events: CalendarEvent[];
  isSimpleMode: boolean;
  onContextMenu?: (e: React.MouseEvent, date: Date) => void;
}) => {
  const handleContext = onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, date) : undefined;

  if (!isSimpleMode || !children) {
    return (
      <div className="rbc-day-bg" onContextMenu={handleContext}>
        {children}
      </div>
    );
  }

  const eventsOnDay = events.filter((event) => {
    const cellDateStart = startOfDay(date);
    const eventStartDay = startOfDay(event.start);

    if (event.allDay && event.start && event.end) {
      const eventEffectiveEnd = startOfDay(event.end);
      return !isBefore(cellDateStart, eventStartDay) && isBefore(cellDateStart, eventEffectiveEnd);
    }
    return isSameDay(cellDateStart, eventStartDay);
  });

  const uniqueColors: string[] = [];
  if (eventsOnDay.length > 0) {
    const colors = eventsOnDay
      .map((event) => event.color || '#3174ad')
      .filter((color, index, self) => self.indexOf(color) === index);
    uniqueColors.push(...colors.slice(0, 4));
  }

  return (
    <div className="rbc-day-bg relative" onContextMenu={handleContext}>
      {children}
      {uniqueColors.length > 0 && (
        <div className="absolute bottom-1 left-1/2 flex w-full -translate-x-1/2 justify-center space-x-1 px-1">
          {uniqueColors.map((color, index) => (
            <span
              key={`${format(date, 'yyyy-MM-dd')}-dot-${index}`}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: color }}
              title={eventsOnDay
                .filter((e) => (e.color || '#3174ad') === color)
                .map((e) => e.title)
                .join(', ')}
            />
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
  isSimpleMode,
  onDropFromOutside,
  contextStamps,
  onApplyStampToDay,
  travelBuffers,
}: CalendarViewProps) => {
  const [menu, setMenu] = useState<{ x: number; y: number; date: Date } | null>(null);
  const { language, t } = useLanguage();

  const localizer = useMemo(() => {
    const locale = language === 'ja' ? ja : enUS;
    return dateFnsLocalizer({
      format,
      parse,
      startOfWeek: () => startOfWeek(new Date(), { locale }),
      getDay,
      locales: language === 'ja' ? { ja } : { 'en-US': enUS },
    });
  }, [language]);

  const messages = useMemo(
    () =>
      language === 'ja'
        ? {
            today: '今日',
            previous: '前へ',
            next: '次へ',
            month: '月',
            week: '週',
            day: '日',
            agenda: '一覧',
            date: '日付',
            time: '時刻',
            event: '予定',
            showMore: (total: number) => `+${total}件`,
            noEventsInRange: '予定はありません',
          }
        : {
            today: 'Today',
            previous: 'Back',
            next: 'Next',
            month: 'Month',
            week: 'Week',
            day: 'Day',
            agenda: 'Agenda',
            date: 'Date',
            time: 'Time',
            event: 'Event',
            showMore: (total: number) => `+${total} more`,
            noEventsInRange: 'No events in this range',
          },
    [language],
  );

  const augmentedEvents = useMemo(() => {
    if (!travelBuffers || travelBuffers.size === 0 || currentView === Views.MONTH) {
      return events;
    }
    return [...events, ...buildTravelEvents(travelBuffers)];
  }, [events, travelBuffers, currentView]);

  const handleCellContext =
    onApplyStampToDay && contextStamps && contextStamps.length > 0
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
      const tooltip =
        language === 'ja'
          ? `${TRAVEL_MODE_EMOJI[mode]} ${minutes} 分 — ${fromName} → ${toName}${overflow ? '（空き時間より長い）' : ''}`
          : `${TRAVEL_MODE_EMOJI[mode]} ${minutes} min — ${fromName} → ${toName}${overflow ? ' (tight!)' : ''}`;
      return (
        <div title={tooltip} className="flex items-center justify-center gap-1 truncate">
          <span aria-hidden="true">{TRAVEL_MODE_EMOJI[mode]}</span>
          <span>{minutes} min</span>
          {overflow && <span aria-hidden="true" title={t.calendar.travelOverGap}>⚠️</span>}
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
            fontSize: '0.8em',
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
            className="mr-1 rounded bg-white/30 px-1 text-[10px] font-bold"
            title={t.calendar.fromGoogle}
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
        onRangeChange={onRangeChange}
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        selectable
        onDropFromOutside={onDropFromOutside}
        messages={messages}
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

