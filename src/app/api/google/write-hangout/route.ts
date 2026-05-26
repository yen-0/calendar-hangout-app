import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpError, requireUid } from '@/lib/google/auth-helpers';
import { adminDb } from '@/lib/firebase/admin';
import { getRefreshToken, markConnectionError } from '@/lib/google/connections';
import { googleClient } from '@/lib/google/oauth';
import { hangoutEventId } from '@/lib/google/idempotent-id';

export const runtime = 'nodejs';

interface RequestBody {
  hangoutRequestId: string;
  title: string;
  startISO: string;
  endISO: string;
  participantUids: string[];
}

interface ParticipantResult {
  uid: string;
  status: 'written' | 'updated' | 'skipped_not_connected' | 'error';
  googleEventId?: string;
  error?: string;
}

async function mintAccessToken(refreshToken: string): Promise<string | null> {
  const client = googleClient();
  client.setCredentials({ refresh_token: refreshToken });
  try {
    const { token } = await client.getAccessToken();
    return token ?? null;
  } catch {
    return null;
  }
}

async function writeForParticipant(
  uid: string,
  body: RequestBody,
): Promise<ParticipantResult> {
  const refreshToken = await getRefreshToken(uid);
  if (!refreshToken) return { uid, status: 'skipped_not_connected' };

  const accessToken = await mintAccessToken(refreshToken);
  if (!accessToken) {
    await markConnectionError(uid, 'refresh_failed_during_write');
    return { uid, status: 'error', error: 'token_refresh_failed' };
  }

  const eventId = hangoutEventId(body.hangoutRequestId, uid);
  const event = {
    id: eventId,
    summary: body.title,
    start: { dateTime: body.startISO },
    end: { dateTime: body.endISO },
    description: `Confirmed via ツドイ hangout request ${body.hangoutRequestId}.`,
  };

  // Try create first; if it already exists, fall back to update.
  const createUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const createResp = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (createResp.ok) {
    return { uid, status: 'written', googleEventId: eventId };
  }
  if (createResp.status === 409) {
    const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
    const updateResp = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
    if (updateResp.ok) return { uid, status: 'updated', googleEventId: eventId };
    const text = await updateResp.text();
    return { uid, status: 'error', error: `update_failed_${updateResp.status}: ${text}` };
  }
  const text = await createResp.text();
  return { uid, status: 'error', error: `create_failed_${createResp.status}: ${text}` };
}

export async function POST(req: NextRequest) {
  try {
    const callerUid = await requireUid(req);
    const body = (await req.json()) as RequestBody;
    if (!body.hangoutRequestId || !body.title || !body.startISO || !body.endISO) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    // Verify the caller is the creator of the hangout request.
    const requestDocRef = adminDb().collection('hangoutRequests').doc(body.hangoutRequestId);
    const requestSnap = await requestDocRef.get();
    if (!requestSnap.exists) {
      return NextResponse.json({ error: 'request_not_found' }, { status: 404 });
    }
    const requestData = requestSnap.data() as { creatorUid?: string };
    if (requestData.creatorUid !== callerUid) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // Per-participant error isolation: settle all promises before responding.
    const results = await Promise.all(
      (body.participantUids ?? []).map((uid) =>
        writeForParticipant(uid, body).catch(
          (err): ParticipantResult => ({
            uid,
            status: 'error',
            error: err instanceof Error ? err.message : 'unknown',
          }),
        ),
      ),
    );

    // Persist the per-participant google event IDs on the hangout doc.
    const eventIdsMap: Record<string, string> = {};
    const errorsMap: Record<string, string> = {};
    for (const r of results) {
      if (r.googleEventId) eventIdsMap[r.uid] = r.googleEventId;
      if (r.error) errorsMap[r.uid] = r.error;
    }
    if (Object.keys(eventIdsMap).length > 0 || Object.keys(errorsMap).length > 0) {
      await requestDocRef.set(
        {
          googleEventIds: eventIdsMap,
          googleWriteErrors: errorsMap,
          googleWrittenAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
