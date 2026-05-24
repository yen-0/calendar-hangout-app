import { createHash } from 'node:crypto';

/**
 * Build a deterministic event ID for a (hangout, participant) pair.
 * Google Calendar event IDs must be 5–1024 chars from base32hex (a–v, 0–9).
 * Hex is a subset of base32hex, so a SHA-256 hex digest is always valid.
 * Same inputs → same ID → re-confirms update rather than duplicate.
 */
export function hangoutEventId(requestId: string, uid: string): string {
  return createHash('sha256').update(`hangout:${requestId}:${uid}`).digest('hex');
}
