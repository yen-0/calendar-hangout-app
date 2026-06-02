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
    eyebrow: '公開調整をすぐ始める',
    title: '候補を送って、集めて、確定する。',
    body:
      'アカウントなしでも始められる公開セッションで、参加者の空き時間を集めてそのまま候補を確定できます。',
    createPrimary: '新しい調整を作成',
    inviteSecondary: '友だちを招待',
    summary: ['公開中', '確定済み', '終了済み'],
    introTitle: 'アカウントなしでも使える公開モード',
    introBody:
      'このページでは一時的な公開セッションを使って、すぐにリンク共有と空き時間の収集を始められます。',
    sectionTitle: '調整一覧',
    empty: 'まだ公開調整はありません。',
    createFirst: '最初の調整を作る',
    loading: '読み込み中...',
    signedOut: 'サインインすると自分の調整を確認できます。',
    requestClosed: '調整を終了しました。',
    requestDeleted: '調整を削除しました。',
    shareCopied: 'リンクをコピーしました。',
    createError: '公開セッションを開始できませんでした。',
    deleteConfirmPrefix: 'この調整を削除しますか？',
    deleteConfirmSuffix: 'この操作は元に戻せません。',
  },
  en: {
    eyebrow: 'Start public scheduling instantly',
    title: 'Share candidate times, collect replies, confirm the best one.',
    body:
      'Use the public session flow to collect everyone’s availability and confirm a time without requiring an account.',
    createPrimary: 'Create request',
    inviteSecondary: 'Invite from friends',
    summary: ['Open', 'Confirmed', 'Closed'],
    introTitle: 'Public mode without an account',
    introBody:
      'This page uses a temporary public session so you can share a link and collect availability right away.',
    sectionTitle: 'Requests',
    empty: 'No public requests yet.',
    createFirst: 'Create the first request',
    loading: 'Loading...',
    signedOut: 'Sign in to manage your own requests.',
    requestClosed: 'Request closed.',
    requestDeleted: 'Request deleted.',
    shareCopied: 'Link copied.',
    createError: 'Could not start a public session.',
    deleteConfirmPrefix: 'Delete this request?',
    deleteConfirmSuffix: 'This cannot be undone.',
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
      open: requests.filter((request) => request.status !== 'confirmed' && request.status !== 'closed').length,
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
        showErrorToast(language === 'ja' ? 'このブラウザではクリップボードを使えません。' : 'Clipboard API not available.');
        return;
      }
      navigator.clipboard
        .writeText(link)
        .then(() => showInfoToast(content.shareCopied))
        .catch(() => showErrorToast(language === 'ja' ? 'リンクのコピーに失敗しました。' : 'Failed to copy link.'));
    },
    [content.shareCopied, language],
  );

  const handleCloseOrArchive = useCallback(
    async (req: HangoutRequestClientState) => {
      if (!user || user.uid !== req.creatorUid) return;
      if (!confirm(`${content.deleteConfirmPrefix} "${req.requestName}" ${content.deleteConfirmSuffix}`)) return;
      setIsProcessing(true);
      try {
        const { updateHangoutRequestDetails } = await import('@/lib/firebase/firestoreService');
        await updateHangoutRequestDetails(req.id, { status: 'closed' });
        showSuccessToast(content.requestClosed);
        await requestsQuery.refetch();
      } catch (err) {
        console.error('Failed to close:', err);
        showErrorToast(language === 'ja' ? `調整の終了に失敗しました。 ${(err as Error).message}` : `Failed to close the request. ${(err as Error).message}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [content.deleteConfirmPrefix, content.deleteConfirmSuffix, content.requestClosed, language, requestsQuery, user],
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
      showErrorToast(language === 'ja' ? `調整の削除に失敗しました。 ${(err as Error).message}` : `Failed to delete the request. ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [content.requestDeleted, deleteMutation, language, pendingDelete, requestsQuery, user]);

  if (authLoading || (!user && !publicSessionError)) {
    return <div className="p-6 text-center text-slate-500">{content.loading}</div>;
  }

  if (publicSessionError) {
    return (
      <div className="p-6 text-center text-red-600">
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
          <Button className="bg-slate-950 text-white hover:bg-slate-800">Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-[0_24px_90px_-55px_rgba(15,23,42,0.45)] backdrop-blur">
        <div className="grid gap-6 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.12),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(248,250,252,0.9))] p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-cyan-100 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700">
              <span className="h-2 w-2 rounded-full bg-cyan-500" />
              {content.eyebrow}
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              {content.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">{content.body}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => router.push('/tsudoi/request')}
                className="rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800"
              >
                {content.createPrimary}
              </Button>
              {!isPublicSession && (
                <Link href="/friends">
                  <Button variant="outline" className="rounded-full border-slate-300 bg-white">
                    {content.inviteSecondary}
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1">
            {[
              { label: content.summary[0], value: summary.open, tone: 'from-cyan-50 to-cyan-100 text-cyan-900' },
              {
                label: content.summary[1],
                value: summary.confirmed,
                tone: 'from-emerald-50 to-emerald-100 text-emerald-900',
              },
              { label: content.summary[2], value: summary.closed, tone: 'from-slate-100 to-slate-200 text-slate-700' },
            ].map((item) => (
              <div key={item.label} className={`rounded-[1.5rem] bg-gradient-to-br ${item.tone} px-5 py-4`}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em]">{item.label}</p>
                <p className="mt-1 text-3xl font-black">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {isPublicSession && (
        <div className="rounded-[1.5rem] border border-indigo-200 bg-indigo-50 px-5 py-4 text-indigo-900 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em]">{content.introTitle}</p>
          <p className="mt-1 text-sm leading-7">{content.introBody}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">{content.sectionTitle}</h2>
        <Button
          onClick={() => router.push('/tsudoi/request')}
          className="rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-700"
        >
          {content.createPrimary}
        </Button>
      </div>

      {requestsQuery.isLoading ? (
        <p className="py-8 text-center text-slate-500">{content.loading}</p>
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
        confirmText={content.sectionTitle}
      />
    </div>
  );
}
