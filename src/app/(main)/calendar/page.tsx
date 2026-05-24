'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { isSameDay } from 'date-fns';
import { CalendarEvent, CalendarEventUpdate } from '@/types/events';
import { useAuth } from '@/contexts/AuthContext';
import { showActionToast, showErrorToast, showInfoToast, showSuccessToast } from '@/lib/toasts';
import { expandRecurringEvents } from '@/utils/eventUtils';
import { buildStampUsageMap } from '@/utils/stampStats';
import { presetToStamp } from '@/lib/stampPresets';
import { useCalendarStore } from '@/hooks/useCalendarStore';
import { useCalendarView } from '@/hooks/useCalendarView';
import { useTravelBuffers } from '@/hooks/useTravelBuffers';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useGoogleCalendarEvents, useGoogleStatus } from '@/lib/queries/google';
import { CalendarPageHeader } from '@/components/calendar/CalendarPageHeader';
import { StampPaletteSheet } from '@/components/calendar/StampPaletteSheet';
import { StampPlacementChip } from '@/components/calendar/StampPlacementChip';
import { EventDialog } from '@/components/calendar/EventDialog';
import { StampDialog } from '@/components/calendar/StampDialog';
import { StampDeleteDialog } from '@/components/calendar/StampDeleteDialog';
import { StampPackShareDialog } from '@/components/calendar/StampPackShareDialog';
import DayDetailsModal from '@/components/calendar/DayDetailsModal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import '@/styles/calendar.css';

const DynamicCalendarView = dynamic(
  () => import('@/components/calendar/CalendarView').then((mod) => mod.CalendarView),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <p className="text-gray-500">Loading Calendar…</p>
      </div>
    ),
  },
);

type PendingDelete = { id: string; type: 'event' | 'stamp' };

