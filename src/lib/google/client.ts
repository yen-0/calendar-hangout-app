'use client';

import { auth } from '@/lib/firebase/config';

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function startGoogleConnect(): Promise<string> {
  const res = await fetch('/api/auth/google/start', { headers: await authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

export async function getGoogleStatus(): Promise<{ connected: boolean }> {
  const res = await fetch('/api/google/status', { headers: await authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as { connected: boolean };
}

export async function disconnectGoogle(): Promise<void> {
  const res = await fetch('/api/google/disconnect', {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

export interface ProbeEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  link: string | null;
}

export async function probeNextFive(): Promise<ProbeEvent[]> {
  const res = await fetch('/api/google/probe', { headers: await authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const { events } = (await res.json()) as { events: ProbeEvent[] };
  return events;
}
