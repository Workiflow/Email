import { NextResponse } from 'next/server';
import { createRouteClient } from '../../../lib/supabase-route';
import { loadProfile } from '../../../lib/profile';
import { createInboxSchema } from '@shared/inbox';

export async function POST(request: Request) {
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

  const payload = await request.json();
  const parsed = createInboxSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { data, error } = await supabase
    .from('inbox')
    .insert({
      id: crypto.randomUUID(),
      team_id: profile.teamId,
      name: parsed.data.name,
      gmail_address: parsed.data.gmailAddress,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
