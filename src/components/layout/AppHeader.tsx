// src/components/layout/AppHeader.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { BellIcon, CalendarDaysIcon, UserGroupIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

interface AppHeaderProps {
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onOpenNotifications, unreadNotificationsCount }) => {
  const { user, signOut, isGuest } = useAuth();
  const pathname = usePathname();

  const navItems = [
    { href: '/calendar', label: 'Calendar', icon: CalendarDaysIcon },
    { href: '/hangouts', label: 'Hangouts', icon: UserGroupIcon },
  ];

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40">
      <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link
          href={user && !isGuest ? "/calendar" : "/"} // Guests go to landing, users to calendar
          className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
        >
          MyAppName {/* Replace with your actual app name or logo component */}
        </Link>

        {/* Navigation and Actions - shown if user or guest */}
        {(user || isGuest) && (
          <div className="flex items-center space-x-2 sm:space-x-4">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${pathname === item.href
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <item.icon className="h-5 w-5 inline-block sm:mr-1.5" aria-hidden="true" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}

            {/* Notification Button - only for logged-in (non-guest) users */}
            {user && !isGuest && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenNotifications}
                className="relative text-gray-600 hover:bg-gray-100 hover:text-gray-900 p-2"
                title="Notifications"
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
            
            {/* Sign Out / Sign In for Guest */}
            {user && !isGuest && (
                <Button variant="outline" size="sm" onClick={signOut} title="Sign Out">
                    <ArrowRightOnRectangleIcon className="h-5 w-5 sm:mr-1.5"/>
                    <span className="hidden sm:inline">Sign Out</span>
                </Button>
            )}
             {isGuest && ( // If user is a guest
                 <Link href="/sign-in">
                    <Button variant="outline" size="sm">Sign In / Sign Up</Button>
                 </Link>
             )}
          </div>
        )}
        
        {/* Fallback for when no user and not guest (e.g. on landing page if this header were to be used there) */}
        {/* And not on auth pages themselves */}
        {!user && !isGuest && 
            (pathname !== '/sign-in' && pathname !== '/sign-up') && 
             <div className="space-x-2">
                <Link href="/sign-in">
                    <Button variant="outline" size="sm">Sign In</Button>
                </Link>
                <Link href="/sign-up">
                    <Button variant="default" size="sm">Sign Up</Button>
                </Link>
             </div>
        }
      </nav>
    </header>
  );
};

export default AppHeader;