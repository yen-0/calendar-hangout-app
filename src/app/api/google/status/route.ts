import { NextRequest, NextResponse } from 'next/server';
import { HttpError, requireUid } from '@/lib/google/auth-helpers';
import { isConnected } from '@/lib/google/connections';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const uid = await requireUid(req);
    const connected = await isConnected(uid);
    return NextResponse.json({ connected });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
