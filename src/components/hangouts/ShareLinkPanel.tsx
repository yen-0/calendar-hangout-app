'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showErrorToast, showInfoToast } from '@/lib/toasts';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  requestId: string;
}

export function ShareLinkPanel({ requestId }: Props) {
  const link =
    typeof window !== 'undefined' ? `${window.location.origin}/tsudoi/reply/${requestId}` : '';
  const { t } = useLanguage();

  const copy = useCallback(() => {
    if (!link) return;
    if (!navigator.clipboard) {
      showErrorToast('Clipboard API not available in this browser.');
      return;
    }
    navigator.clipboard
      .writeText(link)
      .then(() => showInfoToast(t.hangouts.shareLinkCopied))
      .catch(() => showErrorToast('Failed to copy link.'));
  }, [link, t.hangouts.shareLinkCopied]);

  return (
    <div className="mb-6 rounded-md border border-green-300 bg-green-100 p-4 shadow">
      <h3 className="text-lg font-semibold text-green-700">{t.hangouts.requestCreated}</h3>
      <p className="mb-2 text-sm text-green-600">{t.hangouts.shareThisLink}</p>
      <div className="flex items-center gap-2">
        <Input type="text" readOnly value={link} className="bg-white" />
        <Button onClick={copy} variant="outline">
          {t.common.copy}
        </Button>
      </div>
    </div>
  );
}

