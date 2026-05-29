'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAddCalendarItem,
  useCalendarItems,
  useDeleteCalendarItem,
  useDeleteStampCascade,
  useUpdateCalendarItem,
} from '@/lib/queries/calendarItems';
import { CalendarEvent, CalendarEventUpdate } from '@/types/events';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/lib/queries/keys';

function makeMockEvents(): CalendarEvent[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const dayAfter = new Date(y, m, d + 2);
  const nextWeek = new Date(y, m, d + 7);
  return [
    {
      id: 'mock-1',
      title: 'Team Meeting',
      start: new Date(y, m, d, 10, 0),
      end: new Date(y, m, d, 11, 0),
      color: '#2563eb',
    },
    {
      id: 'mock-2',
      title: 'Gym Session',
      start: new Date(y, m, d, 18, 0),
      end: new Date(y, m, d, 19, 0),
      color: '#16a34a',
      isStamp: true,
      emoji: '🏋️',
    },
    {
      id: 'mock-3',
      title: 'Project Deadline',
      start: dayAfter,
      end: dayAfter,
      allDay: true,
      color: '#dc2626',
    },
    {
      id: 'mock-4',
      title: 'Weekend Getaway',
      start: nextWeek,
      end: new Date(y, m, d + 9),
      allDay: true,
      color: '#f97316',
    },
    {
      id: 'mock-5',
      title: 'Lunch with Client',
      start: new Date(y, m, d, 12, 30),
      end: new Date(y, m, d, 13, 30),
      color: '#f59e0b',
    },
  ];
}

export type StampDeleteMode = 'soft' | 'cascade';

export interface CalendarStore {
  events: CalendarEvent[];
  isLoading: boolean;
  addEvent: (data: Omit<CalendarEvent, 'id'>) => Promise<string>;
  updateEvent: (id: string, data: CalendarEventUpdate) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  /**
   * Remove a stamp definition.
   *  - 'soft' — keep placed instances; mark the definition with stampDeletedAt
   *    so it disappears from the palette and stops generating new recurrences.
   *  - 'cascade' — delete the definition AND every applied instance (one server
   *    round-trip + batched deletes).
   */
  deleteStamp: (id: string, mode: StampDeleteMode) => Promise<void>;
}

export function useCalendarStore(): CalendarStore {
  const { user, isGuest, isPublicSession } = useAuth();
  const uid = user && !isGuest && !isPublicSession ? user.uid : undefined;
  const qc = useQueryClient();

  const query = useCalendarItems(uid);
  const addMutation = useAddCalendarItem(uid);
  const updateMutation = useUpdateCalendarItem(uid);
  const deleteMutation = useDeleteCalendarItem(uid);
  const cascadeMutation = useDeleteStampCascade(uid);

  const [guestEvents, setGuestEvents] = useState<CalendarEvent[]>(() =>
    isGuest ? makeMockEvents() : [],
  );

  const events = isGuest ? guestEvents : (query.data ?? []);
  const isLoading = isGuest ? false : query.isLoading;

  const addEvent = useCallback(
    async (data: Omit<CalendarEvent, 'id'>): Promise<string> => {
      if (isGuest) {
        const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setGuestEvents((prev) => [...prev, { ...data, id }]);
        return id;
      }
      if (!uid) throw new Error('Not signed in');
      return addMutation.mutateAsync(data);
    },
    [isGuest, uid, addMutation],
  );

  const updateEvent = useCallback(
    async (id: string, data: CalendarEventUpdate) => {
      if (isGuest) {
        setGuestEvents((prev) =>
          prev.map((e) => {
            if (e.id !== id) return e;
            // For guest mode (in-memory), translate `null` → field removed
            // so the local state matches what Firestore would do.
            const next = { ...e } as Record<string, unknown>;
            for (const [k, v] of Object.entries(data)) {
              if (v === null) delete next[k];
              else if (v !== undefined) next[k] = v;
            }
            return next as unknown as CalendarEvent;
          }),
        );
        return;
      }
      if (!uid) throw new Error('Not signed in');
      await updateMutation.mutateAsync({ itemId: id, data });
    },
    [isGuest, uid, updateMutation],
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      if (isGuest) {
        setGuestEvents((prev) => prev.filter((e) => e.id !== id));
        return;
      }
      if (!uid) throw new Error('Not signed in');
      await deleteMutation.mutateAsync(id);
    },
    [isGuest, uid, deleteMutation],
  );

  const deleteStamp = useCallback(
    async (id: string, mode: StampDeleteMode) => {
      if (mode === 'soft') {
        if (isGuest) {
          setGuestEvents((prev) =>
            prev.map((e) => (e.id === id ? { ...e, stampDeletedAt: new Date() } : e)),
          );
          return;
        }
        if (!uid) throw new Error('Not signed in');
        await updateMutation.mutateAsync({
          itemId: id,
          data: { stampDeletedAt: new Date() },
        });
        return;
      }

      // cascade
      if (isGuest) {
        setGuestEvents((prev) => prev.filter((e) => e.id !== id && e.originalStampId !== id));
        return;
      }
      if (!uid) throw new Error('Not signed in');
      await cascadeMutation.mutateAsync(id);
      // Optimistically prune the cache so the UI updates before the
      // invalidation refetch completes. The mutation's onSuccess will then
      // reconcile with the server.
      qc.setQueryData<CalendarEvent[]>(queryKeys.calendarItems(uid), (old) =>
        (old ?? []).filter((e) => e.id !== id && e.originalStampId !== id),
      );
    },
    [isGuest, uid, updateMutation, cascadeMutation, qc],
  );

  return { events, isLoading, addEvent, updateEvent, deleteEvent, deleteStamp };
}
