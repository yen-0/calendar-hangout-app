// src/types/hangouts.ts
import { Timestamp } from 'firebase/firestore';
import { CalendarEvent } from './events'; // Assuming this has { title, start, end }
export interface CommonSlot {
    start: Date;
    end: Date;
    availableParticipants?: string[];
}
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
  createdAt: Timestamp;
  
  desiredDurationMinutes: number;
  desiredMarginMinutes: number;
  desiredMemberCount: number;
  dateRanges: { start: Timestamp, end: Timestamp }[]; // Stored as Timestamps
  timeRanges: TimeRange[]; // Stored as is (string HH:mm)
  participants: {
    [userId: string]: ParticipantData; // Map of participant UID to their data
  }
  finalSelectedSlot?: { start: Timestamp, end: Timestamp };
  // shareableLink?: string; // Can be derived: /hangouts/reply/{id}
  commonAvailabilitySlots?: any; // Calculated common slots
  calendarEvents?: CalendarEvent[]; // Optional: Denormalized events for quick access


  status: 'pending' |              // Initial state, waiting for participants
          'pending_calculation' |   // Enough participants joined, ready for calculation or calculation in progress
          'results_ready' |         // Common slots have been found
          'no_slots_found' |        // Calculation ran, but no common slots identified
          'confirmed' |             // Creator has selected a final slot
          'closed';                 // Manually closed by creator (e.g., event happened or cancelled)

  // Optional: Populated when the creator confirms a final slot
  
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



export interface ConfirmHangoutPayload {
  hangoutRequestId: string;
  // add any other required fields, for example:
  chosenSlot: {
    start: string;
    end: string;
    availableParticipants?: string[]; // Optional: who was available for this slot
  };
}

export interface FinalSelectedSlot {
  start: Date;
  end: Date;
}