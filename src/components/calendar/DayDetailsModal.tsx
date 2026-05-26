'use client';

import React from 'react';
import { CalendarEvent } from '@/types/events';
import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useLanguage } from '@/hooks/useLanguage';

interface DayDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  eventsOnDay: CalendarEvent[];
  eventOpenMode?: 'hide_all' | 'show_time' | 'show_all';
  onAddEvent: (date: Date) => void;
  onEditEvent: (event: CalendarEvent) => void;
}

const DayDetailsModal: React.FC<DayDetailsModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  eventsOnDay,
  onAddEvent,
  onEditEvent,
}) => {
  const { t } = useLanguage();
  if (!isOpen || !selectedDate) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.calendar.eventForDay(format(selectedDate, 'EEEE, MMMM d, yyyy'))}
      size="md"
    >
      <div className="max-h-[60vh] space-y-4 overflow-y-auto">
        {eventsOnDay.length > 0 ? (
          eventsOnDay
            .sort((a, b) => a.start.getTime() - b.start.getTime())
            .map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-md border p-3"
                style={{ borderColor: event.color || '#e5e7eb', backgroundColor: `${event.color}1A` }}
                onClick={() => onEditEvent(event)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onEditEvent(event)}
              >
                <div className="flex items-center">
                  {event.isStamp && event.emoji && <span className="mr-2 text-xl">{event.emoji}</span>}
                  <div>
                    <p className="text-sm font-semibold" style={{ color: event.color || 'inherit' }}>
                      {event.title}
                    </p>
                    <p className="text-xs text-gray-600">
                      {event.allDay ? t.calendar.allDay : `${format(event.start, 'p')} - ${format(event.end, 'p')}`}
                    </p>
                  </div>
                </div>
              </div>
            ))
        ) : (
          <p className="py-4 text-center text-gray-500">{t.calendar.noEventsForDay}</p>
        )}
      </div>
      <div className="mt-6 border-t pt-4">
        <Button onClick={() => onAddEvent(selectedDate)} className="w-full bg-blue-600 text-white hover:bg-blue-700">
          {t.calendar.addEventForDay(format(selectedDate, 'MMM d'))}
        </Button>
      </div>
    </Modal>
  );
};

export default DayDetailsModal;
