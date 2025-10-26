-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "citext";

-- Tables
create table if not exists public.team (
  id uuid primary key,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.profile (
  id uuid primary key,
  team_id uuid references public.team(id) on delete cascade,
  email citext not null unique,
  name text,
  role text not null check (role in ('admin', 'agent', 'viewer')),
  created_at timestamptz default now()
);

create table if not exists public.inbox (
  id uuid primary key,
  team_id uuid references public.team(id) on delete cascade,
  name text not null,
  gmail_address text not null,
  google_oauth_client_id text,
  google_account_email text,
  is_active boolean default true,
  last_synced_at timestamptz,
  last_history_id text,
  token_encrypted bytea,
  token_iv bytea,
  token_auth_tag bytea,
  created_at timestamptz default now()
);

create table if not exists public.conversation (
  id uuid primary key,
  inbox_id uuid references public.inbox(id) on delete cascade,
  gmail_thread_id text unique not null,
  subject text,
  status text not null default 'open' check (status in ('open','waiting','closed')),
  assignee_id uuid references public.profile(id),
  last_customer_msg_at timestamptz,
  last_agent_msg_at timestamptz,
  preview text,
  created_at timestamptz default now()
);

create table if not exists public.message (
  id uuid primary key,
  conversation_id uuid references public.conversation(id) on delete cascade,
  gmail_message_id text unique not null,
  from_addr text not null,
  to_addrs text[] not null default '{}',
  cc_addrs text[] not null default '{}',
  bcc_addrs text[] not null default '{}',
  sent_at timestamptz not null,
  body_html text,
  body_text text,
  headers jsonb default '{}'::jsonb,
  has_attachments boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.attachment (
  id uuid primary key,
  message_id uuid references public.message(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  size integer not null,
  storage_path text not null,
  created_at timestamptz default now()
);

create table if not exists public.comment (
  id uuid primary key,
  conversation_id uuid references public.conversation(id) on delete cascade,
  author_id uuid references public.profile(id),
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.tag (
  id uuid primary key,
  team_id uuid references public.team(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz default now()
);

create table if not exists public.conversation_tag (
  conversation_id uuid references public.conversation(id) on delete cascade,
  tag_id uuid references public.tag(id) on delete cascade,
  primary key (conversation_id, tag_id)
);

create table if not exists public.snooze (
  conversation_id uuid primary key references public.conversation(id) on delete cascade,
  until timestamptz not null,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_conversation_status on public.conversation(status);
create index if not exists idx_conversation_assignee on public.conversation(assignee_id);
create index if not exists idx_conversation_last_customer on public.conversation(last_customer_msg_at desc);
create index if not exists idx_conversation_search on public.conversation using gin (to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(preview,'')));
create index if not exists idx_message_body_search on public.message using gin (to_tsvector('english', coalesce(body_text,'')));

-- RLS setup
alter table public.team enable row level security;
alter table public.profile enable row level security;
alter table public.inbox enable row level security;
alter table public.conversation enable row level security;
alter table public.message enable row level security;
alter table public.attachment enable row level security;
alter table public.comment enable row level security;
alter table public.tag enable row level security;
alter table public.conversation_tag enable row level security;
alter table public.snooze enable row level security;

-- Helper function to extract team id from auth token metadata
create or replace function public.current_team_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.team_id', true), '')::uuid;
$$;

-- Policies
create policy "Team members can view team" on public.team
  for select using (id = public.current_team_id());

create policy "Team members manage team" on public.team
  for all using (id = public.current_team_id());

create policy "Team profile read" on public.profile
  for select using (team_id = public.current_team_id());

create policy "Team profile write" on public.profile
  for all using (team_id = public.current_team_id() and role != 'viewer');

create policy "Inbox read" on public.inbox
  for select using (team_id = public.current_team_id());

create policy "Inbox write" on public.inbox
  for all using (team_id = public.current_team_id() and exists (
    select 1 from public.profile
    where id = auth.uid()
      and team_id = public.current_team_id()
      and role in ('admin', 'agent')
  ));

create policy "Conversation read" on public.conversation
  for select using (exists (
    select 1 from public.inbox i
    where i.id = inbox_id and i.team_id = public.current_team_id()
  ));

create policy "Conversation write" on public.conversation
  for all using (exists (
    select 1 from public.profile p
    join public.inbox i on i.team_id = p.team_id
    where p.id = auth.uid()
      and p.role in ('admin', 'agent')
      and i.id = conversation.inbox_id
      and i.team_id = public.current_team_id()
  ));

create policy "Message read" on public.message
  for select using (exists (
    select 1 from public.conversation c
    join public.inbox i on i.id = c.inbox_id
    where c.id = message.conversation_id
      and i.team_id = public.current_team_id()
  ));

create policy "Message write" on public.message
  for all using (exists (
    select 1 from public.conversation c
    join public.profile p on p.team_id = public.current_team_id()
    where c.id = message.conversation_id
      and p.id = auth.uid()
      and p.role in ('admin', 'agent')
  ));

create policy "Attachment read" on public.attachment
  for select using (exists (
    select 1 from public.message m
    join public.conversation c on c.id = m.conversation_id
    join public.inbox i on i.id = c.inbox_id
    where m.id = attachment.message_id
      and i.team_id = public.current_team_id()
  ));

create policy "Attachment write" on public.attachment
  for all using (exists (
    select 1 from public.message m
    join public.conversation c on c.id = m.conversation_id
    join public.profile p on p.id = auth.uid()
    where m.id = attachment.message_id
      and p.team_id = public.current_team_id()
      and p.role in ('admin', 'agent')
  ));

create policy "Comment read" on public.comment
  for select using (exists (
    select 1 from public.conversation c
    join public.inbox i on i.id = c.inbox_id
    where c.id = comment.conversation_id
      and i.team_id = public.current_team_id()
  ));

create policy "Comment write" on public.comment
  for all using (exists (
    select 1 from public.profile p
    join public.conversation c on c.id = comment.conversation_id
    join public.inbox i on i.id = c.inbox_id
    where p.id = auth.uid()
      and p.team_id = public.current_team_id()
      and p.role in ('admin', 'agent')
      and i.team_id = public.current_team_id()
  ));

create policy "Tag read" on public.tag
  for select using (team_id = public.current_team_id());

create policy "Tag write" on public.tag
  for all using (exists (
    select 1 from public.profile p
    where p.id = auth.uid()
      and p.team_id = public.current_team_id()
      and p.role in ('admin', 'agent')
  ));

create policy "Conversation tag read" on public.conversation_tag
  for select using (exists (
    select 1 from public.conversation c
    join public.tag t on t.id = conversation_tag.tag_id
    where c.id = conversation_tag.conversation_id
      and t.team_id = public.current_team_id()
  ));

create policy "Conversation tag write" on public.conversation_tag
  for all using (exists (
    select 1 from public.conversation c
    join public.inbox i on i.id = c.inbox_id
    join public.profile p on p.id = auth.uid()
    where c.id = conversation_tag.conversation_id
      and i.team_id = public.current_team_id()
      and p.team_id = i.team_id
      and p.role in ('admin', 'agent')
  ));

create policy "Snooze read" on public.snooze
  for select using (exists (
    select 1 from public.conversation c
    join public.inbox i on i.id = c.inbox_id
    where c.id = snooze.conversation_id
      and i.team_id = public.current_team_id()
  ));

create policy "Snooze write" on public.snooze
  for all using (exists (
    select 1 from public.conversation c
    join public.inbox i on i.id = c.inbox_id
    join public.profile p on p.id = auth.uid()
    where c.id = snooze.conversation_id
      and i.team_id = public.current_team_id()
      and p.role in ('admin', 'agent')
  ));

