'use client';

import { useQuery } from '@tanstack/react-query';
import { auth } from '@/lib/firebase/config';
import { CalendarEvent } from '@/types/events';

interface RawGcalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  link: string | null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export function useGoogleStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['google', 'status'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch('/api/google/status', { headers: await authHeaders() });
      if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
      return (await res.json()) as { connected: boolean };
    },
  });
}

export function useGoogleCalendarEvents(
  range: { start: Date; end: Date } | null,
  enabled: boolean,
) {
  return useQuery<CalendarEvent[]>({
    queryKey: ['google', 'events', range?.start.toISOString(), range?.end.toISOString()],
    enabled: enabled && !!range,
    staleTime: 60_000,
    queryFn: async () => {
      if (!range) return [];
      const params = new URLSearchParams({
        timeMin: range.start.toISOString(),
        timeMax: range.end.toISOString(),
      });
      const res = await fetch(`/api/google/events?${params.toString()}`, {
        headers: await authHeaders(),
      });
      if (res.status === 412) return []; // not connected — silent empty
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `events fetch failed: ${res.status}`);
      }
      const body = (await res.json()) as { events: RawGcalEvent[] };
      return body.events.map(
        (e): CalendarEvent => ({
          id: `gcal:${e.id}`,
          gcalEventId: e.id,
          source: 'gcal',
          title: e.title,
          start: new Date(e.start),
          end: new Date(e.end),
          allDay: e.allDay,
        }),
      );
    },
  });
}
