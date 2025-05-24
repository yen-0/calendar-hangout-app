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
  HangoutRequest,
  HangoutRequestFormData,
  ParticipantData,
  ParticipantEvent,
  DateRange as ClientDateRange // Alias to avoid conflict if DateRange is globally defined
} from '@/types/hangouts';

const HANGOUT_REQUESTS_COLLECTION = 'hangoutRequests';

// Helper to convert Firestore Timestamps in an event object to JS Dates
const eventFromFirestore = (docSnap: DocumentSnapshot<DocumentData>): CalendarEvent => {
  const data = docSnap.data() as any; // Cast to any temporarily
  const event: CalendarEvent = {
    id: docSnap.id,
    ...data,
    // Convert Timestamps back to JS Dates
    start: data.start instanceof Timestamp ? data.start.toDate() : new Date(data.start),
    end: data.end instanceof Timestamp ? data.end.toDate() : new Date(data.end),
  };
  if (data.repeatEndDate) {
    event.repeatEndDate = data.repeatEndDate instanceof Timestamp ? data.repeatEndDate.toDate() : new Date(data.repeatEndDate);
  }
  if (data.occurrenceDate) {
    event.occurrenceDate = data.occurrenceDate instanceof Timestamp ? data.occurrenceDate.toDate() : new Date(data.occurrenceDate);
  }
  return event;
};

// Helper to convert JS Dates in an event object to Firestore Timestamps
const eventToFirestore = (eventData: Partial<Omit<CalendarEvent, 'id'>>) => {
  const dataToSave: any = { ...eventData };
  if (eventData.start) dataToSave.start = Timestamp.fromDate(new Date(eventData.start));
  if (eventData.end) dataToSave.end = Timestamp.fromDate(new Date(eventData.end));
  if (eventData.repeatEndDate) dataToSave.repeatEndDate = Timestamp.fromDate(new Date(eventData.repeatEndDate));
  if (eventData.occurrenceDate) dataToSave.occurrenceDate = Timestamp.fromDate(new Date(eventData.occurrenceDate));

  // Remove undefined fields to avoid Firestore errors, or ensure they are handled
  Object.keys(dataToSave).forEach(key => dataToSave[key] === undefined && delete dataToSave[key]);
  return dataToSave;
};


const getCalendarItemsCollectionRef = (userId: string) => {
  return collection(db, 'users', userId, 'calendarItems');
};

// Fetch all calendar items for a user
export const fetchCalendarItems = async (userId: string): Promise<CalendarEvent[]> => {
  if (!userId) return [];
  try {
    const q = query(getCalendarItemsCollectionRef(userId));
    const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
    return querySnapshot.docs.map(docSnap => eventFromFirestore(docSnap));
  } catch (error) {
    console.error("Error fetching calendar items: ", error);
    throw error; // Or return empty array / handle error appropriately
  }
};

// Add a new calendar item (event or stamp definition)
export const addCalendarItem = async (userId: string, itemData: Omit<CalendarEvent, 'id'>): Promise<string> => {
  if (!userId) throw new Error("User ID is required to add item.");
  try {
    const dataToSave = eventToFirestore(itemData);
    const docRef = await addDoc(getCalendarItemsCollectionRef(userId), dataToSave);
    return docRef.id; // Return the new document ID
  } catch (error) {
    console.error("Error adding calendar item: ", error);
    throw error;
  }
};

// Update an existing calendar item
export const updateCalendarItem = async (userId: string, itemId: string, itemData: Partial<Omit<CalendarEvent, 'id'>>): Promise<void> => {
  if (!userId) throw new Error("User ID is required to update item.");
  try {
    const dataToSave = eventToFirestore(itemData);
    const itemDocRef = doc(db, 'users', userId, 'calendarItems', itemId);
    await setDoc(itemDocRef, dataToSave, { merge: true }); // Use setDoc with merge:true for update
  } catch (error) {
    console.error("Error updating calendar item: ", error);
    throw error;
  }
};

// Delete a calendar item
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

const convertDateRangesToTimestamps = (dateRanges: ClientDateRange[]) => {
  return dateRanges.map(dr => ({
    start: Timestamp.fromDate(new Date(dr.start)),
    end: Timestamp.fromDate(new Date(dr.end)),
  }));
};

