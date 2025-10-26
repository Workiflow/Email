import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('Supabase environment variables are required');
}

const supabase = createClient(url, serviceKey);

async function main() {
  const teamId = crypto.randomUUID();
  const inboxId = crypto.randomUUID();
  const profileId = crypto.randomUUID();
  const conversationId = crypto.randomUUID();
  const messageId = crypto.randomUUID();

  await supabase.from('team').upsert({ id: teamId, name: 'Demo Team' });
  await supabase
    .from('profile')
    .upsert({ id: profileId, team_id: teamId, email: 'agent@example.com', name: 'Demo Agent', role: 'admin' });
  await supabase
    .from('inbox')
    .upsert({
      id: inboxId,
      team_id: teamId,
      name: 'Support',
      gmail_address: 'demo-inbox@example.com',
      is_active: true
    });

  await supabase
    .from('conversation')
    .upsert({
      id: conversationId,
      inbox_id: inboxId,
      gmail_thread_id: nanoid(),
      subject: 'Welcome to the shared inbox',
      status: 'open',
      assignee_id: profileId,
      preview: 'This is a demo conversation',
      last_customer_msg_at: new Date().toISOString()
    });

  await supabase
    .from('message')
    .upsert({
      id: messageId,
      conversation_id: conversationId,
      gmail_message_id: nanoid(),
      from_addr: 'customer@example.com',
      to_addrs: ['support@example.com'],
      cc_addrs: [],
      bcc_addrs: [],
      sent_at: new Date().toISOString(),
      body_text: 'This is a demo message.',
      body_html: '<p>This is a demo message.</p>',
      headers: {},
      has_attachments: false
    });

  console.log('Seed complete');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
