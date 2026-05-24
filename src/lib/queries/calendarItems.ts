'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addCalendarItem,
  deleteCalendarItem,
  deleteStampWithInstances,
  fetchCalendarItems,
  updateCalendarItem,
} from '@/lib/firebase/firestoreService';
import { CalendarEvent, CalendarEventUpdate } from '@/types/events';
import { queryKeys } from './keys';

export function useCalendarItems(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.calendarItems(userId),
    queryFn: () => (userId ? fetchCalendarItems(userId) : Promise.resolve<CalendarEvent[]>([])),
    enabled: !!userId,
  });
}

export function useAddCalendarItem(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: Omit<CalendarEvent, 'id'>) => {
      if (!userId) throw new Error('User ID required to add a calendar item');
      return addCalendarItem(userId, item);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.calendarItems(userId) }),
  });
}

export function useUpdateCalendarItem(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { itemId: string; data: CalendarEventUpdate }) => {
      if (!userId) throw new Error('User ID required to update a calendar item');
      return updateCalendarItem(userId, args.itemId, args.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.calendarItems(userId) }),
  });
}

export function useDeleteCalendarItem(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => {
      if (!userId) throw new Error('User ID required to delete a calendar item');
      return deleteCalendarItem(userId, itemId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.calendarItems(userId) }),
  });
}

export function useDeleteStampCascade(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stampId: string) => {
      if (!userId) throw new Error('User ID required to delete a stamp');
      return deleteStampWithInstances(userId, stampId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.calendarItems(userId) }),
  });
}
