# Architecture

Hangly is a Next.js 15 app that bridges Google Calendar and group scheduling. Users sign in with Firebase Auth, connect Google Calendar via a separate OAuth flow, create hangout requests, collect availability from participants, and confirm a slot that is written back to every participant's Google Calendar.

## System overview

```text
Browser (Next.js)
  - React 19 / TanStack Query
  - Firebase JS SDK (Auth)
  - Direct Google Calendar API reads
        |
        | Firebase ID token
        v
Next.js API routes
  /api/auth/google/*   OAuth start/callback
  /api/google/*        status, events, probe, write-hangout, disconnect
  /api/hangouts/*      common availability and slot ranking
        |
        | Admin SDK / server-side token exchange
        v
Firestore + Google Calendar API
  users/{uid}/calendarItems
  users/{uid}/private/googleOAuth
  hangoutRequests/{requestId}
  userNotifications/{uid}/notifications
```

## Google OAuth flow

Google Calendar access uses a separate OAuth 2.0 authorization-code flow. The browser starts the flow with a Firebase ID token, the server verifies the user, exchanges the authorization code for a refresh token, and stores that refresh token server-side in Firestore.

The refresh token never crosses the client/server boundary. It is only read by server routes using the Firebase Admin SDK.

## Slot ranking

`POST /api/hangouts/rank-slots` now uses a deterministic heuristic instead of an external model. It scores candidate slots by:

- Number of available participants
- Requested duration fit
- Day of week
- Time of day
- Clean round-hour or half-hour starts

The endpoint still returns `{ ranked: [{ index, rationale }] }`, so the UI can highlight suggested slots without changing the rest of the flow.

## Module boundaries

- `src/app/` - routes and pages
- `src/app/api/` - server route handlers
- `src/components/` - UI by domain
- `src/hooks/` - view-state hooks
- `src/lib/queries/` - TanStack Query wrappers
- `src/lib/google/` - OAuth and Google Calendar helpers
- `src/lib/firebase/` - client config, Admin SDK wrapper, Firestore helpers
- `src/utils/` - pure business logic

## Environment variables

The app expects Firebase client config in `.env.local` via `NEXT_PUBLIC_FIREBASE_*`, plus server-side Google OAuth and Firebase Admin credentials.
