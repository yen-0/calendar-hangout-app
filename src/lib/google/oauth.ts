import { createHmac, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

export const GCAL_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

const STATE_TTL_MS = 10 * 60_000;

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export function googleClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: requireEnv('GOOGLE_OAUTH_CLIENT_ID'),
    clientSecret: requireEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
    redirectUri: requireEnv('GOOGLE_OAUTH_REDIRECT_URI'),
  });
}

function stateSecret(): string {
  return requireEnv('GOOGLE_OAUTH_STATE_SECRET');
}

export function signState(uid: string): string {
  const nonce = Math.random().toString(36).slice(2, 10);
  const payload = `${uid}.${Date.now()}.${nonce}`;
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifyState(state: string): { uid: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot === -1) return null;
    const payload = decoded.slice(0, lastDot);
    const provided = decoded.slice(lastDot + 1);
    const expected = createHmac('sha256', stateSecret()).update(payload).digest('hex');
    const a = Buffer.from(provided, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const [uid, tsStr] = payload.split('.');
    const ts = Number(tsStr);
    if (!uid || Number.isNaN(ts)) return null;
    if (Date.now() - ts > STATE_TTL_MS) return null;
    return { uid };
  } catch {
    return null;
  }
}

export function buildAuthUrl(uid: string): string {
  return googleClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GCAL_SCOPES,
    state: signState(uid),
    include_granted_scopes: true,
  });
}
