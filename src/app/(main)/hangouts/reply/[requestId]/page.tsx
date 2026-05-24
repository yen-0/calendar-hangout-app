'use client';

import { useCallback, useEffect, useState } from 'react';
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
import {
  CommonSlotClient,
  HangoutRequestClientState,
  ParticipantDataClient,
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
  const { user, loading: authLoading } = useAuth();
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

  const loadRequest = useCallback(async () => {
    if (!requestId) {
      setPageError('Request ID is missing.');
      setIsLoading(false);
      return;
    }
    if (authLoading) return;
    setIsLoading(true);
    setPageError(null);
    try {
      const fetched = await fetchHangoutRequestById(requestId);
      if (!fetched) {
        setPageError("Hangout request not found or you don't have access.");
        return;
      }
      setRequest(fetched);
      if (user && fetched.participants && fetched.participants[user.uid]) {
        setHasUserAlreadySubmitted(true);
      }
      if (fetched.status === 'results_ready' && fetched.commonAvailabilitySlots) {
        setCommonSlots(fetched.commonAvailabilitySlots);
      } else {
        setCommonSlots([]);
      }
    } catch (err) {
      console.error('Failed to load hangout request:', err);
      setPageError('Could not load the hangout request details.');
      showErrorToast('Failed to load request details.');
    } finally {
      setIsLoading(false);
    }
  }, [requestId, authLoading, user]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  const handleSubmitAvailability = useCallback(async () => {
    if (!user || !request) {
      showErrorToast('User not logged in or request not loaded.');
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
      showSuccessToast('Your availability has been submitted!');
      setHasUserAlreadySubmitted(true);
      setRequest((prev) => {
        if (!prev) return null;
        const updatedParticipants = { ...prev.participants, [user.uid]: newParticipant };
        const newStatus =
          prev.status === 'pending' &&
          Object.keys(updatedParticipants).length >= prev.desiredMemberCount
            ? 'pending_calculation'
            : prev.status;
        return { ...prev, participants: updatedParticipants, status: newStatus };
      });
    } catch (err) {
      console.error('Error submitting availability:', err);
      setPageError(`Failed to submit availability. ${(err as Error).message}`);
      showErrorToast('Failed to submit availability.');
    } finally {
      setIsSubmittingAvailability(false);
    }
  }, [user, request]);

  const handleCalculateCommonTimes = useCallback(async () => {
    if (!request) {
      showErrorToast('Request data not loaded.');
      return;
    }
    const submittedCount = Object.keys(request.participants || {}).length;
    if (submittedCount === 0) {
      showInfoToast('No participants have submitted their availability yet.');
      return;
    }
    if (submittedCount < request.desiredMemberCount) {
      showInfoToast(
        `Waiting for at least ${request.desiredMemberCount} participants. Currently ${submittedCount} have responded.`,
      );
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
      showSuccessToast(slots.length > 0 ? `Found ${slots.length} common slots!` : 'No common slots found.');
      setRequest((prev) =>
        prev ? { ...prev, status: newStatus, commonAvailabilitySlots: slots } : null,
      );
      if (slots.length > 0) setIsResultsModalOpen(true);
    } catch (err) {
      console.error('Error calculating common times:', err);
      showErrorToast('An error occurred while calculating common times.');
    } finally {
      setIsCalculatingSlots(false);
    }
  }, [request]);

  const handleInitiateConfirm = useCallback(() => {
    if (!request || selectedFinalSlotIndex === null || !commonSlots[selectedFinalSlotIndex]) {
      showErrorToast('Please select a valid slot to confirm.');
      return;
    }
    if (!user || user.uid !== request.creatorUid) {
      showErrorToast('Only the creator can confirm the final slot.');
      return;
    }
    setSlotToConfirm(commonSlots[selectedFinalSlotIndex]);
  }, [request, selectedFinalSlotIndex, commonSlots, user]);

  const handleConfirmAndInvite = useCallback(async () => {
    if (!request || !slotToConfirm || !user) {
      showErrorToast('Missing critical data to confirm slot.');
      return;
    }
    if (user.uid !== request.creatorUid) {
      showErrorToast('Only the creator can confirm the final slot.');
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
            showInfoToast('Confirmed event added to your calendar.');
          } catch (err) {
            console.error("Failed to add confirmed event to creator's calendar:", err);
            showErrorToast('Could not add event to your own calendar automatically.');
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
      showSuccessToast(`Slot confirmed: ${format(slotStart, 'MMM d, hh:mm a')}! Invitations sent.`);
      setRequest((prev) =>
        prev
          ? { ...prev, status: 'confirmed', finalSelectedSlot: { start: slotStart, end: slotEnd } }
          : null,
      );
      setIsResultsModalOpen(false);
      setSelectedFinalSlotIndex(null);

      // Best-effort: push the event to each participant's Google Calendar.
      // Skips participants who haven't connected GCal; errors are isolated per participant.
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
          showInfoToast(
            `Wrote event to ${written} Google Calendar${written === 1 ? '' : 's'}` +
              (skipped > 0 ? ` (${skipped} not connected)` : '') +
              (errored > 0 ? ` (${errored} failed)` : ''),
          );
        } else if (skipped > 0 && errored === 0) {
          showInfoToast('No participants have connected Google Calendar yet.');
        } else if (errored > 0) {
          showErrorToast(`Google Calendar write failed for ${errored} participant(s).`);
        }
      } catch (err) {
        console.error('GCal write-back failed:', err);
        showErrorToast('Could not push event to Google Calendars.');
      }
    } catch (err) {
      console.error('Error confirming final slot:', err);
      showErrorToast('Failed to confirm the slot. Please try again.');
    } finally {
      setIsConfirmingSlot(false);
    }
  }, [request, slotToConfirm, user]);

  if (authLoading || isLoading) {
    return <div className="p-6 text-center text-gray-500">Loading request details…</div>;
  }
  if (pageError) {
    return (
      <div className="p-6 text-center text-red-600">
        <p className="font-semibold text-lg">Error</p>
        <p>{pageError}</p>
      </div>
    );
  }
  if (!request) {
    return <div className="p-6 text-center text-gray-500">Hangout request not found.</div>;
  }

  const canSubmit =
    user && !hasUserAlreadySubmitted && request.status !== 'confirmed' && request.status !== 'closed';
  const canResubmit =
    user && hasUserAlreadySubmitted && request.status !== 'confirmed' && request.status !== 'closed';
  const participantCount = Object.keys(request.participants || {}).length;
  const isCreator = !!user && user.uid === request.creatorUid;
  const showSlotsActions = request.status !== 'confirmed' && request.status !== 'closed';

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 my-6 bg-white shadow-xl rounded-2xl">
      <HangoutDetailsCard request={request} />

      {request.status === 'confirmed' && request.finalSelectedSlot && (
        <ConfirmedSlotBanner slot={request.finalSelectedSlot} />
      )}

      {user && request.status !== 'confirmed' && request.status !== 'closed' && (
        <section className="mb-8 p-6 bg-slate-50 rounded-lg">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Your Participation</h2>
          {canSubmit && (
            <Button
              variant="solid"
              className="bg-blue-600 hover:bg-blue-700 text-white w-full mb-2"
              onClick={handleSubmitAvailability}
              isLoading={isSubmittingAvailability}
              disabled={isSubmittingAvailability}
            >
              Submit My Availability
            </Button>
          )}
          {canResubmit && (
            <Button
              variant="outline"
              className="w-full mb-2"
              onClick={handleSubmitAvailability}
              isLoading={isSubmittingAvailability}
              disabled={isSubmittingAvailability}
            >
              Update My Availability
            </Button>
          )}
        </section>
      )}

      {!user && (
        <div className="mb-8 p-6 bg-yellow-50 rounded-lg text-center text-yellow-700">
          <p className="text-lg font-semibold mb-2">Sign in to participate</p>
          <p>Please sign in to submit your availability or join this hangout.</p>
        </div>
      )}

      {showSlotsActions && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-700 mb-4">Find Common Slots</h2>
          {(request.status === 'results_ready' || request.status === 'no_slots_found') &&
            commonSlots.length > 0 && (
              <Button
                onClick={() => setIsResultsModalOpen(true)}
                variant="solid"
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg mb-4"
              >
                View Calculated Common Slots
              </Button>
            )}
          {(request.status === 'results_ready' || request.status === 'no_slots_found') &&
            commonSlots.length === 0 && (
              <p className="text-center text-slate-500 py-4 px-6 bg-slate-50 rounded-md">
                No common time slots were found based on the latest calculation.
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
                  ? 'Calculating…'
                  : request.status === 'results_ready' || request.status === 'no_slots_found'
                    ? 'Re-Calculate Common Times'
                    : 'Calculate Common Times Now'}
              </Button>
            )}
          {request.status === 'pending' && participantCount < request.desiredMemberCount && (
            <p className="text-sm text-center text-slate-500 mt-3">
              Waiting for more participants ({request.desiredMemberCount - participantCount} more needed)
              before calculating.
            </p>
          )}
        </section>
      )}

      <footer className="mt-12 text-center">
        <Link href="/hangouts">
          <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-100">
            Back to My Hangouts List
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
          title="Confirm and Send Invitations"
          message="Confirm this slot and send invitations to all available participants? This cannot be undone."
          confirmText="Yes, Confirm & Send Invites"
          cancelText="Cancel"
          isLoading={isConfirmingSlot}
        />
      )}
    </div>
  );
}
