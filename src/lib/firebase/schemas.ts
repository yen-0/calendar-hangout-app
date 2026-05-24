import { z } from 'zod';

export const DayKeySchema = z.enum(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);

export const CalendarEventSourceSchema = z.enum(['local', 'gcal']);

/**
 * Schema for a CalendarEvent in its client-side shape (Dates already converted from Timestamps).
 * Used to runtime-validate the result of eventFromFirestore so a malformed Firestore doc
 * throws at the data boundary rather than deep in a component.
 */
export const StampAvailabilitySchema = z.enum(['busy', 'free', 'tentative']);

export const TravelModeSchema = z.enum(['transit', 'walk', 'drive']);

export const EventLocationSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().max(240).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  placeId: z.string().max(80).optional(),
});

export const CalendarEventSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  start: z.date(),
  end: z.date(),
  allDay: z.boolean().optional(),
  color: z.string().optional(),
  source: CalendarEventSourceSchema.optional(),
  gcalEventId: z.string().optional(),
  isStamp: z.boolean().optional(),
  emoji: z.string().optional(),
  repeatDays: z.array(DayKeySchema).optional(),
  repeatFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  repeatInterval: z.number().int().positive().optional(),
  repeatEndDate: z.date().optional(),
  originalStampId: z.string().optional(),
  occurrenceDate: z.date().optional(),
  stampCategory: z.string().optional(),
  stampPinned: z.boolean().optional(),
  stampOrder: z.number().optional(),
  stampAvailability: StampAvailabilitySchema.optional(),
  stampDeletedAt: z.date().optional(),
  location: EventLocationSchema.optional(),
  travelMode: TravelModeSchema.optional(),
  resource: z.unknown().optional(),
});

export type CalendarEventValidated = z.infer<typeof CalendarEventSchema>;

export const TimeRangeSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

export const DateRangeClientSchema = z.object({
  start: z.date(),
  end: z.date(),
});

export const HangoutStatusSchema = z.enum([
  'pending',
  'pending_calculation',
  'results_ready',
  'no_slots_found',
  'confirmed',
  'closed',
]);

export const PackedStampSchema = z.object({
  title: z.string().min(1).max(80),
  emoji: z.string().max(8).optional(),
  color: z.string().max(16).optional(),
  startMinutes: z.number().int().min(0).max(60 * 24 - 1),
  durationMinutes: z.number().int().min(1).max(60 * 24),
  category: z.string().max(40).optional(),
  availability: StampAvailabilitySchema.optional(),
});

export const StampPackSchema = z.object({
  id: z.string().min(1),
  ownerUid: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(280).optional(),
  createdAt: z.date(),
  revokedAt: z.date().nullable(),
  stamps: z.array(PackedStampSchema).min(1).max(50),
});
