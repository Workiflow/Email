import { NextResponse } from 'next/server';
import { createRouteClient } from '../../../lib/supabase-route';
import { loadProfile } from '../../../lib/profile';

export async function GET() {
  const supabase = createRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await loadProfile(supabase, user.id);

  return NextResponse.json(profile);
}
