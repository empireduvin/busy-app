import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicSupabaseEnv } from '@/lib/public-env';

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const { url, anonKey } = getPublicSupabaseEnv();

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

export function getSupabaseBrowserClientResult() {
  try {
    return {
      client: getSupabaseBrowserClient(),
      error: null,
    };
  } catch (error) {
    return {
      client: null,
      error,
    };
  }
}
