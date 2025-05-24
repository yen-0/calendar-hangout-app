// src/components/calendar/EventForm.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CalendarEvent } from '@/types/events';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
// import { Textarea } from '@/components/ui/textarea'; // Assuming you have this
import { Label } from '@/components/ui/label';
import EmojiPicker, { EmojiClickData, Theme as EmojiTheme } from 'emoji-picker-react';
// You might need a Popover or Dropdown component for the emoji picker
// For simplicity, we'll show it inline or via a simple toggle first.

// Helper to format Date to 'yyyy-MM-ddThh:mm' for datetime-local input
const formatDateForInput = (date: Date | undefined | null): string => {
  if (!date) return '';
  const d = new Date(date);
  const timezoneOffset = d.getTimezoneOffset() * 60000;
  const localDate = new Date(d.getTime() - timezoneOffset);
  return localDate.toISOString().slice(0, 16);
};

// Helper to format Date to 'yyyy-MM-dd' for date input
const formatDateForDateInput = (date: Date | undefined | null): string => {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
};

const daysOfWeekMap: { key: CalendarEvent['repeatDays'] extends (infer U)[] ? U : never, label: string }[] = [
    { key: 'SUN', label: 'Sun' },
    { key: 'MON', label: 'Mon' },
    { key: 'TUE', label: 'Tue' },
    { key: 'WED', label: 'Wed' },
    { key: 'THU', label: 'Thu' },
    { key: 'FRI', label: 'Fri' },
    { key: 'SAT', label: 'Sat' },
];

interface EventFormProps {
  event?: Partial<CalendarEvent> | null; // Event data for editing, or null/undefined for new
  onSave: (eventData: Omit<CalendarEvent, 'id' | 'isStamp' | 'emoji' | 'repeatDays' | 'repeatEndDate' | 'originalStampId' | 'occurrenceDate'> & { id?: string }) => void; // Modified onSave type
  onCancel: () => void;
  onDelete?: (eventId: string) => void;
  defaultStartDate?: Date;
  defaultEndDate?: Date;
}

const EventForm: React.FC<EventFormProps> = ({
  event,
  onSave,
  onCancel,
  onDelete,
  defaultStartDate,
  defaultEndDate,
}) => {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState('#2563eb'); // Default blue

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setStart(formatDateForInput(event.start));
      setEnd(formatDateForInput(event.end));
      setAllDay(event.allDay || false);
      setColor(event.color || '#2563eb');
    } else {
      // New event
      setTitle('');
      const initialStartDate = defaultStartDate || new Date();
      setStart(formatDateForInput(initialStartDate));
      const initialEndDate = defaultEndDate || new Date(initialStartDate.getTime() + 60 * 60 * 1000);
      setEnd(formatDateForInput(initialEndDate));
      setAllDay(false);
      setColor('#2563eb');
    }
  }, [event, defaultStartDate, defaultEndDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { alert("Title is required."); return; }
    if (!start || !end) { alert("Start and End times are required."); return; }
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (endDate <= startDate && !allDay) {
        alert("End time must be after start time.");
        return;
    }

    const eventData: Omit<CalendarEvent, 'id' | 'isStamp' | 'emoji' | 'repeatDays' | 'repeatEndDate' | 'originalStampId' | 'occurrenceDate'> & { id?: string } = {
      title: title.trim(),
      start: startDate,
      end: allDay ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59) : endDate,
      allDay,
      color,
      // No stamp-specific fields are set here
    };
    if (event?.id) {
      eventData.id = event.id;
    }
    onSave(eventData);
  };

  const isEditing = !!event?.id;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-1"> {/* Removed max-h and overflow, as it's simpler now */}
      {/* Event Type Toggle REMOVED */}

      <div>
        <Label htmlFor="event-title">Event Title</Label>
        <Input id="event-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      {/* Emoji Picker REMOVED */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="event-start">Start Time</Label>
          <Input id="event-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required disabled={allDay} />
        </div>
        <div>
          <Label htmlFor="event-end">End Time</Label>
          <Input id="event-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required disabled={allDay} />
        </div>
      </div>
      
      <div className="flex items-center">
        <input id="event-allDay" type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
        <Label htmlFor="event-allDay" className="ml-2 block text-sm text-gray-900">All-day event</Label>
      </div>

      <div>
        <Label htmlFor="event-color">Color</Label>
        <Input id="event-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 h-10 w-full" />
      </div>

      {/* Repeat Options REMOVED */}

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
        {isEditing && onDelete && (
          <Button type="button" variant="destructive" onClick={() => onDelete(event!.id!)}>Delete</Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
          {isEditing ? 'Save Changes' : 'Create Event'}
        </Button>
      </div>
    </form>
  );
};

export default EventForm;