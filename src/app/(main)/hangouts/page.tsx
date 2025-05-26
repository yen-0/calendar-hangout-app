// src/app/(main)/hangouts/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import dynamic from 'next/dynamic';
import { HangoutRequestClientState, HangoutRequestFormData, DateRangeClient } from '@/types/hangouts'; // Corrected import
import {
    createHangoutRequest,
    fetchHangoutRequestsForUser,
    updateHangoutRequestDetails,
    deleteHangoutRequest,
    fetchCalendarItems
} from '@/lib/firebase/firestoreService';
import { prepareCreatorEventsForRequest } from '@/utils/hangoutUtils';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/lib/toasts';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { format } from 'date-fns'; // For date formatting

const DynamicHangoutRequestForm = dynamic(
  () => import('@/components/hangouts/HangoutRequestForm'),
  { ssr: false, loading: () => <p className="p-6 text-center">Loading form...</p> }
);

export default function HangoutsPage() {
  const { user, loading: authLoading, isGuest } = useAuth(); // Added isGuest
  const [requests, setRequests] = useState<HangoutRequestClientState[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newlyCreatedRequestId, setNewlyCreatedRequestId] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState<HangoutRequestClientState | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<HangoutRequestClientState | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const loadRequests = useCallback(async () => {
    if (authLoading || !user || isGuest) { // Don't load for guests
      setRequests([]);
      setIsLoadingRequests(false);
      return;
    }
    setIsLoadingRequests(true);
    try {
      const userRequests = await fetchHangoutRequestsForUser(user.uid);
      setRequests(userRequests);
    } catch (error) {
      console.error("Failed to load hangout requests:", error);
      showErrorToast("Could not load your hangout requests.");
      setRequests([]);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [user, authLoading, isGuest]); // Added isGuest dependency

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleOpenCreateModal = () => {
    if (!user || isGuest) { // Prevent guests from opening create modal
        showInfoToast("Please sign in to create hangout requests.");
        return;
    }
    setNewlyCreatedRequestId(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => setIsCreateModalOpen(false);

  const handleOpenEditModal = (req: HangoutRequestClientState) => {
    setEditingRequest(req);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedRequest = async (formData: HangoutRequestFormData) => {
    if (!editingRequest || !user || user.uid !== editingRequest.creatorUid || isGuest) return;
    setIsProcessingAction(true);
    try {
      const dataToUpdate: Partial<Pick<HangoutRequestClientState, 'requestName' | 'desiredMemberCount'>> = {
        requestName: formData.requestName,
        desiredMemberCount: formData.desiredMemberCount,
      };
      await updateHangoutRequestDetails(editingRequest.id, dataToUpdate);
      showSuccessToast("Request updated!");
      setIsEditModalOpen(false);
      setEditingRequest(null);
      loadRequests();
    } catch (error) {
      console.error("Error updating hangout request:", error);
      showErrorToast("Failed to update request. " + (error as Error).message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const promptDeleteRequest = (req: HangoutRequestClientState) => {
    setRequestToDelete(req);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDeleteRequest = async () => {
    if (!requestToDelete || !user || user.uid !== requestToDelete.creatorUid || isGuest) return;
    setIsProcessingAction(true);
    try {
      await deleteHangoutRequest(requestToDelete.id);
      showSuccessToast("Request deleted!");
      setIsConfirmDeleteOpen(false);
      setRequestToDelete(null);
      loadRequests();
    } catch (error) {
      console.error("Error deleting hangout request:", error);
      showErrorToast("Failed to delete request. " + (error as Error).message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCloseRequest = async (req: HangoutRequestClientState) => {
    if (!user || user.uid !== req.creatorUid || isGuest) return;
    if (!confirm(`Are you sure you want to close the request "${req.requestName}"?`)) {
      return;
    }
    setIsProcessingAction(true);
    try {
      await updateHangoutRequestDetails(req.id, { status: 'closed' });
      showSuccessToast("Request closed.");
      loadRequests();
    } catch (error) {
      console.error("Error closing request:", error);
      showErrorToast("Failed to close request. " + (error as Error).message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSaveRequest = async (formData: HangoutRequestFormData) => {
    if (!user || isGuest) { // Prevent guests
      showErrorToast("You must be signed in to create a request.");
      return;
    }
    setIsSubmitting(true);
    setNewlyCreatedRequestId(null);
    try {
      const userCalendarEvents = await fetchCalendarItems(user.uid);
      const creatorEventsForRequest = prepareCreatorEventsForRequest(
        userCalendarEvents,
        formData.dateRanges,
        formData.timeRanges
      );
      const newId = await createHangoutRequest(
        user.uid,
        user.displayName || user.email || "Anonymous User",
        formData,
        creatorEventsForRequest
      );
      setNewlyCreatedRequestId(newId);
      showSuccessToast("Hangout Request created successfully!");
      handleCloseCreateModal();
      loadRequests();
    } catch (error) {
      console.error("Error saving hangout request:", error);
      showErrorToast("Failed to create hangout request. " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getShareableLink = (requestId: string | null) => {
    if (!requestId) return "";
    return `${window.location.origin}/hangouts/reply/${requestId}`;
  };

  const copyLinkToClipboard = (link: string) => {
    if (!link) return;
    if (!navigator.clipboard) {
        showErrorToast("Clipboard API not available in this browser or context.");
        return;
    }
    navigator.clipboard.writeText(link)
      .then(() => showInfoToast("Link copied to clipboard!"))
      .catch(err => showErrorToast("Failed to copy link."));
  };

  if (authLoading) {
    return <div className="p-6 text-center">Loading authentication...</div>;
  }

  // If user is a guest, show a message prompting them to sign in
  if (isGuest) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4 text-lg">Want to create and manage hangout requests?</p>
        <p className="mb-4 text-gray-600">Please sign in or create an account to use this feature.</p>
        <Link href="/sign-in">
          <Button size="lg">Sign In / Sign Up</Button>
        </Link>
      </div>
    );
  }

  // If no user (and not a guest, meaning not yet loaded or truly logged out)
  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">Please sign in to manage hangout requests.</p>
        <Link href="/sign-in">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  // --- User is authenticated and not a guest ---
  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">My Hangout Requests</h1>
        {/* THIS BUTTON SHOULD ALWAYS BE VISIBLE FOR AUTHENTICATED (NON-GUEST) USERS */}
        <Button onClick={handleOpenCreateModal} className="bg-green-600 hover:bg-green-700 text-white">
          + Create New Request
        </Button>
      </div>

      {newlyCreatedRequestId && (
        <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-md shadow">
          <h3 className="text-lg font-semibold text-green-700">Request Created!</h3>
          <p className="text-sm text-green-600 mb-2">Share this link with others to collect their availability:</p>
          <div className="flex items-center gap-2">
            <Input type="text" readOnly value={getShareableLink(newlyCreatedRequestId)} className="bg-white" />
            <Button onClick={() => copyLinkToClipboard(getShareableLink(newlyCreatedRequestId))} variant="outline">
              Copy Link
            </Button>
          </div>
        </div>
      )}

      {isLoadingRequests ? (
        <p className="text-center text-gray-500 py-4">Loading your requests...</p>
      ) : requests.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-300 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto text-gray-400 mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-3.741-5.007M12 12h.01M12 12h.01M12 12h.01M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.53 1.977a5.25 5.25 0 0 1-5.008 3.741 9.095 9.095 0 0 1-3.741-.48M3.75 4.5a.75.75 0 0 0-.75.75v13.5a.75.75 0 0 0 .75.75h16.5a.75.75 0 0 0 .75-.75V5.25a.75.75 0 0 0-.75-.75H3.75Z" />
          </svg>
          <p className="text-gray-500">You haven't created any hangout requests yet.</p>
          <Button onClick={handleOpenCreateModal} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
            Create Your First Request
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="p-4 bg-white rounded-lg shadow border border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-semibold text-blue-700 hover:underline">
                    <Link href={`/hangouts/reply/${req.id}`}>
                      {req.requestName}
                    </Link>
                  </h2>
                  <p className="text-xs text-gray-500">
                    Created: {format(req.createdAt, 'PPP')}
                  </p>
                  <p className="text-xs text-gray-500">
                    Status: <span className="font-medium capitalize">{req.status.replace(/_/g, ' ')}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Participants: {Object.keys(req.participants || {}).length} / {req.desiredMemberCount}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyLinkToClipboard(getShareableLink(req.id))}
                >
                  Copy Share Link
                </Button>
              </div>
              {user && user.uid === req.creatorUid && req.status !== 'closed' && ( // Keep confirmed here, as archive is an action on confirmed
                <div className="mt-4 pt-3 border-t border-gray-200 flex flex-wrap items-center gap-2">
                  {req.status !== 'confirmed' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditModal(req)}
                        disabled={isProcessingAction}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => promptDeleteRequest(req)}
                        disabled={isProcessingAction}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                  {/* Button to Close or Archive */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCloseRequest(req)}
                    disabled={isProcessingAction}
                  >
                    {req.status === 'confirmed' ? 'Archive (Mark as Done)' : 'Close Request'}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={handleCloseCreateModal} title="Create New Hangout Request" size="lg">
        {isCreateModalOpen && (
          <DynamicHangoutRequestForm
            onSave={handleSaveRequest}
            onCancel={handleCloseCreateModal}
            isLoading={isSubmitting}
          />
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Hangout Request" size="lg">
        {isEditModalOpen && editingRequest && (
          <DynamicHangoutRequestForm
            onSave={handleSaveEditedRequest}
            onCancel={() => setIsEditModalOpen(false)}
            isLoading={isProcessingAction}
            initialData={{
              requestName: editingRequest.requestName,
              desiredDurationMinutes: editingRequest.desiredDurationMinutes,
              desiredMarginMinutes: editingRequest.desiredMarginMinutes,
              desiredMemberCount: editingRequest.desiredMemberCount,
              dateRanges: editingRequest.dateRanges, // Already DateRangeClient[]
              timeRanges: editingRequest.timeRanges,
            }}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={confirmDeleteRequest}
        title="Confirm Delete Request"
        message={`Are you sure you want to delete the request "${requestToDelete?.requestName}"? This action cannot be undone.`}
        isLoading={isProcessingAction}
        confirmText="Delete"
      />
    </div>
  );
}