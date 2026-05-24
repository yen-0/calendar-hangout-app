'use client';

import { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';

interface Props {
  user: User | null;
  isGuest: boolean;
  isSimpleMode: boolean;
  onToggleMode: () => void;
  onAddEvent: () => void;
}

export function CalendarPageHeader({
  user,
  isGuest,
  isSimpleMode,
  onToggleMode,
  onAddEvent,
}: Props) {
  const heading = user
    ? `${user.displayName || user.email}'s Calendar`
    : isGuest
      ? 'Guest Calendar'
      : 'Calendar';

  return (
    <div className="flex justify-between items-center mb-4">
      <h1 className="text-2xl font-semibold">{heading}</h1>
      <div className="flex items-center space-x-2">
        <Button onClick={onToggleMode} variant="outline" size="default">
          {isSimpleMode ? 'Show Detailed View' : 'Show Simple View'}
        </Button>
        <Button
          onClick={onAddEvent}
          size="default"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          + Add Event
        </Button>
      </div>
    </div>
  );
}
