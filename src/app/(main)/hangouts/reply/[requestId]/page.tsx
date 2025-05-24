// src/app/(main)/hangouts/reply/[requestId]/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal'; // Your generic Modal component
import { HangoutRequest, ParticipantData, CommonSlot } from '@/types/hangouts';
import {
    fetchHangoutRequestById,
    addParticipantToHangoutRequest,
    fetchCalendarItems,
} from '@/lib/firebase/firestoreService';
import { prepareCreatorEventsForRequest as prepareParticipantEventsForRequest } from '@/utils/hangoutUtils';
import { findCommonAvailability } from '@/utils/hangoutUtils';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/lib/toasts';
import Link from 'next/link';
import { format } from 'date-fns';
import { writeBatch, Timestamp, updateDoc, doc, collection } from '@/lib/firebase';// Firestore specific
import { db } from '@/lib/firebase/config'; // Your db instance
import { CheckCircleIcon } from '@heroicons/react/24/solid'; // Example icon, adjust as needed
import { addCalendarItem } from '@/lib/firebase/firestoreService';
import { CalendarEvent } from '@/types/events';
import ConfirmationModal from '@/components/ui/ConfirmationModal'; // Your confirmation modal component
import { getFunctions, httpsCallable, Functions } from "firebase/functions"; // Import Firebase Functions SDK
import { app as firebaseApp } from '@/lib/firebase/config'; // Your initialized Firebase app

