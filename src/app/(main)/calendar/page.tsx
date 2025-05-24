// src/app/(main)/calendar/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { CalendarEvent } from '@/types/events';
import { View } from 'react-big-calendar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import DayDetailsModal from '@/components/calendar/DayDetailsModal';
import '@/styles/calendar.css';
import { isSameDay } from 'date-fns'; // isWithinInterval might be needed for allDay in eventsForSelectedDay
import {
  fetchCalendarItems,
  addCalendarItem,
  updateCalendarItem,
  deleteCalendarItem
} from '@/lib/firebase/firestoreService';
import { expandRecurringEvents } from '@/utils/eventUtils';
import { addDays, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/lib/toasts'; 
import ConfirmationModal from '@/components/ui/ConfirmationModal';

// --- TOP-LEVEL DYNAMIC IMPORTS ---
const DynamicCalendarView = dynamic(
  () => import('@/components/calendar/CalendarView').then(mod => mod.CalendarView),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <p className="text-gray-500">Loading Calendar...</p>
      </div>
    ),
  }
);

const DynamicEventForm = dynamic(
    () => import('@/components/calendar/EventForm'),
    {
      ssr: false,
      loading: () => <p className="p-6 text-center">Loading form...</p>,
    }
);

const DynamicStampForm = dynamic(
  () => import('@/components/calendar/StampForm'),
  { ssr: false, loading: () => <p className="p-6 text-center">Loading stamp form...</p> }
);
// --- END TOP-LEVEL DYNAMIC IMPORTS ---

const getMockEvents = (): CalendarEvent[] => {
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2); dayAfter.setHours(12,0,0,0);
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
  return [
    { id: '1', title: 'Team Meeting', start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0, 0), end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0, 0), color: '#2563eb' },
    { id: '2', title: 'Gym Session', start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0, 0), end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 0, 0), color: '#16a34a', isStamp: true, emoji: '🏋️' },
    { id: '3', title: 'Project Deadline', start: dayAfter, end: dayAfter, allDay: true, color: '#dc2626' },
    { id: '4', title: 'Weekend Getaway', start: nextWeek, end: new Date(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate() + 2), allDay: true, color: '#f97316'},
    { id: '5', title: 'Lunch with Client', start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 30, 0), end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30, 0), color: '#f59e0b'},
  ];
};

