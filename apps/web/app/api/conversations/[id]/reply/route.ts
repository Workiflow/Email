import { NextResponse } from 'next/server';
import { createRouteClient } from '../../../../../lib/supabase-route';
import { loadProfile } from '../../../../../lib/profile';
import { replySchema } from '@shared/inbox';
import { decryptToken, getOAuthClient, refreshAccessToken } from '../../../../../lib/google';
import { google } from 'googleapis';

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
  const parsed = replySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { data: conversation } = await supabase
    .from('conversation')
    .select('id, inbox_id, subject, gmail_thread_id, inbox:inbox_id(team_id, google_account_email, token_encrypted, token_iv, token_auth_tag)')
    .eq('id', params.id)
    .maybeSingle();

  if (!conversation || conversation.inbox.team_id !== profile.teamId) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const token = decryptToken(conversation.inbox);
  if (!token) {
    return NextResponse.json({ error: 'Inbox is not connected to Gmail' }, { status: 400 });
  }

  let workingToken = token;
  if (!token.access_token || (token.expiry_date && token.expiry_date < Date.now() + 60_000)) {
    workingToken = await refreshAccessToken(token, supabase, conversation.inbox_id);
  }

  const { data: lastMessage } = await supabase
    .from('message')
    .select('gmail_message_id, headers')
    .eq('conversation_id', params.id)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const toHeaderString = (value: unknown) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.join(' ');
    return String(value);
  };

  const inReplyTo = toHeaderString(lastMessage?.headers?.['message-id']);
  const references = toHeaderString(lastMessage?.headers?.['references']);

  const emailHeaders = [
    `From: ${conversation.inbox.google_account_email ?? profile.email}`,
    `To: ${parsed.data.to.join(', ')}`,
    parsed.data.cc && parsed.data.cc.length ? `Cc: ${parsed.data.cc.join(', ')}` : undefined,
    parsed.data.bcc && parsed.data.bcc.length ? `Bcc: ${parsed.data.bcc.join(', ')}` : undefined,
    `Subject: Re: ${conversation.subject ?? ''}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : undefined,
    references ? `References: ${references}` : undefined,
    'Content-Type: text/html; charset=UTF-8'
  ]
    .filter(Boolean)
    .join('\r\n');

  const body = `${emailHeaders}\r\n\r\n${parsed.data.body}`;
  const raw = Buffer.from(body).toString('base64url');

  const client = getOAuthClient();
  client.setCredentials(workingToken);
  const gmail = google.gmail({ version: 'v1', auth: client });

  const sendResult = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
      threadId: conversation.gmail_thread_id ?? undefined
    }
  });

  const gmailMessageId = sendResult.data.id ?? crypto.randomUUID();

  await supabase
    .from('message')
    .insert({
      id: crypto.randomUUID(),
      conversation_id: params.id,
      gmail_message_id: gmailMessageId,
      from_addr: conversation.inbox.google_account_email ?? profile.email,
      to_addrs: parsed.data.to,
      cc_addrs: parsed.data.cc ?? [],
      bcc_addrs: parsed.data.bcc ?? [],
      sent_at: new Date().toISOString(),
      body_html: parsed.data.body,
      body_text: parsed.data.body,
      headers: {
        'in-reply-to': inReplyTo,
        references,
        subject: `Re: ${conversation.subject ?? ''}`
      },
      has_attachments: parsed.data.attachments?.length ? true : false
    });

  await supabase
    .from('conversation')
    .update({
      last_agent_msg_at: new Date().toISOString(),
      status: 'waiting',
      assignee_id: profile.id,
      gmail_thread_id: conversation.gmail_thread_id ?? sendResult.data.threadId ?? null
    })
    .eq('id', params.id);

  return NextResponse.json({ success: true });
}
