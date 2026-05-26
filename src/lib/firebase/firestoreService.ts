import { db } from './config';
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
  deleteField,
  query,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import {
  HangoutRequest,
  HangoutRequestClientState,
  HangoutRequestFormData,
  ParticipantDataClient,
  ParticipantEventClient,
  FinalSelectedSlotClient,
  CommonSlotClient,
  DateRangeClient,
  ParticipantDataFirestore,
  ParticipantEventFirestore,
  DateRangeFirestore,
  CommonSlotFirestore,
} from '@/types/hangouts';
import { PackedStamp, StampPackClient, StampPackFirestore } from '@/types/stampPacks';
import { nanoid } from 'nanoid';


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
    stampCategory: data.stampCategory,
    stampPinned: data.stampPinned,
    stampOrder: data.stampOrder,
    stampAvailability: data.stampAvailability,
    location: data.location,
    travelMode: data.travelMode,
    // Convert Timestamps back to JS Dates
    start: data.start instanceof Timestamp ? data.start.toDate() : new Date(data.start),
    end: data.end instanceof Timestamp ? data.end.toDate() : new Date(data.end),
    repeatEndDate: data.repeatEndDate ? (data.repeatEndDate instanceof Timestamp ? data.repeatEndDate.toDate() : new Date(data.repeatEndDate)) : undefined,
    occurrenceDate: data.occurrenceDate ? (data.occurrenceDate instanceof Timestamp ? data.occurrenceDate.toDate() : new Date(data.occurrenceDate)) : undefined,
    stampDeletedAt: data.stampDeletedAt ? (data.stampDeletedAt instanceof Timestamp ? data.stampDeletedAt.toDate() : new Date(data.stampDeletedAt)) : undefined,
    // Ensure all other fields from CalendarEvent are mapped
  };
  return event;
};

// Caller-side input. `null` for an optional field is interpreted as
// "remove this field from the Firestore doc" (becomes deleteField()).
// `undefined` means "leave it alone" (no write).
type EventInput = {
  [K in keyof Omit<CalendarEvent, 'id'>]?: CalendarEvent[K] | null;
};

// Date fields that must be converted to Firestore Timestamps before write.
const DATE_FIELDS = ['start', 'end', 'repeatEndDate', 'occurrenceDate', 'stampDeletedAt'] as const satisfies readonly (keyof CalendarEvent)[];

const eventToFirestore = (eventData: EventInput): DocumentData => {
  const dataToSave: DocumentData = {};
  for (const [key, value] of Object.entries(eventData)) {
    if (value === undefined) continue;
    if (value === null) {
      dataToSave[key] = deleteField();
      continue;
    }
    if ((DATE_FIELDS as readonly string[]).includes(key) && value instanceof Date) {
      dataToSave[key] = Timestamp.fromDate(value);
    } else if ((DATE_FIELDS as readonly string[]).includes(key)) {
      dataToSave[key] = Timestamp.fromDate(new Date(value as string | number | Date));
    } else {
      dataToSave[key] = value;
    }
  }
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

export const updateCalendarItem = async (userId: string, itemId: string, itemData: EventInput): Promise<void> => {
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

// Firestore batched writes cap at 500 ops. Most users won't hit this with a
// single stamp, but we chunk to stay safe.
const BATCH_LIMIT = 450;

/**
 * Delete a stamp definition AND every applied instance pointing at it.
 * Used by the "Delete all" path in the stamp-delete dialog. Returns the number
 * of instance documents removed (the definition counts separately).
 */
export const deleteStampWithInstances = async (
  userId: string,
  stampId: string,
): Promise<number> => {
  if (!userId) throw new Error("User ID is required to delete stamp.");
  const colRef = getCalendarItemsCollectionRef(userId);
  const instanceQuery = query(colRef, where('originalStampId', '==', stampId));
  const snap = await getDocs(instanceQuery);

  let instanceCount = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const slice = docs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    slice.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    instanceCount += slice.length;
  }

  // Definition itself.
  await deleteDoc(doc(db, 'users', userId, 'calendarItems', stampId));
  return instanceCount;
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
        recipientUids: data.recipientUids ?? [],
        participants: participantsClient,   // CONVERTED
        commonAvailabilitySlots: commonAvailabilitySlotsClient, // CONVERTED
        finalSelectedSlot: finalSelectedSlotClient,             // CONVERTED
    };
};


