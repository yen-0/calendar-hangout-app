'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ShareLinkPanel } from '@/components/hangouts/ShareLinkPanel';
import { TsudoiRequestEditor } from '@/components/tsudoi/TsudoiRequestEditor';
import { showErrorToast, showSuccessToast } from '@/lib/toasts';
import { useCreateHangoutRequest } from '@/lib/queries/hangoutRequests';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HangoutRequestFormData } from '@/types/hangouts';

const ORGANIZER_NAME_STORAGE_KEY = 'tsudoi.publicOrganizerName';

const copy = {
  ja: {
    eyebrow: '候補を作成',
    title: '週グリッドから候補を選び、回答リンクを発行する。',
    body: '候補時間を選ぶと、参加者がアカウントなしで回答できる共有リンクを作成できます。',
    back: '一覧に戻る',
    success: '調整を作成しました。',
    createBack: '一覧へ戻る',
    signedOut: '候補を作成するにはサインインしてください。',
    createButton: 'サインイン',
    organizerName: '主催者名',
    organizerNameHelp: '回答ページの「作成者」として表示されます。',
    organizerNamePlaceholder: '例: ゆき',
    organizerNameRequired: '主催者名を入力してください。',
    note: '候補を保存すると、共有リンクのコピー画面に進みます。回答が集まったら一覧から確定できます。',
  },
  en: {
    eyebrow: 'Create candidate times',
    title: 'Pick slots from the weekly grid and publish a reply link.',
    body: 'Select candidate cells, save the request, and share a public link so participants can reply without an account.',
    back: 'Back to list',
    success: 'Request created successfully.',
    createBack: 'Return to list',
    signedOut: 'Please sign in to create a request.',
    createButton: 'Sign in',
    organizerName: 'Organizer name',
    organizerNameHelp: 'Shown as the creator on the reply page.',
    organizerNamePlaceholder: 'Example: Yuki',
    organizerNameRequired: 'Please enter your organizer name.',
    note: 'After saving the candidate set, you will get a share link. Once replies come in, confirm the final time from the request list.',
  },
} as const;

export default function TsudoiRequestCreatePage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-stone-500">Loading...</div>}>
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
  const [organizerName, setOrganizerName] = useState('');

  useEffect(() => {
    if (authLoading || user) return;
    setIsBootstrappingPublicSession(true);
    void ensurePublicSession().finally(() => setIsBootstrappingPublicSession(false));
  }, [authLoading, ensurePublicSession, user]);

  useEffect(() => {
    if (!isPublicSession) return;
    setOrganizerName(window.localStorage.getItem(ORGANIZER_NAME_STORAGE_KEY) ?? '');
  }, [isPublicSession]);

  const handleSave = useCallback(
    async (formData: HangoutRequestFormData) => {
      if (!user) {
        showErrorToast(content.signedOut);
        return;
      }

      const trimmedOrganizerName = organizerName.trim();
      if (isPublicSession && !trimmedOrganizerName) {
        showErrorToast(content.organizerNameRequired);
        return;
      }

      setIsSaving(true);
      try {
        const creatorName = isPublicSession
          ? trimmedOrganizerName
          : user.displayName || user.email || 'Anonymous User';

        if (isPublicSession) {
          window.localStorage.setItem(ORGANIZER_NAME_STORAGE_KEY, trimmedOrganizerName);
        }

        const id = await createMutation.mutateAsync({
          creatorUid: user.uid,
          creatorName,
          formData,
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
    [
      content.organizerNameRequired,
      content.signedOut,
      content.success,
      createMutation,
      isPublicSession,
      organizerName,
      user,
    ],
  );

  if (authLoading || isBootstrappingPublicSession || !user) {
    return <div className="p-6 text-center text-stone-500">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">{content.signedOut}</p>
        <Link href="/sign-in">
          <Button>{content.createButton}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="page-frame">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="panel-muted">
          <p className="eyebrow">{content.eyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
            {content.title}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-stone-700">{content.body}</p>

          {isPublicSession && !createdRequestId && (
            <div className="mt-6 border border-stone-300 bg-white p-4">
              <Label htmlFor="organizerName">{content.organizerName}</Label>
              <Input
                id="organizerName"
                className="mt-2 bg-white"
                value={organizerName}
                onChange={(event) => setOrganizerName(event.target.value)}
                placeholder={content.organizerNamePlaceholder}
                required
              />
              <p className="mt-2 text-xs leading-5 text-stone-600">{content.organizerNameHelp}</p>
            </div>
          )}

          <div className="mt-6 border-l-4 border-amber-500 bg-white p-4 text-sm leading-6 text-stone-700">
            {content.note}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/tsudoi">
              <Button variant="outline">{content.back}</Button>
            </Link>
          </div>
        </aside>

        <section className="work-surface p-5 sm:p-8">
          {createdRequestId ? (
            <div className="space-y-6">
              <ShareLinkPanel requestId={createdRequestId} />
              <div className="flex justify-end">
                <Link href="/tsudoi">
                  <Button>{content.createBack}</Button>
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
