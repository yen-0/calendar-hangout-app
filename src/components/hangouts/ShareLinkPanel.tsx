'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showErrorToast, showInfoToast } from '@/lib/toasts';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  requestId: string;
}

const copy = {
  ja: {
    title: '候補リンクを共有',
    body: 'このリンクを参加者に送ると、すぐに回答を集められます。',
    copy: 'リンクをコピー',
    copied: 'リンクをコピーしました。',
    clipboardError: 'このブラウザではクリップボードを使用できません。',
    copyError: 'リンクのコピーに失敗しました。',
  },
  en: {
    title: 'Share the candidate link',
    body: 'Send this link to participants to collect their availability right away.',
    copy: 'Copy link',
    copied: 'Link copied.',
    clipboardError: 'Clipboard API not available in this browser.',
    copyError: 'Failed to copy link.',
  },
} as const;

export function ShareLinkPanel({ requestId }: Props) {
  const link =
    typeof window !== 'undefined' ? `${window.location.origin}/tsudoi/reply/${requestId}` : '';
  const { language } = useLanguage();
  const content = copy[language] ?? copy.en;

  const copyLink = useCallback(() => {
    if (!link) return;
    if (!navigator.clipboard) {
      showErrorToast(content.clipboardError);
      return;
    }
    navigator.clipboard
      .writeText(link)
      .then(() => showInfoToast(content.copied))
      .catch(() => showErrorToast(content.copyError));
  }, [content, link]);

  return (
    <div className="rounded-[1.5rem] border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
      <h3 className="text-lg font-bold text-cyan-900">{content.title}</h3>
      <p className="mt-1 text-sm text-cyan-800/80">{content.body}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input type="text" readOnly value={link} className="bg-white" />
        <Button
          onClick={copyLink}
          variant="outline"
          className="border-cyan-200 bg-white text-cyan-800"
        >
          {content.copy}
        </Button>
      </div>
    </div>
  );
}
