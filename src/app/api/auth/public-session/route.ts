import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { adminAuth } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const uid = `public_${nanoid(20)}`;
    const token = await adminAuth().createCustomToken(uid, {
      publicSession: 'true',
    });

    return NextResponse.json({ uid, token });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
