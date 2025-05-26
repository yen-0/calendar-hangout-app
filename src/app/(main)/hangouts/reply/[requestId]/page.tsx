// src/app/(main)/hangouts/reply/[requestId]/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import {
    // Import CLIENT-SIDE types for state and direct use in component
    HangoutRequestClientState,
    ParticipantDataClient, // For constructing newParticipantData
    CommonSlotClient,      // For calculatedCommonSlots state
    ConfirmHangoutPayload, // For Cloud Function if you were using it
    DateRangeClient,       // For mapping dateRanges before passing to utils
    ParticipantEventClient // For participantEvents
} from '@/types/hangouts';
import {
    fetchHangoutRequestById,
    addParticipantToHangoutRequest, // This function should expect ParticipantDataClient
    fetchCalendarItems,
} from '@/lib/firebase/firestoreService';
import { prepareCreatorEventsForRequest as prepareParticipantEventsForRequest } from '@/utils/hangoutUtils';
import { findCommonAvailability } from '@/utils/hangoutUtils'; // This function should expect HangoutRequestClientState
import { showSuccessToast, showErrorToast, showInfoToast } from '@/lib/toasts';
import Link from 'next/link';
import { format } from 'date-fns';
// Import only what's needed for *saving* data back to Firestore if not using CF for all writes
import { Timestamp, updateDoc, doc, collection, writeBatch } from 'firebase/firestore'; // Corrected: get from 'firebase/firestore'
import { db } from '@/lib/firebase/config';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
// addCalendarItem is for adding to *own* calendar, it expects CalendarEvent with JS Dates
import { addCalendarItem } from '@/lib/firebase/firestoreService';
import { CalendarEvent } from '@/types/events';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
// Removed Cloud Function imports as per "don't use any firebase functions" for this step

