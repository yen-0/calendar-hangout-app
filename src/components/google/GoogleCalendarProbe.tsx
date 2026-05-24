'use client';

import { useEffect, useState } from 'react';
import { probeNextFive, ProbeEvent } from '@/lib/google/client';
import { Button } from '@/components/ui/button';

interface Props {
  enabled: boolean;
}

export function GoogleCalendarProbe({ enabled }: Props) {
  const [events, setEvents] = useState<ProbeEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await probeNextFive();
      setEvents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Probe failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) void load();
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="mt-4 rounded-md border border-gray-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Next 5 Google Calendar events (debug probe)</h3>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {events && events.length === 0 && (
        <div className="text-sm text-gray-500">No upcoming events.</div>
      )}
      {events && events.length > 0 && (
        <ul className="space-y-1 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-2">
              <span className="font-mono text-xs text-gray-500">{e.start}</span>
              <span>{e.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
