import { NextRequest, NextResponse } from 'next/server';
import { createOAuthState, getOAuthClient } from '../../../../lib/google';
import { googleOAuthStateSchema } from '@shared/inbox';

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = googleOAuthStateSchema.safeParse({
    inboxId: params.inboxId,
    teamId: params.teamId,
    redirectPath: params.redirectPath ?? '/inbox'
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const state = createOAuthState(parsed.data);
  const client = getOAuthClient();
  const authUrl = client.generateAuthUrl({
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    access_type: 'offline',
    prompt: 'consent',
    state
  });

  return NextResponse.redirect(authUrl);
}
