# ADR 0004: AI-ranked slot suggestions via Claude Haiku 4.5 with prompt caching

Date: 2026-05-22
Status: Accepted

## Context

When `findCommonAvailability()` returns common slots for a hangout, the result is often dozens of equally-valid candidates ranked only by start time. A human creator looking at "Tuesday 09:15, Tuesday 09:30, Tuesday 09:45, Tuesday 10:00…" cannot easily tell which slot will actually work best for the group.

We want to surface 1–3 top picks with one-line rationale per pick, so the creator can confirm a sensible slot in one click instead of scanning.

## Decision

A new Route Handler `POST /api/hangouts/rank-slots` takes the hangout context and candidate slots, calls `claude-haiku-4-5-20251001` with a small structured prompt, and returns ranked picks as `{ ranked: [{ index, rationale }] }`.

Key choices:
- **Haiku 4.5, not Sonnet.** This is a non-critical UX hint with a latency budget under a second. Haiku is fast and cheap enough to run on every "AI rank" click.
- **Prompt caching enabled.** The system prompt (the only large stable part) is marked `cache_control: { type: 'ephemeral' }`. Successive calls hit the cache, cutting input cost ~90% and improving latency.
- **JSON output validated with Zod.** The model is instructed to return strict JSON; we tolerate optional code-fence wrapping (`extractJson` strips it) and then `RankedResponseSchema.safeParse` validates the shape before returning to the client. If the model returns garbage, the route returns 502 with the raw text — never a malformed shape.
- **Indices clamped to candidate set.** If the model invents an index outside `slots.length`, we drop it. The client never sees a dangling pointer.
- **Graceful degradation when no API key.** `getAnthropic()` in `src/lib/anthropic.ts` returns `null` if `ANTHROPIC_API_KEY` is unset; the route returns 503 with a helpful message and the UI shows the error to the creator. The rest of the app keeps working.

## Consequences

**Wins:**
- A memorable, demonstrable feature that turns "I have to scroll a list" into "the app picks for me." This is the feature recruiters will remember from the demo.
- Cost is bounded — Haiku 4.5 at ~1.5K tokens per call (after cache warm) is fractions of a cent.
- Failure modes are explicit and recoverable: 503 (no key), 502 (model output unparseable), 400 (bad client input). None of them break the rest of the page.

**Trade-offs:**
- Adds a new external dependency (Anthropic API). The graceful-degradation path mitigates this for deployments without a key.
- Quality depends on prompt phrasing. The current heuristics in the system prompt encode common sense ("avoid lunch, prefer round numbers, Tue–Thu beats Mon/Fri for work meetings"). Tuning is just text edits.
- LLM ranking is a *suggestion*, not authoritative. The UI presents AI picks with a distinct visual treatment (gold rank badges + italic rationale) so users understand it's advisory; the creator still has to click "Confirm" on a slot they actually choose.

**Future direction:** if we gather participant preferences over time, the prompt could be enriched with "User X typically prefers afternoons; User Y is usually unavailable on Fridays." That requires user history we don't have yet.
