import { Timestamp } from 'firebase/firestore';
import { StampAvailability } from './events';

/**
 * Serialized stamp shape inside a stamp pack. Captures everything that's
 * meaningful for sharing while explicitly omitting Firestore-only fields
 * (ids, timestamps, owner uid). Times-of-day are stored as minutes from
 * midnight so they survive timezone changes between sharer and importer —
 * the sharing semantics are "use this at 09:00 local" regardless of TZ.
 */
export interface PackedStamp {
  title: string;
  emoji?: string;
  color?: string;
  /** Minutes from local midnight for the placed instance start. */
  startMinutes: number;
  /** Duration in minutes. */
  durationMinutes: number;
  category?: string;
  availability?: StampAvailability;
}

export interface StampPackClient {
  id: string;
  ownerUid: string;
  name: string;
  description?: string;
  createdAt: Date;
  /** When non-null the pack URL is treated as revoked. */
  revokedAt: Date | null;
  stamps: PackedStamp[];
}

export interface StampPackFirestore {
  ownerUid: string;
  name: string;
  description?: string;
  createdAt: Timestamp;
  revokedAt: Timestamp | null;
  stamps: PackedStamp[];
}
