# ADR 0004: Heuristic-ranked slot suggestions

Date: 2026-05-22
Status: Accepted

## Context

When `findCommonAvailability()` returns common slots for a hangout, the result is often a long list of candidates that all look acceptable. We want to surface 1 to 3 top picks with a short rationale per pick so the creator can confirm a sensible slot faster.

## Decision

`POST /api/hangouts/rank-slots` applies a deterministic scoring heuristic and returns ranked picks as `{ ranked: [{ index, rationale }] }`.

Key choices:

- No external API dependency. Ranking runs locally in the route handler, so deployments do not need an Anthropic key.
- Deterministic scoring. Availability count, requested duration fit, day of week, and time of day determine the order.
- Stable output shape. The route still returns the same `ranked` structure, so the UI can keep the same highlight treatment.

## Consequences

**Wins:**

- No model latency, no token costs, and no external ranking dependency.
- The ranking is predictable and easy to test.
- Failure modes are limited to normal request validation errors.

**Trade-offs:**

- Heuristics are simpler than a model and will not capture nuanced preferences unless the scoring rules are expanded.
- The ranking is still a suggestion, not authoritative. The UI presents ranked picks with a distinct visual treatment, and the creator still has to confirm a slot.

**Future direction:** if we gather participant preferences over time, the heuristic could be enriched with user-specific weighting such as "User X typically prefers afternoons; User Y is usually unavailable on Fridays."
