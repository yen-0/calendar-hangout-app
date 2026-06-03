'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/hooks/useLanguage';
import { UnauthenticatedShell } from '@/components/marketing/UnauthenticatedShell';
import { CalendarDaysIcon, CheckCircleIcon, UsersIcon } from '@heroicons/react/24/outline';

const copy = {
  ja: {
    eyebrow: 'アカウント作成',
    title: '候補作成から確定までを、同じ場所で。',
    body: 'Tsudoi は予定の衝突確認、候補日の共有、参加者の回答確認をひとつの流れにまとめます。',
    bullets: [
      {
        icon: UsersIcon,
        title: '複数人の回答を確認',
        body: '参加者ごとの可否を見ながら候補を絞れます。',
      },
      {
        icon: CalendarDaysIcon,
        title: 'カレンダー連携',
        body: 'Google Calendar と連携して予定の重複を避けられます。',
      },
      {
        icon: CheckCircleIcon,
        title: '確定まで進める',
        body: '決まった予定は共有し、カレンダーへ反映できます。',
      },
    ],
  },
  en: {
    eyebrow: 'Account access',
    title: 'Plan the request, collect replies, confirm the time.',
    body: 'Tsudoi keeps conflict checks, shared candidate windows, and participant replies in one calendar-aware workflow.',
    bullets: [
      {
        icon: UsersIcon,
        title: 'Compare group replies',
        body: 'See who can attend each candidate time without building a spreadsheet.',
      },
      {
        icon: CalendarDaysIcon,
        title: 'Connect your calendar',
        body: 'Use Google Calendar to avoid conflicts and write confirmed events back.',
      },
      {
        icon: CheckCircleIcon,
        title: 'Move to confirmation',
        body: 'Share, collect, choose, and notify from the same workspace.',
      },
    ],
  },
} as const;

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, loading, isGuest, isPublicSession } = useAuth();
  const router = useRouter();
  const { language } = useLanguage();
  const content = copy[language];

  useEffect(() => {
    if (loading) return;
    if (isGuest || isPublicSession || user) {
      router.replace('/tsudoi');
    }
  }, [isGuest, isPublicSession, loading, router, user]);

  if (loading || user || isGuest) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-stone-500">
        Loading...
      </div>
    );
  }

  return (
    <main className="page-frame">
      <UnauthenticatedShell showActions={false}>
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <aside className="panel-muted">
            <div className="eyebrow">{content.eyebrow}</div>
            <h1 className="mt-4 max-w-md text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              {content.title}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-stone-700 sm:text-base">
              {content.body}
            </p>

            <div className="mt-6 divide-y divide-stone-300 border border-stone-300 bg-white">
              {content.bullets.map((bullet) => {
                const Icon = bullet.icon;
                return (
                  <div key={bullet.title} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-stone-300 bg-stone-100 text-slate-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950">{bullet.title}</p>
                        <p className="mt-1 text-sm leading-6 text-stone-600">{bullet.body}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="work-surface p-5 sm:p-7 lg:p-8">{children}</section>
        </div>
      </UnauthenticatedShell>
    </main>
  );
}
