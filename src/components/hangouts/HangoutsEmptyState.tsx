'use client';

import { Button } from '@/components/ui/button';

interface Props {
  onCreate: () => void;
}

export function HangoutsEmptyState({ onCreate }: Props) {
  return (
    <div className="text-center py-10 border-2 border-dashed border-gray-300 rounded-lg">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-12 h-12 mx-auto text-gray-400 mb-3"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-3.741-5.007M12 12h.01M12 12h.01M12 12h.01M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.53 1.977a5.25 5.25 0 0 1-5.008 3.741 9.095 9.095 0 0 1-3.741-.48M3.75 4.5a.75.75 0 0 0-.75.75v13.5a.75.75 0 0 0 .75.75h16.5a.75.75 0 0 0 .75-.75V5.25a.75.75 0 0 0-.75-.75H3.75Z"
        />
      </svg>
      <p className="text-gray-500">You haven&apos;t created any hangout requests yet.</p>
      <Button onClick={onCreate} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
        Create Your First Request
      </Button>
    </div>
  );
}
