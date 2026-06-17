'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { Timestamp, collection, doc, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { HangoutDetailsCard } from '@/components/hangouts/HangoutDetailsCard';
import { ConfirmedSlotBanner } from '@/components/hangouts/ConfirmedSlotBanner';
import { CommonSlotsModal } from '@/components/hangouts/CommonSlotsModal';
import { TsudoiResponseGrid } from '@/components/tsudoi/TsudoiResponseGrid';
import { TsudoiLiveResultsGrid } from '@/components/tsudoi/TsudoiLiveResultsGrid';
import { TsudoiWeeklyResponseGrid } from '@/components/tsudoi/TsudoiWeeklyResponseGrid';
import { useLanguage } from '@/hooks/useLanguage';
import {
  CommonSlotClient,
  HangoutRequestClientState,
  ParticipantDataClient,
  SlotResponseStatus,
} from '@/types/hangouts';
import {
  addCalendarItem,
  addParticipantToHangoutRequest,
  fetchCalendarItems,
  fetchHangoutRequestById,
} from '@/lib/firebase/firestoreService';
import {
  deriveSlotResponsesFromEvents,
  findCommonAvailability,
  prepareCreatorEventsForRequest,
} from '@/utils/hangoutUtils';
import { showErrorToast, showInfoToast, showSuccessToast } from '@/lib/toasts';
import { db } from '@/lib/firebase/config';
import { CalendarEvent } from '@/types/events';
import { writeHangoutToCalendars } from '@/lib/google/write-hangout-client';

const responseViewCopy = {
  ja: {
    weeklyGridTitle: '\u9031\u30b0\u30ea\u30c3\u30c9',
    weeklyGridBody:
      '\u9031\u306e\u5019\u88dc\u3092\u898b\u306a\u304c\u3089\u3001\u6642\u9593\u5e2f\u3054\u3068\u306b\u56de\u7b54\u3067\u304d\u307e\u3059\u3002',
    listViewTitle: '\u30ea\u30b9\u30c8\u30d3\u30e5\u30fc',
    listViewBody:
      '\u5019\u88dc\u3092\u65e5\u4ed8\u9806\u306e\u4e00\u89a7\u3067\u78ba\u8a8d\u3057\u3066\u30011\u4ef6\u305a\u3064\u56de\u7b54\u3067\u304d\u307e\u3059\u3002',
  },
  en: {
    weeklyGridTitle: 'Weekly grid',
    weeklyGridBody: 'Review the candidate week and answer by time block.',
    listViewTitle: 'List view',
    listViewBody: 'Review candidates as a chronological list and answer one by one.',
  },
} as const;

interface ResponseViewsProps {
  candidateSlots: NonNullable<HangoutRequestClientState['candidateSlots']>;
  responses: Record<string, SlotResponseStatus>;
  isLoading: boolean;
  onChange: (responses: Record<string, SlotResponseStatus>) => void;
  language: 'ja' | 'en';
}

function TsudoiResponseViews({
  candidateSlots,
  responses,
  isLoading,
  onChange,
  language,
}: ResponseViewsProps) {
  const content = responseViewCopy[language];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{content.weeklyGridTitle}</h3>
            <p className="text-sm text-slate-500">{content.weeklyGridBody}</p>
          </div>
        </div>
        <TsudoiWeeklyResponseGrid
          candidateSlots={candidateSlots}
          responses={responses}
          isLoading={isLoading}
          onChange={onChange}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{content.listViewTitle}</h3>
            <p className="text-sm text-slate-500">{content.listViewBody}</p>
          </div>
        </div>
        <TsudoiResponseGrid
          candidateSlots={candidateSlots}
          responses={responses}
          isLoading={isLoading}
          onChange={onChange}
        />
      </section>
    </div>
  );
}

