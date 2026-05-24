'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showErrorToast, showInfoToast } from '@/lib/toasts';

interface Props {
  requestId: string;
}

export function ShareLinkPanel({ requestId }: Props) {
  const link =
    typeof window !== 'undefined' ? `${window.location.origin}/hangouts/reply/${requestId}` : '';

  const copy = useCallback(() => {
    if (!link) return;
    if (!navigator.clipboard) {
      showErrorToast('Clipboard API not available in this browser.');
      return;
    }
    navigator.clipboard
      .writeText(link)
      .then(() => showInfoToast('Link copied to clipboard!'))
      .catch(() => showErrorToast('Failed to copy link.'));
  }, [link]);

  return (
    <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-md shadow">
      <h3 className="text-lg font-semibold text-green-700">Request Created!</h3>
      <p className="text-sm text-green-600 mb-2">
        Share this link with others to collect their availability:
      </p>
      <div className="flex items-center gap-2">
        <Input type="text" readOnly value={link} className="bg-white" />
        <Button onClick={copy} variant="outline">
          Copy Link
        </Button>
      </div>
    </div>
  );
}
