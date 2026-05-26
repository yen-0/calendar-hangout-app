'use client';

import { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  user: User | null;
  isGuest: boolean;
  isSimpleMode: boolean;
  onToggleMode: () => void;
  onAddEvent: () => void;
}

export function CalendarPageHeader({ user, isGuest, isSimpleMode, onToggleMode, onAddEvent }: Props) {
  const { t } = useLanguage();
  const heading = user
    ? `${user.displayName || user.email}’s ${t.nav.calendar}`
    : isGuest
      ? t.calendar.guestTitle
      : t.nav.calendar;

  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-2xl font-semibold">{heading}</h1>
      <div className="flex items-center space-x-2">
        <Button onClick={onToggleMode} variant="outline" size="default">
          {isSimpleMode ? t.calendar.showDetailed : t.calendar.showSimple}
        </Button>
        <Button onClick={onAddEvent} size="default" className="bg-blue-600 text-white hover:bg-blue-700">
          {t.calendar.addEvent}
        </Button>
      </div>
    </div>
  );
}