export default function CalendarPage() {
    // --- CORE STATE ---
      const { user, isGuest, loading: authLoading } = useAuth(); // Get user and authLoading
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [currentView, setCurrentView] = useState<View>('month');
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [isSimpleMode, setIsSimpleMode] = useState(true);

    // --- EVENT FORM MODAL STATE ---
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [selectedEventForForm, setSelectedEventForForm] = useState<CalendarEvent | null>(null);
    const [eventModalMode, setEventModalMode] = useState<'create' | 'edit'>('create');
    const [defaultModalDates, setDefaultModalDates] = useState<{ start: Date, end: Date } | null>(null);

    // --- DAY DETAILS MODAL STATE ---
    const [isDayDetailsModalOpen, setIsDayDetailsModalOpen] = useState(false);
    const [dateForDetailsModal, setDateForDetailsModal] = useState<Date | null>(null);

    // --- STAMP FORM MODAL STATE ---
    const [isStampFormModalOpen, setIsStampFormModalOpen] = useState(false);
    const [selectedStampForEditing, setSelectedStampForEditing] = useState<CalendarEvent | null>(null);

    // --- STAMP PLACEMENT STATE ---
    const [selectedStampForPlacement, setSelectedStampForPlacement] = useState<CalendarEvent | null>(null);

  const [isLoadingEvents, setIsLoadingEvents] = useState(true); // New loading state for events
const [viewWindow, setViewWindow] = useState<{ start: Date, end: Date } | null>(null);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'event' | 'stamp' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // Loading state for delete operation
useEffect(() => {
    const loadEvents = async () => {

      if (authLoading) {
        return;
      }
      if (user && !isGuest) { // User is authenticated

        setIsLoadingEvents(true);
        try {
          const userEvents = await fetchCalendarItems(user.uid);
          setEvents(userEvents);
        } catch (error) {
          console.error("[EFFECT loadEvents] Failed to load events for user:", error);
          showErrorToast("Could not load your calendar data.");
          setEvents([]); // Clear events on error
        } finally {
          setIsLoadingEvents(false);
        }
      } else if (isGuest) { // Guest mode
        setIsLoadingEvents(true); // It's still a "load" operation
        const mockEvents = getMockEvents();
        setEvents(mockEvents);
        setIsLoadingEvents(false);
      } else { // No user, not guest (e.g., logged out, or auth still loading just finished and user is null)

        setEvents([]); // THIS IS THE LINE THAT CLEARS EVENTS
        setIsLoadingEvents(false); // We are "done" loading (or clearing)
      }
    };

    loadEvents();
}, [user, isGuest, authLoading]); // Depend on user, isGuest, and authLoading

  const displayedEvents = useMemo(() => {
    if (!viewWindow || events.length === 0) {
      // If no view window yet, or no base events, return base events
      // or an empty array until viewWindow is set.
      // RBC might show current month by default before first onNavigate.
      return events; 
    }
    return expandRecurringEvents(events, viewWindow.start, viewWindow.end);
  }, [events, viewWindow]);

    const masterStamps = useMemo(() => {
        return events.filter(event => event.isStamp && !event.originalStampId);
    }, [events]);

    // --- HANDLERS (MEMOIZED WITH useCallback) ---

    const openModalForCreate = useCallback((slotInfo?: { start: Date; end: Date }) => {
        setSelectedEventForForm(null); setEventModalMode('create');
        setDefaultModalDates(slotInfo ? { start: slotInfo.start, end: slotInfo.end } : null);
        setIsEventModalOpen(true);
    }, []);

    const openModalForEdit = useCallback((eventToEdit: CalendarEvent) => {
        setSelectedEventForForm(eventToEdit); setEventModalMode('edit');
        setDefaultModalDates(null); setIsEventModalOpen(true);
    }, []);

    const closeEventFormModal = useCallback(() => setIsEventModalOpen(false), []);

    const handleSaveEvent = useCallback(async (eventData: Omit<CalendarEvent, 'id' | 'isStamp' | 'emoji' | 'repeatDays' | 'repeatEndDate' | 'originalStampId' | 'occurrenceDate'> & { id?: string }) => {
    if (!user && !isGuest) { alert("Please sign in to save events."); return; }

    const fullEventData = { // Ensure no stamp-specific fields are accidentally included for regular events
        ...eventData, 
        isStamp: false, 
        allDay: eventData.allDay || false, 
        // Explicitly set potentially undefined stamp fields to undefined or null
        emoji: undefined,
        repeatDays: undefined,
        repeatEndDate: undefined,
        originalStampId: undefined,
        occurrenceDate: undefined
    };


    if (eventModalMode === 'edit' && eventData.id) { // Editing existing event
        const eventId = eventData.id;
        if (user && !isGuest) {
            try {
                await updateCalendarItem(user.uid, eventId, fullEventData);
                setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, ...fullEventData, id: eventId } as CalendarEvent : ev));
                showSuccessToast("Event updated successfully!");
            } catch (error) { console.error("Error updating event:", error); showErrorToast("Failed to update event."); }
        } else { // Guest mode - local update
            setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, ...fullEventData, id: eventId } as CalendarEvent : ev));
            showSuccessToast("Event updated successfully!");
        }
    } else { // Creating new event
        const dataToSave: Omit<CalendarEvent, 'id'> = {
            ...fullEventData,
            start: new Date(fullEventData.start!), // Ensure Date objects if coming from form
            end: new Date(fullEventData.end!),
        };
        if (user && !isGuest) {
            try {
                const newId = await addCalendarItem(user.uid, dataToSave);
                setEvents(prev => [...prev, { ...dataToSave, id: newId }]);
                showSuccessToast("Event added successfully!");
            } catch (error) { console.error("Error adding event:", error); showErrorToast("Failed to add event."); }
        } else { // Guest mode - local add
            const newId = String(Date.now() + Math.random());
            setEvents(prev => [...prev, { ...dataToSave, id: newId }]);
            showSuccessToast("Event added successfully!");
        }
    }
    closeEventFormModal();
}, [eventModalMode, closeEventFormModal, user, isGuest]);

    const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (!user && !isGuest) { alert("Please sign in to delete events."); return; }

    if (user && !isGuest) {
        try {
            await deleteCalendarItem(user.uid, eventId);
            setEvents(prev => prev.filter(ev => ev.id !== eventId));
            showSuccessToast("Event deleted successfully!");
        } catch (error) { console.error("Error deleting event:", error); showErrorToast("Failed to delete event."); }
    } else { // Guest mode - local delete
        setEvents(prev => prev.filter(ev => ev.id !== eventId));
        showSuccessToast("Event deleted successfully!");
    }
    closeEventFormModal();
}, [closeEventFormModal, user, isGuest]);

    const openDayDetailsModal = useCallback((date: Date) => {
        setDateForDetailsModal(date); setIsDayDetailsModalOpen(true);
    }, []);

    const closeDayDetailsModal = useCallback(() => {
        setIsDayDetailsModalOpen(false); setDateForDetailsModal(null);
    }, []);

    const handleAddEventFromDetails = useCallback((date: Date) => {
        closeDayDetailsModal();
        const startOfDay = new Date(date); startOfDay.setHours(9,0,0,0);
        const endOfDay = new Date(date); endOfDay.setHours(10,0,0,0);
        openModalForCreate({ start: startOfDay, end: endOfDay });
    }, [closeDayDetailsModal, openModalForCreate]);

    const handleEditEventFromDetails = useCallback((eventToEdit: CalendarEvent) => {
        closeDayDetailsModal(); openModalForEdit(eventToEdit);
    }, [closeDayDetailsModal, openModalForEdit]);

    const openStampFormToCreate = useCallback(() => {
        setSelectedStampForEditing(null); setIsStampFormModalOpen(true);
    }, []);

    const openStampFormToEdit = useCallback((stampToEdit: CalendarEvent) => {
        setSelectedStampForEditing(stampToEdit); setIsStampFormModalOpen(true);
    }, []);

    const closeStampFormModal = useCallback(() => setIsStampFormModalOpen(false), []);

    const handleSaveStamp = useCallback(async (stampData: Omit<CalendarEvent, 'id'> & { id?: string }) => {
    if (!user && !isGuest) { alert("Please sign in to save stamps."); return; }

    const fullStampData: Omit<CalendarEvent, 'id'> = { // Ensure all relevant fields for a master stamp
        ...stampData,
        isStamp: true,
        allDay: stampData.allDay || false, // Or typically false for stamps if duration is key
        start: new Date(stampData.start!),
        end: new Date(stampData.end!),
        repeatEndDate: stampData.repeatEndDate ? new Date(stampData.repeatEndDate) : undefined,
        // occurrenceDate and originalStampId should NOT be on master stamps
        occurrenceDate: undefined, 
        originalStampId: undefined,
    };

    if (stampData.id) { // Editing existing stamp definition
        const stampIdToEdit = stampData.id;
 
        const existingStampIndex = events.findIndex(ev => ev.id === stampIdToEdit);
        if (existingStampIndex === -1) {
            console.error(`[handleSaveStamp - EDIT] STAMP WITH ID ${stampIdToEdit} NOT FOUND IN 'events' STATE!`);
            showErrorToast("Error: Could not find the stamp to update.");
            closeStampFormModal();
            return;
        }
        if (user && !isGuest) {
            try {
                await updateCalendarItem(user.uid, stampIdToEdit, fullStampData); // Pass fullStampData to Firestore
                // Prepare the new events array
                const updatedEventsArray = events.map(ev =>
                    ev.id === stampIdToEdit ? { ...ev, ...fullStampData, id: stampIdToEdit } as CalendarEvent : ev
                );
                setEvents(updatedEventsArray);

                // --- DEBUG LOGGING (Option 1) ---
                const updatedStampFromPreparedArray = updatedEventsArray.find(e => e.id === stampIdToEdit);
                
                showSuccessToast("Stamp updated successfully!");            } catch (error) {console.error("Error updating stamp:", error); showErrorToast("Failed to update stamp."); }
        } else { // Guest mode
            setEvents(prev => prev.map(ev => ev.id === stampIdToEdit ? { ...ev, ...fullStampData, id: stampIdToEdit } as CalendarEvent : ev));
            showSuccessToast("Stamp updated successfully!");
        }
    } else { // Creating new stamp definition
        if (user && !isGuest) {
            try {
                const newId = await addCalendarItem(user.uid, fullStampData);
                setEvents(prev => [...prev, { ...fullStampData, id: newId }]);
                showSuccessToast("Stamp added successfully!");
            } catch (error) { console.error("Error adding stamp:", error);  showErrorToast("Failed to add stamp."); }
        } else { // Guest mode
            const newId = String(Date.now() + Math.random() + "-stamp");
            setEvents(prev => [...prev, { ...fullStampData, id: newId }]);
            showSuccessToast("Stamp added successfully!");
        }
    }
    closeStampFormModal();
}, [closeStampFormModal, user, isGuest]);

    const handleDeleteStamp = useCallback(async (stampId: string) => {
    if (!user && !isGuest) { alert("Please sign in to delete stamps."); return; }

    // IMPORTANT: When deleting a master stamp, you also need to decide what to do with
    // all its applied instances (events with originalStampId === stampId).
    // Option 1: Delete them all (requires another Firestore query and batch delete).
    // Option 2: Leave them as "orphaned" events.
    // Option 3: Prevent deletion if instances exist.
    // For now, we'll just delete the master. This needs to be expanded for production.
    console.warn(`Deleting master stamp ${stampId}. Consider implementing deletion of its instances.`);

    if (user && !isGuest) {
        try {
            await deleteCalendarItem(user.uid, stampId);
            setEvents(prev => prev.filter(ev => ev.id !== stampId));
            // Also remove any applied instances from local state for immediate UI update
            setEvents(prev => prev.filter(ev => ev.originalStampId !== stampId));
            showSuccessToast("Stamp deleted successfully!");
        } catch (error) { console.error("Error deleting stamp:", error);  showErrorToast("Failed to delete stamp."); }
    } else { // Guest mode
        setEvents(prev => prev.filter(ev => ev.id !== stampId));
        setEvents(prev => prev.filter(ev => ev.originalStampId !== stampId));
        showSuccessToast("Stamp deleted successfully!");
    }

    if (selectedStampForPlacement?.id === stampId) {
        setSelectedStampForPlacement(null);
    }
    closeStampFormModal();
}, [selectedStampForPlacement, closeStampFormModal, user, isGuest]);

    const handleApplyStamp = useCallback(async (stampDefinition: CalendarEvent, date: Date) => {
    if (!user && !isGuest) { alert("Please sign in to apply stamps."); return; }
    if (!stampDefinition.isStamp) return;

    // ... (logic to calculate newEventStart, newEventEnd from Step 6.1)
    const stampStartTime = new Date(stampDefinition.start); const stampEndTime = new Date(stampDefinition.end);
    const newEventStart = new Date(date); newEventStart.setHours(stampStartTime.getHours(), stampStartTime.getMinutes(), stampStartTime.getSeconds());
    const newEventEnd = new Date(date); newEventEnd.setHours(stampEndTime.getHours(), stampEndTime.getMinutes(), stampEndTime.getSeconds());
    const originalStartDay = new Date(stampDefinition.start).setHours(0,0,0,0);
    const originalEndDay = new Date(stampDefinition.end).setHours(0,0,0,0);
    if (originalEndDay > originalStartDay && newEventEnd.getTime() <= newEventStart.getTime()) {
         newEventEnd.setDate(newEventEnd.getDate() + ( (originalEndDay - originalStartDay) / (1000 * 60 * 60 * 24) ) );
    }

    const newEventInstanceData: Omit<CalendarEvent, 'id'> = {
      title: stampDefinition.title,
      start: newEventStart,
      end: newEventEnd,
      allDay: stampDefinition.allDay, // Consider if allDay should be copied or stamps always have duration
      color: stampDefinition.color,
      isStamp: true, // It's an instance of a stamp
      emoji: stampDefinition.emoji,
      originalStampId: stampDefinition.id, // Link to the master stamp
      occurrenceDate: newEventStart,
      // These should NOT be on an instance
      repeatDays: undefined,
      repeatEndDate: undefined,
    };

    if (user && !isGuest) {
        try {
            const newId = await addCalendarItem(user.uid, newEventInstanceData);
            setEvents(prev => [...prev, { ...newEventInstanceData, id: newId }]);
            showInfoToast(`Stamp "${newEventInstanceData.title}" applied!`); // INFO TOAST
        } catch (error) { console.error("Error applying stamp:", error); showErrorToast("Failed to apply stamp."); }
    } else { // Guest mode
        const newId = String(Date.now() + Math.random());
        setEvents(prev => [...prev, { ...newEventInstanceData, id: newId }]);
        showInfoToast(`Stamp "${newEventInstanceData.title}" applied!`); // INFO TOAST
    }
    // setSelectedStampForPlacement(null); // Optional: auto-deselect
}, [user, isGuest]); // setEvents is stable, add other stable dependencies if any

    const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date; action: string }) => {
        if (selectedStampForPlacement) {
            handleApplyStamp(selectedStampForPlacement, slotInfo.start); return;
        }
        if (slotInfo.action === 'click' || slotInfo.action === 'doubleClick') {
            openDayDetailsModal(slotInfo.start);
        } else if (slotInfo.action === 'select') {
            openModalForCreate({ start: slotInfo.start, end: slotInfo.end });
        }
    }, [selectedStampForPlacement, handleApplyStamp, openDayDetailsModal, openModalForCreate]);

    const handleSelectEvent = useCallback((eventClicked: CalendarEvent) => {
        if (selectedStampForPlacement) {
            handleApplyStamp(selectedStampForPlacement, eventClicked.start); return;
        }
        if (isSimpleMode && currentView === 'month') {
            openDayDetailsModal(eventClicked.start);
        } else {
            openModalForEdit(eventClicked);
        }
    }, [isSimpleMode, currentView, selectedStampForPlacement, handleApplyStamp, openDayDetailsModal, openModalForEdit]);

    const eventsForSelectedDay = useMemo(() => {
        if (!dateForDetailsModal) return [];
        return displayedEvents.filter(event => {
            const eventStartDay = new Date(new Date(event.start).setHours(0,0,0,0));
            const detailsDateDay = new Date(new Date(dateForDetailsModal).setHours(0,0,0,0));
            if (event.allDay && event.start && event.end) { // check event.start and event.end exist
                const eventEndDay = new Date(new Date(event.end).setHours(0,0,0,0));
                return detailsDateDay >= eventStartDay && detailsDateDay <= eventEndDay;
            }
            return isSameDay(eventStartDay, detailsDateDay);
        });
    }, [dateForDetailsModal, displayedEvents]);

      const handleNavigate = useCallback((newDate: Date, view: View, action: string) => {
    setCurrentDate(newDate); // Keep your existing currentDate state for centering the calendar

    // Calculate the new view window based on newDate and view
    // This is a simplified calculation; react-big-calendar might have more direct ways
    // to get the exact range, or you might use its `onRangeChange` prop.
    let start = new Date(newDate);
    let end = new Date(newDate);

    if (view === 'month') {
      start = new Date(start.getFullYear(), start.getMonth(), 1);
      end = new Date(end.getFullYear(), end.getMonth() + 1, 0); // Last day of month
      // Add buffer for events spilling from prev/next month
      start = addDays(start, -7); 
      end = addDays(end, 7);
    } else if (view === 'week') {
      start = startOfWeek(start, { weekStartsOn: 0 }); // Assuming week starts on Sunday
      end = endOfWeek(end, { weekStartsOn: 0 });
    } else if (view === 'day') {
      start = startOfDay(start);
      end = endOfDay(end);
    }
    // For Agenda, onRangeChange is better. For now, this is a rough window.
    setViewWindow({ start, end });
  }, []); // Removed setCurrentDate as it's already done inside, no external deps if newDate is from callback

  const handleViewChange = useCallback((newView: View) => {
    setCurrentView(newView);
    // Also trigger a re-calculation of viewWindow when view changes
    // Call a similar logic as in handleNavigate or a dedicated function
    // For simplicity, let's rely on the next onNavigate or an initial onRangeChange call from RBC
    // This might need a slight delay or direct call to updateViewWindow(currentDate, newView)
    // For now, we'll let the next navigation or initial load set the window.
    // A more robust solution might use onRangeChange if available for all views.
    
    // Temporary: re-trigger navigate to update window. Not ideal.
    // handleNavigate(currentDate, newView, 'VIEW_CHANGE');
  }, [currentDate]); // Add handleNavigate if you call it


  // This is a more reliable way to get the view range from react-big-calendar
  const handleRangeChange = useCallback((range: Date[] | { start: Date; end: Date }) => {
    let start, end;
    if (Array.isArray(range)) {
        // For agenda view, it's often an array of dates
        if (range.length > 0) {
            start = startOfDay(range[0]);
            // For agenda, the end might be the last day shown, or we might want a wider window.
            // Let's assume it's the range of visible days.
            end = endOfDay(range[range.length - 1]);
        } else { return; } // No range
    } else { // For month/week/day, it's usually {start, end}
        start = startOfDay(range.start);
        end = endOfDay(range.end);
    }
    // Add buffer for month view if necessary (events spanning across month boundaries)
    if(currentView === Views.MONTH){
        start = addDays(start, -7);
        end = addDays(end, 7);
    }
    setViewWindow({ start, end });
  }, [currentView]); // Added currentView


  // Initialize viewWindow on first load
  useEffect(() => {
    if (!viewWindow && currentDate && currentView) {
        // Calculate initial view window based on current date and view
        let start = new Date(currentDate);
        let end = new Date(currentDate);
        if (currentView === 'month') {
            start = new Date(start.getFullYear(), start.getMonth(), 1);
            end = new Date(end.getFullYear(), end.getMonth() + 1, 0);
            start = addDays(start, -7); end = addDays(end, 7);
        } else if (currentView === 'week') {
            start = startOfWeek(start, { weekStartsOn: 0 });
            end = endOfWeek(end, { weekStartsOn: 0 });
        } // etc. for day
        setViewWindow({start, end});
    }
  }, [currentDate, currentView, viewWindow]); 


    const toggleMode = () => setIsSimpleMode(prev => !prev);
  const requestDeleteConfirmation = (id: string, type: 'event' | 'stamp') => {
    setItemToDelete({ id, type });
    setIsConfirmDeleteModalOpen(true);
  };

  const closeConfirmDeleteModal = () => {
    setIsConfirmDeleteModalOpen(false);
    setItemToDelete(null);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      if (itemToDelete.type === 'event') {
        await handleDeleteEvent(itemToDelete.id); // Your existing Firestore delete logic
      } else if (itemToDelete.type === 'stamp') {
        await handleDeleteStamp(itemToDelete.id); // Your existing Firestore delete logic
      }
    } catch (error) {
      // Errors are already handled by showErrorToast within handleDeleteEvent/Stamp
      console.error(`Error during confirmed delete of ${itemToDelete.type}:`, error);
    } finally {
      setIsDeleting(false);
      closeConfirmDeleteModal();
    }
  };
    // JSX Return
    return (
        <div className="p-2 md:p-6 flex flex-col md:flex-row gap-4">
            {/* Left Column: Calendar View and Controls */}
            <div className="flex-grow">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-semibold">
                        {user ? `${user.displayName || user.email}'s Calendar` : 'Guest Calendar'}
                    </h1>
                    <div className="flex items-center space-x-2">
                        <Button onClick={toggleMode} variant="outline" size="default">
                            {isSimpleMode ? 'Show Detailed View' : 'Show Simple View'}
                        </Button>
                        <Button onClick={() => openModalForCreate()} size="default" className="bg-blue-600 hover:bg-blue-700 text-white">
                            + Add Event
                        </Button>
                    </div>
                </div>
                <DynamicCalendarView
                    events={displayedEvents}
                    currentView={currentView}
                    currentDate={currentDate}
                    onView={handleViewChange}
                    onNavigate={handleNavigate}
                    onRangeChange={handleRangeChange} // Add this prop to RBC
                    onSelectEvent={handleSelectEvent}
                    onSelectSlot={handleSelectSlot}
                    isSimpleMode={isSimpleMode}
                />
            </div>

            {/* Right Column: Stamp Palette */}
            <div className="w-full md:w-64 lg:w-72 flex-shrink-0 bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-center border-b pb-2 mb-3">
                    <h2 className="text-lg font-semibold">Your Stamps</h2>
                    <Button onClick={openStampFormToCreate} size="sm" variant="outline" className="whitespace-nowrap">
                        + New Stamp
                    </Button>
                </div>

                {selectedStampForPlacement && (
                    <div className="mb-3 p-2 text-sm bg-blue-100 border border-blue-300 rounded">
                        Place <span className="font-semibold">"{selectedStampForPlacement.title}"</span> by clicking a date.
                        <Button variant="ghost" size="sm" onClick={() => setSelectedStampForPlacement(null)} className="ml-2 text-blue-600 hover:text-blue-800 text-xs">Cancel</Button>
                    </div>
                )}
                {!selectedStampForPlacement && masterStamps.length === 0 && (
                     <p className="text-xs text-gray-500 mb-3 text-center py-2">No stamps defined yet. Click "+ New Stamp" to create one.</p>
                )}
                {!selectedStampForPlacement && masterStamps.length > 0 && (
                    <p className="text-xs text-gray-500 mb-3">Click a stamp to select it, then click a date on the calendar to add.</p>
                )}
                
                {masterStamps.length > 0 && (
                    <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
                        {masterStamps.map(stamp => {
                            const isSelectedToPlace = selectedStampForPlacement?.id === stamp.id;
                            return (
                                <div
                                    key={stamp.id}
                                    title={isSelectedToPlace ? `"${stamp.title}" is selected. Click a date to place it.` : `Select "${stamp.title}" to place on calendar.`}
                                    className={`p-2 rounded border hover:bg-gray-100 flex items-center transition-all ${isSelectedToPlace ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
                                    style={{ borderColor: stamp.color || '#ccc' }}
                                >
                                    <div 
                                        className="flex-grow flex items-center cursor-pointer"
                                        onClick={() => { 
                                            if (isSelectedToPlace) { setSelectedStampForPlacement(null); } else { setSelectedStampForPlacement(stamp); }
                                        }}
                                    >
                                        <span className="text-xl mr-2">{stamp.emoji}</span>
                                        <span className="text-sm">{stamp.title}</span>
                                    </div>
                                    <span className="w-3 h-3 rounded-full inline-block mr-2" style={{ backgroundColor: stamp.color }}></span>
                                    <Button 
                                        variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-gray-700 p-0"
                                        onClick={(e) => { e.stopPropagation(); openStampFormToEdit(stamp); }} title="Edit Stamp"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.502a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.886 1.343Z" /></svg>
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Event Form Modal */}
            <Modal
                isOpen={isEventModalOpen} onClose={closeEventFormModal}
                title={eventModalMode === 'edit' ? 'Edit Event' : 'Create New Event'} size="lg"
            >
                {isEventModalOpen && (
                    <DynamicEventForm
                        event={selectedEventForForm} onSave={handleSaveEvent} onCancel={closeEventFormModal}
                        onDelete={eventModalMode === 'edit' && selectedEventForForm 
                    ? () => requestDeleteConfirmation(selectedEventForForm.id, 'event') 
                    : undefined}
                        defaultStartDate={defaultModalDates?.start} defaultEndDate={defaultModalDates?.end}
                    />
                )}
            </Modal>

            {/* Stamp Form Modal */}
            <Modal
                isOpen={isStampFormModalOpen} onClose={closeStampFormModal}
                title={selectedStampForEditing ? "Edit Stamp" : "Create New Stamp"} size="lg"
            >
                {isStampFormModalOpen && (
                    <DynamicStampForm
                        stamp={selectedStampForEditing} onSave={handleSaveStamp} onCancel={closeStampFormModal}
                        onDelete={selectedStampForEditing 
                    ? () => requestDeleteConfirmation(selectedStampForEditing.id, 'stamp') 
                    : undefined}                    />
                )}
            </Modal>

            {/* Day Details Modal */}
            <DayDetailsModal
                isOpen={isDayDetailsModalOpen} onClose={closeDayDetailsModal}
                selectedDate={dateForDetailsModal} eventsOnDay={eventsForSelectedDay}
                onAddEvent={handleAddEventFromDetails} onEditEvent={handleEditEventFromDetails}
            />
                <ConfirmationModal
      isOpen={isConfirmDeleteModalOpen}
      onClose={closeConfirmDeleteModal}
      onConfirm={confirmDeleteItem}
      title={`Confirm Deletion`}
      message={itemToDelete?.type === 'stamp' 
        ? "Are you sure you want to delete this stamp definition? This may also affect its placed instances if not handled separately." 
        : "Are you sure you want to delete this event?"
      }
      confirmText="Delete"
      isLoading={isDeleting}
    />
        </div>
    );
}