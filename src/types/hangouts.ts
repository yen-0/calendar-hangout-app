// src/types/hangouts.ts
import { Timestamp } from 'firebase/firestore';
// Assuming CalendarEvent in './events' uses JS Date for its date fields
// If not, you might need a CalendarEventClient and CalendarEventFirestore distinction too.
// For now, let's assume CalendarEvent from './events' is client-ready (uses JS Date).

// --- Base Client-Side Date/Time Structures (using JS Date) ---
export interface DateRangeClient {
  start: Date;
  end: Date;
}

export interface TimeRange { // This is often fine as strings for both client and Firestore
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

// For individual participant's event data (client-side)
export interface ParticipantEventClient {
  title: string;
  start: Date;
  end: Date;
}

// For participant's submitted data (client-side)
export interface ParticipantDataClient {
  uid: string;
  displayName: string;
  submittedAt: Date; // JS Date
  events: ParticipantEventClient[];
}

// For common slots found by calculation (client-side)
export interface CommonSlotClient {
  start: Date;
  end: Date;
  availableParticipants: string[];
}

// For the final chosen slot (client-side)
export interface FinalSelectedSlotClient {
  start: Date;
  end: Date;
  // availableParticipants?: string[]; // Optional, if you want to store this on the final slot
}

// --- Firestore-Specific Date/Time Structures (using Timestamp) ---
export interface DateRangeFirestore {
  start: Timestamp;
  end: Timestamp;
}

export interface ParticipantEventFirestore {
  title: string;
  start: Timestamp;
  end: Timestamp;
}

export interface ParticipantDataFirestore {
  uid: string;
  displayName: string;
  submittedAt: Timestamp;
  events: ParticipantEventFirestore[];
}

export interface CommonSlotFirestore {
  start: Timestamp;
  end: Timestamp;
  availableParticipants: string[];
}

export interface FinalSelectedSlotFirestore {
  start: Timestamp;
  end: Timestamp;
  // availableParticipants?: string[]; // Optional
}

// --- Main HangoutRequest Interface (Represents data in Firestore) ---
export interface HangoutRequest {
  // id is typically not stored in the document itself, but is the document's ID.
  // When fetching, you add it. When creating, Firestore generates it.
  // For strictness, you could have Omit<HangoutRequest, 'id'> for creation.
  id?: string; // Optional here, but always present on fetched data
  creatorUid: string;
  creatorName: string;
  requestName: string;
  status:
    | 'pending'
    | 'pending_calculation'
    | 'results_ready'
    | 'no_slots_found'
    | 'confirmed'
    | 'closed';
  createdAt: Timestamp;
  desiredDurationMinutes: number;
  desiredMarginMinutes: number;
  desiredMemberCount: number;
  dateRanges: DateRangeFirestore[];
  timeRanges: TimeRange[]; // Stays as string HH:mm
  participants: {
    [userId: string]: ParticipantDataFirestore;
  };
  commonAvailabilitySlots?: CommonSlotFirestore[];
  finalSelectedSlot?: FinalSelectedSlotFirestore;
  // calendarEvents?: CalendarEvent[]; // This seems out of place for the HangoutRequest itself.
                                    // If it's meant to be a denormalization of something, consider its purpose.
                                    // Usually, calendar events are linked by hangoutRequestId.
}

// --- HangoutRequest Client-Side State (Represents data in React components) ---
export interface HangoutRequestClientState {
  id: string; // Always present when in client state after fetching
  creatorUid: string;
  creatorName: string;
  requestName: string;
  status: HangoutRequest['status']; // Inherits the status union
  createdAt: Date; // JS Date
  desiredDurationMinutes: number;
  desiredMarginMinutes: number;
  desiredMemberCount: number;
  dateRanges: DateRangeClient[]; // Uses JS Date
  timeRanges: TimeRange[];
  participants: {
    [userId: string]: ParticipantDataClient; // Uses client version
  };
  commonAvailabilitySlots?: CommonSlotClient[]; // Uses client version
  finalSelectedSlot?: FinalSelectedSlotClient;   // Uses client version
}

// --- Form Data & Payload Interfaces ---
export interface HangoutRequestFormData { // For the creation form
  requestName: string;
  desiredDurationMinutes: number;
  desiredMarginMinutes: number;
  desiredMemberCount: number;
  dateRanges: DateRangeClient[]; // Form uses JS Date
  timeRanges: TimeRange[];
}

export interface ConfirmHangoutPayload { // For calling the Cloud Function (if used) or client-side logic
  hangoutRequestId: string;
  chosenSlot: {
    start: string; // ISO Date string
    end: string;   // ISO Date string
    availableParticipants: string[]; // UIDs
  };
  // requestName?: string; // Could be passed if Cloud Function doesn't re-fetch it
}

// --- DEPRECATED/REDUNDANT TYPES TO REMOVE (from your provided snippet) ---
// These seem to be mixed or older versions that can be consolidated by the structure above.
//
// interface CommonSlot { // Use CommonSlotClient or CommonSlotFirestore
//     start: Date;
//     end: Date;
//     availableParticipants?: string[];
// }
// interface DateRange { // Use DateRangeClient or DateRangeFirestore
//   start: Date;
//   end: Date;
// }
// interface ParticipantEvent { // Use ParticipantEventClient or ParticipantEventFirestore
//   title: string;
//   start: Date;
//   end: Date;
// }
// interface ParticipantData { // Use ParticipantDataClient or ParticipantDataFirestore
//   uid: string;
//   displayName: string;
//   submittedAt: Timestamp; // This was mixed - submittedAt as Timestamp, but events use ParticipantEvent (which had Date)
//   events: ParticipantEvent[];
// }
// interface FinalSelectedSlot { // Use FinalSelectedSlotClient or FinalSelectedSlotFirestore
//      start: Date;
//      end: Date;
// }