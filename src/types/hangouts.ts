// src/types/hangouts.ts
import { Timestamp } from 'firebase/firestore';
import { CalendarEvent } from './events'; // Assuming this has { title, start, end }

export interface DateRange {
  start: Date; // Stored as Timestamp in Firestore, but Date in client
  end: Date;   // Stored as Timestamp in Firestore, but Date in client
}

export interface TimeRange { // For simplicity, let's use string "HH:mm" for input, convert as needed
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

// Subset of CalendarEvent relevant for hangout availability
export interface ParticipantEvent {
  title: string;
  start: Date; // Stored as Timestamp
  end: Date;   // Stored as Timestamp
}

export interface ParticipantData {
  uid: string;
  displayName: string; // Denormalized for easier display
  submittedAt: Timestamp;
  events: ParticipantEvent[]; // User's busy slots (actual event occurrences) within request ranges
}

export interface HangoutRequest {
  id: string; // Document ID
  creatorUid: string;
  creatorName: string; // Denormalized
  requestName: string;
  status: 'pending' | 'calculating' | 'results_ready' | 'closed';
  createdAt: Timestamp;
  desiredDurationMinutes: number;
  desiredMarginMinutes: number;
  desiredMemberCount: number;
  dateRanges: { start: Timestamp, end: Timestamp }[]; // Stored as Timestamps
  timeRanges: TimeRange[]; // Stored as is (string HH:mm)
  participants: {
    [userId: string]: ParticipantData; // Map of participant UID to their data
  };
  // shareableLink?: string; // Can be derived: /hangouts/reply/{id}
}

// For form data before conversion to Firestore types
export interface HangoutRequestFormData {
  requestName: string;
  desiredDurationMinutes: number;
  desiredMarginMinutes: number;
  desiredMemberCount: number;
  dateRanges: DateRange[];
  timeRanges: TimeRange[];
}
export interface FinalSelectedSlot {
     start: Date; // Client-side
     end: Date;   // Client-side
     // availableParticipants?: string[]; // Optional: can be useful to store who was available for the chosen one
   }

export interface HangoutRequest {
   // ... (existing fields)
   status: 'pending' | 'pending_calculation' | 'results_ready' | 'no_slots_found' | 'confirmed' | 'closed';
   finalSelectedSlot?: { start: Timestamp, end: Timestamp }; // Stored as Timestamps in Firestore
   // commonAvailabilitySlots?: CommonSlot[]; // This is already there from previous step, for Firestore it would be Timestamps too
 }