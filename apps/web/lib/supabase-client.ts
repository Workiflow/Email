'use client';

import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';
import type { Database } from '@db/inbox';

export function useSupabaseBrowser() {
  const [client] = useState(() => createBrowserSupabaseClient<Database>());
  return client;
}
