'use client';

import { useLanguage } from '@/hooks/useLanguage';

export function LanguageToggle() {
  const { language, setLanguage, hydrated } = useLanguage();
  const options = [
    { value: 'ja' as const, label: '日本語' },
    { value: 'en' as const, label: 'English' },
  ];

  if (!hydrated) {
    return <div className="h-9 w-[128px] border border-stone-300 bg-stone-100" />;
  }

  return (
    <div
      className="inline-flex border border-stone-300 bg-white p-1"
      role="tablist"
      aria-label="Language"
    >
      {options.map((option) => {
        const active = option.value === language;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setLanguage(option.value)}
            className={[
              'px-3 py-1.5 text-xs font-semibold transition',
              active
                ? 'bg-slate-950 text-white'
                : 'text-slate-600 hover:bg-stone-100 hover:text-slate-900',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
