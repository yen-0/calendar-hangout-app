'use client';

import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  onCreate: () => void;
}

const copy = {
  ja: {
    message: 'まだ公開リクエストはありません。',
    action: '最初のリクエストを作成',
  },
  en: {
    message: 'No public requests yet.',
    action: 'Create the first request',
  },
} as const;

export function HangoutsEmptyState({ onCreate }: Props) {
  const { language } = useLanguage();
  const content = copy[language] ?? copy.en;

  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="mx-auto mb-4 h-12 w-12 text-cyan-500"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-3.741-5.007M12 12h.01M12 12h.01M12 12h.01M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.53 1.977a5.25 5.25 0 0 1-5.008 3.741 9.095 9.095 0 0 1-3.741-.48M3.75 4.5a.75.75 0 0 0-.75.75v13.5a.75.75 0 0 0 .75.75h16.5a.75.75 0 0 0 .75-.75V5.25a.75.75 0 0 0-.75-.75H3.75Z"
        />
      </svg>
      <p className="text-slate-600">{content.message}</p>
      <Button
        onClick={onCreate}
        className="mt-5 rounded-full bg-slate-950 text-white hover:bg-slate-800"
      >
        {content.action}
      </Button>
    </div>
  );
}
