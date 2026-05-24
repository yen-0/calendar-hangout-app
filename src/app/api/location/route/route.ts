import { NextRequest, NextResponse } from 'next/server';
import { estimateTravel } from '@/lib/location/travelEstimate';
import type { TravelMode } from '@/types/events';
import type { TravelRouteResponse } from '@/lib/location/types';

const VALID_MODES: readonly TravelMode[] = ['transit', 'walk', 'drive'];

function num(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest): Promise<NextResponse<TravelRouteResponse | { error: string }>> {
  const sp = req.nextUrl.searchParams;
  const fromLat = num(sp.get('fromLat'));
  const fromLng = num(sp.get('fromLng'));
  const toLat = num(sp.get('toLat'));
  const toLng = num(sp.get('toLng'));
  const mode = sp.get('mode') as TravelMode | null;

  if (
    fromLat === null ||
    fromLng === null ||
    toLat === null ||
    toLng === null ||
    mode === null ||
    !VALID_MODES.includes(mode)
  ) {
    return NextResponse.json({ error: 'Invalid parameters.' }, { status: 400 });
  }

  // Pragmatic implementation: Yahoo Japan's transit/route APIs aren't part of
  // the free YOLP tier, so we use a deterministic heuristic that's good enough
  // for "you have 22 min to get there" hints. The estimated:true flag lets the
  // client display a "~" qualifier. Swap this out for a real routing call when
  // a contract is in place.
  const result = estimateTravel(
    { lat: fromLat, lng: fromLng },
    { lat: toLat, lng: toLng },
    mode,
  );

  return NextResponse.json({
    minutes: result.minutes,
    distanceKm: result.distanceKm,
    mode,
    estimated: true,
  });
}
