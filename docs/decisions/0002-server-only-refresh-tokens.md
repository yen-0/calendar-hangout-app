# ADR 0002: Refresh tokens are server-only; access tokens are short-lived and ephemeral

Date: 2026-05-22
Status: Accepted

## Context

Hangly needs persistent Google Calendar access for two flows:

1. Reading the user's events to overlay them on the in-app calendar.
2. Writing a confirmed hangout to *every participant's* Google Calendar — which happens days after they connected, and may run when none of them are actively using the app.

Both flows require a Google **refresh token**. Where it lives is a security decision.

## Decision

- The refresh token is stored at `users/{uid}/private/googleOAuth` in Firestore.
- The `users/{uid}/private/**` subtree has a Firestore security rule of `allow read, write: if false`. No client can read or write it — only the Admin SDK can.
- Access tokens are minted on demand from the refresh token, server-side, and **never persisted**. They live in process memory for the duration of one request and die with it.
- For client-side reads (the calendar overlay), the server returns *events* — not tokens. The client never sees a token of any kind beyond its own Firebase ID token.

Firebase Auth's `GoogleAuthProvider.addScope('.../calendar.events')` is explicitly **not** used. That path returns an access token only (no refresh token, because Firebase uses the implicit grant) and would force us to re-prompt the user on every session.

## Consequences

**Wins:**
- The refresh token never crosses the wire to the browser. Even a compromised client cannot exfiltrate Calendar access.
- Server-side write-back works regardless of which participants are currently online.
- Firestore rules are the primary defense (deny by default); rules can be unit-tested with the Firebase emulator.

**Trade-offs:**
- We carry a Google OAuth client (`google-auth-library`) on the server, including its secret. The client secret lives in environment variables on the deploy target.
- Refresh tokens can be revoked by the user at `myaccount.google.com`. On `invalid_grant`, the server marks the connection dead via `markConnectionError()` and the UI surfaces a "Reconnect Google Calendar" CTA.
- Encryption at rest is a defense-in-depth concern; the rules ban is the load-bearing protection.

**Audit-friendly?** Yes. Every server call site that reads a refresh token goes through `getRefreshToken(uid)` in `src/lib/google/connections.ts`, which is the only function that touches that document. Grep is sufficient to audit access.
