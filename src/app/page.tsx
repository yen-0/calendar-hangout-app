'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  ClockIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/hooks/useLanguage';
import { UnauthenticatedShell } from '@/components/marketing/UnauthenticatedShell';

type HomeCopy = {
  eyebrow: string;
  heroLead: string;
  heroAccent: string;
  heroDescription: string;
  primaryCta: string;
  secondaryCta: string;
  tertiaryCta: string;
  noCredit: string;
  metrics: Array<{ value: string; label: string }>;
  highlights: Array<{
    title: string;
    body: string;
    icon: 'users' | 'calendar' | 'clock' | 'check';
  }>;
  proofTitle: string;
  proofBody: string;
  proofQuote: string;
  finalTitle: string;
  finalBody: string;
  finalCta: string;
};

const copyByLanguage: Record<'ja' | 'en', HomeCopy> = {
  ja: {
    eyebrow: '予定調整を、ひとつの作業画面で。',
    heroLead: '空き時間を集めて、候補日を比べて、',
    heroAccent: 'そのまま予定を決める。',
    heroDescription:
      'Tsudoi は友人やチームの予定調整に必要な候補作成、回答収集、確定連絡をまとめるカレンダーアプリです。複数人の都合を見ながら、無理のない時間を選べます。',
    primaryCta: '無料で始める',
    secondaryCta: 'サインイン',
    tertiaryCta: '公開調整を試す',
    noCredit: 'クレジットカード不要。Google またはメールで始められます。',
    metrics: [
      { value: '1 view', label: '候補、回答、確定をまとめて確認' },
      { value: 'Google', label: 'カレンダー連携に対応' },
      { value: 'Public', label: 'アカウントなしの回答リンク' },
    ],
    highlights: [
      {
        title: '複数人の候補を管理',
        body: '参加者が増えても、回答と候補時間を同じ画面で確認できます。',
        icon: 'users',
      },
      {
        title: 'カレンダーと連携',
        body: 'Google Calendar の予定を参照し、確定した予定を書き戻せます。',
        icon: 'calendar',
      },
      {
        title: '移動時間も考慮',
        body: '前後の予定に無理が出ないよう、移動バッファを含めて候補を選べます。',
        icon: 'clock',
      },
      {
        title: '確定まで同じ流れ',
        body: 'リンク共有、回答収集、確定通知まで、作業を分けずに進められます。',
        icon: 'check',
      },
    ],
    proofTitle: '日程調整を作業として扱う',
    proofBody:
      '見た目の派手さより、候補を見比べやすいこと、回答の状態がすぐ分かること、確定まで迷わないことを優先しています。',
    proofQuote: '候補を送って待つだけではなく、最初から成立しやすい時間を絞り込める調整画面です。',
    finalTitle: '最初の調整を作成する',
    finalBody:
      'ベータ期間中は無料で利用できます。アカウントを作成して、候補時間の共有から始めてください。',
    finalCta: '無料で始める',
  },
  en: {
    eyebrow: 'Group scheduling without the theatre.',
    heroLead: 'Collect availability, compare candidate times,',
    heroAccent: 'and confirm the plan.',
    heroDescription:
      'Tsudoi is a calendar-aware workspace for planning hangouts. Create candidate windows, collect replies, check calendar conflicts, and write the confirmed event back without moving between tools.',
    primaryCta: 'Start free',
    secondaryCta: 'Sign in',
    tertiaryCta: 'Try public scheduling',
    noCredit: 'No credit card required. Start with Google or email.',
    metrics: [
      { value: '1 view', label: 'candidates, replies, and confirmation' },
      { value: 'Google', label: 'calendar conflict checks and write-back' },
      { value: 'Public', label: 'reply links for guests without accounts' },
    ],
    highlights: [
      {
        title: 'Designed for group replies',
        body: 'Keep participant answers and candidate times readable as the group gets larger.',
        icon: 'users',
      },
      {
        title: 'Calendar sync where it matters',
        body: 'Use Google Calendar events in the conflict model and write the final time back.',
        icon: 'calendar',
      },
      {
        title: 'Travel buffers included',
        body: 'Avoid options that technically fit but leave no time between events.',
        icon: 'clock',
      },
      {
        title: 'One flow to confirmation',
        body: 'Share the link, collect answers, choose the time, and send the result from one place.',
        icon: 'check',
      },
    ],
    proofTitle: 'Built like a scheduling desk, not a landing page',
    proofBody:
      'The interface favors comparison, status, and action over decorative effects. You can see what is open, what is confirmed, and what still needs a reply.',
    proofQuote:
      'Instead of sending a loose list of options, Tsudoi gives you a working board for getting to a real decision.',
    finalTitle: 'Create your first request',
    finalBody:
      'Tsudoi is free during beta. Create an account and send your first candidate set in minutes.',
    finalCta: 'Start free',
  },
};

function FeatureIcon({ name }: { name: HomeCopy['highlights'][number]['icon'] }) {
  const className = 'h-5 w-5';
  switch (name) {
    case 'users':
      return <UsersIcon className={className} />;
    case 'calendar':
      return <CalendarDaysIcon className={className} />;
    case 'clock':
      return <ClockIcon className={className} />;
    case 'check':
      return <CheckBadgeIcon className={className} />;
  }
}

