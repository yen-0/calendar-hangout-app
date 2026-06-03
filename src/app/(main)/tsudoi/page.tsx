'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { HangoutRequestCard } from '@/components/hangouts/HangoutRequestCard';
import { HangoutsEmptyState } from '@/components/hangouts/HangoutsEmptyState';
import { showErrorToast, showInfoToast, showSuccessToast } from '@/lib/toasts';
import { HangoutRequestClientState } from '@/types/hangouts';
import { useDeleteHangoutRequest, useHangoutRequestsForUser } from '@/lib/queries/hangoutRequests';
import { useLanguage } from '@/hooks/useLanguage';

const copy = {
  ja: {
    eyebrow: '公開調整',
    title: '候補を送って、回答を集めて、予定を確定する。',
    body: 'アカウントなしでも使える公開セッションです。参加者の空き時間を集め、候補の状態を確認できます。',
    createPrimary: '調整を作成',
    inviteSecondary: '友だちを招待',
    summary: ['進行中', '確定済み', '終了'],
    introTitle: '公開モードで利用中',
    introBody:
      'このページでは一時的な公開セッションを使っています。リンクを共有して、すぐに回答を集められます。',
    sectionTitle: '調整一覧',
    loading: '読み込み中...',
    signedOut: 'サインインすると自分の調整を管理できます。',
    requestClosed: '調整を終了しました。',
    requestDeleted: '調整を削除しました。',
    shareCopied: 'リンクをコピーしました。',
    createError: '公開セッションを開始できませんでした。',
    deleteConfirmPrefix: 'この調整を削除しますか?',
    deleteConfirmSuffix: 'この操作は元に戻せません。',
    confirmDelete: '削除',
  },
  en: {
    eyebrow: 'Public scheduling',
    title: 'Share candidate times, collect replies, confirm the plan.',
    body: 'Use the public session flow to collect availability and manage open requests without requiring every participant to create an account.',
    createPrimary: 'Create request',
    inviteSecondary: 'Invite from friends',
    summary: ['Open', 'Confirmed', 'Closed'],
    sectionTitle: 'Requests',
    introTitle: 'Using public mode',
    introBody:
      'This page uses a temporary public session so you can share a link and collect availability right away.',
    loading: 'Loading...',
    signedOut: 'Sign in to manage your own requests.',
    requestClosed: 'Request closed.',
    requestDeleted: 'Request deleted.',
    shareCopied: 'Link copied.',
    createError: 'Could not start a public session.',
    deleteConfirmPrefix: 'Delete this request?',
    deleteConfirmSuffix: 'This cannot be undone.',
    confirmDelete: 'Delete',
  },
} as const;

