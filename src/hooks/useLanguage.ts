'use client';

import { useMemo } from 'react';
import { getTranslations } from '@/lib/i18n';
import { useUserPreferences } from '@/hooks/useUserPreferences';

export function useLanguage() {
  const { prefs, setPref, hydrated } = useUserPreferences();
  const translations = useMemo(() => getTranslations(prefs.language), [prefs.language]);

  return {
    language: prefs.language,
    setLanguage: (language: 'ja' | 'en') => setPref('language', language),
    hydrated,
    t: translations,
  };
}

