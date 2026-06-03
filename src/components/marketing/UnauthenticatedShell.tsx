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
    <div className={['plain-shell', className].join(' ')}>
      <header className="shell-header">
        <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/favicon.svg" alt="" width={40} height={40} className="h-10 w-10" />
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
                  <Button variant="outline" size="sm" className="border-stone-400 bg-white">
                    Sign in
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button size="sm" className="bg-slate-950 text-white hover:bg-slate-800">
                    Start free
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="p-5 sm:p-6 lg:p-8">{children}</div>
    </div>
  );
}