export default function ReplyToHangoutRequestPage() {
    const { user, loading: authLoading } = useAuth();
    const params = useParams();
    const router = useRouter();
    const requestId = params?.requestId as string | undefined;

    const [request, setRequest] = useState<HangoutRequest | null>(null);
    const [isLoadingRequest, setIsLoadingRequest] = useState(true);
    const [isSubmittingAvailability, setIsSubmittingAvailability] = useState(false);
    const [pageError, setPageError] = useState<string | null>(null);
    const [hasUserAlreadySubmitted, setHasUserAlreadySubmitted] = useState(false);

    // State for common availability calculation and display
    const [isCalculatingSlots, setIsCalculatingSlots] = useState(false);
    const [calculatedCommonSlots, setCalculatedCommonSlots] = useState<CommonSlot[]>([]);
    const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
    const [selectedFinalSlotIndex, setSelectedFinalSlotIndex] = useState<number | null>(null);
    const [isConfirmingSlot, setIsConfirmingSlot] = useState(false);
    const [showAddToCalendarConfirm, setShowAddToCalendarConfirm] = useState(false);
    const [slotToConfirmDetails, setSlotToConfirmDetails] = useState<CommonSlot | null>(null);
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
            const fetchedRequest = await fetchHangoutRequestById(requestId);
            if (fetchedRequest) {
                setRequest(fetchedRequest);
                if (user && fetchedRequest.participants && fetchedRequest.participants[user.uid]) {
                    setHasUserAlreadySubmitted(true);
                }
                // If results are already calculated and stored, load them
                if (fetchedRequest.status === 'results_ready' && fetchedRequest.commonAvailabilitySlots) {
                    const slotsWithDates = (fetchedRequest.commonAvailabilitySlots as any[]).map(s => ({
                        ...s,
                        start: s.start instanceof Timestamp ? s.start.toDate() : new Date(s.start),
                        end: s.end instanceof Timestamp ? s.end.toDate() : new Date(s.end),
                    }));
                    setCalculatedCommonSlots(slotsWithDates);
                } else {
                    setCalculatedCommonSlots([]); // Clear if no results or not ready
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
            const userCalendarEvents = await fetchCalendarItems(user.uid);
            const participantEvents = prepareParticipantEventsForRequest(
                userCalendarEvents,
                request.dateRanges,
                request.timeRanges
            );
            const newParticipantData: ParticipantData = {
                uid: user.uid,
                displayName: user.displayName || user.email || "A Participant",
                submittedAt: new Date(),
                events: participantEvents,
            };

            await addParticipantToHangoutRequest(request.id, user.uid, newParticipantData);
            showSuccessToast("Your availability has been submitted!");
            setHasUserAlreadySubmitted(true);
            // Optimistically update local state or reload
            setRequest(prev => {
                if (!prev) return null;
                const updatedParticipants = {
                    ...prev.participants,
                    [user.uid]: newParticipantData
                };
                // If status was 'pending' and now enough participants, change to 'pending_calculation'
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
        // Optional: Restrict who can trigger calculation (e.g., only creator)
        // if (!user || user.uid !== request.creatorUid) {
        //   showErrorToast("Only the creator can initiate slot calculation.");
        //   return;
        // }
        if (!request.participants || Object.keys(request.participants).length === 0) {
            showInfoToast(`No participants have submitted their availability yet.`);
            return;
        }
        if (Object.keys(request.participants).length < request.desiredMemberCount && Object.keys(request.participants).length > 0) {
            showInfoToast(`Waiting for at least ${request.desiredMemberCount} participants. Currently ${Object.keys(request.participants).length} have responded.`);
            // return; // Uncomment if you want to strictly enforce this before calculation
        }


        setIsCalculatingSlots(true);
        setCalculatedCommonSlots([]); // Clear previous display while calculating

        // Simulate async for UI responsiveness if calculation is synchronous and blocking
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const slots = findCommonAvailability(request, 30);
            setCalculatedCommonSlots(slots);

            // Save results to Firestore
            const requestDocRef = doc(db, "hangoutRequests", request.id);
            const newStatus = slots.length > 0 ? 'results_ready' : 'no_slots_found';
            await updateDoc(requestDocRef, {
                commonAvailabilitySlots: slots.map(s => ({
                    start: Timestamp.fromDate(s.start),
                    end: Timestamp.fromDate(s.end),
                    availableParticipants: s.availableParticipants,
                })),
                status: newStatus,
            });

            showSuccessToast(slots.length > 0 ? `Found ${slots.length} common slots!` : "No common slots found with current availability.");

            // Update local request state to reflect new status and slots
            setRequest(prev => prev ? ({
                ...prev,
                status: newStatus,
                commonAvailabilitySlots: slots as any // Store with JS Dates locally
            }) : null);

            if (slots.length > 0) {
                setIsResultsModalOpen(true); // Open modal if slots are found
            }

        } catch (e) {
            console.error("Error calculating common times:", e);
            showErrorToast("An error occurred while calculating common times.");
        } finally {
            setIsCalculatingSlots(false);
        }
    };


    // --- RENDER LOGIC ---
    if (authLoading || isLoadingRequest) {
        return <div className="p-6 text-center text-gray-500">Loading request details...</div>;
    }

    if (pageError) {
        return (
            <div className="p-6 text-center text-red-500">
                <p className="mb-4 text-lg">{pageError}</p>
                <Link href="/hangouts">
                    <Button variant="outline">Back to My Hangouts</Button>
                </Link>
            </div>
        );
    }

    if (!request) {
        return <div className="p-6 text-center text-gray-500">Hangout request not found.</div>;
    }


    const handleConfirmFinalSlot = async () => {
        if (!request || selectedFinalSlotIndex === null || !calculatedCommonSlots[selectedFinalSlotIndex]) {
            showErrorToast("Please select a valid slot to confirm.");
            return;
        }
        if (!user || user.uid !== request.creatorUid) {
            showErrorToast("Only the creator can confirm the final slot.");
            return;
        }

        setIsConfirmingSlot(true);
        const chosenSlot = calculatedCommonSlots[selectedFinalSlotIndex];

        try {
            const requestDocRef = doc(db, "hangoutRequests", request.id);
            await updateDoc(requestDocRef, {
                finalSelectedSlot: {
                    start: Timestamp.fromDate(chosenSlot.start),
                    end: Timestamp.fromDate(chosenSlot.end),
                },
                status: 'confirmed',
            });

            showSuccessToast(`Slot confirmed: ${format(chosenSlot.start, 'MMM d, hh:mm a')}!`);
            setRequest(prev => prev ? ({
                ...prev,
                status: 'confirmed',
                finalSelectedSlot: { start: chosenSlot.start, end: chosenSlot.end } as any,
            }) : null);
            setIsResultsModalOpen(false);
            setSelectedFinalSlotIndex(null);

            // TODO: Notification logic
        } catch (error) {
            console.error("Error confirming final slot:", error);
            showErrorToast("Failed to confirm the slot. Please try again.");
        } finally {
            setIsConfirmingSlot(false);
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
        const chosenSlot = calculatedCommonSlots[selectedFinalSlotIndex];
        setSlotToConfirmDetails(chosenSlot); // Store details for the confirmation modal
        setShowAddToCalendarConfirm(true); // Open the confirmation modal
    };
    // Confirm the final slot and add events to calendars (not used)
    const actuallyConfirmAndAddEvents = async () => {
        if (!request || !slotToConfirmDetails || !user) return;

        setShowAddToCalendarConfirm(false); // Close the first confirmation modal
        setIsConfirmingSlot(true); // Show loading on the main confirm button (if any) or general loading

        const { start: slotStart, end: slotEnd, availableParticipants } = slotToConfirmDetails;

        try {
            // 1. Update the HangoutRequest status and finalSelectedSlot
            const requestDocRef = doc(db, "hangoutRequests", request.id);
            await updateDoc(requestDocRef, {
                finalSelectedSlot: {
                    start: Timestamp.fromDate(slotStart),
                    end: Timestamp.fromDate(slotEnd),
                },
                status: 'confirmed',
            });

            // 2. Add event to calendars of available participants
            if (availableParticipants && availableParticipants.length > 0) {
                for (const participantUid of availableParticipants) {
                    // Construct the CalendarEvent object
                    // You might want a more descriptive title, or link it to the hangout
                    const newCalendarEventData: Omit<CalendarEvent, 'id'> = {
                        title: `Hangout: ${request.requestName}`,
                        start: slotStart, // slotStart and slotEnd are already JS Dates
                        end: slotEnd,
                        allDay: false, // Assuming hangouts are not all-day
                        color: '#4CAF50', // A default color for hangouts, or use request.color if you add one
                        // Add any other relevant fields from your CalendarEvent type
                        // e.g., description, link to hangout request, etc.
                        // isStamp: false, // If you have this field
                        // occurrenceDate: slotStart, // If relevant for your event expansion
                        // originalStampId: undefined, // If relevant
                    };
                    try {
                        await addCalendarItem(participantUid, newCalendarEventData);
                        // Optional: notify individual success if needed
                    } catch (eventError) {
                        console.error(`Failed to add event to calendar for user ${participantUid}:`, eventError);
                        showErrorToast(`Couldn't add event for ${request.participants[participantUid]?.displayName || 'a participant'}.`);
                    }
                }
            }

            showSuccessToast(`Slot confirmed: ${format(slotStart, 'MMM d, hh:mm a')}! Events added to calendars.`);
            setRequest(prev => prev ? ({
                ...prev,
                status: 'confirmed',
                finalSelectedSlot: { start: slotStart, end: slotEnd } as any,
            }) : null);
            setIsResultsModalOpen(false); // Close results modal
            setSelectedFinalSlotIndex(null);
            setSlotToConfirmDetails(null);

            // TODO: More robust notification logic (email, push)

        } catch (error) {
            console.error("Error confirming final slot and adding events:", error);
            showErrorToast("Failed to confirm the slot. Please try again.");
        } finally {
            setIsConfirmingSlot(false);
        }
    };
    const callConfirmHangoutFunction = async () => {
        if (!request || !slotToConfirmDetails || !user) {
            showErrorToast("Missing critical data to confirm slot.");
            return;
        }
        // Client-side authorization check (good to have, but CF does the definitive check)
        if (user.uid !== request.creatorUid) {
            showErrorToast("Only the creator can confirm the final slot.");
            return;
        }

        setShowAddToCalendarConfirm(false); // Close the confirmation modal
        setIsConfirmingSlot(true);         // Set loading state

        const { start: slotStart, end: slotEnd, availableParticipants } = slotToConfirmDetails;

        try {
            const funcs: Functions = getFunctions(firebaseApp); // Get functions instance
            const confirmHangout = httpsCallable<ConfirmHangoutPayload, { success: boolean; message?: string }>(
                funcs,
                'confirmHangoutAndCreateEvents'
            );

            const payload: ConfirmHangoutPayload = {
                hangoutRequestId: request.id,
                chosenSlot: {
                    start: slotStart.toISOString(), // Send as ISO string
                    end: slotEnd.toISOString(),   // Send as ISO string
                    availableParticipants: availableParticipants,
                },
                // requestName: request.requestName, // Optional: CF can fetch this
            };

            const result = await confirmHangout(payload);

            if (result.data.success) {
                showSuccessToast(result.data.message || `Slot confirmed: ${format(slotStart, 'MMM d, hh:mm a')}!`);
                // Optimistically update UI or refetch the entire request
                setRequest(prev => prev ? ({
                    ...prev,
                    status: 'confirmed',
                    finalSelectedSlot: { start: slotStart, end: slotEnd } as any, // Store JS Dates locally
                    // Note: commonAvailabilitySlots might also change if the CF recalculates them
                }) : null);
                setIsResultsModalOpen(false);
                setSelectedFinalSlotIndex(null);
                setSlotToConfirmDetails(null);
                // Consider a full reload of request details after a short delay if needed
                // setTimeout(() => loadRequestDetails(), 1000);
            } else {
                // This case should ideally be handled by HttpsError from CF
                showErrorToast(result.data.message || "Failed to confirm slot via cloud function.");
            }

        } catch (error: any) {
            console.error("Error calling confirmHangoutAndCreateEvents function:", error);
            let errorMessage = "Failed to confirm the slot. Please try again.";
            if (error.code && error.message) { // HttpsError format
                errorMessage = `Error: ${error.message} (Code: ${error.code})`;
            } else if (error.message) {
                errorMessage = error.message;
            }
            showErrorToast(errorMessage);
        } finally {
            setIsConfirmingSlot(false);
        }
    };
    //send invitations to participants

    const handleConfirmSlotAndSendInvitations = async () => {
        if (!request || !slotToConfirmDetails || !user) {
            showErrorToast("Missing critical data to confirm slot.");
            return;
        }
        // Authorization: Ensure current user is the creator
        if (user.uid !== request.creatorUid) {
            showErrorToast("Only the creator can confirm the final slot.");
            return;
        }

        setShowAddToCalendarConfirm(false); // Close the creator's confirmation modal
        setIsConfirmingSlot(true);

        const { start: slotStart, end: slotEnd, availableParticipants } = slotToConfirmDetails;

        try {
            const batch = writeBatch(db); // Initialize Firestore batch

            // 1. Update the HangoutRequest status and finalSelectedSlot
            const requestDocRef = doc(db, "hangoutRequests", request.id);
            batch.update(requestDocRef, {
                finalSelectedSlot: {
                    start: Timestamp.fromDate(slotStart),
                    end: Timestamp.fromDate(slotEnd),
                },
                status: 'confirmed',
            });

            // 2. Create notification documents for each available participant
            if (availableParticipants && availableParticipants.length > 0) {
                const hangoutRequestName = request.requestName;
                const creatorName = request.creatorName;
                const confirmedSlotStartTime = Timestamp.fromDate(slotStart);
                const confirmedSlotEndTime = Timestamp.fromDate(slotEnd);

                for (const participantUid of availableParticipants) {
                    // Don't send a notification to the creator about their own confirmed event in this way,
                    // unless you want them to also explicitly add it via notification.
                    // For simplicity, we can skip notifying the creator here, or handle it differently.
                    if (participantUid === user.uid) continue; // Skip creator for this type of notification

                    const userNotificationRef = doc(collection(db, `userNotifications/${participantUid}/notifications`)); // Auto-ID for notification

                    const notificationMessage = `${creatorName} has confirmed the hangout "${hangoutRequestName}" for ${format(slotStart, 'MMM d, yyyy')} from ${format(slotStart, 'hh:mm a')} to ${format(slotEnd, 'hh:mm a')}.`;

                    batch.set(userNotificationRef, {
                        type: 'hangout_invitation',
                        hangoutRequestId: request.id,
                        hangoutRequestName: hangoutRequestName,
                        confirmedSlotStart: confirmedSlotStartTime,
                        confirmedSlotEnd: confirmedSlotEndTime,
                        creatorName: creatorName,
                        isRead: false,
                        createdAt: Timestamp.now(),
                        message: notificationMessage,
                        participantUid: participantUid, // Store whose notification this is, can be useful
                    });
                }
            }

            await batch.commit(); // Commit all Firestore operations

            showSuccessToast(`Slot confirmed: ${format(slotStart, 'MMM d, hh:mm a')}! Invitations sent.`);
            setRequest(prev => prev ? ({
                ...prev,
                status: 'confirmed',
                finalSelectedSlot: { start: slotStart, end: slotEnd } as any,
            }) : null);
            setIsResultsModalOpen(false);
            setSelectedFinalSlotIndex(null);
            setSlotToConfirmDetails(null);

            // TODO: Optional: Creator might want to add this to their own calendar directly here
            // if (!availableParticipants.includes(user.uid)) { /* Logic for creator to add to their own calendar */ }


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
            <div className="p-6 text-center text-red-500">
                <p className="mb-4 text-lg">{pageError}</p>
                <Link href="/hangouts">
                    <Button variant="outline">Back to My Hangouts</Button>
                </Link>
            </div>
        );
    }

    if (!request) {
        return <div className="p-6 text-center text-gray-500">Hangout request not found.</div>;
    }

    // --- DERIVED STATE (can be defined after request is guaranteed to exist) ---
    const canUserSubmitAvailability = user && !hasUserAlreadySubmitted;
    const canUserResubmitAvailability = user && hasUserAlreadySubmitted;
    const participantCount = Object.keys(request.participants || {}).length;
    const isCreator = user && user.uid === request.creatorUid;

    // --- MAIN JSX RETURN ---
    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 my-6 bg-white shadow-xl rounded-2xl">
            {/* ... (Rest of your JSX as provided previously) ... */}
            <header className="mb-8 pb-4 border-b border-gray-200">
                <h1 className="text-4xl font-bold tracking-tight text-slate-800">{request.requestName}</h1>
                <p className="text-sm text-slate-500 mt-1">
                    Created by <span className="font-semibold text-slate-600">{request.creatorName}</span> on {format(request.createdAt, 'PPP')}
                </p>
            </header>

            <section className="space-y-6 mb-8">
                <div>
                    <h2 className="text-xl font-semibold text-slate-700 mb-2">Proposed Dates & Times</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <h3 className="font-medium text-slate-600">Date Ranges:</h3>
                            <ul className="list-disc list-inside pl-4 text-slate-500">
                                {request.dateRanges.map((dr, index) => (
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
                    <p className="md:col-span-3"><span className="font-semibold text-slate-600">Current Status:</span> <span className="capitalize font-medium text-blue-600">{request.status.replace(/_/g, ' ')}</span><span className="font-semibold text-slate-600"></span></p>
<p><span className="font-semibold text-slate-600">Selected Date: </span>
                        {request.status === 'confirmed' && request.finalSelectedSlot
                            ? (
                                    <>
                                        {format(request.finalSelectedSlot.start, 'EEE, MMM d, yyyy')} {' '}
                                        {format(request.finalSelectedSlot.start, 'hh:mm a')} – {format(request.finalSelectedSlot.end, 'hh:mm a')}
                                    </>
                                )
                            : (
                                    <span className="text-slate-500">Not confirmed</span>
                                )
                        }
                    </p>


                </div>
            </section>
            {/* --- User Actions Section --- */}
            {user && request.status !== 'confirmed' && (
                <section className="mb-8 p-6 bg-slate-50 rounded-lg">
                    <h2 className="text-xl font-semibold text-slate-700 mb-4">Your Participation</h2>
                    {canUserSubmitAvailability && (
                        <Button
                            onClick={handleSubmitAvailability}
                            isLoading={isSubmittingAvailability}
                            disabled={isSubmittingAvailability}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
                        >
                            Submit My Availability
                        </Button>
                    )}
                    {canUserResubmitAvailability && (
                        <div className="text-center">
                            <p className="text-green-600 mb-2">You've already submitted your availability.</p>
                            <Button
                                onClick={handleSubmitAvailability}
                                isLoading={isSubmittingAvailability}
                                disabled={isSubmittingAvailability}
                                className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white"
                            >
                                {isSubmittingAvailability ? 'Resubmitting...' : 'Resubmit My Availability'}
                            </Button>
                        </div>
                    )}
                </section>
            )}
            {!user && (
                <div className="p-4 mb-6 text-center bg-yellow-50 border border-yellow-300 rounded-md">
                    <p className="text-yellow-700">Please <Link href={`/sign-in?redirect=/hangouts/reply/${requestId}`} className="font-semibold underline hover:text-yellow-800">sign in</Link> to submit your availability or view results.</p>
                </div>
            )}

            {/* --- Common Availability Section --- */}
            {request.status !== 'confirmed' && (
                <section className="mb-8">
                    <h2 className="text-2xl font-semibold text-slate-700 mb-4">Find Common Slots</h2>

                    {/* Show "View Calculated Slots" button if results are ready and not yet confirmed */}
                    {(request.status === 'results_ready' || request.status === 'no_slots_found') && calculatedCommonSlots.length > 0 && (
                        <Button onClick={() => setIsResultsModalOpen(true)} variant="solid" className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg mb-4">
                            View Calculated Common Slots
                        </Button>
                    )}
                    {/* Show "No slots found" message if applicable and not yet confirmed */}
                    {(request.status === 'results_ready' || request.status === 'no_slots_found') && calculatedCommonSlots.length === 0 && (
                        <p className="text-center text-slate-500 py-4 px-6 bg-slate-50 rounded-md">
                            No common time slots were found based on the latest calculation.
                        </p>
                    )}

                    {/* Button to trigger/re-trigger calculation - only if not confirmed */}
                    {user && (request.status === 'pending_calculation' || request.status === 'pending' || request.status === 'results_ready' || request.status === 'no_slots_found') && (
                        <Button
                            variant="outline"
                            size="default"
                            className="w-full border-slate-300 hover:bg-slate-100"
                            onClick={handleTriggerFindCommonTimes}
                            isLoading={isCalculatingSlots}
                            disabled={isCalculatingSlots}
                        >
                            {isCalculatingSlots ? 'Calculating...' : (request.status === 'results_ready' || request.status === 'no_slots_found' ? 'Re-Calculate Common Times' : 'Calculate Common Times Now')}
                        </Button>
                    )}
                    {/* Message about waiting for participants - only if pending and not confirmed */}
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
            {request && (
                <Modal
                    isOpen={isResultsModalOpen}
                    onClose={() => { setIsResultsModalOpen(false); setSelectedFinalSlotIndex(null); }}
                    title={`Available Slots for "${request.requestName}"`}
                    size="lg"
                >
                    <div className="max-h-[60vh] overflow-y-auto space-y-3 p-1">
                        {calculatedCommonSlots.length > 0 ? (
                            calculatedCommonSlots.map((slot, index) => (
                                <div
                                    key={index}
                                    className={`p-4 border rounded-lg transition-all cursor-pointer
                                       ${selectedFinalSlotIndex === index
                                            ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-300 shadow-md'
                                            : 'bg-green-50 border-green-300 hover:bg-green-100 hover:shadow-sm'
                                        }`}
                                    onClick={() => user && user.uid === request.creatorUid && request.status !== 'confirmed' && setSelectedFinalSlotIndex(index)}
                                >
                                    {/* ... (existing slot display: start, end, duration, available participants) ... */}
                                    <p className="font-semibold text-green-700 text-md">
                                        {format(slot.start, 'EEE, MMM d, yyyy')}
                                    </p>
                                    <p className="text-lg text-green-800">
                                        {format(slot.start, 'hh:mm a')} – {format(slot.end, 'hh:mm a')}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Duration: {Math.round((slot.end.getTime() - slot.start.getTime()) / (1000 * 60))} minutes
                                    </p>
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
                                    {selectedFinalSlotIndex === index && user && user.uid === request.creatorUid && request.status !== 'confirmed' && (
                                        <div className="mt-3 text-center">
                                            <CheckCircleIcon className="h-6 w-6 text-blue-600 inline-block mr-1" />
                                            <span className="text-blue-700 font-semibold">Selected for Confirmation</span>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (<p className="text-slate-500 text-center py-8">
                            No common slots found with the current participant availability.
                            {isCreator && " You might want to re-calculate or invite more participants."}
                        </p>)}
                    </div>
                    <div className="mt-6 pt-4 border-t flex justify-between items-center">
                        <Button variant="outline" onClick={() => { setIsResultsModalOpen(false); setSelectedFinalSlotIndex(null); }}>Close</Button>
                        {user && user.uid === request.creatorUid && request.status !== 'confirmed' && calculatedCommonSlots.length > 0 && (
                            <Button
                                onClick={handleInitiateConfirmFinalSlot} // CHANGED HERE
                                // isLoading={isConfirmingSlot} // This button doesn't show loading directly anymore
                                disabled={isConfirmingSlot || selectedFinalSlotIndex === null}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                Confirm Selected Slot
                            </Button>
                        )}
                        {request.status === 'confirmed' && request.finalSelectedSlot && (
                            <section className="mb-8 p-6 bg-teal-50 border-2 border-teal-400 rounded-lg shadow-lg text-center">
                                <h2 className="text-2xl font-bold text-teal-700 mb-3">Event Confirmed!</h2>
                                <div className="text-xl text-teal-600">
                                    {/* CORRECTED LINES: */}
                                    <p>{format(request.finalSelectedSlot.start, 'EEE, MMM d, yyyy')}</p>
                                    <p>
                                        {format(request.finalSelectedSlot.start, 'hh:mm a')} –
                                        {format(request.finalSelectedSlot.end, 'hh:mm a')}
                                    </p>
                                </div>
                                {/* You might want to list who confirmed or was available */}
                            </section>
                        )}
                    </div>
                </Modal>

            )}
            {slotToConfirmDetails && (
                <ConfirmationModal
                    isOpen={showAddToCalendarConfirm}
                    onClose={() => { setShowAddToCalendarConfirm(false); setSlotToConfirmDetails(null); }}
                    onConfirm={handleConfirmSlotAndSendInvitations} // Call the function to confirm and send invitations
                    title="Confirm and Send Invitations"
                    message={
                        <div>
                            <p>You are about to confirm the following time slot for "<strong>{request?.requestName}</strong>":</p>
                            <p className="font-semibold my-2">
                                {slotToConfirmDetails?.start ? format(slotToConfirmDetails.start, 'EEE, MMM d, yyyy') : ''} from {' '}
                                {slotToConfirmDetails?.start ? format(slotToConfirmDetails.start, 'hh:mm a') : ''} to {slotToConfirmDetails?.end ? format(slotToConfirmDetails.end, 'hh:mm a') : ''}
                            </p>
                            <p className="mt-3 text-sm text-gray-600">
                                This will send an invitation to all available participants
                                ({slotToConfirmDetails?.availableParticipants.map(pid => request?.participants[pid]?.displayName || 'Unknown').join(', ')}).
                            </p>
                            <p className="mt-1 text-sm text-gray-600">Are you sure?</p>
                        </div>
                    }
                    confirmText="Yes, Confirm & Add to Calendars"
                    cancelText="Cancel"
                    isLoading={isConfirmingSlot} // This modal's confirm button shows loading
                />
            )}
        </div>

    );
}