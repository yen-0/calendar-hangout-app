'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ShareLinkPanel } from '@/components/hangouts/ShareLinkPanel';
import { TsudoiRequestEditor } from '@/components/tsudoi/TsudoiRequestEditor';
import { showErrorToast, showSuccessToast } from '@/lib/toasts';
import { useCreateHangoutRequest } from '@/lib/queries/hangoutRequests';
import { fetchCalendarItems } from '@/lib/firebase/firestoreService';
import { prepareCreatorEventsForRequest } from '@/utils/hangoutUtils';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { HangoutRequestFormData } from '@/types/hangouts';

const copy = {
  ja: {
    eyebrow: '公開候補を作成',
    title: '候補日を並べて、リンクで共有する。',
    body:
      '週グリッドから候補を選んで公開すると、参加者はリンクから空き時間を入力できます。作成後はそのまま共有リンクをコピーできます。',
    back: '一覧に戻る',
    success: '調整を作成しました。',
    backToList: '一覧に戻る',
    createBack: '一覧へ戻る',
    signedOut: '候補を作成するにはサインインしてください。',
    createButton: '新しい調整を作成',
  },
  en: {
    eyebrow: 'Create public candidate times',
    title: 'Pick slots, publish a link, collect replies.',
    body:
      'Select candidate cells from the weekly grid and publish them. Participants can then reply from the shared link without an account.',
    back: 'Back to list',
    success: 'Request created successfully.',
    backToList: 'Back to list',
    createBack: 'Return to list',
    signedOut: 'Please sign in to create a request.',
    createButton: 'Create a new request',
  },
} as const;

export default function TsudoiRequestCreatePage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-slate-500">Loading...</div>}>
      <TsudoiRequestCreatePageInner />
    </Suspense>
  );
}

function TsudoiRequestCreatePageInner() {
  const { user, loading: authLoading, isPublicSession, ensurePublicSession } = useAuth();
  const { language } = useLanguage();
  const content = copy[language];
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
        showErrorToast(content.signedOut);
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
        const creatorName = isPublicSession ? 'Public organizer' : user.displayName || user.email || 'Anonymous User';
        const id = await createMutation.mutateAsync({
          creatorUid: user.uid,
          creatorName,
          formData,
          creatorEvents,
        });
        setCreatedRequestId(id);
        showSuccessToast(content.success);
      } catch (error) {
        console.error('Failed to create Tsudoi request:', error);
        showErrorToast(`Failed to create request. ${(error as Error).message}`);
      } finally {
        setIsSaving(false);
      }
    },
    [content.signedOut, content.success, createMutation, isPublicSession, user],
  );

  if (authLoading || isBootstrappingPublicSession || !user) {
    return <div className="p-6 text-center text-slate-500">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">{content.signedOut}</p>
        <Link href="/sign-in">
          <Button className="bg-slate-950 text-white hover:bg-slate-800">{content.createButton}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-900 p-6 text-white shadow-[0_24px_90px_-55px_rgba(15,23,42,0.8)] sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">{content.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{content.title}</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-200">{content.body}</p>
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            {language === 'ja'
              ? 'この画面で候補を確定すると、リンク共有と回答収集にすぐ進めます。'
              : 'Once you confirm the candidate set here, you can copy the share link and start collecting replies.'}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/tsudoi">
              <Button variant="outline" className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15">
                {content.back}
              </Button>
            </Link>
          </div>
        </aside>

        <section className="rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-[0_24px_90px_-55px_rgba(15,23,42,0.45)] sm:p-8">
          {createdRequestId ? (
            <div className="space-y-6">
              <ShareLinkPanel requestId={createdRequestId} />
              <div className="flex justify-end">
                <Link href="/tsudoi">
                  <Button className="rounded-full bg-slate-950 text-white hover:bg-slate-800">{content.createBack}</Button>
                </Link>
              </div>
            </div>
          ) : (
            <TsudoiRequestEditor
              mode="create"
              initialData={recipientUid ? { recipientUids: [recipientUid] } : undefined}
              isLoading={isSaving}
              onSave={handleSave}
              onCancel={() => router.push('/tsudoi')}
            />
          )}
        </section>
      </div>
    </div>
  );
}
