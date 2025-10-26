import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

type ClientOptions = {
  serviceRoleKey?: string;
  supabaseUrl?: string;
};

export function createServiceClient(options: ClientOptions = {}) {
  const supabaseUrl = options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase environment variables are missing');
  }
  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'shared-inbox-service' } }
  });
}

export type { Database };
