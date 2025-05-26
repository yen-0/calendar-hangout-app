// src/lib/firebase/firestoreService.ts
import { db, auth } from './config'; // Your Firebase config

import { CalendarEvent } from '@/types/events';
import {
  setDoc,
  DocumentData,
  DocumentSnapshot,
  QuerySnapshot,
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import {
  HangoutRequest, // This is your Firestore-facing type (expects Timestamps)
  HangoutRequestClientState, // This is what your client components should receive (expects JS Dates)
  HangoutRequestFormData,
  ParticipantDataClient,     // Client-facing participant data
  ParticipantEventClient,    // Client-facing participant event
  FinalSelectedSlotClient,   // Client-facing final slot
  CommonSlotClient,          // Client-facing common slot
  DateRangeClient,           // Client-facing date range
  TimeRange,                 // TimeRange is likely strings "HH:mm", fine as is
  ParticipantDataFirestore,  // Firestore-facing for iteration
  ParticipantEventFirestore, // Firestore-facing for iteration
  DateRangeFirestore,
  CommonSlotFirestore,
  FinalSelectedSlotFirestore
} from '@/types/hangouts';


// Helper to convert Firestore Timestamps in an event object to JS Dates
const eventFromFirestore = (docSnap: DocumentSnapshot<DocumentData>): CalendarEvent => {
  const data = docSnap.data();
  if (!data) throw new Error("Document data undefined in eventFromFirestore");

  const event: CalendarEvent = {
    id: docSnap.id,
    title: data.title,
    allDay: data.allDay || false,
    color: data.color,
    isStamp: data.isStamp || false,
    emoji: data.emoji,
    repeatDays: data.repeatDays,
    originalStampId: data.originalStampId,
    // Convert Timestamps back to JS Dates
    start: data.start instanceof Timestamp ? data.start.toDate() : new Date(data.start),
    end: data.end instanceof Timestamp ? data.end.toDate() : new Date(data.end),
    repeatEndDate: data.repeatEndDate ? (data.repeatEndDate instanceof Timestamp ? data.repeatEndDate.toDate() : new Date(data.repeatEndDate)) : undefined,
    occurrenceDate: data.occurrenceDate ? (data.occurrenceDate instanceof Timestamp ? data.occurrenceDate.toDate() : new Date(data.occurrenceDate)) : undefined,
    // Ensure all other fields from CalendarEvent are mapped
  };
  return event;
};

// Helper to convert JS Dates in an event object to Firestore Timestamps
const eventToFirestore = (eventData: Partial<Omit<CalendarEvent, 'id'>>) => {
  const dataToSave: any = { ...eventData }; // Start with a copy
  // Ensure all fields exist before trying to convert
  if (eventData.start) dataToSave.start = Timestamp.fromDate(new Date(eventData.start));
  if (eventData.end) dataToSave.end = Timestamp.fromDate(new Date(eventData.end));
  if (eventData.repeatEndDate) dataToSave.repeatEndDate = Timestamp.fromDate(new Date(eventData.repeatEndDate));
  if (eventData.occurrenceDate) dataToSave.occurrenceDate = Timestamp.fromDate(new Date(eventData.occurrenceDate));

  // Remove undefined fields before saving to Firestore to avoid errors.
  Object.keys(dataToSave).forEach(key => {
    if (dataToSave[key] === undefined) {
      delete dataToSave[key];
    }
  });
  return dataToSave;
};


const getCalendarItemsCollectionRef = (userId: string) => {
  return collection(db, 'users', userId, 'calendarItems');
};

export const fetchCalendarItems = async (userId: string): Promise<CalendarEvent[]> => {
  if (!userId) return [];
  try {
    const q = query(getCalendarItemsCollectionRef(userId));
    const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
    return querySnapshot.docs.map(docSnap => eventFromFirestore(docSnap));
  } catch (error) {
    console.error("Error fetching calendar items: ", error);
    throw error;
  }
};

export const addCalendarItem = async (userId: string, itemData: Omit<CalendarEvent, 'id'>): Promise<string> => {
  if (!userId) throw new Error("User ID is required to add item.");
  try {
    const dataToSave = eventToFirestore(itemData);
    const docRef = await addDoc(getCalendarItemsCollectionRef(userId), dataToSave);
    return docRef.id;
  } catch (error) {
    console.error("Error adding calendar item: ", error);
    throw error;
  }
};

export const updateCalendarItem = async (userId: string, itemId: string, itemData: Partial<Omit<CalendarEvent, 'id'>>): Promise<void> => {
  if (!userId) throw new Error("User ID is required to update item.");
  try {
    const dataToSave = eventToFirestore(itemData);
    const itemDocRef = doc(db, 'users', userId, 'calendarItems', itemId);
    await setDoc(itemDocRef, dataToSave, { merge: true });
  } catch (error) {
    console.error("Error updating calendar item: ", error);
    throw error;
  }
};

export const deleteCalendarItem = async (userId: string, itemId: string): Promise<void> => {
  if (!userId) throw new Error("User ID is required to delete item.");
  try {
    const itemDocRef = doc(db, 'users', userId, 'calendarItems', itemId);
    await deleteDoc(itemDocRef);
  } catch (error) {
    console.error("Error deleting calendar item: ", error);
    throw error;
  }
};

const HANGOUT_REQUESTS_COLLECTION = 'hangoutRequests';

const convertDateRangesToTimestamps = (dateRanges: DateRangeClient[]): DateRangeFirestore[] => {
  return dateRanges.map(dr => ({
    start: Timestamp.fromDate(new Date(dr.start)),
    end: Timestamp.fromDate(new Date(dr.end)),
  }));
};

// This function is crucial for converting data for client-side state
const hangoutRequestFromFirestore = (docSnap: DocumentSnapshot<DocumentData>): HangoutRequestClientState => {
    const data = docSnap.data() as Omit<HangoutRequest, 'id'>; // Assume data matches Firestore structure
    if (!data) throw new Error("Document data undefined in hangoutRequestFromFirestore");

    const dateRangesClient: DateRangeClient[] = (data.dateRanges || []).map(
        (dr: DateRangeFirestore) => ({
          start: dr.start.toDate(),
          end: dr.end.toDate(),
        })
      );

      const participantsClient: { [userId: string]: ParticipantDataClient } = {};
      if (data.participants) {
        Object.entries(data.participants).forEach(
          ([uid, pData]: [string, ParticipantDataFirestore]) => {
            participantsClient[uid] = {
              uid: pData.uid,
              displayName: pData.displayName,
              submittedAt: pData.submittedAt.toDate(),
              events: (pData.events || []).map((ev: ParticipantEventFirestore) => ({
                title: ev.title,
                start: ev.start.toDate(),
                end: ev.end.toDate(),
              })),
            };
          }
        );
      }

      const commonAvailabilitySlotsClient: CommonSlotClient[] | undefined =
        data.commonAvailabilitySlots?.map((s: CommonSlotFirestore) => ({
          start: s.start.toDate(),
          end: s.end.toDate(),
          availableParticipants: s.availableParticipants,
        }));

      const finalSelectedSlotClient: FinalSelectedSlotClient | undefined =
        data.finalSelectedSlot && data.finalSelectedSlot.start && data.finalSelectedSlot.end
          ? {
              start: data.finalSelectedSlot.start.toDate(),
              end: data.finalSelectedSlot.end.toDate(),
            }
          : undefined;

    return {
        id: docSnap.id,
        creatorUid: data.creatorUid,
        creatorName: data.creatorName,
        requestName: data.requestName,
        status: data.status,
        createdAt: data.createdAt.toDate(), // CONVERT
        desiredDurationMinutes: data.desiredDurationMinutes,
        desiredMarginMinutes: data.desiredMarginMinutes,
        desiredMemberCount: data.desiredMemberCount,
        dateRanges: dateRangesClient,       // CONVERTED
        timeRanges: data.timeRanges,        // Assuming string, no conversion
        participants: participantsClient,   // CONVERTED
        commonAvailabilitySlots: commonAvailabilitySlotsClient, // CONVERTED
        finalSelectedSlot: finalSelectedSlotClient,             // CONVERTED
    };
};


export const createHangoutRequest = async (
  creatorUid: string,
  creatorName: string,
  formData: HangoutRequestFormData,
  creatorEvents: ParticipantEventClient[] // Expecting client dates
): Promise<string> => {
  try {
    const newRequestRef = doc(collection(db, HANGOUT_REQUESTS_COLLECTION));

    const creatorParticipantDataFirestore: ParticipantDataFirestore = {
      uid: creatorUid,
      displayName: creatorName,
      submittedAt: Timestamp.now(),
      events: creatorEvents.map(event => ({
        title: event.title,
        start: Timestamp.fromDate(new Date(event.start)), // Convert client date to Timestamp
        end: Timestamp.fromDate(new Date(event.end)),     // Convert client date to Timestamp
      })),
    };

    const newRequestData: Omit<HangoutRequest, 'id' | 'commonAvailabilitySlots' | 'finalSelectedSlot'> = { // Exclude optional fields not set on create
      creatorUid,
      creatorName,
      requestName: formData.requestName,
      status: 'pending',
      createdAt: Timestamp.now(),
      desiredDurationMinutes: Number(formData.desiredDurationMinutes),
      desiredMarginMinutes: Number(formData.desiredMarginMinutes),
      desiredMemberCount: Number(formData.desiredMemberCount),
      dateRanges: convertDateRangesToTimestamps(formData.dateRanges), // Converts client dates to Timestamps
      timeRanges: formData.timeRanges,
      participants: {
        [creatorUid]: creatorParticipantDataFirestore,
      },
    };

    await setDoc(newRequestRef, newRequestData);
    return newRequestRef.id;
  } catch (error) {
    console.error('Error creating hangout request:', error);
    throw new Error('Failed to create hangout request.');
  }
};

// This function should return data suitable for client state (i.e., with JS Dates)
export const fetchHangoutRequestsForUser = async (userId: string): Promise<HangoutRequestClientState[]> => {
  try {
    const createdQuery = query(
      collection(db, HANGOUT_REQUESTS_COLLECTION),
      where('creatorUid', '==', userId),
      // Consider adding: orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(createdQuery);
    // Map Firestore documents to the client-side state type
    return querySnapshot.docs.map(docSnap => hangoutRequestFromFirestore(docSnap));
  } catch (error) {
    console.error('Error fetching hangout requests:', error);
    throw new Error('Failed to fetch hangout requests.');
  }
};

// This function should also return data suitable for client state
export const fetchHangoutRequestById = async (requestId: string): Promise<HangoutRequestClientState | null> => {
  try {
    const requestDocRef = doc(db, HANGOUT_REQUESTS_COLLECTION, requestId);
    const docSnap = await getDoc(requestDocRef);

    if (docSnap.exists()) {
      return hangoutRequestFromFirestore(docSnap); // Reuse the helper
    } else {
      console.log(`No hangout request found with ID: ${requestId}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching hangout request by ID (${requestId}):`, error);
    throw new Error('Failed to fetch hangout request details.');
  }
};

export const addParticipantToHangoutRequest = async (
  requestId: string,
  userId: string,
  participantData: ParticipantDataClient // Expecting client dates
): Promise<void> => {
  try {
    const requestDocRef = doc(db, HANGOUT_REQUESTS_COLLECTION, requestId);

    const participantDataForFirestore: ParticipantDataFirestore = {
      uid: participantData.uid,
      displayName: participantData.displayName,
      submittedAt: Timestamp.fromDate(new Date(participantData.submittedAt)), // Convert client date
      events: participantData.events.map(event => ({
        title: event.title,
        start: Timestamp.fromDate(new Date(event.start)), // Convert client date
        end: Timestamp.fromDate(new Date(event.end)),     // Convert client date
      })),
    };

    await updateDoc(requestDocRef, {
      [`participants.${userId}`]: participantDataForFirestore,
      // Optionally update status if this submission meets criteria for 'pending_calculation'
      // This logic might be better handled client-side after this call, or in a Cloud Function
    });
  } catch (error) {
    console.error(`Error adding participant ${userId} to hangout request ${requestId}:`, error);
    throw new Error('Failed to submit your availability.');
  }
};

export const updateHangoutRequestDetails = async (
  requestId: string,
  dataToUpdate: Partial<Pick<HangoutRequest, 'requestName' | 'desiredMemberCount' | 'status' | 'finalSelectedSlot' | 'commonAvailabilitySlots' >>
  // Ensure that if 'finalSelectedSlot' or 'commonAvailabilitySlots' are passed, their dates are Timestamps
): Promise<void> => {
  try {
    const requestDocRef = doc(db, HANGOUT_REQUESTS_COLLECTION, requestId);
    // If dataToUpdate contains date fields, they MUST be Firestore Timestamps
    // This function is generic, so the caller is responsible for ensuring correct data types.
    // For example, if updating 'finalSelectedSlot' from client, convert JS Dates to Timestamps first.
    await updateDoc(requestDocRef, dataToUpdate);
  } catch (error) {
    console.error(`Error updating hangout request ${requestId}:`, error);
    throw new Error('Failed to update hangout request.');
  }
};

export const deleteHangoutRequest = async (requestId: string): Promise<void> => {
  try {
    const requestDocRef = doc(db, HANGOUT_REQUESTS_COLLECTION, requestId);
    await deleteDoc(requestDocRef);
  } catch (error) {
    console.error(`Error deleting hangout request ${requestId}:`, error);
    throw new Error('Failed to delete hangout request.');
  }
};