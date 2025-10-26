import { redirect } from 'next/navigation';
import { createServerClient } from '../../lib/supabase-server';
import { getSession } from '../../lib/auth';
import { InboxShell } from '../../components/inbox-shell';
import type { ConversationSummary, Profile } from '@shared/inbox';

async function loadData(userId: string) {
  const supabase = createServerClient();
  const { data: profileRow, error: profileError } = await supabase
    .from('profile')
    .select('id, email, name, role, team_id')
    .eq('id', userId)
    .single();

  if (profileError || !profileRow) {
    throw profileError ?? new Error('Profile missing');
  }

  const profile: Profile = {
    id: profileRow.id,
    email: profileRow.email,
    name: profileRow.name,
    role: profileRow.role,
    teamId: profileRow.team_id
  };

  const { data: conversationsRows } = await supabase
    .from('conversation')
    .select(
      'id, inbox_id, subject, status, assignee_id, last_customer_msg_at, last_agent_msg_at, preview, snooze:snooze(*), conversation_tag(tag(id, name, color))'
    )
    .order('last_customer_msg_at', { ascending: false })
    .limit(50);

  const conversations: ConversationSummary[] = (conversationsRows ?? []).map((row) => ({
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

  return { profile, conversations };
}

export default async function InboxPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const initialData = await loadData(session.user.id);

  return <InboxShell profile={initialData.profile} initialConversations={initialData.conversations} />;
}
