import { NextResponse } from 'next/server';
import { createRouteClient } from '../../../../../lib/supabase-route';
import { loadProfile } from '../../../../../lib/profile';
import { snoozeSchema } from '@shared/inbox';

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

  const payload = await request.json();
  const parsed = snoozeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { data: conversation } = await supabase
    .from('conversation')
    .select('id, inbox:inbox_id(team_id)')
    .eq('id', params.id)
    .maybeSingle();

  if (!conversation || conversation.inbox.team_id !== profile.teamId) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  await supabase
    .from('snooze')
    .upsert({ conversation_id: params.id, until: parsed.data.until });

  return NextResponse.json({ success: true });
}
