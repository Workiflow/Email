import { NextResponse } from 'next/server';
import { createRouteClient } from '../../../../lib/supabase-route';
import { loadProfile } from '../../../../lib/profile';
import { createOAuthState, getOAuthClient } from '../../../../lib/google';

interface Params {
  params: { id: string };
}

export async function POST(request: Request, { params }: Params) {
  const supabase = createRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await loadProfile(supabase, user.id);
  if (profile.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: inbox, error } = await supabase
    .from('inbox')
    .select('id, team_id')
    .eq('id', params.id)
    .single();

  if (error || !inbox || inbox.team_id !== profile.teamId) {
    return NextResponse.json({ error: 'Inbox not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const redirectPath = typeof body?.redirectPath === 'string' ? body.redirectPath : '/inbox';

  const oauthState = createOAuthState({ inboxId: inbox.id, teamId: profile.teamId, redirectPath });
  const client = getOAuthClient();
  const authUrl = client.generateAuthUrl({
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    access_type: 'offline',
    prompt: 'consent',
    state: oauthState
  });

  return NextResponse.json({ url: authUrl });
}
