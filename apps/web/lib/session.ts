import { createRouteClient } from './supabase-route';

export async function requireUser() {
  const supabase = createRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }
  return { user, supabase } as const;
}
