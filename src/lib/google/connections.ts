import 'server-only';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';

export interface StoredConnection {
  refreshToken: string;
  scope: string;
  connectedAt: Timestamp;
  lastError?: string | null;
}

const connectionRef = (uid: string) =>
  adminDb().collection('users').doc(uid).collection('private').doc('googleOAuth');

export async function saveConnection(
  uid: string,
  refreshToken: string,
  scope: string,
): Promise<void> {
  const data: StoredConnection = {
    refreshToken,
    scope,
    connectedAt: Timestamp.now(),
    lastError: null,
  };
  await connectionRef(uid).set(data, { merge: true });
}

export async function getRefreshToken(uid: string): Promise<string | null> {
  const snap = await connectionRef(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<StoredConnection> | undefined;
  return data?.refreshToken ?? null;
}

export async function deleteConnection(uid: string): Promise<void> {
  await connectionRef(uid).delete();
}

export async function markConnectionError(uid: string, error: string): Promise<void> {
  await connectionRef(uid).set({ lastError: error }, { merge: true });
}

export async function isConnected(uid: string): Promise<boolean> {
  const token = await getRefreshToken(uid);
  return Boolean(token);
}