export default function ReplyToHangoutRequestPage() {
    const { user, loading: authLoading } = useAuth();
    const params = useParams();
    // const router = useRouter(); // Not used in current snippet, can remove if not needed
    const requestId = params?.requestId as string | undefined;

    // USE THE CLIENT-SIDE STATE TYPE
    const [request, setRequest] = useState<HangoutRequestClientState | null>(null);
    const [isLoadingRequest, setIsLoadingRequest] = useState(true);
    const [isSubmittingAvailability, setIsSubmittingAvailability] = useState(false);
    const [pageError, setPageError] = useState<string | null>(null);
    const [hasUserAlreadySubmitted, setHasUserAlreadySubmitted] = useState(false);

    const [isCalculatingSlots, setIsCalculatingSlots] = useState(false);
    const [calculatedCommonSlots, setCalculatedCommonSlots] = useState<CommonSlotClient[]>([]); // Use CommonSlotClient
    const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
    const [selectedFinalSlotIndex, setSelectedFinalSlotIndex] = useState<number | null>(null);
    const [isConfirmingSlot, setIsConfirmingSlot] = useState(false);
    const [showAddToCalendarConfirm, setShowAddToCalendarConfirm] = useState(false);
    const [slotToConfirmDetails, setSlotToConfirmDetails] = useState<CommonSlotClient | null>(null); // Use CommonSlotClient

    const loadRequestDetails = useCallback(async () => {
        if (!requestId) {
            setPageError("Request ID is missing.");
            setIsLoadingRequest(false);
            return;
        }
        if (authLoading) return;

        setIsLoadingRequest(true);
        setPageError(null);
        try {
            // fetchHangoutRequestById now returns HangoutRequestClientState
            const fetchedRequest = await fetchHangoutRequestById(requestId);
            if (fetchedRequest) {
                setRequest(fetchedRequest); // fetchedRequest is already HangoutRequestClientState
                if (user && fetchedRequest.participants && fetchedRequest.participants[user.uid]) {
                    setHasUserAlreadySubmitted(true);
                }
                if (fetchedRequest.status === 'results_ready' && fetchedRequest.commonAvailabilitySlots) {
                    // commonAvailabilitySlots from HangoutRequestClientState are already CommonSlotClient
                    setCalculatedCommonSlots(fetchedRequest.commonAvailabilitySlots);
                } else {
                    setCalculatedCommonSlots([]);
                }
            } else {
                setPageError("Hangout request not found or you don't have access.");
            }
        } catch (err) {
            console.error("Failed to load hangout request:", err);
            setPageError("Could not load the hangout request details.");
            showErrorToast("Failed to load request details.");
        } finally {
            setIsLoadingRequest(false);
        }
    }, [requestId, authLoading, user]);

    useEffect(() => {
        loadRequestDetails();
    }, [loadRequestDetails]);

    const handleSubmitAvailability = async () => {
        if (!user || !request) {
            showErrorToast("User not logged in or request not loaded.");
            return;
        }
        setIsSubmittingAvailability(true);
        setPageError(null);
        try {
            const userCalendarEvents = await fetchCalendarItems(user.uid); // Assumes this returns CalendarEvent with JS Dates
            
            // prepareParticipantEventsForRequest expects DateRangeClient[]
            const requestDateRangesClient: DateRangeClient[] = request.dateRanges; // Already DateRangeClient

            const participantEvents: ParticipantEventClient[] = prepareParticipantEventsForRequest(
                userCalendarEvents,
                requestDateRangesClient,
                request.timeRanges
            );

            // Construct ParticipantDataClient to send to addParticipantToHangoutRequest
            const newParticipantData: ParticipantDataClient = {
                uid: user.uid,
                displayName: user.displayName || user.email || "A Participant",
                submittedAt: new Date(), // JS Date
                events: participantEvents, // Already ParticipantEventClient
            };

            // addParticipantToHangoutRequest should handle converting this ParticipantDataClient to Firestore format
            await addParticipantToHangoutRequest(request.id, user.uid, newParticipantData);
            showSuccessToast("Your availability has been submitted!");
            setHasUserAlreadySubmitted(true);
            
            setRequest(prev => {
                if (!prev) return null;
                const updatedParticipants = {
                    ...prev.participants,
                    [user.uid]: newParticipantData // Store client version locally
                };
                const newStatus = (prev.status === 'pending' && Object.keys(updatedParticipants).length >= prev.desiredMemberCount)
                    ? 'pending_calculation'
                    : prev.status;
                return { ...prev, participants: updatedParticipants, status: newStatus };
            });

        } catch (err) {
            console.error("Error submitting availability:", err);
            setPageError("Failed to submit your availability. " + (err as Error).message);
            showErrorToast("Failed to submit availability.");
        } finally {
            setIsSubmittingAvailability(false);
        }
    };

    const handleTriggerFindCommonTimes = async () => {
        if (!request) {
            showErrorToast("Request data not loaded.");
            return;
        }
        if (!request.participants || Object.keys(request.participants).length === 0) {
            showInfoToast(`No participants have submitted their availability yet.`);
            return;
        }
        if (Object.keys(request.participants).length < request.desiredMemberCount && Object.keys(request.participants).length > 0) {
            showInfoToast(`Waiting for at least ${request.desiredMemberCount} participants. Currently ${Object.keys(request.participants).length} have responded.`);
        }

        setIsCalculatingSlots(true);
        setCalculatedCommonSlots([]);
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            // findCommonAvailability should expect HangoutRequestClientState
            const slots: CommonSlotClient[] = findCommonAvailability(request, 15); // Debug flag removed for now, default step 15
            setCalculatedCommonSlots(slots);

            const requestDocRef = doc(db, "hangoutRequests", request.id);
            const newStatus = slots.length > 0 ? 'results_ready' : 'no_slots_found';
            await updateDoc(requestDocRef, {
                commonAvailabilitySlots: slots.map(s => ({ // Convert back to Firestore Timestamps for saving
                    start: Timestamp.fromDate(s.start),
                    end: Timestamp.fromDate(s.end),
                    availableParticipants: s.availableParticipants,
                })),
                status: newStatus,
            });

            showSuccessToast(slots.length > 0 ? `Found ${slots.length} common slots!` : "No common slots found.");
            setRequest(prev => prev ? ({
                ...prev,
                status: newStatus,
                commonAvailabilitySlots: slots // Store client version locally
            }) : null);

            if (slots.length > 0) {
                setIsResultsModalOpen(true);
            }
        } catch (e) {
            console.error("Error calculating common times:", e);
            showErrorToast("An error occurred while calculating common times.");
        } finally {
            setIsCalculatingSlots(false);
        }
    };

    const handleInitiateConfirmFinalSlot = () => {
        if (!request || selectedFinalSlotIndex === null || !calculatedCommonSlots[selectedFinalSlotIndex]) {
            showErrorToast("Please select a valid slot to confirm.");
            return;
        }
        if (!user || user.uid !== request.creatorUid) {
            showErrorToast("Only the creator can confirm the final slot.");
            return;
        }
        const chosenSlot = calculatedCommonSlots[selectedFinalSlotIndex]; // This is CommonSlotClient
        setSlotToConfirmDetails(chosenSlot);
        setShowAddToCalendarConfirm(true);
    };

    const handleConfirmSlotAndSendInvitations = async () => {
        if (!request || !slotToConfirmDetails || !user) {
            showErrorToast("Missing critical data to confirm slot.");
            return;
        }
        if (user.uid !== request.creatorUid) {
            showErrorToast("Only the creator can confirm the final slot.");
            return;
        }

        setShowAddToCalendarConfirm(false);
        setIsConfirmingSlot(true);

        const { start: slotStart, end: slotEnd, availableParticipants } = slotToConfirmDetails; // These are JS Dates

        try {
            const batch = writeBatch(db);
            const requestDocRef = doc(db, "hangoutRequests", request.id);
            batch.update(requestDocRef, {
                finalSelectedSlot: { // Convert to Timestamps for saving
                    start: Timestamp.fromDate(slotStart),
                    end: Timestamp.fromDate(slotEnd),
                },
                status: 'confirmed',
            });

            if (availableParticipants && availableParticipants.length > 0) {
                const hangoutRequestName = request.requestName;
                const creatorName = request.creatorName;
                // For notifications, sending Timestamps is fine as they get serialized
                const confirmedSlotStartTimeFirestore = Timestamp.fromDate(slotStart);
                const confirmedSlotEndTimeFirestore = Timestamp.fromDate(slotEnd);

                for (const participantUid of availableParticipants) {
                    if (participantUid === user.uid && participantUid === request.creatorUid) { // Creator is also a participant
                        // Creator adds to their own calendar directly, no notification needed for this step
                         try {
                            const creatorCalendarEventData: Omit<CalendarEvent, 'id'> = {
                                title: `Hangout: ${request.requestName}`,
                                start: slotStart, // JS Date
                                end: slotEnd,     // JS Date
                                allDay: false,
                                color: '#4CAF50'
                            };
                            await addCalendarItem(user.uid, creatorCalendarEventData);
                            showInfoToast("Confirmed event added to your calendar.");
                        } catch (error) {
                            console.error("Failed to add confirmed event to creator's calendar:", error);
                            showErrorToast("Could not add event to your own calendar automatically.");
                        }
                        continue; // Skip notification for creator about their own action
                    }
                    
                    const userNotificationRef = doc(collection(db, `userNotifications/${participantUid}/notifications`));
                    const notificationMessage = `${creatorName} has confirmed "${hangoutRequestName}" for ${format(slotStart, 'MMM d, yyyy')} from ${format(slotStart, 'hh:mm a')} to ${format(slotEnd, 'hh:mm a')}.`;
                    batch.set(userNotificationRef, {
                        type: 'hangout_invitation',
                        hangoutRequestId: request.id,
                        hangoutRequestName: hangoutRequestName,
                        confirmedSlotStart: confirmedSlotStartTimeFirestore,
                        confirmedSlotEnd: confirmedSlotEndTimeFirestore,
                        creatorName: creatorName,
                        isRead: false,
                        createdAt: Timestamp.now(),
                        message: notificationMessage,
                        participantUid: participantUid,
                    });
                }
            }
            await batch.commit();
            showSuccessToast(`Slot confirmed: ${format(slotStart, 'MMM d, hh:mm a')}! Invitations sent.`);
            setRequest(prev => prev ? ({
                ...prev,
                status: 'confirmed',
                finalSelectedSlot: { start: slotStart, end: slotEnd } // Store JS Dates locally
            }) : null);
            setIsResultsModalOpen(false);
            setSelectedFinalSlotIndex(null);
            setSlotToConfirmDetails(null);

        } catch (error) {
            console.error("Error confirming final slot and sending invitations:", error);
            showErrorToast("Failed to confirm the slot. Please try again.");
        } finally {
            setIsConfirmingSlot(false);
        }
    };

    // --- RENDER LOGIC (Early returns for loading/error states) ---
    if (authLoading || isLoadingRequest) {
        return <div className="p-6 text-center text-gray-500">Loading request details...</div>;
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

    // --- DERIVED STATE ---
    const canUserSubmitAvailability = user && !hasUserAlreadySubmitted && request.status !== 'confirmed' && request.status !== 'closed';
    const canUserResubmitAvailability = user && hasUserAlreadySubmitted && request.status !== 'confirmed' && request.status !== 'closed';
    const participantCount = Object.keys(request.participants || {}).length;
    const isCreator = user && user.uid === request.creatorUid;

    // --- MAIN JSX RETURN ---
    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 my-6 bg-white shadow-xl rounded-2xl">
            <header className="mb-8 pb-4 border-b border-gray-200">
                <h1 className="text-4xl font-bold tracking-tight text-slate-800">{request.requestName}</h1>
                <p className="text-sm text-slate-500 mt-1">
                    Created by <span className="font-semibold text-slate-600">{request.creatorName}</span> on {format(request.createdAt, 'PPP')} {/* request.createdAt is JS Date now */}
                </p>
            </header>

            <section className="space-y-6 mb-8">
                <div>
                    <h2 className="text-xl font-semibold text-slate-700 mb-2">Proposed Dates & Times</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <h3 className="font-medium text-slate-600">Date Ranges:</h3>
                            <ul className="list-disc list-inside pl-4 text-slate-500">
                                {request.dateRanges.map((dr, index) => ( // dr.start and dr.end are JS Dates
                                    <li key={index}>
                                        {format(dr.start, 'EEE, MMM d, yyyy')} to {format(dr.end, 'EEE, MMM d, yyyy')}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-medium text-slate-600">Daily Time Ranges:</h3>
                            <ul className="list-disc list-inside pl-4 text-slate-500">
                                {request.timeRanges.map((tr, index) => (
                                    <li key={index}>{tr.start} – {tr.end}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm border-t pt-4 mt-4">
                    <p><span className="font-semibold text-slate-600">Duration:</span> {request.desiredDurationMinutes} min</p>
                    <p><span className="font-semibold text-slate-600">Margin:</span> {request.desiredMarginMinutes} min</p>
                    <p><span className="font-semibold text-slate-600">Members:</span> {participantCount} / {request.desiredMemberCount} joined</p>
                    <p className="md:col-span-3"><span className="font-semibold text-slate-600">Current Status:</span> <span className="capitalize font-medium text-blue-600">{request.status.replace(/_/g, ' ')}</span></p>
                </div>
            </section>

            {/* Display Confirmed Slot Info Prominently if Confirmed */}
            {request.status === 'confirmed' && request.finalSelectedSlot && (
                <section className="mb-8 p-6 bg-teal-50 border-2 border-teal-400 rounded-lg shadow-lg text-center">
                    <h2 className="text-2xl font-bold text-teal-700 mb-3 flex items-center justify-center">
                        <CheckCircleIcon className="h-7 w-7 mr-2 text-teal-600"/> Event Confirmed!
                    </h2>
                    <div className="text-xl text-teal-600">
                        <p>{format(request.finalSelectedSlot.start, 'EEE, MMM d, yyyy')}</p> {/* Already JS Date */}
                        <p>
                            {format(request.finalSelectedSlot.start, 'hh:mm a')} –
                            {format(request.finalSelectedSlot.end, 'hh:mm a')}
                        </p>
                    </div>
                </section>
            )}

            {/* --- User Actions Section (Submit/Resubmit Availability) --- */}
            {/* Only show if user is logged in AND request is not yet confirmed or closed */}
            {user && request.status !== 'confirmed' && request.status !== 'closed' && (
                <section className="mb-8 p-6 bg-slate-50 rounded-lg">
                    <h2 className="text-xl font-semibold text-slate-700 mb-4">Your Participation</h2>
                    {canUserSubmitAvailability && (
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
                    {canUserResubmitAvailability && (
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

            {/* --- Common Availability Section (Find/View Slots) --- */}
            {/* Only show if request is NOT YET confirmed or closed */}
            {request.status !== 'confirmed' && request.status !== 'closed' && (
                <section className="mb-8">
                    {/* ... (content for finding/viewing common slots as before) ... */}
                    <h2 className="text-2xl font-semibold text-slate-700 mb-4">Find Common Slots</h2>
                    {(request.status === 'results_ready' || request.status === 'no_slots_found') && calculatedCommonSlots.length > 0 && (
                        <Button onClick={() => setIsResultsModalOpen(true)} variant="solid" className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg mb-4">
                            View Calculated Common Slots
                        </Button>
                    )}
                    {(request.status === 'results_ready' || request.status === 'no_slots_found') && calculatedCommonSlots.length === 0 && (
                        <p className="text-center text-slate-500 py-4 px-6 bg-slate-50 rounded-md">
                            No common time slots were found based on the latest calculation.
                        </p>
                    )}
                    {user && (request.status === 'pending_calculation' || request.status === 'pending' || request.status === 'results_ready' || request.status === 'no_slots_found') && (
                        <Button
                            variant="outline" size="default" className="w-full border-slate-300 hover:bg-slate-100"
                            onClick={handleTriggerFindCommonTimes}
                            isLoading={isCalculatingSlots} disabled={isCalculatingSlots}
                        >
                            {isCalculatingSlots ? 'Calculating...' : (request.status === 'results_ready' || request.status === 'no_slots_found' ? 'Re-Calculate Common Times' : 'Calculate Common Times Now')}
                        </Button>
                    )}
                    {(request.status === 'pending' && participantCount < request.desiredMemberCount) && (
                         <p className="text-sm text-center text-slate-500 mt-3">
                            Waiting for more participants ({request.desiredMemberCount - participantCount} more needed) before calculating.
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

            {/* --- Results Modal --- */}
            {request && request.status !== 'confirmed' && request.status !== 'closed' && ( // Only show if not confirmed/closed
                <Modal
                    isOpen={isResultsModalOpen}
                    onClose={() => { setIsResultsModalOpen(false); setSelectedFinalSlotIndex(null); }}
                    title={`Available Slots for "${request.requestName}"`}
                    size="lg"
                >
                    <div className="max-h-[60vh] overflow-y-auto space-y-3 p-1">
                        {calculatedCommonSlots.length > 0 ? (
                            calculatedCommonSlots.map((slot, index) => ( // slot.start and slot.end are JS Dates
                                <div
                                    key={index}
                                    className={`p-4 border rounded-lg transition-all cursor-pointer
                                       ${selectedFinalSlotIndex === index
                                            ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-300 shadow-md'
                                            : 'bg-green-50 border-green-300 hover:bg-green-100 hover:shadow-sm'
                                        }`}
                                    onClick={() => isCreator && request.status !== 'confirmed' && setSelectedFinalSlotIndex(index)}
                                >
                                    <p className="font-semibold text-green-700 text-md">
                                        {format(slot.start, 'EEE, MMM d, yyyy')}
                                    </p>
                                    <p className="text-lg text-green-800">
                                        {format(slot.start, 'hh:mm a')} – {format(slot.end, 'hh:mm a')}
                                    </p>
                                    {/* ... rest of slot display ... */}
                                     {request.participants && slot.availableParticipants && slot.availableParticipants.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs font-medium text-slate-600">
                                                Available ({slot.availableParticipants.length} / {request.desiredMemberCount}):
                                            </p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {slot.availableParticipants.map(pid => (
                                                    <span key={pid} className="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full">
                                                        {request.participants[pid]?.displayName || `User ${pid.substring(0, 6)}`}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedFinalSlotIndex === index && isCreator && request.status !== 'confirmed' && (
                                        <div className="mt-3 text-center">
                                            <CheckCircleIcon className="h-6 w-6 text-blue-600 inline-block mr-1" />
                                            <span className="text-blue-700 font-semibold">Selected for Confirmation</span>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-slate-500 py-4 px-6 bg-slate-50 rounded-md">
                                No common slots available.
                            </div>
                        )}
                    </div>
                    <div className="mt-6 pt-4 border-t flex justify-between items-center">
                        <Button variant="outline" onClick={() => { setIsResultsModalOpen(false); setSelectedFinalSlotIndex(null); }}>Close</Button>
                        {isCreator && calculatedCommonSlots.length > 0 && (
                            <Button
                                onClick={handleInitiateConfirmFinalSlot}
                                disabled={isConfirmingSlot || selectedFinalSlotIndex === null}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                Confirm Selected Slot & Send Invites
                            </Button>
                        )}
                    </div>
                </Modal>
            )}

            {/* Confirmation Modal for Sending Invitations */}
            {slotToConfirmDetails && (
                <ConfirmationModal
                    isOpen={showAddToCalendarConfirm}
                    onClose={() => { setShowAddToCalendarConfirm(false); setSlotToConfirmDetails(null); }}
                    onConfirm={handleConfirmSlotAndSendInvitations}
                    title="Confirm and Send Invitations"
                    message="Are you sure you want to confirm this slot and send invitations to all available participants? This action cannot be undone."
                    confirmText="Yes, Confirm & Send Invites"
                    cancelText="Cancel"
                    isLoading={isConfirmingSlot}
                />
            )}
        </div>
    );
}