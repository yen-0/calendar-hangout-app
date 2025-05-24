// src/components/calendar/DayDetailsModal.tsx
'use client';

import React from 'react';
import { CalendarEvent } from '@/types/events';
import Modal from '@/components/ui/modal'; // Your generic Modal component
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface DayDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  eventsOnDay: CalendarEvent[];
  onAddEvent: (date: Date) => void; // Callback to open the EventForm modal
  onEditEvent: (event: CalendarEvent) => void; // Callback to edit an existing event
}

const DayDetailsModal: React.FC<DayDetailsModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  eventsOnDay,
  onAddEvent,
  onEditEvent,
}) => {
  if (!isOpen || !selectedDate) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Events for ${format(selectedDate, 'EEEE, MMMM d, yyyy')}`}
      size="md"
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {eventsOnDay.length > 0 ? (
          eventsOnDay
            .sort((a,b) => a.start.getTime() - b.start.getTime()) // Sort events by start time
            .map(event => (
            <div 
                key={event.id} 
                className="p-3 rounded-md border flex justify-between items-center"
                style={{ borderColor: event.color || '#e5e7eb', backgroundColor: `${event.color}1A` /* light bg */ }}
                onClick={() => onEditEvent(event)} // Allow clicking event to edit
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onEditEvent(event)}
            >
                <div className="flex items-center">
                    {event.isStamp && event.emoji && <span className="text-xl mr-2">{event.emoji}</span>}
                    <div>
                        <p className="font-semibold text-sm" style={{color: event.color || 'inherit'}}>{event.title}</p>
                        <p className="text-xs text-gray-600">
                            {event.allDay ? 'All Day' : `${format(event.start, 'p')} - ${format(event.end, 'p')}`}
                        </p>
                    </div>
                </div>
                {/* <Button variant="ghost" size="sm" onClick={() => onEditEvent(event)}>Edit</Button> */}
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center py-4">No events scheduled for this day.</p>
        )}
      </div>
      <div className="mt-6 pt-4 border-t">
        <Button
          onClick={() => onAddEvent(selectedDate)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          + Add New Event for {format(selectedDate, 'MMM d')}
        </Button>
      </div>
    </Modal>
  );
};

export default DayDetailsModal;