'use client';

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { CalendarEvent } from '@/types/events';
import type { TravelRouteResponse } from '@/lib/location/types';

export type TravelBufferKey = string; // `${fromEventId}->${toEventId}`

interface TravelPair {
  key: TravelBufferKey;
  fromId: string;
  toId: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  mode: 'transit' | 'walk' | 'drive';
  /** Start of the "to" event, for sorting/limit logic. */
  toStart: Date;
}

/**
 * Round to 5 decimal places (~1.1m precision). Keeps the react-query cache key
 * stable across re-renders that produce floating-point coord variations.
 */
const round5 = (n: number) => Math.round(n * 100000) / 100000;

function buildPairs(events: CalendarEvent[]): TravelPair[] {
  // Only consider events with a location and a real time slot.
  const located = events.filter((e) => e.location && !e.allDay);

  // Bucket by local-day key, then sort each bucket by start time.
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of located) {
    const d = new Date(e.start);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const arr = byDay.get(key) ?? [];
    arr.push(e);
    byDay.set(key, arr);
  }

  const pairs: TravelPair[] = [];
  for (const dayEvents of byDay.values()) {
    dayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    for (let i = 0; i < dayEvents.length - 1; i++) {
      const from = dayEvents[i];
      const to = dayEvents[i + 1];
      if (!from.location || !to.location) continue;
      // Skip if the prior event hasn't ended before the next begins — overlapping
      // events aren't really sequential travel-wise.
      if (new Date(from.end).getTime() > new Date(to.start).getTime()) continue;
      pairs.push({
        key: `${from.id}->${to.id}`,
        fromId: from.id,
        toId: to.id,
        fromLat: round5(from.location.lat),
        fromLng: round5(from.location.lng),
        toLat: round5(to.location.lat),
        toLng: round5(to.location.lng),
        mode: to.travelMode ?? 'transit',
        toStart: new Date(to.start),
      });
    }
  }

  return pairs;
}

async function fetchRoute(p: TravelPair): Promise<TravelRouteResponse> {
  const params = new URLSearchParams({
    fromLat: String(p.fromLat),
    fromLng: String(p.fromLng),
    toLat: String(p.toLat),
    toLng: String(p.toLng),
    mode: p.mode,
  });
  const res = await fetch(`/api/location/route?${params.toString()}`);
  if (!res.ok) throw new Error(`Route fetch failed: ${res.status}`);
  return res.json();
}

export interface TravelBufferEntry {
  fromId: string;
  toId: string;
  fromStart: Date;
  toStart: Date;
  fromEnd: Date;
  fromLocationName: string;
  toLocationName: string;
  route: TravelRouteResponse;
}

/**
 * For each adjacent same-day pair of events with locations, fetch the travel
 * time. Returns a Map keyed by `fromEventId->toEventId`.
 *
 * No-op when `enabled` is false — the user has the feature toggled off, so we
 * don't want to hit the proxy.
 */
export function useTravelBuffers(
  events: CalendarEvent[],
  enabled: boolean,
): Map<TravelBufferKey, TravelBufferEntry> {
  const pairs = useMemo(() => (enabled ? buildPairs(events) : []), [events, enabled]);

  // Map id → event for stitching the fetched route back to its endpoints.
  const eventsById = useMemo(() => {
    const m = new Map<string, CalendarEvent>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);

  const results = useQueries({
    queries: pairs.map((p) => ({
      queryKey: ['travel', p.fromLat, p.fromLng, p.toLat, p.toLng, p.mode] as const,
      queryFn: () => fetchRoute(p),
      // Estimates are deterministic, so heavy caching is safe.
      staleTime: 1000 * 60 * 60, // 1 hour
      gcTime: 1000 * 60 * 60 * 24, // 1 day
      retry: 1,
    })),
  });

  return useMemo(() => {
    const out = new Map<TravelBufferKey, TravelBufferEntry>();
    pairs.forEach((p, idx) => {
      const r = results[idx];
      if (r.status !== 'success' || !r.data) return;
      const fromEvent = eventsById.get(p.fromId);
      const toEvent = eventsById.get(p.toId);
      if (!fromEvent || !toEvent) return;
      out.set(p.key, {
        fromId: p.fromId,
        toId: p.toId,
        fromStart: new Date(fromEvent.start),
        fromEnd: new Date(fromEvent.end),
        toStart: new Date(toEvent.start),
        fromLocationName: fromEvent.location?.name ?? '',
        toLocationName: toEvent.location?.name ?? '',
        route: r.data,
      });
    });
    return out;
  }, [pairs, results, eventsById]);
}
