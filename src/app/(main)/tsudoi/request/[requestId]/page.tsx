'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { HangoutDetailsCard } from '@/components/hangouts/HangoutDetailsCard';
import { TsudoiRequestEditor } from '@/components/tsudoi/TsudoiRequestEditor';
import { showErrorToast, showSuccessToast } from '@/lib/toasts';
import { useHangoutRequest } from '@/lib/queries/hangoutRequests';
import { useLanguage } from '@/hooks/useLanguage';
import { updateHangoutRequestDetails } from '@/lib/firebase/firestoreService';
import { HangoutRequestFormData } from '@/types/hangouts';

const copy = {
  ja: {
    title: 'リクエストを編集',
    updateFailed: 'リクエストの更新に失敗しました。',
  },
  en: {
    title: 'Edit request',
    updateFailed: 'Failed to update request.',
  },
} as const;

export default function TsudoiRequestEditPage() {
  const { user, loading: authLoading, ensurePublicSession } = useAuth();
  const { t, language } = useLanguage();
  const content = copy[language];
  const router = useRouter();
  const params = useParams();
  const requestId = params?.requestId as string | undefined;
  const requestQuery = useHangoutRequest(requestId);
  const [isSaving, setIsSaving] = useState(false);
  const [isBootstrappingPublicSession, setIsBootstrappingPublicSession] = useState(false);

  const request = requestQuery.data ?? null;
  const isCreator = !!user && !!request && user.uid === request.creatorUid;

  useEffect(() => {
    if (authLoading || user) return;
    setIsBootstrappingPublicSession(true);
    void ensurePublicSession().finally(() => setIsBootstrappingPublicSession(false));
  }, [authLoading, ensurePublicSession, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !request) return;
    if (user.uid !== request.creatorUid) {
      router.replace('/tsudoi');
    }
  }, [authLoading, request, router, user]);

  const initialData = useMemo<
    (Partial<HangoutRequestFormData> & { weekStartDate?: Date }) | undefined
  >(() => {
    if (!request) return undefined;
    return {
      requestName: request.requestName,
      desiredDurationMinutes: request.desiredDurationMinutes,
      desiredMarginMinutes: request.desiredMarginMinutes,
      desiredMemberCount: request.desiredMemberCount,
      dateRanges: request.dateRanges,
      timeRanges: request.timeRanges,
      candidateSlotMinutes: request.candidateSlotMinutes,
      candidateSlots: request.candidateSlots,
      recipientUids: request.recipientUids,
      weekStartDate: request.candidateSlots?.[0]?.start ?? request.dateRanges[0]?.start,
    };
  }, [request]);

  const handleSave = useCallback(
    async (formData: HangoutRequestFormData) => {
      if (!request || !user || !isCreator) {
        showErrorToast(t.replyPage.onlyCreator);
        return;
      }
      setIsSaving(true);
      try {
        await updateHangoutRequestDetails(request.id, {
          requestName: formData.requestName,
          desiredDurationMinutes: formData.desiredDurationMinutes,
          desiredMarginMinutes: formData.desiredMarginMinutes,
          desiredMemberCount: formData.desiredMemberCount,
          dateRanges: formData.dateRanges.map((dr) => ({
            start: Timestamp.fromDate(dr.start),
            end: Timestamp.fromDate(dr.end),
          })),
          timeRanges: formData.timeRanges,
          candidateSlotMinutes: formData.candidateSlotMinutes,
          candidateSlots: formData.candidateSlots?.map((slot) => ({
            start: Timestamp.fromDate(slot.start),
            end: Timestamp.fromDate(slot.end),
          })),
        });
        showSuccessToast(t.hangouts.requestUpdated);
        router.push('/tsudoi');
      } catch (error) {
        console.error('Failed to update Tsudoi request:', error);
        showErrorToast(`${content.updateFailed} ${(error as Error).message}`);
      } finally {
        setIsSaving(false);
      }
    },
    [
      content.updateFailed,
      isCreator,
      request,
      router,
      t.hangouts.requestUpdated,
      t.replyPage.onlyCreator,
      user,
    ],
  );

  if (authLoading || isBootstrappingPublicSession || requestQuery.isLoading) {
    return <div className="p-6 text-center text-gray-500">{t.hangouts.loadingRequests}</div>;
  }

  if (!request) {
    return <div className="p-6 text-center text-gray-500">{t.replyPage.requestNotFound}</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Tsudoi</p>
          <h1 className="text-3xl font-bold text-slate-900">{content.title}</h1>
        </div>
        <Link href="/tsudoi">
          <Button variant="outline">{t.replyPage.backToList}</Button>
        </Link>
      </div>

      <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-8">
        <HangoutDetailsCard request={request} />
      </div>

      {isCreator ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-8">
          <TsudoiRequestEditor
            mode="edit"
            initialData={initialData}
            isLoading={isSaving}
            onSave={handleSave}
            onCancel={() => router.push('/tsudoi')}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
          <p>{t.replyPage.onlyCreator}</p>
          <Link href="/tsudoi">
            <Button className="mt-4" variant="outline">
              {t.replyPage.backToList}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
