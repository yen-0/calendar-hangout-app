import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Collection endpoint for Core Web Vitals from the client.
 * Currently logs to stdout; swap for Sentry/Datadog/etc. when a backend is wired up.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    // eslint-disable-next-line no-console
    console.log('[web-vital]', body);
  } catch {
    // Best-effort — don't fail collection on parse error.
  }
  return new NextResponse(null, { status: 204 });
}
