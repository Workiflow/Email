import { cookies, headers } from 'next/headers';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@db/inbox';

export function createServerClient() {
  const cookieStore = cookies();
  const headerStore = headers();

  return createServerSupabaseClient<Database>({
    cookies: () => cookieStore,
    headers: () => headerStore
  });
}
