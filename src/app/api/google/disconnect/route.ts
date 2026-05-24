import { NextRequest, NextResponse } from 'next/server';
import { HttpError, requireUid } from '@/lib/google/auth-helpers';
import { deleteConnection } from '@/lib/google/connections';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const uid = await requireUid(req);
    await deleteConnection(uid);
    return NextResponse.json({ disconnected: true });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
