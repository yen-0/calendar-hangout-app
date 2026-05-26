'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/hooks/useLanguage';

export default function HomePage() {
  const { user, loading, isGuest, signInAsGuest } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    if (loading) return;
    if (user || isGuest) router.replace('/calendar');
  }, [user, loading, isGuest, router]);

  if (loading || user || isGuest) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-500">
        {t.common.loading}
      </div>
    );
  }

  const features = t.home.features;
  const steps = t.home.steps;

  return (
    <div className="space-y-24 pb-20">
      <section className="relative -mx-4 overflow-hidden bg-gradient-to-br from-sky-50 via-white to-indigo-50 px-4 pb-20 pt-12 md:pt-20">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-baseline gap-3">
            <span className="text-2xl font-bold tracking-tight text-gray-900">{t.appName}</span>
            <span className="text-gray-300">/</span>
            <span className="text-2xl font-bold tracking-tight text-indigo-700">{t.home.strap}</span>
          </div>
          <p className="mb-3 inline-block rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-medium tracking-wide text-indigo-700 backdrop-blur">
            {t.home.strap}
          </p>
          <h1 className="text-4xl font-bold leading-tight text-gray-900 sm:text-5xl md:text-6xl">
            {t.home.heroLead}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-gray-600 sm:text-lg">
            {t.home.heroDescription}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="w-full rounded-lg bg-indigo-600 px-7 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 sm:w-auto"
            >
              {t.home.ctaFree}
            </Link>
            <Link
              href="/sign-in"
              className="w-full rounded-lg border border-gray-300 bg-white px-7 py-3 text-base font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 sm:w-auto"
            >
              {t.home.ctaSignIn}
            </Link>
            <button
              type="button"
              onClick={signInAsGuest}
              className="w-full rounded-lg px-4 py-3 text-base font-medium text-gray-600 underline-offset-4 hover:text-indigo-700 hover:underline sm:w-auto"
            >
              {t.home.ctaGuest}
            </button>
          </div>
          <p className="mt-6 text-xs text-gray-500">{t.home.noCredit}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-2">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">{t.home.planTitle}</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {features.slice(0, 3).map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="text-3xl">{feature.emoji}</div>
              <h3 className="mt-3 text-lg font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-3 text-sm text-gray-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-2">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">{t.home.featuresTitle}</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="flex items-start gap-4">
                <div className="text-3xl leading-none">{feature.emoji}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-3 text-sm text-gray-600">{feature.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative -mx-4 bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">{t.home.howItWorksTitle}</h2>
          </div>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-3 text-sm text-gray-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-2 text-center">
        <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">{t.home.finalTitle}</h2>
        <p className="mt-6 text-base text-gray-600">{t.home.finalDescription}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="w-full rounded-lg bg-indigo-600 px-7 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 sm:w-auto"
          >
            {t.auth.createAccount}
          </Link>
          <Link
            href="/sign-in"
            className="w-full rounded-lg border border-gray-300 bg-white px-7 py-3 text-base font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 sm:w-auto"
          >
            {t.auth.signIn}
          </Link>
        </div>
      </section>
    </div>
  );
}

