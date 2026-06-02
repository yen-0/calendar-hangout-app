'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  ClockIcon,
  SparklesIcon,
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
  highlights: Array<{ title: string; body: string; icon: 'sparkles' | 'users' | 'calendar' | 'clock' | 'check' }>;
  proofTitle: string;
  proofBody: string;
  proofQuote: string;
  finalTitle: string;
  finalBody: string;
  finalCta: string;
};

const copyByLanguage: Record<'ja' | 'en', HomeCopy> = {
  ja: {
    eyebrow: 'もう、日程調整で悩まない。',
    heroLead: 'AI が最適解を提案する',
    heroAccent: '画期的な日程調整アプリ',
    heroDescription:
      'Tsudoi は、参加者の予定・優先度・移動時間をまとめて見て、候補日を自動で絞り込みます。候補を送る、集める、確定する。その一連の流れをひとつの画面で完結できます。',
    primaryCta: '無料で始める',
    secondaryCta: 'サインイン',
    tertiaryCta: '公開調整を試す',
    noCredit: 'クレジットカードは不要です。Google またはメールで始められます。',
    metrics: [
      { value: '90%', label: '調整時間を削減' },
      { value: '1回', label: '候補作成から確定まで' },
      { value: '0重複', label: 'ダブり候補を自動回避' },
    ],
    highlights: [
      {
        title: 'AI が最適な候補を先に出す',
        body: '全員の空き時間を見て、現実的に成立する時間帯だけを提案します。',
        icon: 'sparkles',
      },
      {
        title: '複数人・複数候補に対応',
        body: '大人数でも、候補日が多くても、回答と照らし合わせて一気に整理できます。',
        icon: 'users',
      },
      {
        title: 'カレンダーと自動連携',
        body: 'Google カレンダーの予定を取り込み、確定した予定は各自のカレンダーへ反映します。',
        icon: 'calendar',
      },
      {
        title: 'タイムゾーンと移動時間を考慮',
        body: '海外メンバーや移動のある予定でも、無理のない候補を優先して並べられます。',
        icon: 'clock',
      },
      {
        title: '確定までをワンストップで完了',
        body: '候補送信、回答回収、確定通知までをアプリ内でそのまま進められます。',
        icon: 'check',
      },
    ],
    proofTitle: '日程調整の新しい常識へ',
    proofBody:
      '予定の調整、候補日の見比べ、参加者への共有。これまで別々だった作業を、ひとつの体験にまとめました。',
    proofQuote:
      '「候補を出して、返事を待つ」だけの調整から、最初から成立しやすい時間を提案する調整へ。',
    finalTitle: '今すぐ無料で始める',
    finalBody:
      'Tsudoi は beta 期間中、すぐに使い始められます。まずはアカウントを作成して、最初の候補を出してみてください。',
    finalCta: '無料で始める',
  },
  en: {
    eyebrow: 'Stop losing time to scheduling.',
    heroLead: 'AI suggests the best meeting time',
    heroAccent: 'for your group in one flow.',
    heroDescription:
      'Tsudoi looks at everyone’s availability, priorities, and travel buffers, then turns that into strong candidate times you can share, collect, and confirm without bouncing between tools.',
    primaryCta: 'Start free',
    secondaryCta: 'Sign in',
    tertiaryCta: 'Try public scheduling',
    noCredit: 'No credit card required. Start with Google or email.',
    metrics: [
      { value: '90%', label: 'less scheduling time' },
      { value: '1 flow', label: 'from draft to confirmed' },
      { value: '0 dupes', label: 'duplicate candidates avoided' },
    ],
    highlights: [
      {
        title: 'AI proposes the strongest slots first',
        body: 'Tsudoi scans every participant’s calendar and only surfaces times that are realistic.',
        icon: 'sparkles',
      },
      {
        title: 'Built for groups and multiple candidates',
        body: 'Handle bigger groups and more candidate windows without turning the poll into spreadsheet work.',
        icon: 'users',
      },
      {
        title: 'Calendar sync built in',
        body: 'Pull Google Calendar events into the conflict model and write the confirmed time back automatically.',
        icon: 'calendar',
      },
      {
        title: 'Travel buffers and time zones included',
        body: 'Prefer options that make sense for people in different regions or with travel between events.',
        icon: 'clock',
      },
      {
        title: 'Confirm and notify from one place',
        body: 'Share the link, collect answers, and push the final result without switching apps.',
        icon: 'check',
      },
    ],
    proofTitle: 'A better scheduling habit',
    proofBody:
      'Drafting times, comparing overlaps, and sending reminders should feel like one product, not three separate chores.',
    proofQuote:
      'Move from “send options and wait” to “propose times that are likely to work from the start.”',
    finalTitle: 'Start for free today',
    finalBody:
      'Tsudoi is available during beta. Create your account and send your first candidate set in minutes.',
    finalCta: 'Start free',
  },
};