export default function TsudoiPage() {
  const { user, loading: authLoading, isPublicSession, ensurePublicSession } = useAuth();
  const router = useRouter();
  const requestsQuery = useHangoutRequestsForUser(user?.uid);
  const deleteMutation = useDeleteHangoutRequest();
  const { language } = useLanguage();
  const content = copy[language];

  const [pendingDelete, setPendingDelete] = useState<HangoutRequestClientState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [publicSessionError, setPublicSessionError] = useState<string | null>(null);

  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);
  const summary = useMemo(
    () => ({
      open: requests.filter(
        (request) => request.status !== 'confirmed' && request.status !== 'closed',
      ).length,
      confirmed: requests.filter((request) => request.status === 'confirmed').length,
      closed: requests.filter((request) => request.status === 'closed').length,
    }),
    [requests],
  );

  useEffect(() => {
    if (authLoading || user) return;
    void ensurePublicSession().catch((error) => {
      console.error('Failed to start public session:', error);
      setPublicSessionError(content.createError);
    });
  }, [authLoading, content.createError, ensurePublicSession, user]);

  const copyShareLink = useCallback(
    (id: string) => {
      const link = `${window.location.origin}/tsudoi/reply/${id}`;
      if (!navigator.clipboard) {
        showErrorToast(
          language === 'ja'
            ? 'このブラウザではクリップボードを使用できません。'
            : 'Clipboard API not available.',
        );
        return;
      }
      navigator.clipboard
        .writeText(link)
        .then(() => showInfoToast(content.shareCopied))
        .catch(() =>
          showErrorToast(
            language === 'ja' ? 'リンクのコピーに失敗しました。' : 'Failed to copy link.',
          ),
        );
    },
    [content.shareCopied, language],
  );

  const handleCloseOrArchive = useCallback(
    async (req: HangoutRequestClientState) => {
      if (!user || user.uid !== req.creatorUid) return;
      if (
        !confirm(
          `${content.deleteConfirmPrefix} "${req.requestName}" ${content.deleteConfirmSuffix}`,
        )
      )
        return;
      setIsProcessing(true);
      try {
        const { updateHangoutRequestDetails } = await import('@/lib/firebase/firestoreService');
        await updateHangoutRequestDetails(req.id, { status: 'closed' });
        showSuccessToast(content.requestClosed);
        await requestsQuery.refetch();
      } catch (err) {
        console.error('Failed to close:', err);
        showErrorToast(
          language === 'ja'
            ? `調整の終了に失敗しました。${(err as Error).message}`
            : `Failed to close the request. ${(err as Error).message}`,
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [
      content.deleteConfirmPrefix,
      content.deleteConfirmSuffix,
      content.requestClosed,
      language,
      requestsQuery,
      user,
    ],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete || !user || user.uid !== pendingDelete.creatorUid) return;
    setIsProcessing(true);
    try {
      await deleteMutation.mutateAsync(pendingDelete.id);
      showSuccessToast(content.requestDeleted);
      setPendingDelete(null);
      await requestsQuery.refetch();
    } catch (err) {
      console.error('Failed to delete:', err);
      showErrorToast(
        language === 'ja'
          ? `調整の削除に失敗しました。${(err as Error).message}`
          : `Failed to delete the request. ${(err as Error).message}`,
      );
    } finally {
      setIsProcessing(false);
    }
  }, [content.requestDeleted, deleteMutation, language, pendingDelete, requestsQuery, user]);

  if (authLoading || (!user && !publicSessionError)) {
    return <div className="p-6 text-center text-stone-500">{content.loading}</div>;
  }

  if (publicSessionError) {
    return (
      <div className="p-6 text-center text-red-700">
        <p className="mb-2 text-lg font-semibold">{content.eyebrow}</p>
        <p>{publicSessionError}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">{content.signedOut}</p>
        <Link href="/sign-in">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="page-frame space-y-6">
      <section className="work-surface">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div>
            <div className="eyebrow">{content.eyebrow}</div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              {content.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-700 sm:text-base">
              {content.body}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => router.push('/tsudoi/request')} className="px-5">
                {content.createPrimary}
              </Button>
              {!isPublicSession && (
                <Link href="/friends">
                  <Button variant="outline">{content.inviteSecondary}</Button>
                </Link>
              )}
            </div>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1">
            {[
              {
                label: content.summary[0],
                value: summary.open,
                accent: 'border-l-4 border-l-amber-500',
              },
              {
                label: content.summary[1],
                value: summary.confirmed,
                accent: 'border-l-4 border-l-emerald-600',
              },
              {
                label: content.summary[2],
                value: summary.closed,
                accent: 'border-l-4 border-l-stone-500',
              },
            ].map((item) => (
              <div key={item.label} className={`status-tile ${item.accent}`}>
                <p className="kicker">{item.label}</p>
                <p className="mt-1 text-3xl font-semibold text-slate-950">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {isPublicSession && (
        <div className="border border-amber-300 bg-amber-50 px-5 py-4 text-amber-950">
          <p className="kicker text-amber-800">{content.introTitle}</p>
          <p className="mt-1 text-sm leading-7">{content.introBody}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          {content.sectionTitle}
        </h2>
        <Button onClick={() => router.push('/tsudoi/request')}>{content.createPrimary}</Button>
      </div>

      {requestsQuery.isLoading ? (
        <p className="py-8 text-center text-stone-500">{content.loading}</p>
      ) : requests.length === 0 ? (
        <HangoutsEmptyState onCreate={() => router.push('/tsudoi/request')} />
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <HangoutRequestCard
              key={req.id}
              request={req}
              isCreator={user.uid === req.creatorUid}
              isProcessing={isProcessing}
              onCopyShareLink={copyShareLink}
              onEdit={(request) => router.push(`/tsudoi/request/${request.id}`)}
              onDelete={setPendingDelete}
              onCloseOrArchive={handleCloseOrArchive}
            />
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
        title={content.sectionTitle}
        message={`${content.deleteConfirmPrefix} "${pendingDelete?.requestName ?? ''}" ${content.deleteConfirmSuffix}`}
        isLoading={isProcessing}
        confirmText={content.confirmDelete}
      />
    </div>
  );
}