// Helper to convert Firestore Timestamps in dateRanges back to client-side Dates
const convertTimestampsToDateRanges = (timestampRanges: { start: Timestamp, end: Timestamp }[]): ClientDateRange[] => {
  return timestampRanges.map(tr => ({
    start: tr.start.toDate(),
    end: tr.end.toDate(),
  }));
};


export const createHangoutRequest = async (
  creatorUid: string,
  creatorName: string,
  formData: HangoutRequestFormData,
  creatorEvents: ParticipantEvent[] // Creator's busy events for the request ranges
): Promise<string> => {
  try {
    const newRequestRef = doc(collection(db, HANGOUT_REQUESTS_COLLECTION));

    const creatorParticipantData: ParticipantData = {
      uid: creatorUid,
      displayName: creatorName,
      submittedAt: Timestamp.now(),
      events: creatorEvents.map(event => ({
        ...event,
        start: Timestamp.fromDate(new Date(event.start)), // Ensure Timestamps
        end: Timestamp.fromDate(new Date(event.end)),     // Ensure Timestamps
      })),
    };

    const newRequestData: Omit<HangoutRequest, 'id'> = {
      creatorUid,
      creatorName,
      requestName: formData.requestName,
      status: 'pending',
      createdAt: Timestamp.now(),
      desiredDurationMinutes: Number(formData.desiredDurationMinutes),
      desiredMarginMinutes: Number(formData.desiredMarginMinutes),
      desiredMemberCount: Number(formData.desiredMemberCount),
      dateRanges: convertDateRangesToTimestamps(formData.dateRanges),
      timeRanges: formData.timeRanges, // Storing as is for now
      participants: {
        [creatorUid]: creatorParticipantData,
      },
    };

    await setDoc(newRequestRef, newRequestData);
    return newRequestRef.id;
  } catch (error) {
    console.error('Error creating hangout request:', error);
    throw new Error('Failed to create hangout request.');
  }
};

