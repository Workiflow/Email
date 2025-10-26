import { createServerClient } from './supabase-server';

export async function getSession() {
  const supabase = createServerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  return session;
}
