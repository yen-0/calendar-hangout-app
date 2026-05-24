import { NextRequest, NextResponse } from 'next/server';
import type { LocationSearchResponse, LocationSearchResult } from '@/lib/location/types';

// Greater Tokyo bounding box (lng_min,lat_min,lng_max,lat_max). Yahoo YOLP
// expects this ordering. We keep search region-locked so a casual "shibuya"
// query doesn't surface a Shibuya in Hokkaido.
const TOKYO_BBOX = '138.9,35.4,140.2,36.0';

interface YahooFeature {
  Name?: string;
  Property?: {
    Address?: string;
    Uid?: string;
  };
  Geometry?: {
    // YOLP returns "lng,lat" (longitude first) as a comma string.
    Coordinates?: string;
  };
}

interface YahooResponse {
  Feature?: YahooFeature[];
}

function parseCoords(raw: string | undefined): { lat: number; lng: number } | null {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length !== 2) return null;
  const lng = Number(parts[0]);
  const lat = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export async function GET(req: NextRequest): Promise<NextResponse<LocationSearchResponse | { error: string }>> {
  const appId = process.env.YAHOO_JAPAN_APP_ID;
  if (!appId || appId === 'placeholder') {
    return NextResponse.json(
      { error: 'Yahoo Japan API key not configured.' },
      { status: 503 },
    );
  }

  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const yahooUrl = new URL('https://map.yahooapis.jp/search/local/V1/localSearch');
  yahooUrl.searchParams.set('appid', appId);
  yahooUrl.searchParams.set('query', q);
  yahooUrl.searchParams.set('output', 'json');
  yahooUrl.searchParams.set('results', '8');
  yahooUrl.searchParams.set('bbox', TOKYO_BBOX);

  try {
    const upstream = await fetch(yahooUrl.toString(), {
      headers: { Accept: 'application/json' },
      // Yahoo edges occasionally hang; cap so we don't tie up the route handler.
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstream.status}` },
        { status: 502 },
      );
    }
    const data: YahooResponse = await upstream.json();
    const results: LocationSearchResult[] = [];
    for (const f of data.Feature ?? []) {
      const coords = parseCoords(f.Geometry?.Coordinates);
      if (!coords) continue;
      const item: LocationSearchResult = {
        name: f.Name ?? 'Unnamed place',
        lat: coords.lat,
        lng: coords.lng,
      };
      if (f.Property?.Address) item.address = f.Property.Address;
      if (f.Property?.Uid) item.placeId = f.Property.Uid;
      results.push(item);
    }
    return NextResponse.json({ results });
  } catch (err) {
    console.error('Yahoo local search failed:', err);
    return NextResponse.json({ error: 'Search failed.' }, { status: 502 });
  }
}
