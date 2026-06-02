'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';
import { LanguageToggle } from '@/components/common/LanguageToggle';
import { Button } from '@/components/ui/button';

interface UnauthenticatedShellProps {
  children: ReactNode;
  className?: string;
  showActions?: boolean;
}

export function UnauthenticatedShell({
  children,
  className = '',
  showActions = true,
}: UnauthenticatedShellProps) {
  return (
    <div
      className={[
        'relative isolate overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.45)] backdrop-blur-xl',
        className,
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute right-[-6rem] top-16 h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        <div className="absolute bottom-[-5rem] left-1/3 h-72 w-72 rounded-full bg-emerald-200/25 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-slate-200/70 bg-white/70">
        <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/favicon.svg" alt="" width={44} height={44} className="h-11 w-11" />
            <div>
              <div className="text-lg font-semibold tracking-tight text-slate-900">Tsudoi</div>
              <div className="text-xs text-slate-500">Calendar-aware scheduling</div>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <LanguageToggle />
            {showActions && (
              <div className="flex items-center gap-2">
                <Link href="/sign-in">
                  <Button variant="outline" size="sm" className="border-slate-300 bg-white/80">
                    Sign in
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800">
                    Start free
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="relative z-10 p-5 sm:p-6 lg:p-8">{children}</div>
    </div>
  );
}
