'use client';

import { useCallback, useEffect, useState } from 'react';

const GUEST_STORAGE_KEY = 'isGuest';

/**
 * Persisted guest-mode flag. Guest mode is local-only — no Firebase user is created.
 * Synced to localStorage so a guest stays a guest across reloads.
 */
export function useGuestMode() {
  const [isGuest, setIsGuestState] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsGuestState(window.localStorage.getItem(GUEST_STORAGE_KEY) === 'true');
  }, []);

  const setIsGuest = useCallback((next: boolean) => {
    setIsGuestState(next);
    if (typeof window === 'undefined') return;
    if (next) {
      window.localStorage.setItem(GUEST_STORAGE_KEY, 'true');
    } else {
      window.localStorage.removeItem(GUEST_STORAGE_KEY);
    }
  }, []);

  return { isGuest, setIsGuest } as const;
}
