const LEGACY_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() || '';

export const BROWSER_SUPABASE_ENV_ERROR =
  'Missing Supabase browser env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.';

export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || LEGACY_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(BROWSER_SUPABASE_ENV_ERROR);
  }

  return {
    url,
    anonKey,
    usedLegacyAnonKey:
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() &&
      Boolean(LEGACY_PUBLIC_SUPABASE_ANON_KEY),
  };
}

export function getPublicSupabaseEnvResult() {
  try {
    return {
      env: getPublicSupabaseEnv(),
      error: null,
    };
  } catch (error) {
    return {
      env: null,
      error,
    };
  }
}

export function getGoogleMapsBrowserApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || null;
}
