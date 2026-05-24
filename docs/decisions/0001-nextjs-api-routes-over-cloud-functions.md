# ADR 0001: Next.js API routes over Cloud Functions for server-side Google work

Date: 2026-05-22
Status: Accepted

## Context

We need server-side code to (a) exchange OAuth codes for refresh tokens, (b) store refresh tokens behind a security boundary, (c) mint short-lived access tokens on demand, and (d) write confirmed hangouts to every participant's Google Calendar — including participants who are not the currently signed-in user.

The original plan called for Firebase Cloud Functions in `/functions`, mostly because that folder already existed in the project and Firebase callable functions are the obvious fit for "server-side code that uses Admin SDK against Firestore."

## Decision

All server-side Google work runs as Next.js App Router Route Handlers under `src/app/api/`, using `firebase-admin` initialized lazily in `src/lib/firebase/admin.ts` (marked `import 'server-only'`). The `/functions` folder is left empty.

## Consequences

**Wins:**
- Single deployment target. `vercel deploy` (or `next start`) ships the whole app; no separate `firebase deploy --only functions` step.
- Co-located with the route table. The OAuth callback URL (`/api/auth/google/callback`) lives next to the page it redirects to (`/settings`).
- Shared types and utilities between server and client without a build boundary.
- One observability surface (Vercel logs / Sentry server-side) instead of two.
- Faster local dev — `npm run dev` is enough; no Firebase emulator for functions.

**Trade-offs:**
- Loses Firebase callable functions' built-in auth check; we re-implement it as `requireUid()` in `src/lib/google/auth-helpers.ts`, verifying the ID token via the Admin SDK.
- Cold-start characteristics differ. Vercel serverless functions are comparable to Cloud Functions Gen 2; the Edge runtime is faster but limits node_modules support, so heavy Node deps (firebase-admin) stay on the Node runtime.
- If we ever need scheduled jobs or pub/sub triggers, those go back to Cloud Functions or a separate worker — Route Handlers are HTTP-only.

**Reversible?** Yes. The Google logic is isolated in `src/lib/google/*` (pure server code with no Next-specific imports) and could be lifted into a Cloud Function with a thin HTTP wrapper.
