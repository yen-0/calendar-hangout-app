'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
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

export default function HangoutsPage() {
  const { user, loading: authLoading, isGuest, isPublicSession, ensurePublicSession } = useAuth();
  const router = useRouter();
  const requestsQuery = useHangoutRequestsForUser(user?.uid);
  const deleteMutation = useDeleteHangoutRequest();
  const { t } = useLanguage();

  const [pendingDelete, setPendingDelete] = useState<HangoutRequestClientState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [publicSessionError, setPublicSessionError] = useState<string | null>(null);

  const requests = requestsQuery.data ?? [];

  useEffect(() => {
    if (authLoading || user || isGuest) return;
    void ensurePublicSession().catch((error) => {
      console.error('Failed to start public session:', error);
      setPublicSessionError('Could not start a public scheduling session.');
    });
  }, [authLoading, ensurePublicSession, isGuest, user]);

  const copyShareLink = useCallback(
    (id: string) => {
      const link = `${window.location.origin}/hangouts/reply/${id}`;
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

  if (authLoading || (!user && !isGuest && !publicSessionError)) {
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
    <div className="p-4 md:p-6">
      {isPublicSession && (
        <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide">{t.hangouts.publicRequestsIntroTitle}</p>
          <p className="mt-1 text-sm">{t.hangouts.publicRequestsIntroBody}</p>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {isPublicSession ? t.hangouts.publicRequests : t.hangouts.myRequests}
        </h1>
        <Button
          onClick={() => router.push('/hangouts/request')}
          className="bg-green-600 text-white hover:bg-green-700"
        >
          {t.hangouts.createNewRequest}
        </Button>
      </div>

      {requestsQuery.isLoading ? (
        <p className="py-4 text-center text-gray-500">{t.hangouts.loadingRequests}</p>
      ) : requests.length === 0 ? (
        <HangoutsEmptyState onCreate={() => router.push('/hangouts/request')} />
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <HangoutRequestCard
              key={req.id}
              request={req}
              isCreator={user.uid === req.creatorUid}
              isProcessing={isProcessing}
              onCopyShareLink={copyShareLink}
              onEdit={(request) => router.push(`/hangouts/request/${request.id}`)}
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
