function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

export function getSupabaseServerEnv() {
  return {
    url: requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    serviceRoleKey: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  };
}

export function getNswEnv() {
  return {
    apiKey: requiredEnv('NSW_API_KEY'),
    apiSecret: requiredEnv('NSW_API_SECRET'),
    oauthUrl: requiredEnv('NSW_OAUTH_URL'),
    baseUrl: requiredEnv('NSW_LIQUOR_BASE_URL'),
  };
}

export function getGoogleMapsServerApiKey() {
  const value =
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

  if (!value) {
    throw new Error(
      'Missing env var: GOOGLE_MAPS_API_KEY (or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY fallback)'
    );
  }

  return value;
}
