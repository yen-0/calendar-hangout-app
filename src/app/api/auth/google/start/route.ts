import { NextRequest, NextResponse } from 'next/server';
import { HttpError, requireUid } from '@/lib/google/auth-helpers';
import { buildAuthUrl } from '@/lib/google/oauth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const uid = await requireUid(req);
    const url = buildAuthUrl(uid);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
