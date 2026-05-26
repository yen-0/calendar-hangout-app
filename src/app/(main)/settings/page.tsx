'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ConnectCalendarButton } from '@/components/google/ConnectCalendarButton';
import { GoogleCalendarProbe } from '@/components/google/GoogleCalendarProbe';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { languageOptions } from '@/lib/i18n';
import { useLanguage } from '@/hooks/useLanguage';

function SettingsContent() {
  const { user, loading, isGuest } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [connected, setConnected] = useState(false);
  const { prefs, setPref, hydrated } = useUserPreferences();
  const { t } = useLanguage();

  useEffect(() => {
    if (loading) return;
    if (!user || isGuest) router.replace('/sign-in');
  }, [loading, user, isGuest, router]);

  if (loading || !user || isGuest) return null;

  const status = params.get('google');
  const reason = params.get('reason');
  const eventPrivacyOptions = [
    {
      key: 'hide_all',
      title: 'Hide everything',
      description: 'Only show that the event exists. Titles and times stay covered.',
    },
    {
      key: 'show_time',
      title: 'Show time only',
      description: 'Reveal the time range but keep the event title hidden.',
    },
    {
      key: 'show_all',
      title: 'Show everything',
      description: 'Open the full event editor/details immediately.',
    },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-2xl font-semibold">{t.settings.title}</h1>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium">{t.common.language}</h2>
        <p className="text-sm text-gray-600">{t.settings.languageDescription}</p>
        <div className="max-w-xs">
          <select
            value={prefs.language}
            onChange={(e) => setPref('language', e.target.value as 'ja' | 'en')}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {status === 'connected' && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {t.settings.connected}
        </div>
      )}
      {status === 'error' && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {t.settings.error}: {reason ?? 'unknown error'}
        </div>
      )}

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium">{t.settings.googleTitle}</h2>
        <p className="text-sm text-gray-600">{t.settings.googleDescription}</p>
        <ConnectCalendarButton refreshKey={status ?? ''} onStatusChange={setConnected} />
        <GoogleCalendarProbe enabled={connected} />
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium">{t.settings.locationTitle}</h2>
        <p className="text-sm text-gray-600">{t.settings.locationDescription}</p>
        <label className="flex cursor-pointer items-center gap-3 select-none">
          <input
            type="checkbox"
            checked={hydrated && prefs.locationFeaturesEnabled}
            disabled={!hydrated}
            onChange={(e) => setPref('locationFeaturesEnabled', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm">{t.settings.enableLocation}</span>
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium">Event privacy when opening events</h2>
        <p className="text-sm text-gray-600">
          Choose how much of your event content is revealed when you tap or open an event.
        </p>
        <div className="space-y-2">
          {eventPrivacyOptions.map((option) => {
            const active = prefs.eventOpenMode === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setPref('eventOpenMode', option.key)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{option.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{option.description}</p>
                  </div>
                  <span
                    className={`h-4 w-4 rounded-full border ${
                      active ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
                    }`}
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>
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
