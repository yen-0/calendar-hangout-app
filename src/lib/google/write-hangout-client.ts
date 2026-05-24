'use client';

import { auth } from '@/lib/firebase/config';

export interface WriteHangoutResult {
  uid: string;
  status: 'written' | 'updated' | 'skipped_not_connected' | 'error';
  googleEventId?: string;
  error?: string;
}

export async function writeHangoutToCalendars(args: {
  hangoutRequestId: string;
  title: string;
  startISO: string;
  endISO: string;
  participantUids: string[];
}): Promise<WriteHangoutResult[]> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  const res = await fetch('/api/google/write-hangout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const json = (await res.json()) as { results: WriteHangoutResult[] };
  return json.results;
}
