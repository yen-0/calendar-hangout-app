import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from './config';

export interface PublicUserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  displayNameLower: string;
  emailLower: string;
  searchText: string;
  updatedAt: Timestamp;
}

export interface PublicUserProfileClient {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  searchText: string;
  updatedAt: Date;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface FriendshipRecord {
  id: string;
  participantUids: [string, string];
  requestedByUid: string;
  status: FriendshipStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  acceptedAt?: Timestamp | null;
}

export interface FriendshipRecordClient {
  id: string;
  participantUids: [string, string];
  requestedByUid: string;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date | null;
}

const PUBLIC_USERS_COLLECTION = 'publicUsers';
const FRIENDSHIPS_COLLECTION = 'friendships';

const pairKey = (uidA: string, uidB: string) => [uidA, uidB].sort().join('__');

const normalize = (value: string | undefined | null) => (value ?? '').trim().toLowerCase();

function profileToClient(docId: string, data: PublicUserProfile): PublicUserProfileClient {
  return {
    uid: docId,
    displayName: data.displayName,
    email: data.email,
    photoURL: data.photoURL ?? null,
    searchText: data.searchText,
    updatedAt: data.updatedAt.toDate(),
  };
}

function friendshipToClient(docId: string, data: FriendshipRecord): FriendshipRecordClient {
  return {
    id: docId,
    participantUids: data.participantUids,
    requestedByUid: data.requestedByUid,
    status: data.status,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
    acceptedAt: data.acceptedAt ? data.acceptedAt.toDate() : null,
  };
}

export async function upsertPublicUserProfile(input: {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}): Promise<void> {
  if (!input.uid) return;
  const displayName = (input.displayName?.trim() || input.email?.split('@')[0] || 'Anonymous User').trim();
  const email = input.email?.trim() || '';
  const data: PublicUserProfile = {
    uid: input.uid,
    displayName,
    email,
    photoURL: input.photoURL ?? null,
    displayNameLower: normalize(displayName),
    emailLower: normalize(email),
    searchText: normalize(`${displayName} ${email}`),
    updatedAt: Timestamp.now(),
  };
  await setDoc(doc(db, PUBLIC_USERS_COLLECTION, input.uid), data, { merge: true });
}

export async function fetchPublicUserProfiles(): Promise<PublicUserProfileClient[]> {
  const snap = await getDocs(collection(db, PUBLIC_USERS_COLLECTION));
  return snap.docs
    .map((d) => profileToClient(d.id, d.data() as PublicUserProfile))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function fetchFriendshipsForUser(userId: string): Promise<FriendshipRecordClient[]> {
  if (!userId) return [];
  const q = query(collection(db, FRIENDSHIPS_COLLECTION), where('participantUids', 'array-contains', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => friendshipToClient(d.id, d.data() as FriendshipRecord));
}

export function getFriendshipId(uidA: string, uidB: string): string {
  return pairKey(uidA, uidB);
}

export async function sendFriendRequest(fromUid: string, toUid: string): Promise<string> {
  if (!fromUid || !toUid) throw new Error('Both user ids are required.');
  const id = pairKey(fromUid, toUid);
  const ref = doc(db, FRIENDSHIPS_COLLECTION, id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const data = existing.data() as FriendshipRecord;
    if (data.status === 'accepted') return id;
    if (data.status === 'pending' && data.requestedByUid === fromUid) return id;
    if (data.status === 'pending' && data.requestedByUid !== fromUid) {
      await updateDoc(ref, {
        status: 'accepted',
        updatedAt: Timestamp.now(),
        acceptedAt: Timestamp.now(),
      });
      return id;
    }
  }
  await setDoc(ref, {
    participantUids: [fromUid, toUid],
    requestedByUid: fromUid,
    status: 'pending',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    acceptedAt: null,
  });

  const batch = writeBatch(db);
  const notifRef = doc(collection(db, `userNotifications/${toUid}/notifications`));
  batch.set(notifRef, {
    type: 'friend_request',
    friendRequestId: id,
    friendUid: fromUid,
    creatorUid: fromUid,
    participantUid: toUid,
    isRead: false,
    createdAt: Timestamp.now(),
    message: 'You have a new friend request.',
    relatedUrl: '/friends',
  });
  await batch.commit();
  return id;
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  await updateDoc(doc(db, FRIENDSHIPS_COLLECTION, friendshipId), {
    status: 'accepted',
    updatedAt: Timestamp.now(),
    acceptedAt: Timestamp.now(),
  });
}

export async function declineFriendRequest(friendshipId: string): Promise<void> {
  await deleteDoc(doc(db, FRIENDSHIPS_COLLECTION, friendshipId));
}

export function getFriendRelation(
  userId: string,
  friendship: FriendshipRecordClient | undefined,
): 'self' | 'accepted' | 'incoming' | 'outgoing' | 'none' {
  if (!friendship) return 'none';
  if (!friendship.participantUids.includes(userId)) return 'none';
  if (friendship.status === 'accepted') return 'accepted';
  if (friendship.requestedByUid === userId) return 'outgoing';
  return 'incoming';
}
