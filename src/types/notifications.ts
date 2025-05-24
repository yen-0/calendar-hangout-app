// src/types/notifications.ts (Create this new file)
import { Timestamp } from 'firebase/firestore';

export interface UserNotification {
  id: string; // Document ID
  type: 'hangout_invitation' | 'generic_message' | 'friend_request'; // Add other types as needed
  hangoutRequestId?: string;
  hangoutRequestName?: string;
  confirmedSlotStart?: Timestamp; // Firestore Timestamp
  confirmedSlotEnd?: Timestamp;   // Firestore Timestamp
  creatorName?: string;           // For hangout_invitation
  isRead: boolean;
  createdAt: Timestamp;
  message: string;
  participantUid: string; // Whose notification this is
  // Add any other fields common to all notifications or specific to types
  relatedUrl?: string; // e.g., link to the hangout reply page
}

// For client-side display, you might convert Timestamps to Dates
export interface UserNotificationClient extends Omit<UserNotification, 'createdAt' | 'confirmedSlotStart' | 'confirmedSlotEnd'> {
  createdAt: Date;
  confirmedSlotStart?: Date;
  confirmedSlotEnd?: Date;
}