'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { user, loading, isGuest, signInAsGuest } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user || isGuest) router.replace('/calendar');
  }, [user, loading, isGuest, router]);

  if (loading || user || isGuest) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-24 pb-20">
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden bg-gradient-to-br from-sky-50 via-white to-indigo-50 px-4 pb-20 pt-12 md:pt-20">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-baseline gap-3">
            <span className="text-2xl font-bold tracking-tight text-gray-900">Hangly</span>
            <span className="text-gray-300">/</span>
            <span lang="ja" className="text-2xl font-bold tracking-tight text-indigo-700">
              ツドイ
            </span>
          </div>
          <p className="mb-3 inline-block rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-medium tracking-wide text-indigo-700 backdrop-blur">
            Calendar-aware group scheduling
            <span className="mx-2 text-gray-300">·</span>
            <span lang="ja">あなたの予定を読み取る日程調整</span>
          </p>
          <h1 className="text-4xl font-bold leading-tight text-gray-900 sm:text-5xl md:text-6xl">
            Group scheduling that already
            <br className="hidden sm:block" />{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
              knows when you&rsquo;re free.
            </span>
          </h1>
          <p
            lang="ja"
            className="mt-4 text-xl font-semibold text-gray-700 sm:text-2xl"
          >
            あなたの予定を読み取って、空き時間を自動で見つける日程調整。
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-base text-gray-600 sm:text-lg">
            Hangly bridges your Google Calendar and group scheduling. Drop reusable stamps onto your
            week, share a hangout link, and confirm a time that&rsquo;s written straight back to
            everyone&rsquo;s calendars.
          </p>
          <p lang="ja" className="mx-auto mt-3 max-w-2xl text-base text-gray-600 sm:text-lg">
            <span className="font-semibold text-gray-800">ツドイ</span>は、Googleカレンダーと日程調整をひとつにするアプリです。スタンプで自分の予定をサッと埋め、ハングアウトのリンクを共有するだけ。確定した日時はそのままカレンダーに書き戻されます。
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="w-full rounded-lg bg-indigo-600 px-7 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 sm:w-auto"
            >
              Get started free
              <span className="ml-2 text-sm font-normal text-indigo-100" lang="ja">
                / 無料ではじめる
              </span>
            </Link>
            <Link
              href="/sign-in"
              className="w-full rounded-lg border border-gray-300 bg-white px-7 py-3 text-base font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 sm:w-auto"
            >
              Sign in
              <span className="ml-2 text-sm font-normal text-gray-500" lang="ja">
                / ログイン
              </span>
            </Link>
            <button
              type="button"
              onClick={signInAsGuest}
              className="w-full rounded-lg px-4 py-3 text-base font-medium text-gray-600 underline-offset-4 hover:text-indigo-700 hover:underline sm:w-auto"
            >
              Continue as guest
              <span className="ml-2 text-sm font-normal text-gray-400" lang="ja">
                / ゲストで試す
              </span>
            </button>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            No credit card. Sign in with Google or email.
            <span className="mx-2 text-gray-300">·</span>
            <span lang="ja">クレジットカード不要。Googleまたはメールで登録できます。</span>
          </p>
        </div>
      </section>

      {/* Why Hangly */}
      <section className="mx-auto max-w-5xl px-2">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Built for the way you actually plan
          </h2>
          <p lang="ja" className="mt-2 text-lg font-medium text-gray-600">
            実際の日程調整に寄り添う設計
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="text-3xl">📅</div>
            <h3 className="mt-3 text-lg font-semibold text-gray-900">
              No more &ldquo;does Tuesday work?&rdquo;
            </h3>
            <p lang="ja" className="mt-1 text-sm font-medium text-gray-600">
              「火曜って空いてる？」のやり取りはもう不要
            </p>
            <p className="mt-3 text-sm text-gray-600">
              Hangly already sees your Google Calendar, so it can suggest slots where everyone is
              actually free — no back-and-forth.
            </p>
            <p lang="ja" className="mt-2 text-sm text-gray-600">
              Googleカレンダーを参照して、メンバー全員が本当に空いている時間だけを提案します。
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="text-3xl">⚡</div>
            <h3 className="mt-3 text-lg font-semibold text-gray-900">Stamp in your week in seconds</h3>
            <p lang="ja" className="mt-1 text-sm font-medium text-gray-600">
              スタンプで1週間を一瞬で埋める
            </p>
            <p className="mt-3 text-sm text-gray-600">
              Create reusable stamps for &ldquo;Gym,&rdquo; &ldquo;Class,&rdquo; or &ldquo;Work
              shift&rdquo; and drag them onto the calendar. Recurring routines stop being a chore.
            </p>
            <p lang="ja" className="mt-2 text-sm text-gray-600">
              「ジム」「授業」「シフト」などのスタンプを作って、カレンダーにポンと押すだけ。繰り返しの予定入力から解放されます。
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="text-3xl">✅</div>
            <h3 className="mt-3 text-lg font-semibold text-gray-900">
              Confirmed time writes itself back
            </h3>
            <p lang="ja" className="mt-1 text-sm font-medium text-gray-600">
              決まった予定はそのままカレンダーへ
            </p>
            <p className="mt-3 text-sm text-gray-600">
              Pick a time everyone agreed on and Hangly drops the confirmed event onto each
              connected Google Calendar automatically.
            </p>
            <p lang="ja" className="mt-2 text-sm text-gray-600">
              みんなで合意した日時は、各メンバーのGoogleカレンダーに自動で書き込まれます。
            </p>
          </div>
        </div>
      </section>

      {/* Features deep-dive */}
      <section className="mx-auto max-w-5xl px-2">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            What&rsquo;s inside
          </h2>
          <p lang="ja" className="mt-2 text-lg font-medium text-gray-600">
            主な機能
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <FeatureCard
            emoji="🔗"
            en={{
              title: 'Google Calendar bridge',
              body: 'Sign in with Google and Hangly pulls in your existing events as conflict data. Confirmed hangouts get written back to your calendar — no copy-pasting.',
            }}
            ja={{
              title: 'Googleカレンダー連携',
              body: 'Googleでログインすると、既存の予定を競合チェック用に取り込みます。確定したハングアウトはGoogleカレンダーに自動で反映。',
            }}
          />

          <FeatureCard
            emoji="🎯"
            en={{
              title: 'Stamps — your scheduling shortcut',
              body: 'Reusable colored stamps for routines (work, classes, gym, sleep). Multi-paint a whole week of recurring availability with a single drag.',
            }}
            ja={{
              title: 'スタンプ — 高速入力ショートカット',
              body: '色付きのスタンプを「仕事」「授業」「ジム」「睡眠」など用途別に作成。ドラッグで1週間分の繰り返し予定をまとめて入力できます。',
            }}
          />

          <FeatureCard
            emoji="🗓️"
            en={{
              title: 'Hangouts that find common slots',
              body: 'Pick a window, share a link, and let Hangly highlight intersections where everyone (including their Google events) is free. Reply with a tap.',
            }}
            ja={{
              title: '共通の空き時間を見つけるハングアウト',
              body: '範囲を指定してリンクを共有するだけ。Googleカレンダーの予定も含めて、全員の共通の空き時間をハイライト表示します。',
            }}
          />

          <FeatureCard
            emoji="🚆"
            en={{
              title: 'Travel buffers for Tokyo (beta)',
              body: 'Attach a location to events in the Greater Tokyo area and Hangly estimates the travel time between consecutive plans — so you don’t accidentally book a Shibuya meeting right after one in Roppongi.',
            }}
            ja={{
              title: '東京エリアの移動時間バッファ（ベータ）',
              body: '東京圏のイベントに場所を設定すると、連続する予定の間の移動時間を自動で推定。六本木の直後に渋谷で予定を入れる、なんてミスを防ぎます。',
            }}
          />
        </div>
      </section>

      {/* How it works */}
      <section className="relative -mx-4 bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">How it works</h2>
            <p lang="ja" className="mt-2 text-lg font-medium text-gray-600">
              使い方は3ステップ
            </p>
          </div>

          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            <Step
              n={1}
              en={{
                title: 'Connect your calendar',
                body: 'Sign in with Google. Hangly reads your busy times so it knows when not to suggest a slot.',
              }}
              ja={{
                title: 'カレンダーを連携',
                body: 'Googleでログイン。ツドイがあなたの予定を読み取り、空いていない時間は提案しません。',
              }}
            />
            <Step
              n={2}
              en={{
                title: 'Stamp your routine',
                body: 'Block out work, classes, and personal time with stamps. Build out a typical week in under a minute.',
              }}
              ja={{
                title: 'スタンプで予定を埋める',
                body: '仕事や授業、プライベートをスタンプで一気にブロック。1分でいつもの1週間が完成します。',
              }}
            />
            <Step
              n={3}
              en={{
                title: 'Share & confirm',
                body: 'Send the hangout link, watch responses roll in, pick a time, and Hangly writes it back to every connected calendar.',
              }}
              ja={{
                title: '共有して確定',
                body: 'ハングアウトのリンクを送って回答を集め、時間を確定。各メンバーのカレンダーに自動で書き込まれます。',
              }}
            />
          </ol>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-2 text-center">
        <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
          Stop juggling spreadsheets and group chats.
        </h2>
        <p lang="ja" className="mt-2 text-2xl font-bold text-gray-900">
          スプレッドシートとグループチャットの往復はもう終わり。
        </p>
        <p className="mt-6 text-base text-gray-600">
          Hangly is free while in beta. Sign in with Google, paint your week, and send your first
          hangout link in under five minutes.
        </p>
        <p lang="ja" className="mt-3 text-base text-gray-600">
          ツドイはベータ期間中、無料でご利用いただけます。Googleでログインし、スタンプで1週間を作って、5分以内に最初のハングアウトを共有しましょう。
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="w-full rounded-lg bg-indigo-600 px-7 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 sm:w-auto"
          >
            Create your free account
            <span className="ml-2 text-sm font-normal text-indigo-100" lang="ja">
              / 無料登録
            </span>
          </Link>
          <Link
            href="/sign-in"
            className="w-full rounded-lg border border-gray-300 bg-white px-7 py-3 text-base font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 sm:w-auto"
          >
            I already have an account
            <span className="ml-2 text-sm font-normal text-gray-500" lang="ja">
              / アカウントをお持ちの方
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

type CopyPair = { title: string; body: string };

function FeatureCard({
  emoji,
  en,
  ja,
}: {
  emoji: string;
  en: CopyPair;
  ja: CopyPair;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="text-3xl leading-none">{emoji}</div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{en.title}</h3>
          <p lang="ja" className="mt-1 text-sm font-medium text-gray-600">
            {ja.title}
          </p>
          <p className="mt-3 text-sm text-gray-600">{en.body}</p>
          <p lang="ja" className="mt-2 text-sm text-gray-600">
            {ja.body}
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, en, ja }: { n: number; en: CopyPair; ja: CopyPair }) {
  return (
    <li className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
        {n}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{en.title}</h3>
      <p lang="ja" className="mt-1 text-sm font-medium text-gray-600">
        {ja.title}
      </p>
      <p className="mt-3 text-sm text-gray-600">{en.body}</p>
      <p lang="ja" className="mt-2 text-sm text-gray-600">
        {ja.body}
      </p>
    </li>
  );
}