export const fetchHangoutRequestsForUser = async (userId: string): Promise<HangoutRequest[]> => {
  try {
    const createdQuery = query(
      collection(db, HANGOUT_REQUESTS_COLLECTION),
      where('creatorUid', '==', userId)
    );

    const querySnapshot = await getDocs(createdQuery);
    const requests: HangoutRequest[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      requests.push({
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate(), // CONVERT TO JS DATE HERE
        dateRanges: data.dateRanges.map((dr: any) => ({
          start: (dr.start as Timestamp).toDate(),
          end: (dr.end as Timestamp).toDate(),
        })),
        participants: Object.entries(data.participants || {}).reduce((acc, [pUid, pData]: [string, any]) => {
          acc[pUid] = {
            ...pData,
            submittedAt: (pData.submittedAt as Timestamp).toDate(), // Also convert here
            events: (pData.events || []).map((ev: any) => ({
              ...ev,
              start: (ev.start as Timestamp).toDate(), // And here
              end: (ev.end as Timestamp).toDate(),     // And here
            }))
          };
          return acc;
        }, {} as { [userId: string]: ParticipantData }),
        // Also convert finalSelectedSlot and commonAvailabilitySlots if they exist
        finalSelectedSlot: data.finalSelectedSlot ? {
          start: (data.finalSelectedSlot.start as Timestamp).toDate(),
          end: (data.finalSelectedSlot.end as Timestamp).toDate(),
        } : undefined,
        commonAvailabilitySlots: (data.commonAvailabilitySlots || []).map((s: any) => ({
          ...s, // Make sure to spread other fields like availableParticipants
          start: (s.start as Timestamp).toDate(),
          end: (s.end as Timestamp).toDate(),
        })),
      } as HangoutRequest);
    });
    // Already sorted if using orderBy in query, otherwise sort here if needed
    // return requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return requests;
  } catch (error) {
    console.error('Error fetching hangout requests:', error);
    throw new Error('Failed to fetch hangout requests.');
  }
};
export const fetchHangoutRequestById = async (requestId: string): Promise<HangoutRequest | null> => {
  try {
    const requestDocRef = doc(db, HANGOUT_REQUESTS_COLLECTION, requestId);
    const docSnap = await getDoc(requestDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Convert Firestore Timestamps back to JS Dates
      const participants: { [key: string]: ParticipantData } = {};
      if (data.participants) {
        Object.entries(data.participants).forEach(([uid, pData]: [string, any]) => {
          participants[uid] = {
            ...pData,
            submittedAt: (pData.submittedAt as Timestamp).toDate(),
            events: pData.events.map((ev: any) => ({
              ...ev,
              start: (ev.start as Timestamp).toDate(),
              end: (ev.end as Timestamp).toDate(),
            })),
          };
        });
      }
      let finalSelectedSlotClient: FinalSelectedSlot | undefined = undefined;
      if (data.finalSelectedSlot && data.finalSelectedSlot.start && data.finalSelectedSlot.end) {
        finalSelectedSlotClient = {
          start: (data.finalSelectedSlot.start as Timestamp).toDate(), // Convert to JS Date
          end: (data.finalSelectedSlot.end as Timestamp).toDate(),     // Convert to JS Date
        };
      }

      return {
        id: docSnap.id,
        // ... other properties from data, ensuring their Timestamps are converted
        createdAt: (data.createdAt as Timestamp).toDate(),
        dateRanges: (data.dateRanges || []).map((dr: any) => ({
          start: (dr.start as Timestamp).toDate(),
          end: (dr.end as Timestamp).toDate(),
        })),
        participants: Object.entries(data.participants || {}).reduce((acc, [pUid, pData]: [string, any]) => {
          acc[pUid] = {
            ...pData,
            submittedAt: (pData.submittedAt as Timestamp).toDate(),
            events: (pData.events || []).map((ev: any) => ({
              ...ev,
              start: (ev.start as Timestamp).toDate(),
              end: (ev.end as Timestamp).toDate(),
            }))
          };
          return acc;
        }, {} as { [userId: string]: ParticipantData }),
        commonAvailabilitySlots: (data.commonAvailabilitySlots || []).map((s: any) => ({
          ...s,
          start: (s.start as Timestamp).toDate(),
          end: (s.end as Timestamp).toDate(),
        })),
        finalSelectedSlot: finalSelectedSlotClient, // Use the converted version
        // Spread other data fields that don't need conversion
        requestName: data.requestName,
        creatorUid: data.creatorUid,
        creatorName: data.creatorName,
        status: data.status,
        desiredDurationMinutes: data.desiredDurationMinutes,
        desiredMarginMinutes: data.desiredMarginMinutes,
        desiredMemberCount: data.desiredMemberCount,
        timeRanges: data.timeRanges, // Assuming timeRanges doesn't contain Timestamps
      } as HangoutRequest; // Type assertion might be needed if not all fields are explicitly listed
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error fetching hangout request by ID (${requestId}):`, error);
    throw new Error('Failed to fetch hangout request details.');
  }
};

// Function to add/update participant's availability
export const addParticipantToHangoutRequest = async (
  requestId: string,
  userId: string,
  participantData: ParticipantData
): Promise<void> => {
  try {
    const requestDocRef = doc(db, HANGOUT_REQUESTS_COLLECTION, requestId);

    // Convert dates in participantData.events to Timestamps before saving
    const eventsWithTimestamps = participantData.events.map(event => ({
      ...event,
      start: Timestamp.fromDate(new Date(event.start)),
      end: Timestamp.fromDate(new Date(event.end)),
    }));

    const participantDataForFirestore = {
      ...participantData,
      submittedAt: Timestamp.fromDate(new Date(participantData.submittedAt)), // Ensure submittedAt is a Timestamp
      events: eventsWithTimestamps,
    };

    // Use dot notation to update a specific field within the participants map
    await updateDoc(requestDocRef, {
      [`participants.${userId}`]: participantDataForFirestore,
    });
  } catch (error) {
    console.error(`Error adding participant ${userId} to hangout request ${requestId}:`, error);
    throw new Error('Failed to submit your availability.');
  }
};

export const updateHangoutRequestDetails = async (
  requestId: string,
  dataToUpdate: Partial<Pick<HangoutRequest, 'requestName' | 'desiredMemberCount' | 'status' /* add other editable fields */>>
): Promise<void> => {
  try {
    const requestDocRef = doc(db, HANGOUT_REQUESTS_COLLECTION, requestId);
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