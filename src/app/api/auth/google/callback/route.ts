import { NextRequest, NextResponse } from 'next/server';
import { saveConnection } from '@/lib/google/connections';
import { googleClient, verifyState } from '@/lib/google/oauth';

export const runtime = 'nodejs';

function settingsUrl(req: NextRequest, params: Record<string, string>): string {
  const url = new URL('/settings', req.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const errorParam = req.nextUrl.searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(settingsUrl(req, { google: 'error', reason: errorParam }));
  }
  if (!code || !state) {
    return NextResponse.redirect(settingsUrl(req, { google: 'error', reason: 'missing_params' }));
  }

  const verified = verifyState(state);
  if (!verified) {
    return NextResponse.redirect(settingsUrl(req, { google: 'error', reason: 'invalid_state' }));
  }

  try {
    const client = googleClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        settingsUrl(req, { google: 'error', reason: 'no_refresh_token' }),
      );
    }
    await saveConnection(verified.uid, tokens.refresh_token, tokens.scope ?? '');
    return NextResponse.redirect(settingsUrl(req, { google: 'connected' }));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'token_exchange_failed';
    return NextResponse.redirect(settingsUrl(req, { google: 'error', reason: message }));
  }
}