function SchedulingBoard({ language }: { language: 'ja' | 'en' }) {
  const isJa = language === 'ja';
  const rows = [
    {
      label: isJa ? '土 10:00' : 'Sat 10:00',
      yes: 4,
      maybe: 1,
      no: 0,
      status: isJa ? '本命' : 'Best fit',
    },
    {
      label: isJa ? '土 14:00' : 'Sat 14:00',
      yes: 3,
      maybe: 2,
      no: 0,
      status: isJa ? '候補' : 'Candidate',
    },
    {
      label: isJa ? '日 11:30' : 'Sun 11:30',
      yes: 2,
      maybe: 1,
      no: 2,
      status: isJa ? '保留' : 'Backup',
    },
  ];

  return (
    <div className="work-surface">
      <div className="border-b border-stone-300 bg-stone-100 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="kicker">{isJa ? '今週の候補' : 'This week'}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {isJa ? '夕食会の日程調整' : 'Dinner plan availability'}
            </h2>
          </div>
          <div className="border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            {isJa ? '5人' : '5 people'}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="calendar-strip">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
            <div key={day} className="calendar-cell">
              <div className="font-semibold text-stone-500">
                {isJa ? ['月', '火', '水', '木', '金', '土', '日'][index] : day}
              </div>
              <div className="mt-3 h-2 bg-stone-200" />
              <div className="mt-2 h-2 bg-stone-200" />
              {index === 5 && <div className="mt-2 h-6 bg-emerald-200" />}
              {index === 6 && <div className="mt-2 h-6 bg-amber-200" />}
            </div>
          ))}
        </div>

        <div className="mt-4 divide-y divide-stone-200 border border-stone-300">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[1fr_auto] gap-3 bg-white px-4 py-3 text-sm"
            >
              <div>
                <div className="font-semibold text-slate-950">{row.label}</div>
                <div className="mt-1 text-xs text-stone-500">
                  {isJa
                    ? `可 ${row.yes} / 未定 ${row.maybe} / 不可 ${row.no}`
                    : `${row.yes} yes / ${row.maybe} maybe / ${row.no} no`}
                </div>
              </div>
              <div className="self-center border border-stone-300 bg-stone-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {row.status}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 border border-slate-900 bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
          {isJa ? 'この時間で確定する' : 'Confirm selected time'}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="metric-tile">
      <div className="text-xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-sm leading-5 text-stone-600">{label}</div>
    </div>
  );
}

export default function HomePage() {
  const { user, loading, isGuest, isPublicSession } = useAuth();
  const router = useRouter();
  const { language, hydrated } = useLanguage();
  const copy = useMemo(() => copyByLanguage[language], [language]);

  useEffect(() => {
    if (loading) return;
    if (isGuest || isPublicSession || user) {
      router.replace('/tsudoi');
    }
  }, [isGuest, isPublicSession, loading, router, user]);

  if (loading || user || isGuest) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-stone-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="page-frame">
      <UnauthenticatedShell showActions={false}>
        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-7">
            <div className="eyebrow">{copy.eyebrow}</div>

            <div className="space-y-4">
              <p className="kicker">Tsudoi</p>
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
                {copy.heroLead} {copy.heroAccent}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-stone-700">{copy.heroDescription}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-up" className="primary-link">
                {copy.primaryCta}
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/sign-in" className="secondary-link">
                {copy.secondaryCta}
              </Link>
              <Link href="/tsudoi" className="quiet-link">
                {copy.tertiaryCta}
              </Link>
            </div>

            <p className="text-sm text-stone-500">{copy.noCredit}</p>

            <div className="grid gap-3 sm:grid-cols-3">
              {copy.metrics.map((metric) => (
                <MetricCard key={metric.label} value={metric.value} label={metric.label} />
              ))}
            </div>
          </div>

          <SchedulingBoard language={hydrated ? language : 'ja'} />
        </section>
      </UnauthenticatedShell>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="panel">
          <div className="flex flex-wrap items-center gap-3">
            <div className="eyebrow">{language === 'ja' ? '解決すること' : 'What it solves'}</div>
            <div className="kicker">Tsudoi</div>
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950 sm:text-3xl">
            {copy.proofTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-700 sm:text-base">
            {copy.proofBody}
          </p>
          <div className="mt-6 border-l-4 border-amber-500 bg-amber-50 p-5">
            <p className="text-lg font-semibold leading-8 text-slate-800">{copy.proofQuote}</p>
          </div>
        </div>

        <div className="panel-muted">
          <p className="kicker">{language === 'ja' ? '始める' : 'Get started'}</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950 sm:text-3xl">
            {copy.finalTitle}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-stone-700 sm:text-base">
            {copy.finalBody}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-up" className="primary-link">
              {copy.finalCta}
            </Link>
            <Link href="/sign-in" className="secondary-link">
              {copy.secondaryCta}
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {copy.highlights.map((feature) => (
            <div key={feature.title} className="panel">
              <div className="flex h-10 w-10 items-center justify-center border border-stone-300 bg-stone-100 text-slate-700">
                <FeatureIcon name={feature.icon} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-700">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
