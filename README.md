# Shared Inbox

A lean, maintainable shared inbox for small teams. The app uses Next.js 14, Supabase, and polling Gmail sync to deliver a Front-style shared inbox with minimal moving parts.

## Monorepo Layout

```
/apps/web        – Next.js 14 app router + API routes
/packages/db     – SQL migrations, seed script, Supabase helpers
/packages/shared – Shared types, zod schemas, encryption & Gmail helpers
/packages/ui     – Lightweight UI primitives
```

## Prerequisites

- Node.js 20+
- pnpm 8+
- Supabase project with the SQL from `packages/db/sql`
- Google Cloud project with Gmail API enabled

Copy `.env.example` to `.env` and populate:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback
CRON_SECRET=choose-a-secret
ENCRYPTION_KEY=base64-encoded-32-byte-key
```

Generate an encryption key via `openssl rand -base64 32`.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Apply database schema and policies to Supabase:

   ```bash
   supabase db push --file packages/db/sql/0001_init.sql
   ```

3. (Optional) Seed demo data (requires `SUPABASE_SERVICE_ROLE_KEY`):

   ```bash
   pnpm db:seed
   ```

4. Run the dev server:

   ```bash
   pnpm dev
   ```

   The web app is served on http://localhost:3000.

## Gmail OAuth

1. Configure a Google OAuth client with redirect URI `https://your-domain.com/api/oauth/google/callback` (and the local URL above).
2. When creating an inbox, use the **Connect Gmail** action which calls `/api/inboxes/:id/connect-gmail` to obtain an OAuth URL. The callback stores the refresh token encrypted with AES-256-GCM.

## Cron Sync

Deploy environments should configure a scheduler (e.g. Vercel Cron) to hit the Gmail sync endpoint every 2–5 minutes:

```
GET https://your-domain.com/api/cron/gmail-sync?secret=CRON_SECRET
```

The sync handler fetches up to 200 messages per inbox, upserts conversations, and streams attachments to the Supabase storage bucket `attachments`.

## Testing

- Unit tests (encryption, Gmail parsing, sanitisation):

  ```bash
  pnpm test
  ```

- Playwright happy path (requires the app running):

  ```bash
  pnpm playwright
  ```

## Deployment Notes

- Deploy the Next.js app (e.g. Vercel). Provide all env vars at build/runtime.
- Provision a Supabase storage bucket named `attachments` (public access not required).
- Configure Supabase Auth email templates for magic link sign-in.
- Ensure Supabase JWT includes `team_id` claim for RLS (see `packages/db/sql` policies).
- Lock down the cron endpoint with a secret string.

## Security Considerations

- Gmail refresh tokens are encrypted using AES-256-GCM with a base64 key stored in `ENCRYPTION_KEY`.
- HTML bodies are sanitised with DOMPurify before rendering.
- Strict Content Security Policy headers ship via `next.config.mjs`.
- Realtime presence leverages Supabase channels for optimistic locking without external brokers.

