import 'server-only';
import { NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export async function requireUid(req: NextRequest): Promise<string> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing bearer token');
  }
  const idToken = header.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    throw new HttpError(401, 'Invalid Firebase ID token');
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
