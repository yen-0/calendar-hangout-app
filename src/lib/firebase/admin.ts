import 'server-only';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let cached: App | undefined;

function getAdminApp(): App {
  if (cached) return cached;
  const existing = getApps();
  if (existing.length > 0) {
    cached = existing[0];
    return cached;
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!json) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY env var is required for the Admin SDK (JSON string of a service account key).',
    );
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY env var must be a valid JSON string of a service account key.',
    );
  }

  cached = initializeApp({ credential: cert(parsed as Parameters<typeof cert>[0]) });
  return cached;
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}
