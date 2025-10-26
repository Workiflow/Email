import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@db/inbox';
import type { Profile } from '@shared/inbox';

export async function loadProfile(supabase: SupabaseClient<Database>, userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profile')
    .select('id, email, name, role, team_id')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error('Profile not found');
  }

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    teamId: data.team_id
  };
}
