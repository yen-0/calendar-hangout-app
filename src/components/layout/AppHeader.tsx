'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import {
  ArrowRightOnRectangleIcon,
  BellIcon,
  CalendarDaysIcon,
  Cog6ToothIcon,
  UsersIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

interface AppHeaderProps {
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onOpenNotifications, unreadNotificationsCount }) => {
  const { user, signOut, isGuest } = useAuth();
  const pathname = usePathname();
  const { t } = useLanguage();

  const navItems = [
    { href: '/calendar', label: t.nav.calendar, icon: CalendarDaysIcon },
    { href: '/hangouts', label: t.nav.hangouts, icon: UserGroupIcon },
    { href: '/friends', label: t.nav.friends, icon: UsersIcon },
    ...(user && !isGuest ? [{ href: '/settings', label: t.nav.settings, icon: Cog6ToothIcon }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <nav className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link
          href={user && !isGuest ? '/calendar' : '/'}
          className="text-2xl font-bold text-blue-600 transition-colors hover:text-blue-700"
        >
          {t.appName}
        </Link>

        {(user || isGuest) && (
          <div className="flex items-center space-x-2 sm:space-x-4">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors
                  ${
                    pathname === item.href
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <item.icon className="inline-block h-5 w-5 sm:mr-1.5" aria-hidden="true" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}

            {user && !isGuest && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenNotifications}
                className="relative p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                title={t.nav.notifications}
              >
                <BellIcon className="h-6 w-6" />
                {unreadNotificationsCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
                    aria-label={`${unreadNotificationsCount} unread notifications`}
                  >
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </Button>
            )}

            {user && !isGuest && (
              <Button variant="outline" size="sm" onClick={signOut} title={t.nav.signOut}>
                <ArrowRightOnRectangleIcon className="h-5 w-5 sm:mr-1.5" />
                <span className="hidden sm:inline">{t.nav.signOut}</span>
              </Button>
            )}
            {isGuest && (
              <Link href="/sign-in">
                <Button variant="outline" size="sm">
                  {t.nav.signInSignUp}
                </Button>
              </Link>
            )}
          </div>
        )}

        {!user && !isGuest && pathname !== '/sign-in' && pathname !== '/sign-up' && (
          <div className="space-x-2">
            <Link href="/sign-in">
              <Button variant="outline" size="sm">
                {t.nav.signIn}
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button variant="default" size="sm">
                {t.nav.signUp}
              </Button>
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
};

export default AppHeader;
