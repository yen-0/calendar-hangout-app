import { NextRequest, NextResponse } from 'next/server';
import { HttpError, requireUid } from '@/lib/google/auth-helpers';
import { getRefreshToken, markConnectionError } from '@/lib/google/connections';
import { googleClient } from '@/lib/google/oauth';

export const runtime = 'nodejs';

interface CalendarEventListResponse {
  items?: Array<{
    id: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    htmlLink?: string;
  }>;
}

export async function GET(req: NextRequest) {
  try {
    const uid = await requireUid(req);
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

    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      maxResults: '5',
      singleEvents: 'true',
      orderBy: 'startTime',
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
    const body = (await resp.json()) as CalendarEventListResponse;
    return NextResponse.json({
      events: (body.items ?? []).map((e) => ({
        id: e.id,
        title: e.summary ?? '(no title)',
        start: e.start?.dateTime ?? e.start?.date ?? null,
        end: e.end?.dateTime ?? e.end?.date ?? null,
        link: e.htmlLink ?? null,
      })),
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
