import { DayKey } from '@/types/calendar';

export type CalendarEventSource = 'local' | 'gcal';

export type StampAvailability = 'busy' | 'free' | 'tentative';

export type TravelMode = 'transit' | 'walk' | 'drive';

/**
 * A geocoded location attached to an event or stamp. Coordinates are required
 * (the buffer-calculation API needs them); placeId is optional and provider-
 * specific (Yahoo Japan's `Uid`/`Gid`) — kept opaque so we can swap providers
 * later without a migration.
 */
export interface EventLocation {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  color?: string;

  // Where the event comes from. Absence is treated as 'local' for backward compatibility.
  source?: CalendarEventSource;
  // For GCal-sourced events: the Google event ID (stable across syncs).
  gcalEventId?: string;

  isStamp?: boolean;
  emoji?: string;

  repeatDays?: DayKey[];
  repeatFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  repeatInterval?: number;
  repeatEndDate?: Date;

  originalStampId?: string;
  occurrenceDate?: Date;

  // Stamp-definition-only fields (ignored on non-stamp events and stamp instances).
  stampCategory?: string;
  stampPinned?: boolean;
  stampOrder?: number;
  // Default 'busy' when undefined — matches pre-existing behavior.
  stampAvailability?: StampAvailability;
  // Soft-delete marker for stamp definitions. When set, the stamp is hidden from
  // the palette but placed instances are preserved.
  stampDeletedAt?: Date;

  // Optional geocoded location and preferred travel mode for buffer
  // calculations. Scoped to Japan for now (the autocomplete is region-locked).
  location?: EventLocation;
  travelMode?: TravelMode;

  resource?: unknown;
}

export const isGcalEvent = (e: CalendarEvent): boolean => e.source === 'gcal';

/**
 * Partial-update payload that allows `null` for individual fields to explicitly
 * clear them in storage (Firestore `deleteField()`). `undefined` means "no change."
 */
export type CalendarEventUpdate = {
  [K in keyof Omit<CalendarEvent, 'id'>]?: CalendarEvent[K] | null;
};