'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ConnectCalendarButton } from '@/components/google/ConnectCalendarButton';
import { GoogleCalendarProbe } from '@/components/google/GoogleCalendarProbe';
import { useUserPreferences } from '@/hooks/useUserPreferences';

function SettingsContent() {
  const { user, loading, isGuest } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [connected, setConnected] = useState(false);
  const { prefs, setPref, hydrated } = useUserPreferences();

  useEffect(() => {
    if (loading) return;
    if (!user || isGuest) router.replace('/sign-in');
  }, [loading, user, isGuest, router]);

  if (loading || !user || isGuest) return null;

  const status = params.get('google');
  const reason = params.get('reason');

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {status === 'connected' && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Google Calendar connected.
        </div>
      )}
      {status === 'error' && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Could not connect Google Calendar: {reason ?? 'unknown error'}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Google Calendar</h2>
        <p className="text-sm text-gray-600">
          Connect your Google Calendar so Hangly can show your events alongside the in-app calendar
          and write confirmed hangouts back to your calendar.
        </p>
        <ConnectCalendarButton refreshKey={status ?? ''} onStatusChange={setConnected} />
        <GoogleCalendarProbe enabled={connected} />
      </section>

      <section className="space-y-3 border-t pt-6">
        <h2 className="text-lg font-medium">Location &amp; travel buffers (beta)</h2>
        <p className="text-sm text-gray-600">
          Attach a Tokyo-area location to any event or stamp. When two events on the same day
          both have locations, the calendar will show an estimated travel time between them.
          Currently scoped to Greater Tokyo. Estimates are based on straight-line distance and an
          average door-to-door speed per travel mode — they&rsquo;re a sanity check, not a routed trip.
        </p>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hydrated && prefs.locationFeaturesEnabled}
            disabled={!hydrated}
            onChange={(e) => setPref('locationFeaturesEnabled', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm">
            Enable location autocomplete and travel buffers on the calendar.
          </span>
        </label>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}
