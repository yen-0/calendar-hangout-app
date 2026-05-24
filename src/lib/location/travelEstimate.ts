import type { TravelMode } from '@/types/events';

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

interface ModeProfile {
  /** Average door-to-door speed in km/h. */
  speedKmh: number;
  /** Fixed overhead in minutes (walk to station, wait, parking, etc.). */
  overheadMin: number;
  /** Multiplier on great-circle distance to approximate routed distance. */
  routingFactor: number;
}

// Tuned for inner Tokyo / Yamanote-line scale trips. Transit assumes typical
// JR / Tokyo Metro combinations with a short walk on each end.
const PROFILES: Record<TravelMode, ModeProfile> = {
  transit: { speedKmh: 28, overheadMin: 9, routingFactor: 1.25 },
  walk: { speedKmh: 4.6, overheadMin: 1, routingFactor: 1.3 },
  drive: { speedKmh: 20, overheadMin: 4, routingFactor: 1.35 },
};

/**
 * Heuristic travel-time estimate. Not a real routed trip — uses haversine
 * distance, a per-mode routing-factor, average speed, and a fixed overhead.
 * Server callers should mark responses with `estimated: true`.
 */
export function estimateTravel(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TravelMode,
): { minutes: number; distanceKm: number } {
  const profile = PROFILES[mode];
  const straightKm = haversineKm(from, to);
  const routedKm = straightKm * profile.routingFactor;
  const minutes = (routedKm / profile.speedKmh) * 60 + profile.overheadMin;
  return {
    minutes: Math.max(1, Math.round(minutes)),
    distanceKm: Math.round(routedKm * 10) / 10,
  };
}
