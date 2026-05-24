'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * User-level UI preferences that don't need to round-trip to Firestore.
 * Persisted to localStorage and broadcast across components in the same tab
 * via a custom 'prefchange' event so toggling on one screen updates others
 * without a router-level state lift.
 */
export interface UserPreferences {
  /**
   * When true, location autocomplete shows in event/stamp forms and travel
   * buffers render between adjacent events. Default false — opt-in.
   */
  locationFeaturesEnabled: boolean;
}

const STORAGE_KEY = 'hangly:prefs:v1';
const EVENT_NAME = 'hangly:prefchange';

const DEFAULTS: UserPreferences = {
  locationFeaturesEnabled: false,
};

function readPrefs(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function writePrefs(prefs: UserPreferences) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: prefs }));
  } catch (err) {
    console.error('Failed to persist preferences:', err);
  }
}

export function useUserPreferences(): {
  prefs: UserPreferences;
  setPref: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  hydrated: boolean;
} {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(readPrefs());
    setHydrated(true);
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<UserPreferences>).detail;
      if (detail) setPrefs(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPrefs(readPrefs());
    };
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setPref = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        writePrefs(next);
        return next;
      });
    },
    [],
  );

  return { prefs, setPref, hydrated };
}
