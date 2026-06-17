'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addParticipantToHangoutRequest,
  createHangoutRequest,
  deleteHangoutRequest,
  fetchHangoutRequestById,
  fetchHangoutRequestsForUser,
  updateHangoutRequestDetails,
} from '@/lib/firebase/firestoreService';
import { HangoutRequest, HangoutRequestFormData, ParticipantDataClient } from '@/types/hangouts';
import { queryKeys } from './keys';

export function useHangoutRequestsForUser(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hangoutRequests.list(userId),
    queryFn: () => (userId ? fetchHangoutRequestsForUser(userId) : Promise.resolve([])),
    enabled: !!userId,
  });
}

export function useHangoutRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: requestId
      ? queryKeys.hangoutRequests.detail(requestId)
      : ['hangoutRequests', 'detail', null],
    queryFn: () => (requestId ? fetchHangoutRequestById(requestId) : Promise.resolve(null)),
    enabled: !!requestId,
  });
}

export function useCreateHangoutRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      creatorUid: string;
      creatorName: string;
      formData: HangoutRequestFormData;
      recipientUids?: string[];
    }) =>
      createHangoutRequest(
        args.creatorUid,
        args.creatorName,
        args.formData,
        args.recipientUids ?? [],
      ),
    onSuccess: (_id, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.hangoutRequests.list(vars.creatorUid) }),
  });
}

export function useAddParticipant(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { userId: string; data: ParticipantDataClient }) =>
      addParticipantToHangoutRequest(requestId, args.userId, args.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.hangoutRequests.detail(requestId) }),
  });
}

type HangoutUpdate = Partial<
  Pick<
    HangoutRequest,
    | 'requestName'
    | 'desiredMemberCount'
    | 'status'
    | 'finalSelectedSlot'
    | 'commonAvailabilitySlots'
  >
>;

export function useUpdateHangoutRequestDetails(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: HangoutUpdate) => updateHangoutRequestDetails(requestId, data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.hangoutRequests.detail(requestId) }),
  });
}

export function useDeleteHangoutRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => deleteHangoutRequest(requestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.hangoutRequests.all }),
  });
}
