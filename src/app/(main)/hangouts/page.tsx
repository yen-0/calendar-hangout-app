'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useState } from 'react';
import nextDynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { HangoutRequestCard } from '@/components/hangouts/HangoutRequestCard';
import { ShareLinkPanel } from '@/components/hangouts/ShareLinkPanel';
import { HangoutsEmptyState } from '@/components/hangouts/HangoutsEmptyState';
import { showErrorToast, showInfoToast, showSuccessToast } from '@/lib/toasts';
import { HangoutRequestClientState, HangoutRequestFormData } from '@/types/hangouts';
import {
  useCreateHangoutRequest,
  useDeleteHangoutRequest,
  useHangoutRequestsForUser,
} from '@/lib/queries/hangoutRequests';
import { fetchCalendarItems } from '@/lib/firebase/firestoreService';
import { prepareCreatorEventsForRequest } from '@/utils/hangoutUtils';
import { useLanguage } from '@/hooks/useLanguage';

const DynamicHangoutRequestForm = nextDynamic(() => import('@/components/hangouts/HangoutRequestForm'), {
  ssr: false,
  loading: () => <p className="p-6 text-center">Loading form…</p>,
});

function EditModalContent({
  request,
  isProcessing,
  onCancel,
  onSave,
}: {
  request: HangoutRequestClientState;
  isProcessing: boolean;
  onCancel: () => void;
  onSave: (data: HangoutRequestFormData) => Promise<void>;
}) {
  return (
    <DynamicHangoutRequestForm
      onSave={onSave}
      onCancel={onCancel}
      isLoading={isProcessing}
      initialData={{
        requestName: request.requestName,
        desiredDurationMinutes: request.desiredDurationMinutes,
        desiredMarginMinutes: request.desiredMarginMinutes,
        desiredMemberCount: request.desiredMemberCount,
        dateRanges: request.dateRanges,
        timeRanges: request.timeRanges,
      }}
    />
  );
}

export default function HangoutsPage() {
  const { user, loading: authLoading, isGuest } = useAuth();
  const requestsQuery = useHangoutRequestsForUser(user?.uid);
  const createMutation = useCreateHangoutRequest();
  const deleteMutation = useDeleteHangoutRequest();
  const { t } = useLanguage();

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<HangoutRequestClientState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HangoutRequestClientState | null>(null);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const requests = requestsQuery.data ?? [];

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

  const handleCreate = useCallback(
    async (formData: HangoutRequestFormData) => {
      if (!user || isGuest) {
        showErrorToast('You must be signed in to create a request.');
        return;
      }
      setIsProcessing(true);
      try {
        const userEvents = await fetchCalendarItems(user.uid);
        const creatorEvents = prepareCreatorEventsForRequest(
          userEvents,
          formData.dateRanges,
          formData.timeRanges,
        );
        const id = await createMutation.mutateAsync({
          creatorUid: user.uid,
          creatorName: user.displayName || user.email || 'Anonymous User',
          formData,
          creatorEvents,
        });
        setNewlyCreatedId(id);
        showSuccessToast(t.hangouts.createSuccess);
        setCreateOpen(false);
      } catch (err) {
        console.error('Failed to create request:', err);
        showErrorToast(`Failed to create request. ${(err as Error).message}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [user, isGuest, createMutation, t.hangouts.createSuccess],
  );

  const handleEditSaveDirect = useCallback(
    async (formData: HangoutRequestFormData) => {
      if (!editing || !user || user.uid !== editing.creatorUid) return;
      setIsProcessing(true);
      try {
        const { updateHangoutRequestDetails } = await import('@/lib/firebase/firestoreService');
        await updateHangoutRequestDetails(editing.id, {
          requestName: formData.requestName,
          desiredMemberCount: formData.desiredMemberCount,
        });
        showSuccessToast(t.hangouts.requestUpdated);
        setEditing(null);
        await requestsQuery.refetch();
      } catch (err) {
        console.error('Failed to update request:', err);
        showErrorToast(`Failed to update request. ${(err as Error).message}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [editing, user, requestsQuery, t.hangouts.requestUpdated],
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
    [user, requestsQuery, t.hangouts.requestClosed],
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
  }, [pendingDelete, user, deleteMutation, requestsQuery, t.hangouts.requestDeleted]);

  if (authLoading) return <div className="p-6 text-center">{t.hangouts.loadingAuth}</div>;

  if (isGuest) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4 text-lg">{t.hangouts.guestPromptTitle}</p>
        <p className="mb-4 text-gray-600">{t.hangouts.guestPromptBody}</p>
        <Link href="/sign-in">
          <Button size="lg">{t.nav.signInSignUp}</Button>
        </Link>
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.hangouts.myRequests}</h1>
        <Button
          onClick={() => {
            setNewlyCreatedId(null);
            setCreateOpen(true);
          }}
          className="bg-green-600 text-white hover:bg-green-700"
        >
          {t.hangouts.createNewRequest}
        </Button>
      </div>

      {newlyCreatedId && <ShareLinkPanel requestId={newlyCreatedId} />}

      {requestsQuery.isLoading ? (
        <p className="py-4 text-center text-gray-500">{t.hangouts.loadingRequests}</p>
      ) : requests.length === 0 ? (
        <HangoutsEmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <HangoutRequestCard
              key={req.id}
              request={req}
              isCreator={user.uid === req.creatorUid}
              isProcessing={isProcessing}
              onCopyShareLink={copyShareLink}
              onEdit={setEditing}
              onDelete={setPendingDelete}
              onCloseOrArchive={handleCloseOrArchive}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        title={t.hangouts.createDialog}
        size="lg"
      >
        {isCreateOpen && (
          <DynamicHangoutRequestForm
            onSave={handleCreate}
            onCancel={() => setCreateOpen(false)}
            isLoading={isProcessing}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={t.hangouts.editDialog}
        size="lg"
      >
        {editing && (
          <EditModalContent
            request={editing}
            isProcessing={isProcessing}
            onCancel={() => setEditing(null)}
            onSave={handleEditSaveDirect}
          />
        )}
      </Modal>

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