function HeroIcon({ name }: { name: HomeCopy['highlights'][number]['icon'] }) {
  const className = 'h-6 w-6';
  switch (name) {
    case 'sparkles':
      return <SparklesIcon className={className} />;
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

function PhoneMockup({ language }: { language: 'ja' | 'en' }) {
  const isJa = language === 'ja';
  return (
    <div className="relative mx-auto w-full max-w-[390px] rounded-[2.4rem] border border-white/70 bg-gradient-to-b from-slate-900 to-slate-800 p-3 shadow-[0_30px_120px_-40px_rgba(15,23,42,0.55)]">
      <div className="rounded-[2rem] bg-slate-50 p-4 shadow-inner">
        <div className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-slate-200" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 text-white shadow">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{isJa ? '最適候補を提案' : 'Top candidate times'}</p>
              <p className="text-xs text-slate-500">{isJa ? '今週の候補' : 'This week'}</p>
            </div>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">
            AI
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {[
            { rank: isJa ? '第1候補' : 'Top pick', time: '5/24 10:00 - 11:00', score: '98%' },
            { rank: isJa ? '第2候補' : 'Next', time: '5/24 14:00 - 15:00', score: '85%' },
            { rank: isJa ? '第3候補' : 'Backup', time: '5/27 11:00 - 12:00', score: '82%' },
          ].map((item, index) => (
            <div
              key={item.rank}
              className={[
                'rounded-2xl border bg-white p-4 shadow-sm',
                index === 0 ? 'border-cyan-200' : 'border-slate-100',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-amber-600">{item.rank}</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">{item.time}</div>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-cyan-200 text-sm font-bold text-cyan-600">
                  {item.score}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 p-0.5">
          <div className="rounded-[1.1rem] bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900">
            {isJa ? 'この日時で確定する' : 'Confirm this time'}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 px-5 py-4 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="text-2xl font-black tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{label}</div>
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
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-0 pb-10 pt-0">
      <UnauthenticatedShell showActions={false} className="bg-white/70">
        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-cyan-100 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700">
              <span className="h-2 w-2 rounded-full bg-cyan-500" />
              {copy.eyebrow}
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Tsudoi</p>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                <span className="bg-gradient-to-r from-cyan-500 via-sky-600 to-indigo-600 bg-clip-text text-transparent">
                  {copy.heroLead}
                </span>{' '}
                {copy.heroAccent}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                {copy.heroDescription}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
              >
                {copy.primaryCta}
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                {copy.secondaryCta}
              </Link>
              <Link
                href="/tsudoi"
                className="inline-flex items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 px-6 py-3 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
              >
                {copy.tertiaryCta}
              </Link>
            </div>

            <p className="text-sm text-slate-500">{copy.noCredit}</p>

            <div className="grid gap-3 sm:grid-cols-3">
              {copy.metrics.map((metric) => (
                <MetricCard key={metric.label} value={metric.value} label={metric.label} />
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-4 top-10 h-28 w-28 rounded-full bg-cyan-200/50 blur-3xl" />
            <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-indigo-200/50 blur-3xl" />
            <PhoneMockup language={hydrated ? language : 'ja'} />
            <div className="absolute -bottom-6 left-4 hidden max-w-[260px] rounded-3xl border border-white/80 bg-white/90 p-4 shadow-[0_25px_70px_-40px_rgba(15,23,42,0.5)] backdrop-blur lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {language === 'ja' ? 'メンバーの空き時間' : 'Everyone availability'}
              </p>
              <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[10px] text-slate-500">
                {['田中', '佐藤', '鈴木', '山田'].map((name, index) => (
                  <div key={name} className="space-y-1">
                    <div className="mx-auto h-7 w-7 rounded-full bg-gradient-to-br from-slate-200 to-slate-300" />
                    <div>{language === 'ja' ? name : ['Alex', 'Mina', 'Ken', 'Rina'][index]}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-[11px] text-slate-600">
                {language === 'ja'
                  ? '候補をひとつずつ見比べる必要はありません。最適な時間から順に表示します。'
                  : 'No need to compare every slot manually. The strongest options surface first.'}
              </div>
            </div>
          </div>
        </section>
      </UnauthenticatedShell>

      <section className="mx-auto mt-8 grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
              {language === 'ja' ? '悩みを整理' : 'What it solves'}
            </div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              {language === 'ja' ? 'Tsudoi' : 'Tsudoi'}
            </div>
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {copy.proofTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">{copy.proofBody}</p>
          <div className="mt-6 rounded-[1.5rem] bg-gradient-to-br from-slate-50 to-cyan-50 p-5">
            <p className="text-lg font-semibold leading-8 text-slate-800">{copy.proofQuote}</p>
          </div>
        </div>

        <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-700 p-6 text-white shadow-[0_25px_80px_-40px_rgba(15,23,42,0.65)] sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
            {language === 'ja' ? '今すぐ無料で始める' : 'Get started now'}
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{copy.finalTitle}</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-200 sm:text-base">{copy.finalBody}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              {copy.finalCta}
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              {copy.secondaryCta}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {copy.highlights.map((feature, index) => (
            <div
              key={feature.title}
              className={[
                'rounded-[1.75rem] border bg-white p-5 shadow-[0_18px_60px_-45px_rgba(15,23,42,0.4)]',
                index === 0 ? 'border-cyan-200' : 'border-slate-200',
              ].join(' ')}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-indigo-100 text-cyan-700">
                <HeroIcon name={feature.icon} />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-950">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
