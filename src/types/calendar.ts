import { CalendarEvent } from "@/types/events";
export interface CalendarEventWithHangoutId extends Omit<CalendarEvent, "id"> {
  hangoutRequestId: string;
}


// filepath: src/types/calendar.ts
export type DayKey = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";