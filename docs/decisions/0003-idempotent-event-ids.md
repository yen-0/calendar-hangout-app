# ADR 0003: Idempotent Google Calendar event IDs via SHA-256 hex of (requestId, uid)

Date: 2026-05-22
Status: Accepted

## Context

When a hangout is confirmed, the server writes an event to each participant's primary Google Calendar. The creator might "re-confirm" (after editing the slot, or just by clicking the button twice) — we must not create duplicate events on participants' calendars.

The Google Calendar API supports two patterns for this:
1. **Server-generated event ID** — `events.insert` assigns one. Re-calling creates a duplicate.
2. **Client-supplied event ID** — pass `id` in the insert body. If an event with that ID exists, the API returns 409 Conflict and we fall back to `events.update` for the same idempotent ID.

Pattern (2) requires the ID to be 5–1024 chars from base32hex (`[a-v0-9]`).

## Decision

For each `(hangoutRequestId, participantUid)` pair, the event ID is:

```ts
sha256(`hangout:${hangoutRequestId}:${uid}`).hex()
```

Implementation: `src/lib/google/idempotent-id.ts`.

The write-back route (`POST /api/google/write-hangout`) tries `events.insert` first; on 409 Conflict it issues `events.update` with the same ID. The resulting `googleEventId` is persisted on the hangout document at `hangoutRequests/{id}.googleEventIds[uid]` so the UI can show "written" status.

## Consequences

**Wins:**
- Same inputs always produce the same ID — re-confirming updates the existing event rather than duplicating it. No state needs to be consulted to compute the next ID.
- Hex output is a subset of base32hex, so the value is always a valid Google event ID without further encoding.
- SHA-256 produces 64 hex chars, well within the 5–1024 limit, and the ID is opaque (doesn't leak the requestId or uid to anyone reading the calendar).
- Per-participant error isolation: if one participant's write fails, others succeed; errors are recorded in `googleWriteErrors`.

**Trade-offs:**
- IDs are not human-meaningful — debugging requires a join with `hangoutRequests/{id}.googleEventIds`. Worth it; the alternative (concatenated natural keys) would either leak data or need separate encoding.
- If a participant manually deletes the event from their calendar, the next re-confirm will recreate it (because insert no longer returns 409). This is desirable — they likely want it back if the creator re-confirms.

**Reversible?** Easily — the ID format is a pure function with no callers other than the write route.
