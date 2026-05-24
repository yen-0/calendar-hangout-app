/**
 * Shared types between the location API routes and their client callers.
 * Kept in a tiny dedicated file so the same shapes can be imported by both
 * server (route handlers) and client (autocomplete component, travel hook).
 */

import type { TravelMode } from '@/types/events';

export interface LocationSearchResult {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export interface LocationSearchResponse {
  results: LocationSearchResult[];
}

export interface TravelRouteRequest {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  mode: TravelMode;
}

export interface TravelRouteResponse {
  minutes: number;
  distanceKm: number;
  mode: TravelMode;
  /** True when the response is a heuristic estimate, not a routed trip. */
  estimated: boolean;
}
