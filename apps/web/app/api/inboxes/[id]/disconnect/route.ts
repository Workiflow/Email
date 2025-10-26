import { NextResponse } from 'next/server';
import { createRouteClient } from '../../../../lib/supabase-route';
import { loadProfile } from '../../../../lib/profile';
import { decryptToken, revokeToken } from '../../../../lib/google';

interface Params {
  params: { id: string };
}

export async function POST(_request: Request, { params }: Params) {
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

  const { data: inbox } = await supabase
    .from('inbox')
    .select('id, team_id, token_encrypted, token_iv, token_auth_tag')
    .eq('id', params.id)
    .single();

  if (!inbox || inbox.team_id !== profile.teamId) {
    return NextResponse.json({ error: 'Inbox not found' }, { status: 404 });
  }

  const token = decryptToken(inbox);
  if (token) {
    await revokeToken(token).catch(() => {
      // ignore errors when revoking
    });
  }

  await supabase
    .from('inbox')
    .update({ token_encrypted: null, token_iv: null, token_auth_tag: null, google_account_email: null })
    .eq('id', inbox.id);

  return NextResponse.json({ success: true });
}