export default function CalendarPage() {
  const { user, isGuest } = useAuth();
  const store = useCalendarStore();
  const { view, date, viewWindow, handleNavigate, handleViewChange } = useCalendarView('month');
  const { prefs } = useUserPreferences();

  const [isSimpleMode, setIsSimpleMode] = useState(true);
  const [eventDialog, setEventDialog] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    event: CalendarEvent | null;
    defaultStart?: Date;
    defaultEnd?: Date;
  }>({ open: false, mode: 'create', event: null });
  const [stampDialog, setStampDialog] = useState<{ open: boolean; stamp: CalendarEvent | null }>({
    open: false,
    stamp: null,
  });
  const [dayDetails, setDayDetails] = useState<{ open: boolean; date: Date | null }>({
    open: false,
    date: null,
  });
  const [selectedStampForPlacement, setSelectedStampForPlacement] = useState<CalendarEvent | null>(
    null,
  );
  // Holds the stamp currently mid-drag from the palette. Ref because RBC's
  // onDropFromOutside reads it during a synchronous drop callback and we don't
  // want the drop handler to be re-created on every drag.
  const draggedStampRef = useRef<CalendarEvent | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const isSignedIn = !!user && !isGuest;
  const { data: googleStatus } = useGoogleStatus(isSignedIn);
  const { data: gcalEvents = [] } = useGoogleCalendarEvents(
    viewWindow,
    isSignedIn && !!googleStatus?.connected,
  );

  // Soft-deleted stamp definitions stay in Firestore (so their already-placed
  // instances remain coherent) but should not surface in the palette, nor
  // generate any new recurrence occurrences.
  const visibleEvents = useMemo(
    () => store.events.filter((e) => !(e.isStamp && !e.originalStampId && e.stampDeletedAt)),
    [store.events],
  );

  const displayedEvents = useMemo(() => {
    const expandedLocal =
      viewWindow && visibleEvents.length > 0
        ? expandRecurringEvents(visibleEvents, viewWindow.start, viewWindow.end)
        : visibleEvents;
    return [...expandedLocal, ...gcalEvents];
  }, [visibleEvents, viewWindow, gcalEvents]);

  const travelBuffers = useTravelBuffers(displayedEvents, prefs.locationFeaturesEnabled);

  const masterStamps = useMemo(
    () => visibleEvents.filter((e) => e.isStamp && !e.originalStampId),
    [visibleEvents],
  );

  const stampUsage = useMemo(() => buildStampUsageMap(store.events), [store.events]);

  /**
   * Top stamps to surface in the day right-click context menu:
   * pinned first, then by total usage. Capped at 5 for menu readability.
   */
  const contextMenuStamps = useMemo(() => {
    const sorted = [...masterStamps].sort((a, b) => {
      if (!!a.stampPinned !== !!b.stampPinned) return a.stampPinned ? -1 : 1;
      const aUse = stampUsage.get(a.id)?.total ?? 0;
      const bUse = stampUsage.get(b.id)?.total ?? 0;
      if (aUse !== bUse) return bUse - aUse;
      return a.title.localeCompare(b.title);
    });
    return sorted.slice(0, 5);
  }, [masterStamps, stampUsage]);

  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of masterStamps) {
      if (s.stampCategory) set.add(s.stampCategory);
    }
    return Array.from(set).sort();
  }, [masterStamps]);

  const eventsForSelectedDay = useMemo(() => {
    if (!dayDetails.date) return [];
    const target = dayDetails.date;
    return displayedEvents.filter((event) => {
      const startDay = new Date(new Date(event.start).setHours(0, 0, 0, 0));
      const targetDay = new Date(new Date(target).setHours(0, 0, 0, 0));
      if (event.allDay && event.start && event.end) {
        const endDay = new Date(new Date(event.end).setHours(0, 0, 0, 0));
        return targetDay >= startDay && targetDay <= endDay;
      }
      return isSameDay(startDay, targetDay);
    });
  }, [dayDetails.date, displayedEvents]);

  const openCreateEvent = useCallback((slot?: { start: Date; end: Date }) => {
    setEventDialog({
      open: true,
      mode: 'create',
      event: null,
      defaultStart: slot?.start,
      defaultEnd: slot?.end,
    });
  }, []);

  const openEditEvent = useCallback((event: CalendarEvent) => {
    setEventDialog({ open: true, mode: 'edit', event });
  }, []);

  const closeEventDialog = useCallback(
    () => setEventDialog((s) => ({ ...s, open: false })),
    [],
  );

  const handleSaveEvent = useCallback(
    async (data: CalendarEventUpdate & { id?: string; title?: string; start?: Date; end?: Date }) => {
      if (!user && !isGuest) {
        showErrorToast('Please sign in to save events.');
        return;
      }
      try {
        if (eventDialog.mode === 'edit' && data.id) {
          const update: CalendarEventUpdate = {
            ...data,
            isStamp: false,
            allDay: data.allDay || false,
            start: data.start ? new Date(data.start) : undefined,
            end: data.end ? new Date(data.end) : undefined,
          };
          await store.updateEvent(data.id, update);
          showSuccessToast('Event updated successfully!');
        } else {
          if (!data.title || !data.start || !data.end) {
            showErrorToast('Title, start, and end are required.');
            return;
          }
          const newEvent: Omit<CalendarEvent, 'id'> = {
            title: data.title,
            start: new Date(data.start),
            end: new Date(data.end),
            allDay: data.allDay || false,
            color: data.color ?? undefined,
            isStamp: false,
            // Strip nulls (only meaningful for updates) on create.
            location: data.location ?? undefined,
            travelMode: data.travelMode ?? undefined,
          };
          await store.addEvent(newEvent);
          showSuccessToast('Event added successfully!');
        }
        closeEventDialog();
      } catch (err) {
        console.error('Error saving event:', err);
        showErrorToast('Failed to save event.');
      }
    },
    [user, isGuest, eventDialog.mode, store, closeEventDialog],
  );

  const handleSaveStamp = useCallback(
    async (data: CalendarEventUpdate & { id?: string; title: string; start: Date; end: Date }) => {
      if (!user && !isGuest) {
        showErrorToast('Please sign in to save stamps.');
        return;
      }
      try {
        if (data.id) {
          const update: CalendarEventUpdate = {
            ...data,
            isStamp: true,
            allDay: data.allDay || false,
            start: new Date(data.start),
            end: new Date(data.end),
            repeatEndDate: data.repeatEndDate ? new Date(data.repeatEndDate) : undefined,
          };
          await store.updateEvent(data.id, update);
          showSuccessToast('Stamp updated successfully!');
        } else {
          const newStamp: Omit<CalendarEvent, 'id'> = {
            title: data.title,
            start: new Date(data.start),
            end: new Date(data.end),
            allDay: data.allDay || false,
            color: data.color ?? undefined,
            isStamp: true,
            emoji: data.emoji ?? undefined,
            repeatDays: data.repeatDays ?? undefined,
            repeatEndDate: data.repeatEndDate ? new Date(data.repeatEndDate) : undefined,
            stampCategory: data.stampCategory ?? undefined,
            stampAvailability: data.stampAvailability ?? undefined,
            location: data.location ?? undefined,
            travelMode: data.travelMode ?? undefined,
          };
          await store.addEvent(newStamp);
          showSuccessToast('Stamp added successfully!');
        }
        setStampDialog({ open: false, stamp: null });
      } catch (err) {
        console.error('Error saving stamp:', err);
        showErrorToast('Failed to save stamp.');
      }
    },
    [user, isGuest, store],
  );

  const handleApplyStamp = useCallback(
    async (stamp: CalendarEvent, dropDate: Date) => {
      if (!stamp.isStamp) return;
      const stampStart = new Date(stamp.start);
      const stampEnd = new Date(stamp.end);
      const newStart = new Date(dropDate);
      newStart.setHours(stampStart.getHours(), stampStart.getMinutes(), 0, 0);
      const newEnd = new Date(dropDate);
      newEnd.setHours(stampEnd.getHours(), stampEnd.getMinutes(), 0, 0);

      const stampStartDay = new Date(stampStart).setHours(0, 0, 0, 0);
      const stampEndDay = new Date(stampEnd).setHours(0, 0, 0, 0);
      if (stampEndDay > stampStartDay && newEnd.getTime() <= newStart.getTime()) {
        const dayDiff = (stampEndDay - stampStartDay) / (1000 * 60 * 60 * 24);
        newEnd.setDate(newEnd.getDate() + dayDiff);
      }

      const instance: Omit<CalendarEvent, 'id'> = {
        title: stamp.title,
        start: newStart,
        end: newEnd,
        allDay: stamp.allDay,
        color: stamp.color,
        isStamp: true,
        emoji: stamp.emoji,
        originalStampId: stamp.id,
        occurrenceDate: newStart,
        location: stamp.location,
        travelMode: stamp.travelMode,
      };
      try {
        const newId = await store.addEvent(instance);
        showActionToast(
          `Placed ${stamp.emoji ?? ''} ${instance.title}`.trim(),
          'Undo',
          () => {
            void store
              .deleteEvent(newId)
              .catch((err) => {
                console.error('Error undoing stamp placement:', err);
                showErrorToast('Could not undo placement.');
              });
          },
        );
      } catch (err) {
        console.error('Error applying stamp:', err);
        showErrorToast('Failed to apply stamp.');
      }
    },
    [store],
  );

  /**
   * Apply a stamp to many days at once. One undo toast covers the whole batch.
   * Adds are issued in parallel; partial failures are surfaced as a single
   * error toast and don't roll back successful inserts (manual undo still works
   * for those via the toast button).
   */
  const handleApplyStampMany = useCallback(
    async (stamp: CalendarEvent, dropDates: Date[]) => {
      if (!stamp.isStamp || dropDates.length === 0) return;
      const stampStart = new Date(stamp.start);
      const stampEnd = new Date(stamp.end);
      const stampStartDay = new Date(stampStart).setHours(0, 0, 0, 0);
      const stampEndDay = new Date(stampEnd).setHours(0, 0, 0, 0);
      const multiDay = stampEndDay > stampStartDay;
      const dayDiff = multiDay ? (stampEndDay - stampStartDay) / (1000 * 60 * 60 * 24) : 0;

      const instances: Omit<CalendarEvent, 'id'>[] = dropDates.map((dropDate) => {
        const newStart = new Date(dropDate);
        newStart.setHours(stampStart.getHours(), stampStart.getMinutes(), 0, 0);
        const newEnd = new Date(dropDate);
        newEnd.setHours(stampEnd.getHours(), stampEnd.getMinutes(), 0, 0);
        if (multiDay) newEnd.setDate(newEnd.getDate() + dayDiff);
        return {
          title: stamp.title,
          start: newStart,
          end: newEnd,
          allDay: stamp.allDay,
          color: stamp.color,
          isStamp: true,
          emoji: stamp.emoji,
          originalStampId: stamp.id,
          occurrenceDate: newStart,
          location: stamp.location,
          travelMode: stamp.travelMode,
        };
      });

      const results = await Promise.allSettled(instances.map((i) => store.addEvent(i)));
      const newIds = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      const failed = results.length - newIds.length;
      if (failed > 0) showErrorToast(`Failed to place ${failed} of ${results.length}.`);
      if (newIds.length === 0) return;

      showActionToast(
        `Placed ${newIds.length} × ${stamp.emoji ?? ''} ${stamp.title}`.trim(),
        'Undo',
        () => {
          void Promise.allSettled(newIds.map((id) => store.deleteEvent(id))).then((r) => {
            const failures = r.filter((x) => x.status === 'rejected').length;
            if (failures > 0) showErrorToast(`Could not undo ${failures} placement(s).`);
            else showInfoToast('Undone.');
          });
        },
      );
    },
    [store],
  );

  const handleDropFromOutside = useCallback(
    (slot: { start: Date | string; end: Date | string; allDay: boolean }) => {
      const stamp = draggedStampRef.current;
      if (!stamp) return;
      const dropDate = slot.start instanceof Date ? slot.start : new Date(slot.start);
      void handleApplyStamp(stamp, dropDate);
      draggedStampRef.current = null;
    },
    [handleApplyStamp],
  );

  const handleSelectSlot = useCallback(
    (slot: { start: Date; end: Date; slots: Date[] | string[]; action: string }) => {
      if (selectedStampForPlacement) {
        // Range-paint: when the user drags across multiple cells with a stamp
        // armed, place one instance per unique day. Single-cell taps still
        // route through the cheaper single-apply path.
        const dayKeys = new Set<string>();
        const days: Date[] = [];
        for (const raw of slot.slots ?? []) {
          const d = raw instanceof Date ? raw : new Date(raw);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          if (!dayKeys.has(key)) {
            dayKeys.add(key);
            days.push(d);
          }
        }
        if (days.length > 1) {
          void handleApplyStampMany(selectedStampForPlacement, days);
        } else {
          void handleApplyStamp(selectedStampForPlacement, slot.start);
        }
        return;
      }
      if (slot.action === 'click' || slot.action === 'doubleClick') {
        setDayDetails({ open: true, date: slot.start });
      } else if (slot.action === 'select') {
        openCreateEvent({ start: slot.start, end: slot.end });
      }
    },
    [selectedStampForPlacement, handleApplyStamp, handleApplyStampMany, openCreateEvent],
  );

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      // Synthetic travel chips aren't editable — they're computed from the
      // adjacent real events.
      const r = event.resource as { type?: string } | undefined;
      if (r?.type === 'travel') return;
      if (selectedStampForPlacement) {
        void handleApplyStamp(selectedStampForPlacement, event.start);
        return;
      }
      if (isSimpleMode && view === 'month') {
        setDayDetails({ open: true, date: event.start });
      } else {
        openEditEvent(event);
      }
    },
    [selectedStampForPlacement, handleApplyStamp, isSimpleMode, view, openEditEvent],
  );

  const confirmEventDelete = useCallback(async () => {
    if (!pendingDelete || pendingDelete.type !== 'event') return;
    setIsDeleting(true);
    try {
      await store.deleteEvent(pendingDelete.id);
      showSuccessToast('Event deleted successfully!');
      closeEventDialog();
    } catch (err) {
      console.error('Delete failed:', err);
      showErrorToast('Failed to delete.');
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }, [pendingDelete, store, closeEventDialog]);

  const confirmStampDelete = useCallback(
    async (mode: 'soft' | 'cascade') => {
      if (!pendingDelete || pendingDelete.type !== 'stamp') return;
      try {
        await store.deleteStamp(pendingDelete.id, mode);
        showSuccessToast(
          mode === 'soft'
            ? 'Stamp retired. Placed instances kept.'
            : 'Stamp and all instances deleted.',
        );
        setStampDialog({ open: false, stamp: null });
        if (selectedStampForPlacement?.id === pendingDelete.id) {
          setSelectedStampForPlacement(null);
        }
        setPendingDelete(null);
      } catch (err) {
        console.error('Stamp delete failed:', err);
        showErrorToast('Failed to delete stamp.');
      }
    },
    [pendingDelete, store, selectedStampForPlacement],
  );

  const pendingStamp = useMemo(() => {
    if (!pendingDelete || pendingDelete.type !== 'stamp') return null;
    return store.events.find((e) => e.id === pendingDelete.id) ?? null;
  }, [pendingDelete, store.events]);

  const pendingStampInstanceCount = useMemo(() => {
    if (!pendingDelete || pendingDelete.type !== 'stamp') return 0;
    return store.events.filter((e) => e.originalStampId === pendingDelete.id).length;
  }, [pendingDelete, store.events]);

  return (
    <div className="p-2 md:p-6 flex flex-col md:flex-row gap-4">
      <div className="flex-grow">
        <CalendarPageHeader
          user={user}
          isGuest={isGuest}
          isSimpleMode={isSimpleMode}
          onToggleMode={() => setIsSimpleMode((s) => !s)}
          onAddEvent={() => openCreateEvent()}
        />
        <DynamicCalendarView
          events={displayedEvents}
          currentView={view}
          currentDate={date}
          onView={handleViewChange}
          onNavigate={handleNavigate}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          isSimpleMode={isSimpleMode}
          onDropFromOutside={handleDropFromOutside}
          contextStamps={contextMenuStamps}
          onApplyStampToDay={(stamp, day) => {
            void handleApplyStamp(stamp, day);
          }}
          travelBuffers={travelBuffers}
        />
      </div>

      <StampPaletteSheet
        stamps={masterStamps}
        selectedStamp={selectedStampForPlacement}
        onSelect={setSelectedStampForPlacement}
        onEdit={(stamp) => setStampDialog({ open: true, stamp })}
        onNewStamp={() => setStampDialog({ open: true, stamp: null })}
        usage={stampUsage}
        onTogglePin={(stamp) => {
          void store
            .updateEvent(stamp.id, { stampPinned: !stamp.stampPinned })
            .catch((err) => {
              console.error('Error pinning stamp:', err);
              showErrorToast('Could not update pin.');
            });
        }}
        onAddPreset={(preset) => {
          void store
            .addEvent(presetToStamp(preset))
            .then(() => showSuccessToast(`Added ${preset.emoji} ${preset.title}`))
            .catch((err) => {
              console.error('Error adding preset stamp:', err);
              showErrorToast('Could not add preset.');
            });
        }}
        onSharePack={isSignedIn ? () => setShareDialogOpen(true) : undefined}
        onDragStartStamp={(stamp) => {
          draggedStampRef.current = stamp;
        }}
        onDragEndStamp={() => {
          draggedStampRef.current = null;
        }}
      />

      <EventDialog
        isOpen={eventDialog.open}
        mode={eventDialog.mode}
        event={eventDialog.event}
        defaultStart={eventDialog.defaultStart}
        defaultEnd={eventDialog.defaultEnd}
        onClose={closeEventDialog}
        onSave={handleSaveEvent}
        onRequestDelete={
          eventDialog.event ? () => setPendingDelete({ id: eventDialog.event!.id, type: 'event' }) : undefined
        }
        onConvertToStamp={(draft) => {
          closeEventDialog();
          setStampDialog({
            open: true,
            stamp: {
              title: draft.title,
              start: draft.start,
              end: draft.end,
              color: draft.color,
              isStamp: true,
            } as CalendarEvent,
          });
        }}
      />

      <StampDialog
        isOpen={stampDialog.open}
        stamp={stampDialog.stamp}
        onClose={() => setStampDialog({ open: false, stamp: null })}
        onSave={handleSaveStamp}
        onRequestDelete={
          stampDialog.stamp
            ? () => setPendingDelete({ id: stampDialog.stamp!.id, type: 'stamp' })
            : undefined
        }
        existingCategories={existingCategories}
      />

      <DayDetailsModal
        isOpen={dayDetails.open}
        onClose={() => setDayDetails({ open: false, date: null })}
        selectedDate={dayDetails.date}
        eventsOnDay={eventsForSelectedDay}
        onAddEvent={(d) => {
          setDayDetails({ open: false, date: null });
          const start = new Date(d);
          start.setHours(9, 0, 0, 0);
          const end = new Date(d);
          end.setHours(10, 0, 0, 0);
          openCreateEvent({ start, end });
        }}
        onEditEvent={(event) => {
          setDayDetails({ open: false, date: null });
          openEditEvent(event);
        }}
      />

      <StampPlacementChip
        stamp={selectedStampForPlacement}
        onCancel={() => setSelectedStampForPlacement(null)}
      />

      <ConfirmationModal
        isOpen={!!pendingDelete && pendingDelete.type === 'event'}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmEventDelete}
        title="Confirm Deletion"
        message="Delete this event?"
        confirmText="Delete"
        isLoading={isDeleting}
      />

      <StampDeleteDialog
        isOpen={!!pendingDelete && pendingDelete.type === 'stamp'}
        stamp={pendingStamp}
        instanceCount={pendingStampInstanceCount}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmStampDelete}
      />

      {user && !isGuest && (
        <StampPackShareDialog
          isOpen={shareDialogOpen}
          stamps={masterStamps}
          ownerUid={user.uid}
          onClose={() => setShareDialogOpen(false)}
        />
      )}
    </div>
  );
}
