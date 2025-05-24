// src/types/events.ts
export interface CalendarEvent {
  id: string;
  title: string;        // For Stamps, this is the Label
  start: Date;
  end: Date;
  allDay?: boolean;
  color?: string;        // Color for the event/stamp
  
  isStamp?: boolean;     // True if this event is a Stamp
  emoji?: string;        // Emoji icon for the Stamp

  // Repeat rules for Stamps
  repeatDays?: ('SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT')[]; // Days of the week
  repeatFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'; // Could add more later (e.g., DAILY)
  repeatInterval?: number; // e.g., repeat every 2 weeks if frequency is WEEKLY
  repeatEndDate?: Date;  // The date until which the stamp should repeat

  // For recurring events, we might store the original stamp's ID
  // and the specific occurrence date if we expand them into individual events.
  originalStampId?: string; 
  occurrenceDate?: Date; // The specific date this instance of a recurring stamp falls on
  
  // Any other resource data react-big-calendar might use
  resource?: any; 
}