export default function ReplyToHangoutRequestPage() {
  const { user, loading: authLoading, ensurePublicSession, isPublicSession } = useAuth();
  const { t, language } = useLanguage();
  const params = useParams();
  const requestId = params?.requestId as string | undefined;

  const [request, setRequest] = useState<HangoutRequestClientState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSubmittingAvailability, setIsSubmittingAvailability] = useState(false);
  const [hasUserAlreadySubmitted, setHasUserAlreadySubmitted] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedFinalSlotIndex, setSelectedFinalSlotIndex] = useState<number | null>(null);
  const [isConfirmingSlot, setIsConfirmingSlot] = useState(false);
  const [slotToConfirm, setSlotToConfirm] = useState<CommonSlotClient | null>(null);
  const [slotResponses, setSlotResponses] = useState<Record<string, SlotResponseStatus>>({});
  const [publicDisplayName, setPublicDisplayName] = useState('');

  const currentParticipant = useMemo(
    () => (user && request ? (request.participants?.[user.uid] ?? null) : null),
    [request, user],
  );

  const liveCommonSlots = useMemo(
    () => (request ? findCommonAvailability(request, 15) : []),
    [request],
  );

  useEffect(() => {
    if (authLoading || user) return;
    void ensurePublicSession().catch((error) => {
      console.error('Failed to start public session:', error);
      setPageError(t.replyPage.publicSessionFailed);
      setIsLoading(false);
    });
  }, [authLoading, ensurePublicSession, t.replyPage.publicSessionFailed, user]);

  const loadRequest = useCallback(async () => {
    if (!requestId) {
      setPageError(t.replyPage.requestIdMissing);
      setIsLoading(false);
      return;
    }
    if (authLoading || !user) return;
    setIsLoading(true);
    setPageError(null);
    try {
      const fetched = await fetchHangoutRequestById(requestId);
      if (!fetched) {
        setPageError(t.replyPage.requestNotFound);
        return;
      }
      setRequest(fetched);
      if (user && fetched.participants && fetched.participants[user.uid]) {
        setHasUserAlreadySubmitted(true);
        setSlotResponses(fetched.participants[user.uid].slotResponses ?? {});
        setPublicDisplayName(fetched.participants[user.uid].displayName ?? '');
      } else {
        setHasUserAlreadySubmitted(false);
      }
    } catch (err) {
      console.error('Failed to load hangout request:', err);
      setPageError(t.replyPage.couldNotLoadDetails);
      showErrorToast(t.replyPage.failedToLoadDetails);
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, requestId, t, user]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  useEffect(() => {
    if (!request?.candidateSlots?.length || !user || currentParticipant?.slotResponses) return;
    if (isPublicSession) {
      setSlotResponses(
        Object.fromEntries(
          request.candidateSlots.map((slot) => [
            `${slot.start.toISOString()}_${slot.end.toISOString()}`,
            'yes',
          ]),
        ),
      );
      return;
    }

    let alive = true;
    void fetchCalendarItems(user.uid)
      .then((userEvents) => {
        if (!alive || !request?.candidateSlots?.length) return;
        const participantEvents = prepareCreatorEventsForRequest(
          userEvents,
          request.dateRanges,
          request.timeRanges,
          request.candidateSlots,
        );
        setSlotResponses(deriveSlotResponsesFromEvents(request.candidateSlots, participantEvents));
      })
      .catch((err) => {
        console.error('Failed to prefill Tsudoi responses:', err);
      });

    return () => {
      alive = false;
    };
  }, [currentParticipant?.slotResponses, isPublicSession, request, user]);

  const syncLocalParticipant = useCallback((participant: ParticipantDataClient) => {
    setHasUserAlreadySubmitted(true);
    setRequest((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        participants: { ...prev.participants, [participant.uid]: participant },
      };
    });
  }, []);

  const handleSubmitAvailability = useCallback(async () => {
    if (!user || !request || isPublicSession) {
      showErrorToast(t.replyPage.notLoggedInOrNotLoaded);
      return;
    }
    setIsSubmittingAvailability(true);
    setPageError(null);
    try {
      const userEvents = await fetchCalendarItems(user.uid);
      const participantEvents = prepareCreatorEventsForRequest(
        userEvents,
        request.dateRanges,
        request.timeRanges,
      );
      const newParticipant: ParticipantDataClient = {
        uid: user.uid,
        displayName: user.displayName || user.email || 'A Participant',
        submittedAt: new Date(),
        events: participantEvents,
        slotResponses:
          request.candidateSlots && request.candidateSlots.length > 0 ? slotResponses : undefined,
      };
      await addParticipantToHangoutRequest(request.id, user.uid, newParticipant);
      showSuccessToast(t.replyPage.availabilitySubmitted);
      syncLocalParticipant(newParticipant);
    } catch (err) {
      console.error('Error submitting availability:', err);
      setPageError(`${t.replyPage.failedToSubmitAvailability} ${(err as Error).message}`);
      showErrorToast(t.replyPage.failedToSubmitAvailability);
    } finally {
      setIsSubmittingAvailability(false);
    }
  }, [isPublicSession, request, slotResponses, syncLocalParticipant, t, user]);

  const handleSubmitPublicResponses = useCallback(async () => {
    if (!user || !request || !isPublicSession) {
      showErrorToast(t.replyPage.notLoggedInOrNotLoaded);
      return;
    }
    if (!publicDisplayName.trim()) {
      showErrorToast(t.replyPage.displayNameRequired);
      return;
    }
    setIsSubmittingAvailability(true);
    setPageError(null);
    try {
      const newParticipant: ParticipantDataClient = {
        uid: user.uid,
        displayName: publicDisplayName.trim(),
        submittedAt: new Date(),
        events: [],
        slotResponses,
      };
      await addParticipantToHangoutRequest(request.id, user.uid, newParticipant);
      showSuccessToast(t.replyPage.availabilitySubmitted);
      syncLocalParticipant(newParticipant);
    } catch (err) {
      console.error('Error submitting public availability:', err);
      setPageError(`${t.replyPage.failedToSubmitAvailability} ${(err as Error).message}`);
      showErrorToast(t.replyPage.failedToSubmitAvailability);
    } finally {
      setIsSubmittingAvailability(false);
    }
  }, [isPublicSession, publicDisplayName, request, slotResponses, syncLocalParticipant, t, user]);

  const handleInitiateConfirm = useCallback(() => {
    if (!request || selectedFinalSlotIndex === null || !liveCommonSlots[selectedFinalSlotIndex]) {
      showErrorToast(t.replyPage.invalidSlot);
      return;
    }
    if (!user || user.uid !== request.creatorUid) {
      showErrorToast(t.replyPage.onlyCreator);
      return;
    }
    setSlotToConfirm(liveCommonSlots[selectedFinalSlotIndex]);
  }, [liveCommonSlots, request, selectedFinalSlotIndex, t, user]);

  const handleConfirmAndInvite = useCallback(async () => {
    if (!request || !slotToConfirm || !user) {
      showErrorToast(t.replyPage.missingConfirmData);
      return;
    }
    if (user.uid !== request.creatorUid) {
      showErrorToast(t.replyPage.onlyCreator);
      return;
    }
    setSlotToConfirm(null);
    setIsConfirmingSlot(true);
    const { start: slotStart, end: slotEnd, availableParticipants } = slotToConfirm;
    try {
      const batch = writeBatch(db);
      const requestDocRef = doc(db, 'hangoutRequests', request.id);
      batch.update(requestDocRef, {
        finalSelectedSlot: {
          start: Timestamp.fromDate(slotStart),
          end: Timestamp.fromDate(slotEnd),
        },
        status: 'confirmed',
      });

      const startTs = Timestamp.fromDate(slotStart);
      const endTs = Timestamp.fromDate(slotEnd);

      for (const participantUid of availableParticipants ?? []) {
        if (participantUid === user.uid && participantUid === request.creatorUid) {
          try {
            const creatorEvent: Omit<CalendarEvent, 'id'> = {
              title: `Hangout: ${request.requestName}`,
              start: slotStart,
              end: slotEnd,
              allDay: false,
              color: '#4CAF50',
            };
            await addCalendarItem(user.uid, creatorEvent);
            showInfoToast(t.replyPage.eventAddedToCalendar);
          } catch (err) {
            console.error("Failed to add confirmed event to creator's calendar:", err);
            showErrorToast(t.replyPage.couldNotAddToOwnCalendar);
          }
          continue;
        }
        const notifRef = doc(collection(db, `userNotifications/${participantUid}/notifications`));
        const message = `${request.creatorName} has confirmed "${request.requestName}" for ${format(slotStart, 'MMM d, yyyy')} from ${format(slotStart, 'hh:mm a')} to ${format(slotEnd, 'hh:mm a')}.`;
        batch.set(notifRef, {
          type: 'hangout_invitation',
          hangoutRequestId: request.id,
          hangoutRequestName: request.requestName,
          confirmedSlotStart: startTs,
          confirmedSlotEnd: endTs,
          creatorName: request.creatorName,
          isRead: false,
          createdAt: Timestamp.now(),
          message,
          participantUid,
        });
      }
      await batch.commit();
      showSuccessToast(t.replyPage.slotConfirmed(format(slotStart, 'MMM d, hh:mm a')));
      setRequest((prev) =>
        prev
          ? { ...prev, status: 'confirmed', finalSelectedSlot: { start: slotStart, end: slotEnd } }
          : null,
      );
      setIsResultsModalOpen(false);
      setSelectedFinalSlotIndex(null);

      if (user && !isPublicSession) {
        try {
          const results = await writeHangoutToCalendars({
            hangoutRequestId: request.id,
            title: `Hangout: ${request.requestName}`,
            startISO: slotStart.toISOString(),
            endISO: slotEnd.toISOString(),
            participantUids: availableParticipants ?? [],
          });
          const written = results.filter(
            (r) => r.status === 'written' || r.status === 'updated',
          ).length;
          const skipped = results.filter((r) => r.status === 'skipped_not_connected').length;
          const errored = results.filter((r) => r.status === 'error').length;
          if (written > 0) {
            showInfoToast(t.replyPage.wroteEventToCalendars(written, skipped, errored));
          } else if (skipped > 0 && errored === 0) {
            showInfoToast(t.replyPage.noParticipantsConnected);
          } else if (errored > 0) {
            showErrorToast(t.replyPage.writeFailed(errored));
          }
        } catch (err) {
          console.error('GCal write-back failed:', err);
          showErrorToast(t.replyPage.couldNotPushCalendars);
        }
      } else {
        showInfoToast(t.replyPage.publicWriteBackSkipped);
      }
    } catch (err) {
      console.error('Error confirming final slot:', err);
      showErrorToast(t.replyPage.confirmFailed);
    } finally {
      setIsConfirmingSlot(false);
    }
  }, [isPublicSession, request, slotToConfirm, t, user]);

  if (authLoading || isLoading) {
    return <div className="p-6 text-center text-gray-500">{t.replyPage.loading}</div>;
  }
  if (pageError) {
    return (
      <div className="p-6 text-center text-red-600">
        <p className="text-lg font-semibold">{t.replyPage.error}</p>
        <p>{pageError}</p>
      </div>
    );
  }
  if (!request) {
    return <div className="p-6 text-center text-gray-500">{t.replyPage.notFound}</div>;
  }

  const participantCount = Object.keys(request.participants || {}).length;
  const isCreator = !!user && user.uid === request.creatorUid;
  const canManageResults = request.status !== 'confirmed' && request.status !== 'closed';
  const submitLabel = hasUserAlreadySubmitted
    ? t.replyPage.updateAvailability
    : t.replyPage.submitAvailability;
  const hasCandidateGrid = !!request.candidateSlots?.length;

  return (
    <div className="mx-auto my-6 max-w-3xl rounded-2xl bg-white p-4 shadow-xl md:p-8">
      <HangoutDetailsCard request={request} />

      {request.status === 'confirmed' && request.finalSelectedSlot && (
        <ConfirmedSlotBanner slot={request.finalSelectedSlot} />
      )}

      {isPublicSession && (
        <div className="mb-8 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide">
            {t.replyPage.publicFlowTitle}
          </p>
          <p className="mt-1 text-sm">{t.replyPage.publicFlowBody}</p>
        </div>
      )}

      {user &&
        !isPublicSession &&
        request.status !== 'confirmed' &&
        request.status !== 'closed' && (
          <section className="mb-8 rounded-lg bg-slate-50 p-6">
            <h2 className="mb-2 text-xl font-semibold text-slate-700">
              {t.replyPage.yourParticipation}
            </h2>
            {hasCandidateGrid && (
              <div className="mb-4">
                <p className="mb-4 text-sm text-slate-500">
                  Mark each slot with circle, triangle, or cross. Calendar conflicts are prefilled,
                  but you can change every answer.
                </p>
                <TsudoiResponseViews
                  candidateSlots={request.candidateSlots ?? []}
                  responses={slotResponses}
                  isLoading={isSubmittingAvailability}
                  onChange={setSlotResponses}
                  language={language === 'ja' ? 'ja' : 'en'}
                />
              </div>
            )}
            {!hasUserAlreadySubmitted && (
              <Button
                variant="solid"
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleSubmitAvailability}
                isLoading={isSubmittingAvailability}
                disabled={isSubmittingAvailability}
              >
                {t.replyPage.submitAvailability}
              </Button>
            )}
            {hasUserAlreadySubmitted && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSubmitAvailability}
                isLoading={isSubmittingAvailability}
                disabled={isSubmittingAvailability}
              >
                {t.replyPage.updateAvailability}
              </Button>
            )}
          </section>
        )}

      {isPublicSession && (
        <section className="mb-8 rounded-lg bg-slate-50 p-6">
          <h2 className="mb-2 text-xl font-semibold text-slate-700">
            {t.replyPage.yourParticipation}
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Enter your name and mark each candidate with circle, triangle, or cross.
          </p>
          <div className="mb-4 space-y-2">
            <Label htmlFor="publicDisplayName">{t.replyPage.displayNameLabel}</Label>
            <Input
              id="publicDisplayName"
              value={publicDisplayName}
              onChange={(event) => setPublicDisplayName(event.target.value)}
              placeholder={t.replyPage.displayNamePlaceholder}
            />
          </div>
          <div className="mb-4">
            <p className="mb-4 text-sm text-slate-500">
              Press a candidate cell to cycle through circle, triangle, and cross.
            </p>
            <TsudoiResponseViews
              candidateSlots={request.candidateSlots ?? []}
              responses={slotResponses}
              isLoading={isSubmittingAvailability}
              onChange={setSlotResponses}
              language={language === 'ja' ? 'ja' : 'en'}
            />
          </div>
          <Button
            className="mt-4 w-full bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleSubmitPublicResponses}
            isLoading={isSubmittingAvailability}
            disabled={isSubmittingAvailability}
          >
            {submitLabel}
          </Button>
        </section>
      )}

      {!user && !isPublicSession && (
        <div className="mb-8 rounded-lg bg-yellow-50 p-6 text-center text-yellow-700">
          <p className="mb-2 text-lg font-semibold">{t.replyPage.publicSessionRequired}</p>
          <p>{t.replyPage.publicSessionRequiredBody}</p>
        </div>
      )}

      <section className="mb-8 rounded-lg bg-slate-50 p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-700">{t.replyPage.findCommonSlots}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Results update automatically as participants submit their availability.
            </p>
          </div>
          {canManageResults && liveCommonSlots.length > 0 && (
            <Button
              onClick={() => setIsResultsModalOpen(true)}
              variant="solid"
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {t.replyPage.viewCalculatedSlots}
            </Button>
          )}
        </div>

        {hasCandidateGrid ? (
          <div className="space-y-4">
            <TsudoiLiveResultsGrid
              candidateSlots={request.candidateSlots ?? []}
              commonSlots={liveCommonSlots}
              participants={request.participants ?? {}}
              canSelect={canManageResults}
              onSelectCommonSlot={(index) => {
                setSelectedFinalSlotIndex(index);
                setIsResultsModalOpen(true);
              }}
            />
            {liveCommonSlots.length === 0 && (
              <p className="rounded-md bg-white px-6 py-4 text-center text-slate-500">
                {t.replyPage.noSlotsBasedOnLatest}
              </p>
            )}
            {canManageResults && liveCommonSlots.length > 0 && (
              <Button
                onClick={() => setIsResultsModalOpen(true)}
                variant="outline"
                className="w-full border-slate-300 hover:bg-slate-100"
              >
                Review and confirm a slot
              </Button>
            )}
          </div>
        ) : (
          <p className="rounded-md bg-white px-6 py-4 text-center text-slate-500">
            No candidate slots are available for this Tsudoi.
          </p>
        )}

        {request.desiredMemberCount > 0 &&
          participantCount < request.desiredMemberCount &&
          request.status !== 'confirmed' &&
          request.status !== 'closed' && (
            <p className="mt-4 text-center text-sm text-slate-500">
              {t.replyPage.waitingForMoreParticipants(
                request.desiredMemberCount - participantCount,
              )}
            </p>
          )}
      </section>

      <footer className="mt-12 text-center">
        <Link href="/tsudoi">
          <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-100">
            {t.replyPage.backToList}
          </Button>
        </Link>
      </footer>

      {canManageResults && (
        <CommonSlotsModal
          isOpen={isResultsModalOpen}
          onClose={() => {
            setIsResultsModalOpen(false);
            setSelectedFinalSlotIndex(null);
          }}
          request={request}
          slots={liveCommonSlots}
          participants={request.participants ?? {}}
          selectedIndex={selectedFinalSlotIndex}
          setSelectedIndex={setSelectedFinalSlotIndex}
          isCreator={isCreator}
          isConfirming={isConfirmingSlot}
          onConfirm={handleInitiateConfirm}
        />
      )}

      {slotToConfirm && (
        <ConfirmationModal
          isOpen={!!slotToConfirm}
          onClose={() => setSlotToConfirm(null)}
          onConfirm={handleConfirmAndInvite}
          title={t.replyPage.confirmTitle}
          message={t.replyPage.confirmMessage}
          confirmText={t.replyPage.confirmYes}
          cancelText={t.replyPage.confirmCancel}
          isLoading={isConfirmingSlot}
        />
      )}
    </div>
  );
}
