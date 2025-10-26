import { NextResponse } from 'next/server';
import { createRouteClient } from '../../../../../../lib/supabase-route';
import { loadProfile } from '../../../../../../lib/profile';

interface Params {
  params: { id: string; tagId: string };
}

export async function DELETE(_request: Request, { params }: Params) {
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

  const { data: conversation } = await supabase
    .from('conversation')
    .select('id, inbox:inbox_id(team_id)')
    .eq('id', params.id)
    .maybeSingle();

  if (!conversation || conversation.inbox.team_id !== profile.teamId) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  await supabase
    .from('conversation_tag')
    .delete()
    .eq('conversation_id', params.id)
    .eq('tag_id', params.tagId);

  return NextResponse.json({ success: true });
}
