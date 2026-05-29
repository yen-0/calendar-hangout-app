'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { Timestamp, collection, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { HangoutDetailsCard } from '@/components/hangouts/HangoutDetailsCard';
import { ConfirmedSlotBanner } from '@/components/hangouts/ConfirmedSlotBanner';
import { CommonSlotsModal } from '@/components/hangouts/CommonSlotsModal';
import { PublicAvailabilityForm } from '@/components/hangouts/PublicAvailabilityForm';
import { useLanguage } from '@/hooks/useLanguage';
import {
  CommonSlotClient,
  HangoutRequestClientState,
  ParticipantDataClient,
  ParticipantEventClient,
} from '@/types/hangouts';
import {
  addCalendarItem,
  addParticipantToHangoutRequest,
  fetchCalendarItems,
  fetchHangoutRequestById,
} from '@/lib/firebase/firestoreService';
import { findCommonAvailability, prepareCreatorEventsForRequest } from '@/utils/hangoutUtils';
import { showErrorToast, showInfoToast, showSuccessToast } from '@/lib/toasts';
import { db } from '@/lib/firebase/config';
import { CalendarEvent } from '@/types/events';
import { writeHangoutToCalendars } from '@/lib/google/write-hangout-client';

export default function ReplyToHangoutRequestPage() {
  const { user, loading: authLoading, ensurePublicSession, isGuest, isPublicSession } = useAuth();
  const { t } = useLanguage();
  const params = useParams();
  const requestId = params?.requestId as string | undefined;

  const [request, setRequest] = useState<HangoutRequestClientState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSubmittingAvailability, setIsSubmittingAvailability] = useState(false);
  const [hasUserAlreadySubmitted, setHasUserAlreadySubmitted] = useState(false);
  const [isCalculatingSlots, setIsCalculatingSlots] = useState(false);
  const [commonSlots, setCommonSlots] = useState<CommonSlotClient[]>([]);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedFinalSlotIndex, setSelectedFinalSlotIndex] = useState<number | null>(null);
  const [isConfirmingSlot, setIsConfirmingSlot] = useState(false);
  const [slotToConfirm, setSlotToConfirm] = useState<CommonSlotClient | null>(null);

  const currentParticipant = useMemo(
    () => (user && request ? request.participants?.[user.uid] ?? null : null),
    [request, user],
  );
  const currentParticipantEvents = currentParticipant?.events;

  useEffect(() => {
    if (authLoading || user || isGuest) return;
    void ensurePublicSession().catch((error) => {
      console.error('Failed to start public session:', error);
      setPageError(t.replyPage.publicSessionFailed);
      setIsLoading(false);
    });
  }, [authLoading, ensurePublicSession, isGuest, t.replyPage.publicSessionFailed, user]);

  const loadRequest = useCallback(async () => {
    if (!requestId) {
      setPageError(t.replyPage.requestIdMissing);
      setIsLoading(false);
      return;
    }
    if (authLoading || (!user && !isGuest)) return;
    if (isGuest) {
      setPageError(t.replyPage.publicSessionRequired);
      setIsLoading(false);
      return;
    }
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
      } else {
        setHasUserAlreadySubmitted(false);
      }
      if (fetched.status === 'results_ready' && fetched.commonAvailabilitySlots) {
        setCommonSlots(fetched.commonAvailabilitySlots);
      } else {
        setCommonSlots([]);
      }
    } catch (err) {
      console.error('Failed to load hangout request:', err);
      setPageError(t.replyPage.couldNotLoadDetails);
      showErrorToast(t.replyPage.failedToLoadDetails);
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, isGuest, requestId, t, user]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  const syncLocalParticipant = useCallback(
    (participant: ParticipantDataClient) => {
      setHasUserAlreadySubmitted(true);
      setRequest((prev) => {
        if (!prev) return null;
        const updatedParticipants = { ...prev.participants, [participant.uid]: participant };
        const newStatus =
          prev.status === 'pending' &&
          Object.keys(updatedParticipants).length >= prev.desiredMemberCount
            ? 'pending_calculation'
            : prev.status;
        return { ...prev, participants: updatedParticipants, status: newStatus };
      });
    },
    [],
  );

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
  }, [isPublicSession, request, syncLocalParticipant, t, user]);

  const handleSubmitPublicAvailability = useCallback(
    async (payload: { displayName: string; events: ParticipantEventClient[] }) => {
      if (!user || !request || !isPublicSession) {
        showErrorToast(t.replyPage.notLoggedInOrNotLoaded);
        return;
      }
      setIsSubmittingAvailability(true);
      setPageError(null);
      try {
        const newParticipant: ParticipantDataClient = {
          uid: user.uid,
          displayName: payload.displayName,
          submittedAt: new Date(),
          events: payload.events,
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
    },
    [isPublicSession, request, syncLocalParticipant, t, user],
  );

  const handleCalculateCommonTimes = useCallback(async () => {
    if (!request) {
      showErrorToast(t.replyPage.requestDataNotLoaded);
      return;
    }
    const submittedCount = Object.keys(request.participants || {}).length;
    if (submittedCount === 0) {
      showInfoToast(t.replyPage.noParticipantsYet);
      return;
    }
    if (submittedCount < request.desiredMemberCount) {
      showInfoToast(t.replyPage.waitingForParticipants(request.desiredMemberCount, submittedCount));
    }
    setIsCalculatingSlots(true);
    setCommonSlots([]);
    await new Promise((r) => setTimeout(r, 50));
    try {
      const slots = findCommonAvailability(request, 15);
      setCommonSlots(slots);
      const newStatus = slots.length > 0 ? 'results_ready' : 'no_slots_found';
      const requestDocRef = doc(db, 'hangoutRequests', request.id);
      await updateDoc(requestDocRef, {
        commonAvailabilitySlots: slots.map((s) => ({
          start: Timestamp.fromDate(s.start),
          end: Timestamp.fromDate(s.end),
          availableParticipants: s.availableParticipants,
        })),
        status: newStatus,
      });
      showSuccessToast(
        slots.length > 0 ? t.replyPage.foundCommonSlots(slots.length) : t.replyPage.noCommonSlots,
      );
      setRequest((prev) =>
        prev ? { ...prev, status: newStatus, commonAvailabilitySlots: slots } : null,
      );
      if (slots.length > 0) setIsResultsModalOpen(true);
    } catch (err) {
      console.error('Error calculating common times:', err);
      showErrorToast(t.replyPage.calculateFailed);
    } finally {
      setIsCalculatingSlots(false);
    }
  }, [request, t]);

  const handleInitiateConfirm = useCallback(() => {
    if (!request || selectedFinalSlotIndex === null || !commonSlots[selectedFinalSlotIndex]) {
      showErrorToast(t.replyPage.invalidSlot);
      return;
    }
    if (!user || user.uid !== request.creatorUid) {
      showErrorToast(t.replyPage.onlyCreator);
      return;
    }
    setSlotToConfirm(commonSlots[selectedFinalSlotIndex]);
  }, [commonSlots, request, selectedFinalSlotIndex, t, user]);

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
          const written = results.filter((r) => r.status === 'written' || r.status === 'updated').length;
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

  const canSubmit =
    user && !isPublicSession && !hasUserAlreadySubmitted && request.status !== 'confirmed' && request.status !== 'closed';
  const canResubmit =
    user && !isPublicSession && hasUserAlreadySubmitted && request.status !== 'confirmed' && request.status !== 'closed';
  const participantCount = Object.keys(request.participants || {}).length;
  const isCreator = !!user && user.uid === request.creatorUid;
  const showSlotsActions = request.status !== 'confirmed' && request.status !== 'closed';
  const submitLabel = hasUserAlreadySubmitted ? t.replyPage.updateAvailability : t.replyPage.submitAvailability;

  return (
    <div className="mx-auto my-6 max-w-3xl rounded-2xl bg-white p-4 shadow-xl md:p-8">
      <HangoutDetailsCard request={request} />

      {request.status === 'confirmed' && request.finalSelectedSlot && (
        <ConfirmedSlotBanner slot={request.finalSelectedSlot} />
      )}

      {isPublicSession && (
        <div className="mb-8 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide">{t.replyPage.publicFlowTitle}</p>
          <p className="mt-1 text-sm">{t.replyPage.publicFlowBody}</p>
        </div>
      )}

      {user && !isPublicSession && request.status !== 'confirmed' && request.status !== 'closed' && (
        <section className="mb-8 rounded-lg bg-slate-50 p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-700">{t.replyPage.yourParticipation}</h2>
          {canSubmit && (
            <Button
              variant="solid"
              className="mb-2 w-full bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleSubmitAvailability}
              isLoading={isSubmittingAvailability}
              disabled={isSubmittingAvailability}
            >
              {t.replyPage.submitAvailability}
            </Button>
          )}
          {canResubmit && (
            <Button
              variant="outline"
              className="mb-2 w-full"
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
        <section className="mb-8">
          <PublicAvailabilityForm
            initialName={currentParticipant?.displayName ?? ''}
            initialEvents={currentParticipantEvents}
            isLoading={isSubmittingAvailability}
            submitLabel={submitLabel}
            onSubmit={handleSubmitPublicAvailability}
          />
        </section>
      )}

      {!user && !isPublicSession && (
        <div className="mb-8 rounded-lg bg-yellow-50 p-6 text-center text-yellow-700">
          <p className="mb-2 text-lg font-semibold">{t.replyPage.publicSessionRequired}</p>
          <p>{t.replyPage.publicSessionRequiredBody}</p>
        </div>
      )}

      {showSlotsActions && (
        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold text-slate-700">{t.replyPage.findCommonSlots}</h2>
          {(request.status === 'results_ready' || request.status === 'no_slots_found') &&
            commonSlots.length > 0 && (
              <Button
                onClick={() => setIsResultsModalOpen(true)}
                variant="solid"
                className="mb-4 w-full bg-green-600 py-3 text-lg text-white hover:bg-green-700"
              >
                {t.replyPage.viewCalculatedSlots}
              </Button>
            )}
          {(request.status === 'results_ready' || request.status === 'no_slots_found') &&
            commonSlots.length === 0 && (
              <p className="rounded-md bg-slate-50 px-6 py-4 text-center text-slate-500">
                {t.replyPage.noSlotsBasedOnLatest}
              </p>
            )}
          {user &&
            (request.status === 'pending_calculation' ||
              request.status === 'pending' ||
              request.status === 'results_ready' ||
              request.status === 'no_slots_found') && (
              <Button
                variant="outline"
                size="default"
                className="w-full border-slate-300 hover:bg-slate-100"
                onClick={handleCalculateCommonTimes}
                isLoading={isCalculatingSlots}
                disabled={isCalculatingSlots}
              >
                {isCalculatingSlots
                  ? t.replyPage.calculating
                  : request.status === 'results_ready' || request.status === 'no_slots_found'
                    ? t.replyPage.recalculateCommonTimes
                    : t.replyPage.calculateNow}
              </Button>
            )}
          {request.status === 'pending' && participantCount < request.desiredMemberCount && (
            <p className="mt-3 text-center text-sm text-slate-500">
              {t.replyPage.waitingForMoreParticipants(
                request.desiredMemberCount - participantCount,
              )}
            </p>
          )}
        </section>
      )}

      <footer className="mt-12 text-center">
        <Link href="/hangouts">
          <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-100">
            {t.replyPage.backToList}
          </Button>
        </Link>
      </footer>

      {showSlotsActions && (
        <CommonSlotsModal
          isOpen={isResultsModalOpen}
          onClose={() => {
            setIsResultsModalOpen(false);
            setSelectedFinalSlotIndex(null);
          }}
          request={request}
          slots={commonSlots}
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
