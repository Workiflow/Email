import { NextResponse } from 'next/server';
import { createRouteClient } from '../../../../lib/supabase-route';
import { loadProfile } from '../../../../lib/profile';

interface Params {
  params: { id: string };
}

export async function GET(_request: Request, { params }: Params) {
  const supabase = createRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const profile = await loadProfile(supabase, user.id);

  const { data: conversation, error } = await supabase
    .from('conversation')
    .select('*, inbox:inbox_id(team_id), snooze:snooze(*), conversation_tag(tag(id, name, color))')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !conversation || conversation.inbox.team_id !== profile.teamId) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const { data: messagesRows } = await supabase
    .from('message')
    .select('id, gmail_message_id, from_addr, to_addrs, cc_addrs, bcc_addrs, sent_at, body_html, body_text, headers, has_attachments')
    .eq('conversation_id', params.id)
    .order('sent_at', { ascending: true });

  const messageIds = (messagesRows ?? []).map((message) => message.id);

  const { data: attachmentsRows } = await supabase
    .from('attachment')
    .select('id, message_id, filename, mime_type, size, storage_path')
    .in('message_id', messageIds.length ? messageIds : ['00000000-0000-0000-0000-000000000000']);

  const { data: commentsRows } = await supabase
    .from('comment')
    .select('id, conversation_id, author_id, body, created_at')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true });

  const detail = {
    conversation: {
      id: conversation.id,
      inboxId: conversation.inbox_id,
      subject: conversation.subject ?? '(no subject)',
      status: conversation.status,
      assigneeId: conversation.assignee_id,
      lastCustomerMessageAt: conversation.last_customer_msg_at,
      lastAgentMessageAt: conversation.last_agent_msg_at,
      preview: conversation.preview,
      snoozedUntil: conversation.snooze?.until ?? null,
      tags: (conversation.conversation_tag ?? []).map((tagRow: any) => ({
        id: tagRow.tag.id,
        name: tagRow.tag.name,
        color: tagRow.tag.color
      }))
    },
    messages: (messagesRows ?? []).map((message) => ({
      id: message.id,
      conversationId: params.id,
      gmailMessageId: message.gmail_message_id,
      from: message.from_addr,
      to: message.to_addrs,
      cc: message.cc_addrs,
      bcc: message.bcc_addrs,
      sentAt: message.sent_at,
      bodyHtml: message.body_html,
      bodyText: message.body_text,
      headers: message.headers ?? {},
      hasAttachments: message.has_attachments ?? false,
      attachments: (attachmentsRows ?? [])
        .filter((attachment) => attachment.message_id === message.id)
        .map((attachment) => ({
          id: attachment.id,
          messageId: attachment.message_id,
          filename: attachment.filename,
          mimeType: attachment.mime_type,
          size: attachment.size,
          storagePath: attachment.storage_path
        }))
    })),
    comments: (commentsRows ?? []).map((comment) => ({
      id: comment.id,
      conversationId: comment.conversation_id,
      authorId: comment.author_id,
      body: comment.body,
      createdAt: comment.created_at
    }))
  };

  return NextResponse.json(detail);
}
