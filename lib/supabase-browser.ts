import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { navigatorLock, processLock, type LockFunc } from '@supabase/auth-js';
import { getPublicSupabaseEnv } from '@/lib/public-env';

let browserClient: SupabaseClient | null = null;

const resilientBrowserLock: LockFunc = async (name, acquireTimeout, fn) => {
  const canUseNavigatorLock =
    typeof window !== 'undefined' &&
    typeof window.navigator !== 'undefined' &&
    'locks' in window.navigator &&
    Boolean(window.navigator.locks);

  if (canUseNavigatorLock) {
    try {
      return await navigatorLock(name, acquireTimeout, fn);
    } catch (error: any) {
      if (error?.isAcquireTimeout) {
        console.warn(
          `Supabase auth navigator lock timed out for ${name}; falling back to process lock.`
        );
        return processLock(name, acquireTimeout, fn);
      }

      throw error;
    }
  }

  return processLock(name, acquireTimeout, fn);
};

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const { url, anonKey } = getPublicSupabaseEnv();

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      lock: resilientBrowserLock,
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
