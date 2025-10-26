import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '../../../lib/supabase-route';
import { loadProfile } from '../../../lib/profile';
import { filterSchema } from '@shared/inbox';

export async function GET(request: NextRequest) {
  const supabase = createRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const profile = await loadProfile(supabase, user.id);

  const parsed = filterSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const query = supabase
    .from('conversation')
    .select(
      'id, inbox_id, subject, status, assignee_id, last_customer_msg_at, last_agent_msg_at, preview, inbox:inbox_id(team_id), snooze:snooze(*), conversation_tag(tag(id, name, color))'
    )
    .order('last_customer_msg_at', { ascending: false })
    .limit(200);

  if (parsed.data.status) {
    query.eq('status', parsed.data.status);
  }

  if (parsed.data.assigneeId) {
    query.eq('assignee_id', parsed.data.assigneeId);
  }

  if (parsed.data.inboxId) {
    query.eq('inbox_id', parsed.data.inboxId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filtered = (data ?? []).filter((row) => row.inbox?.team_id === profile.teamId);

  const q = parsed.data.q?.toLowerCase();
  const tagId = parsed.data.tagId;
  const snoozed = parsed.data.snoozed === 'true';

  const result = filtered
    .filter((row) => {
      if (q) {
        const haystack = `${row.subject ?? ''} ${row.preview ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }
      if (tagId) {
        const tags = (row.conversation_tag ?? []).map((item: any) => item.tag.id);
        if (!tags.includes(tagId)) {
          return false;
        }
      }
      if (snoozed) {
        if (!row.snooze?.until) {
          return false;
        }
      }
      return true;
    })
    .map((row) => ({
      id: row.id,
      inboxId: row.inbox_id,
      subject: row.subject ?? '(no subject)',
      status: row.status,
      assigneeId: row.assignee_id,
      lastCustomerMessageAt: row.last_customer_msg_at,
      lastAgentMessageAt: row.last_agent_msg_at,
      preview: row.preview,
      snoozedUntil: row.snooze?.until ?? null,
      tags: (row.conversation_tag ?? []).map((tagRow: any) => ({
        id: tagRow.tag.id,
        name: tagRow.tag.name,
        color: tagRow.tag.color
      }))
    }));

  return NextResponse.json(result);
}
