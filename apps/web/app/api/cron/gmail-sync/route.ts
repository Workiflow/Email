import { Buffer } from 'buffer';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@db/inbox';
import { decryptToken, getOAuthClient, refreshAccessToken } from '../../../../lib/google';
import { google } from 'googleapis';
import { parseGmailPayload } from '@shared/inbox';

const MAX_MESSAGES_PER_RUN = 200;

function splitAddresses(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => entry.split(',').map((part) => part.trim()).filter(Boolean));
  }
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: inboxes, error } = await supabase
    .from('inbox')
    .select('id, team_id, gmail_address, last_synced_at, last_history_id, token_encrypted, token_iv, token_auth_tag, google_account_email, is_active')
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const inbox of inboxes ?? []) {
    const token = decryptToken(inbox);
    if (!token) {
      continue;
    }

    let workingToken = token;
    if (!token.access_token || (token.expiry_date && token.expiry_date < Date.now() + 60_000)) {
      workingToken = await refreshAccessToken(token, supabase, inbox.id);
    }

    const client = getOAuthClient();
    client.setCredentials(workingToken);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const since = inbox.last_synced_at
      ? Math.floor(new Date(inbox.last_synced_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 3;

    const list = await gmail.users.messages.list({
      userId: 'me',
      q: `after:${since}`,
      maxResults: MAX_MESSAGES_PER_RUN
    });

    const messageIds = list.data.messages?.map((m) => m.id).filter(Boolean) ?? [];

    for (const messageId of messageIds) {
      const messageRes = await gmail.users.messages.get({ userId: 'me', id: messageId!, format: 'full' });
      const message = messageRes.data;
      if (!message.threadId || !message.payload) continue;

      const parsed = parseGmailPayload(message.payload as any);

      const fromHeader = String((parsed.headers['from'] ?? '') || '');
      const toHeader = splitAddresses(parsed.headers['to'] as any);
      const ccHeader = splitAddresses(parsed.headers['cc'] as any);
      const bccHeader = splitAddresses(parsed.headers['bcc'] as any);
      const subjectHeader = String((parsed.headers['subject'] ?? message.snippet ?? '') || '');

      const preview = (message.snippet ?? '').slice(0, 200);

      const { data: existingConversation } = await supabase
        .from('conversation')
        .select('id, status')
        .eq('gmail_thread_id', message.threadId)
        .maybeSingle();

      let conversationId = existingConversation?.id;
      if (!conversationId) {
        conversationId = crypto.randomUUID();
        await supabase.from('conversation').upsert({
          id: conversationId,
          inbox_id: inbox.id,
          gmail_thread_id: message.threadId,
          subject: subjectHeader || '(no subject)',
          status: 'open',
          preview,
          last_customer_msg_at: new Date(Number(message.internalDate)).toISOString()
        });
      }

      await supabase
        .from('conversation')
        .update({
          subject: subjectHeader || '(no subject)',
          preview,
          last_customer_msg_at: new Date(Number(message.internalDate)).toISOString()
        })
        .eq('id', conversationId);

      const { data: existingMessage } = await supabase
        .from('message')
        .select('id')
        .eq('gmail_message_id', message.id!)
        .maybeSingle();

      const messageId = existingMessage?.id ?? crypto.randomUUID();

      await supabase
        .from('message')
        .upsert(
          {
            id: messageId,
            conversation_id: conversationId,
            gmail_message_id: message.id!,
            from_addr: fromHeader,
            to_addrs: toHeader,
            cc_addrs: ccHeader,
            bcc_addrs: bccHeader,
            sent_at: new Date(Number(message.internalDate)).toISOString(),
            body_html: parsed.bodyHtml,
            body_text: parsed.bodyText,
            headers: parsed.headers,
            has_attachments: parsed.attachments.length > 0
          },
          { onConflict: 'gmail_message_id' }
        );

      if (parsed.attachments.length > 0) {
        for (const attachment of parsed.attachments) {
          const attachmentData = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: message.id!,
            id: attachment.attachmentId
          });
          const data = attachmentData.data.data;
          if (!data) continue;
          const buffer = Buffer.from(data, 'base64');
          const storagePath = `${inbox.id}/${message.id}/${attachment.attachmentId}`;
          const attachmentRecordId = `${message.id}-${attachment.attachmentId}`;
          await supabase.storage.from('attachments').upload(storagePath, buffer, {
            contentType: attachment.mimeType,
            upsert: true
          });
          await supabase
            .from('attachment')
            .upsert(
              {
                id: attachmentRecordId,
                message_id: messageId,
                filename: attachment.filename,
                mime_type: attachment.mimeType,
                size: attachment.size,
                storage_path: storagePath
              },
              { onConflict: 'id' }
            );
        }
      }
    }

    await supabase
      .from('inbox')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', inbox.id);
  }

  return NextResponse.json({ success: true });
}
