'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/hooks/useLanguage';
import { UnauthenticatedShell } from '@/components/marketing/UnauthenticatedShell';
import { CalendarDaysIcon, SparklesIcon, UsersIcon } from '@heroicons/react/24/outline';

const copy = {
  ja: {
    eyebrow: 'アカウントを作成してすぐ始める',
    title: '候補日を出すところから、確定まで。',
    body:
      'Tsudoi は、予定の衝突・候補・回答回収をひとつの流れにまとめます。アカウントを作って、すぐに予定調整を始められます。',
    bullets: [
      { icon: SparklesIcon, title: 'AI が先に候補を絞る', body: '迷いやすい時間帯を最初から減らせます。' },
      { icon: UsersIcon, title: '複数人の調整に強い', body: '人数が増えても、比較しやすい形を保ちます。' },
      { icon: CalendarDaysIcon, title: 'カレンダーとつながる', body: 'Google カレンダーと連携して予定を反映します。' },
    ],
  },
  en: {
    eyebrow: 'Create an account and start immediately',
    title: 'From candidate slots to confirmation.',
    body:
      'Tsudoi keeps conflict checking, candidate generation, and response collection in one flow, so you can start scheduling in minutes.',
    bullets: [
      { icon: SparklesIcon, title: 'AI narrows the best times first', body: 'Reduce noisy options before you even share the poll.' },
      { icon: UsersIcon, title: 'Built for multi-person scheduling', body: 'Keep larger groups easy to compare and confirm.' },
      { icon: CalendarDaysIcon, title: 'Connected to your calendar', body: 'Sync with Google Calendar and write confirmed events back.' },
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
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#eff6ff,_#f8fafc_45%,_#ffffff)] text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_28%),radial-gradient(circle_at_right,_rgba(129,140,248,0.18),_transparent_30%),linear-gradient(180deg,_#f8fbff_0%,_#f6f7fb_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <UnauthenticatedShell showActions={false} className="overflow-visible">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <aside className="space-y-6 rounded-[1.75rem] bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-900 p-6 text-white shadow-[0_24px_80px_-45px_rgba(15,23,42,0.8)] sm:p-8">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100">
                <span className="h-2 w-2 rounded-full bg-cyan-300" />
                {content.eyebrow}
              </div>
              <h1 className="max-w-md text-3xl font-black tracking-tight sm:text-4xl">{content.title}</h1>
              <p className="max-w-md text-sm leading-7 text-slate-200 sm:text-base">{content.body}</p>

              <div className="grid gap-3">
                {content.bullets.map((bullet) => {
                  const Icon = bullet.icon;
                  return (
                    <div key={bullet.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-cyan-200">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{bullet.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-300">{bullet.body}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_90px_-50px_rgba(15,23,42,0.45)] backdrop-blur sm:p-7 lg:p-8">
              {children}
            </section>
          </div>
        </UnauthenticatedShell>
      </div>
    </main>
  );
}
