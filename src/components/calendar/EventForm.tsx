// src/components/calendar/EventForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { CalendarEvent, EventLocation, TravelMode } from '@/types/events';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LocationAutocomplete } from '@/components/location/LocationAutocomplete';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useLanguage } from '@/hooks/useLanguage';

const formatDateForInput = (date: Date | undefined | null): string => {
  if (!date) return '';
  const d = new Date(date);
  const timezoneOffset = d.getTimezoneOffset() * 60000;
  const localDate = new Date(d.getTime() - timezoneOffset);
  return localDate.toISOString().slice(0, 16);
};

type EventFormSaveData = Omit<
  CalendarEvent,
  'id' | 'isStamp' | 'emoji' | 'repeatDays' | 'repeatEndDate' | 'originalStampId' | 'occurrenceDate' | 'location' | 'travelMode'
> & {
  id?: string;
  location?: EventLocation | null;
  travelMode?: TravelMode | null;
};

interface EventFormProps {
  event?: Partial<CalendarEvent> | null;
  onSave: (eventData: EventFormSaveData) => void;
  onCancel: () => void;
  onDelete?: (eventId: string) => void;
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
  const [color, setColor] = useState('#2563eb');
  const [location, setLocation] = useState<EventLocation | undefined>(undefined);
  const [travelMode, setTravelMode] = useState<TravelMode>('transit');
  const { prefs } = useUserPreferences();
  const { t } = useLanguage();

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
    if (!title.trim()) {
      alert(t.forms.titleRequired);
      return;
    }
    if (!start || !end) {
      alert(t.forms.startEndRequired);
      return;
    }
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (endDate <= startDate && !allDay) {
      alert(t.forms.endAfterStart);
      return;
    }

    const hadLocation = !!event?.location;
    const locationField: EventLocation | null | undefined = location ? location : hadLocation ? null : undefined;
    const travelModeField: TravelMode | null | undefined = location ? travelMode : hadLocation ? null : undefined;

    const eventData: EventFormSaveData = {
      title: title.trim(),
      start: startDate,
      end: allDay ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59) : endDate,
      allDay,
      color,
      location: locationField,
      travelMode: travelModeField,
    };
    if (event?.id) {
      eventData.id = event.id;
    }
    onSave(eventData);
  };

  const isEditing = !!event?.id;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-1">
      <div>
        <Label htmlFor="event-title">Event Title</Label>
        <Input id="event-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <input id="event-allDay" type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        <Label htmlFor="event-allDay" className="ml-2 block text-sm text-gray-900">
          {t.calendar.allDay}
        </Label>
      </div>

      <div>
        <Label htmlFor="event-color">Color</Label>
        <Input id="event-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 h-10 w-full" />
      </div>

      {prefs.locationFeaturesEnabled && (
        <div className="space-y-2 border-t border-gray-100 pt-2">
          <Label htmlFor="event-location">Location (Tokyo area)</Label>
          <LocationAutocomplete inputId="event-location" value={location} onChange={setLocation} />
          {location && (
            <div>
              <Label htmlFor="event-travel-mode" className="text-xs">
                How will you get there?
              </Label>
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

      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-4">
        {isEditing && onDelete && (
          <Button type="button" variant="destructive" onClick={() => onDelete(event!.id!)}>
            Delete
          </Button>
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
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
          {isEditing ? 'Save Changes' : 'Create Event'}
        </Button>
      </div>
    </form>
  );
};

export default EventForm;
