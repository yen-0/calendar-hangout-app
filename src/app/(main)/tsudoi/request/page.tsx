'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ShareLinkPanel } from '@/components/hangouts/ShareLinkPanel';
import { TsudoiRequestEditor } from '@/components/tsudoi/TsudoiRequestEditor';
import { showErrorToast, showSuccessToast } from '@/lib/toasts';
import { useCreateHangoutRequest } from '@/lib/queries/hangoutRequests';
import { fetchCalendarItems } from '@/lib/firebase/firestoreService';
import { prepareCreatorEventsForRequest } from '@/utils/hangoutUtils';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { HangoutRequestFormData } from '@/types/hangouts';

export default function TsudoiRequestCreatePage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-500">Loading...</div>}>
      <TsudoiRequestCreatePageInner />
    </Suspense>
  );
}

function TsudoiRequestCreatePageInner() {
  const { user, loading: authLoading, isPublicSession, ensurePublicSession } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const recipientUid = searchParams.get('recipient') ?? undefined;
  const createMutation = useCreateHangoutRequest();
  const [isSaving, setIsSaving] = useState(false);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  const [isBootstrappingPublicSession, setIsBootstrappingPublicSession] = useState(false);

  useEffect(() => {
    if (authLoading || user) return;
    setIsBootstrappingPublicSession(true);
    void ensurePublicSession().finally(() => setIsBootstrappingPublicSession(false));
  }, [authLoading, ensurePublicSession, user]);

  const handleSave = useCallback(
    async (formData: HangoutRequestFormData) => {
      if (!user) {
        showErrorToast('You must be signed in to create a request.');
        return;
      }
      setIsSaving(true);
      try {
        const userEvents = isPublicSession ? [] : await fetchCalendarItems(user.uid);
        const creatorEvents = prepareCreatorEventsForRequest(
          userEvents,
          formData.dateRanges,
          formData.timeRanges,
          formData.candidateSlots ?? [],
        );
        const creatorName = isPublicSession
          ? t.hangouts.publicOrganizer
          : user.displayName || user.email || 'Anonymous User';
        const id = await createMutation.mutateAsync({
          creatorUid: user.uid,
          creatorName,
          formData,
          creatorEvents,
        });
        setCreatedRequestId(id);
        showSuccessToast(t.hangouts.createSuccess);
      } catch (error) {
        console.error('Failed to create Tsudoi request:', error);
        showErrorToast(`Failed to create request. ${(error as Error).message}`);
      } finally {
        setIsSaving(false);
      }
    },
    [createMutation, isPublicSession, t.hangouts.createSuccess, t.hangouts.publicOrganizer, user],
  );

  if (authLoading || isBootstrappingPublicSession || !user) {
    return <div className="p-6 text-center text-gray-500">{t.hangouts.loadingAuth}</div>;
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
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Tsudoi</p>
          <h1 className="text-3xl font-bold text-slate-900">Create a request</h1>
        </div>
        <Link href="/tsudoi">
          <Button variant="outline">{t.replyPage.backToList}</Button>
        </Link>
      </div>

      {createdRequestId ? (
        <div className="space-y-6">
          <ShareLinkPanel requestId={createdRequestId} />
          <div className="flex justify-end">
            <Link href="/tsudoi">
              <Button className="bg-sky-600 text-white hover:bg-sky-700">Back to list</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-8">
          <TsudoiRequestEditor
            mode="create"
            initialData={recipientUid ? { recipientUids: [recipientUid] } : undefined}
            isLoading={isSaving}
            onSave={handleSave}
            onCancel={() => router.push('/tsudoi')}
          />
        </div>
      )}
    </div>
  );
}
