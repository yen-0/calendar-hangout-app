'use client';

import { useLanguage } from '@/hooks/useLanguage';

export function LanguageToggle() {
  const { language, setLanguage, hydrated } = useLanguage();
  const options = [
    { value: 'ja' as const, label: '日本語' },
    { value: 'en' as const, label: 'English' },
  ];

  if (!hydrated) {
    return <div className="h-9 w-[120px] rounded-full border border-white/60 bg-white/50" />;
  }

  return (
    <div
      className="inline-flex rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur"
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
              'rounded-full px-3 py-1.5 text-xs font-semibold transition',
              active
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
