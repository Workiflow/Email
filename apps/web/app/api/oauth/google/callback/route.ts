import { NextRequest, NextResponse } from 'next/server';
import { getOAuthClient, parseOAuthState, storeToken } from '../../../../lib/google';
import { createServiceClient } from '@db/inbox';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const stateParam = request.nextUrl.searchParams.get('state');
  if (!code || !stateParam) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const state = parseOAuthState(stateParam);
  const supabase = createServiceClient();
  const client = getOAuthClient();

  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    return NextResponse.json({ error: 'Google did not return a refresh token. Please re-authorize with prompt=consent.' }, { status: 400 });
  }

  client.setCredentials(tokens);
  const gmail = google.gmail({ version: 'v1', auth: client });
  const profile = await gmail.users.getProfile({ userId: 'me' });

  await storeToken(
    supabase,
    state.inboxId,
    {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date
    },
    profile.data.emailAddress ?? undefined
  );

  await supabase
    .from('inbox')
    .update({ last_synced_at: new Date().toISOString(), is_active: true })
    .eq('id', state.inboxId);

  return NextResponse.redirect(new URL(state.redirectPath, request.nextUrl.origin));
}
