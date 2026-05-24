import { NextRequest, NextResponse } from 'next/server';
import { HttpError, requireUid } from '@/lib/google/auth-helpers';
import { getRefreshToken, markConnectionError } from '@/lib/google/connections';
import { googleClient } from '@/lib/google/oauth';

export const runtime = 'nodejs';

interface GcalEventListResponse {
  items?: Array<{
    id: string;
    summary?: string;
    htmlLink?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    status?: string;
  }>;
  nextPageToken?: string;
}

export async function GET(req: NextRequest) {
  try {
    const uid = await requireUid(req);

    const timeMin = req.nextUrl.searchParams.get('timeMin');
    const timeMax = req.nextUrl.searchParams.get('timeMax');
    if (!timeMin || !timeMax) {
      return NextResponse.json(
        { error: 'timeMin and timeMax query params are required (ISO 8601)' },
        { status: 400 },
      );
    }

    const refreshToken = await getRefreshToken(uid);
    if (!refreshToken) {
      return NextResponse.json({ error: 'not_connected' }, { status: 412 });
    }

    const client = googleClient();
    client.setCredentials({ refresh_token: refreshToken });

    let accessToken: string;
    try {
      const { token } = await client.getAccessToken();
      if (!token) throw new Error('Empty access token');
      accessToken = token;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'token_refresh_failed';
      await markConnectionError(uid, message);
      return NextResponse.json({ error: 'token_refresh_failed', reason: message }, { status: 502 });
    }

    const events: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      allDay: boolean;
      link: string | null;
    }> = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
        ...(pageToken ? { pageToken } : {}),
      });
      const resp = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json(
          { error: 'calendar_api_failed', status: resp.status, body: text },
          { status: 502 },
        );
      }
      const body = (await resp.json()) as GcalEventListResponse;
      for (const e of body.items ?? []) {
        if (e.status === 'cancelled') continue;
        const startISO = e.start?.dateTime ?? e.start?.date;
        const endISO = e.end?.dateTime ?? e.end?.date;
        if (!startISO || !endISO) continue;
        events.push({
          id: e.id,
          title: e.summary ?? '(no title)',
          start: startISO,
          end: endISO,
          allDay: Boolean(e.start?.date && !e.start.dateTime),
          link: e.htmlLink ?? null,
        });
      }
      pageToken = body.nextPageToken;
    } while (pageToken);

    return NextResponse.json({ events });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
