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
import {
  useDeleteHangoutRequest,
  useHangoutRequestsForUser,
} from '@/lib/queries/hangoutRequests';
import { useLanguage } from '@/hooks/useLanguage';

export default function TsudoiPage() {
  const { user, loading: authLoading, isPublicSession, ensurePublicSession } = useAuth();
  const router = useRouter();
  const requestsQuery = useHangoutRequestsForUser(user?.uid);
  const deleteMutation = useDeleteHangoutRequest();
  const { t } = useLanguage();

  const [pendingDelete, setPendingDelete] = useState<HangoutRequestClientState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [publicSessionError, setPublicSessionError] = useState<string | null>(null);

  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);
  const summary = useMemo(
    () => ({
      active: requests.filter((request) => request.status !== 'confirmed' && request.status !== 'closed').length,
      waiting: requests.filter(
        (request) =>
          request.status === 'pending' || request.status === 'pending_calculation',
      ).length,
      ready: requests.filter((request) => request.status === 'results_ready').length,
    }),
    [requests],
  );

  useEffect(() => {
    if (authLoading || user) return;
    void ensurePublicSession().catch((error) => {
      console.error('Failed to start public session:', error);
      setPublicSessionError('Could not start a public scheduling session.');
    });
  }, [authLoading, ensurePublicSession, user]);

  const copyShareLink = useCallback(
    (id: string) => {
      const link = `${window.location.origin}/tsudoi/reply/${id}`;
      if (!navigator.clipboard) {
        showErrorToast('Clipboard API not available.');
        return;
      }
      navigator.clipboard
        .writeText(link)
        .then(() => showInfoToast(t.hangouts.shareLinkCopied))
        .catch(() => showErrorToast('Failed to copy link.'));
    },
    [t.hangouts.shareLinkCopied],
  );

  const handleCloseOrArchive = useCallback(
    async (req: HangoutRequestClientState) => {
      if (!user || user.uid !== req.creatorUid) return;
      if (!confirm(`Close the request "${req.requestName}"?`)) return;
      setIsProcessing(true);
      try {
        const { updateHangoutRequestDetails } = await import('@/lib/firebase/firestoreService');
        await updateHangoutRequestDetails(req.id, { status: 'closed' });
        showSuccessToast(t.hangouts.requestClosed);
        await requestsQuery.refetch();
      } catch (err) {
        console.error('Failed to close:', err);
        showErrorToast(`Failed to close. ${(err as Error).message}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [requestsQuery, t.hangouts.requestClosed, user],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete || !user || user.uid !== pendingDelete.creatorUid) return;
    setIsProcessing(true);
    try {
      await deleteMutation.mutateAsync(pendingDelete.id);
      showSuccessToast(t.hangouts.requestDeleted);
      setPendingDelete(null);
      await requestsQuery.refetch();
    } catch (err) {
      console.error('Failed to delete:', err);
      showErrorToast(`Failed to delete. ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [deleteMutation, pendingDelete, requestsQuery, t.hangouts.requestDeleted, user]);

  if (authLoading || (!user && !publicSessionError)) {
    return <div className="p-6 text-center">{t.hangouts.loadingAuth}</div>;
  }

  if (publicSessionError) {
    return (
      <div className="p-6 text-center text-red-600">
        <p className="mb-2 text-lg font-semibold">{t.hangouts.guestPromptTitle}</p>
        <p>{publicSessionError}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">{t.hangouts.signedOutPrompt}</p>
        <Link href="/sign-in">
          <Button>{t.nav.signIn}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_260px] md:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Tsudoi</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Send a schedule poll first. Calendar and friends help when you need them.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Create candidate slots, share a link, collect ○ △ × answers, and confirm the
              strongest time. No account is required to start.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => router.push('/tsudoi/request')}
                className="bg-sky-600 text-white hover:bg-sky-700"
              >
                Create Tsudoi
              </Button>
              {!isPublicSession && (
                <Link href="/friends">
                  <Button variant="outline">Invite from friends</Button>
                </Link>
              )}
            </div>
          </div>
          <div className="grid gap-3 text-sm">
            {[
              { label: 'Active', value: summary.active, tone: 'bg-sky-50 text-sky-800' },
              { label: 'Waiting', value: summary.waiting, tone: 'bg-amber-50 text-amber-800' },
              { label: 'Ready', value: summary.ready, tone: 'bg-emerald-50 text-emerald-800' },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl px-4 py-3 ${item.tone}`}>
                <p className="text-xs font-semibold uppercase tracking-wide">{item.label}</p>
                <p className="mt-1 text-3xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {isPublicSession && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide">{t.hangouts.publicRequestsIntroTitle}</p>
          <p className="mt-1 text-sm">{t.hangouts.publicRequestsIntroBody}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {isPublicSession ? t.hangouts.publicRequests : t.hangouts.myRequests}
        </h1>
        <Button
          onClick={() => router.push('/tsudoi/request')}
          className="bg-green-600 text-white hover:bg-green-700"
        >
          {t.hangouts.createNewRequest}
        </Button>
      </div>

      {requestsQuery.isLoading ? (
        <p className="py-4 text-center text-gray-500">{t.hangouts.loadingRequests}</p>
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
        title={t.hangouts.delete}
        message={`Delete the request "${pendingDelete?.requestName ?? ''}"? This cannot be undone.`}
        isLoading={isProcessing}
        confirmText={t.hangouts.delete}
      />
    </div>
  );
}
