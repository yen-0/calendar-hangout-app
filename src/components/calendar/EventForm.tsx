// src/components/calendar/EventForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { CalendarEvent, EventLocation, TravelMode } from '@/types/events';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LocationAutocomplete } from '@/components/location/LocationAutocomplete';
import { useUserPreferences } from '@/hooks/useUserPreferences';
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

//const daysOfWeekMap: { key: CalendarEvent['repeatDays'] extends (infer U)[] ? U : never, label: string }[] = [
//    { key: 'SUN', label: 'Sun' },
//    { key: 'MON', label: 'Mon' },
//    { key: 'TUE', label: 'Tue' },
//    { key: 'WED', label: 'Wed' },
//    { key: 'THU', label: 'Thu' },
//    { key: 'FRI', label: 'Fri' },
//    { key: 'SAT', label: 'Sat' },
//];

/**
 * Form output. Optional fields (location, travelMode) can be:
 *  - omitted ⇒ no change
 *  - a value ⇒ set to that value
 *  - `null` ⇒ explicitly cleared (Firestore `deleteField()`)
 */
type EventFormSaveData = Omit<
  CalendarEvent,
  'id' | 'isStamp' | 'emoji' | 'repeatDays' | 'repeatEndDate' | 'originalStampId' | 'occurrenceDate' | 'location' | 'travelMode'
> & {
  id?: string;
  location?: EventLocation | null;
  travelMode?: TravelMode | null;
};

interface EventFormProps {
  event?: Partial<CalendarEvent> | null; // Event data for editing, or null/undefined for new
  onSave: (eventData: EventFormSaveData) => void;
  onCancel: () => void;
  onDelete?: (eventId: string) => void;
  /** Save current draft as a new stamp template instead of an event. */
  onConvertToStamp?: (draft: { title: string; start: Date; end: Date; color: string }) => void;
  defaultStartDate?: Date;
  defaultEndDate?: Date;
}

const EventForm: React.FC<EventFormProps> = ({
  event,
  onSave,
  onCancel,
  onDelete,
  onConvertToStamp,
  defaultStartDate,
  defaultEndDate,
}) => {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState('#2563eb'); // Default blue
  const [location, setLocation] = useState<EventLocation | undefined>(undefined);
  const [travelMode, setTravelMode] = useState<TravelMode>('transit');
  const { prefs } = useUserPreferences();

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setStart(formatDateForInput(event.start));
      setEnd(formatDateForInput(event.end));
      setAllDay(event.allDay || false);
      setColor(event.color || '#2563eb');
      setLocation(event.location);
      setTravelMode(event.travelMode ?? 'transit');
    } else {
      // New event
      setTitle('');
      const initialStartDate = defaultStartDate || new Date();
      setStart(formatDateForInput(initialStartDate));
      const initialEndDate = defaultEndDate || new Date(initialStartDate.getTime() + 60 * 60 * 1000);
      setEnd(formatDateForInput(initialEndDate));
      setAllDay(false);
      setColor('#2563eb');
      setLocation(undefined);
      setTravelMode('transit');
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

    // Encode "explicit clear" vs "no change" via null vs undefined: if this is
    // an edit and the user removed a previously-set location, send null so the
    // Firestore write deletes the field instead of leaving stale data behind.
    const hadLocation = !!event?.location;
    const locationField: EventLocation | null | undefined = location
      ? location
      : hadLocation
        ? null
        : undefined;
    const travelModeField: TravelMode | null | undefined = location
      ? travelMode
      : hadLocation
        ? null
        : undefined;

    const eventData: EventFormSaveData = {
      title: title.trim(),
      start: startDate,
      end: allDay ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59) : endDate,
      allDay,
      color,
      location: locationField,
      travelMode: travelModeField,
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

      {prefs.locationFeaturesEnabled && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <Label htmlFor="event-location">Location (Tokyo area)</Label>
          <LocationAutocomplete
            inputId="event-location"
            value={location}
            onChange={setLocation}
          />
          {location && (
            <div>
              <Label htmlFor="event-travel-mode" className="text-xs">How will you get there?</Label>
              <select
                id="event-travel-mode"
                value={travelMode}
                onChange={(e) => setTravelMode(e.target.value as TravelMode)}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="transit">🚆 Transit</option>
                <option value="walk">🚶 Walk</option>
                <option value="drive">🚗 Drive</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Repeat Options REMOVED */}

      <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
        {isEditing && onDelete && (
          <Button type="button" variant="destructive" onClick={() => onDelete(event!.id!)}>Delete</Button>
        )}
        {onConvertToStamp && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!title.trim() || !start || !end) {
                alert('Title and times are required before converting to a stamp.');
                return;
              }
              onConvertToStamp({
                title: title.trim(),
                start: new Date(start),
                end: new Date(end),
                color,
              });
            }}
            title="Reuse this event as a placeable stamp template"
          >
            Save as stamp
          </Button>
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