export const createHangoutRequest = async (
  creatorUid: string,
  creatorName: string,
  formData: HangoutRequestFormData,
  creatorEvents: ParticipantEventClient[], // Expecting client dates
  recipientUids: string[] = [],
): Promise<string> => {
  try {
    const newRequestRef = doc(collection(db, HANGOUT_REQUESTS_COLLECTION));
    const normalizedRecipients = Array.from(new Set(recipientUids.filter((uid) => uid && uid !== creatorUid)));

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
      recipientUids: normalizedRecipients,
      participants: {
        [creatorUid]: creatorParticipantDataFirestore,
      },
    };

    await setDoc(newRequestRef, newRequestData);

    if (normalizedRecipients.length > 0) {
      const batch = writeBatch(db);
      for (const participantUid of normalizedRecipients) {
        const notifRef = doc(collection(db, `userNotifications/${participantUid}/notifications`));
        batch.set(notifRef, {
          type: 'hangout_request',
          hangoutRequestId: newRequestRef.id,
          hangoutRequestName: formData.requestName,
          creatorName,
          creatorUid,
          isRead: false,
          createdAt: Timestamp.now(),
          message: `${creatorName} invited you to "${formData.requestName}".`,
          participantUid,
          relatedUrl: `/hangouts/reply/${newRequestRef.id}`,
        });
      }
      await batch.commit();
    }

    return newRequestRef.id;
  } catch (error) {
    console.error('Error creating hangout request:', error);
    throw new Error('Failed to create hangout request.');
  }
};

// This function should return data suitable for client state (i.e., with JS Dates)
export const fetchHangoutRequestsForUser = async (userId: string): Promise<HangoutRequestClientState[]> => {
  try {
    const createdQuery = query(collection(db, HANGOUT_REQUESTS_COLLECTION), where('creatorUid', '==', userId));
    const invitedQuery = query(
      collection(db, HANGOUT_REQUESTS_COLLECTION),
      where('recipientUids', 'array-contains', userId),
    );

    const [createdSnapshot, invitedSnapshot] = await Promise.all([getDocs(createdQuery), getDocs(invitedQuery)]);
    const docsById = new Map<string, DocumentSnapshot<DocumentData>>();
    createdSnapshot.docs.forEach((docSnap) => docsById.set(docSnap.id, docSnap));
    invitedSnapshot.docs.forEach((docSnap) => docsById.set(docSnap.id, docSnap));
    // Map Firestore documents to the client-side state type
    return [...docsById.values()].map((docSnap) => hangoutRequestFromFirestore(docSnap));
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

// -------- Stamp packs ---------------------------------------------------

const STAMP_PACKS_COLLECTION = 'stampPacks';

const stampPackFromFirestore = (
  docSnap: DocumentSnapshot<DocumentData>,
): StampPackClient => {
  const data = docSnap.data() as StampPackFirestore | undefined;
  if (!data) throw new Error(`Stamp pack ${docSnap.id} has no data`);
  return {
    id: docSnap.id,
    ownerUid: data.ownerUid,
    name: data.name,
    description: data.description,
    createdAt: data.createdAt.toDate(),
    revokedAt: data.revokedAt ? data.revokedAt.toDate() : null,
    stamps: data.stamps ?? [],
  };
};

export interface CreateStampPackInput {
  ownerUid: string;
  name: string;
  description?: string;
  stamps: PackedStamp[];
}

/**
 * Create a new stamp pack. Uses a 10-char nanoid for the doc id (URL-safe,
 * unguessable) so the share link is the id itself.
 */
export const createStampPack = async (input: CreateStampPackInput): Promise<string> => {
  if (!input.ownerUid) throw new Error('ownerUid required');
  if (!input.stamps?.length) throw new Error('stamps required');
  const packId = nanoid(10);
  const ref = doc(db, STAMP_PACKS_COLLECTION, packId);
  const data: StampPackFirestore = {
    ownerUid: input.ownerUid,
    name: input.name.trim().slice(0, 80),
    description: input.description?.trim().slice(0, 280),
    createdAt: Timestamp.fromDate(new Date()),
    revokedAt: null,
    stamps: input.stamps,
  };
  await setDoc(ref, data);
  return packId;
};

export const fetchStampPack = async (packId: string): Promise<StampPackClient | null> => {
  if (!packId) return null;
  const snap = await getDoc(doc(db, STAMP_PACKS_COLLECTION, packId));
  if (!snap.exists()) return null;
  return stampPackFromFirestore(snap);
};

export const listMyStampPacks = async (ownerUid: string): Promise<StampPackClient[]> => {
  if (!ownerUid) return [];
  const q = query(
    collection(db, STAMP_PACKS_COLLECTION),
    where('ownerUid', '==', ownerUid),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(stampPackFromFirestore)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

export const revokeStampPack = async (packId: string): Promise<void> => {
  await updateDoc(doc(db, STAMP_PACKS_COLLECTION, packId), {
    revokedAt: Timestamp.fromDate(new Date()),
  });
};

export const unrevokeStampPack = async (packId: string): Promise<void> => {
  await updateDoc(doc(db, STAMP_PACKS_COLLECTION, packId), {
    revokedAt: null,
  });
};

export const deleteStampPack = async (packId: string): Promise<void> => {
  await deleteDoc(doc(db, STAMP_PACKS_COLLECTION, packId));
};
