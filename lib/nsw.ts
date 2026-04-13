import { getNswEnv } from '@/lib/server-env';

// busy-app/lib/nsw.ts

type TokenCache = { token: string; expiresAt: number } | null;
let cache: TokenCache = null;

/**
 * Get OAuth access token from NSW OneGov
 */
export async function getNswAccessToken(): Promise<string> {
  const { apiKey, apiSecret, oauthUrl } = getNswEnv();

  const now = Date.now();
  if (cache && cache.expiresAt > now + 30_000) {
    return cache.token;
  }

  const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  // NSW expects grant_type as query param
  const tokenUrl = `${oauthUrl}?grant_type=client_credentials`;

  const res = await fetch(tokenUrl, {
    method: "GET",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`NSW OAuth failed (${res.status}): ${text}`);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`NSW OAuth returned non-JSON: ${text}`);
  }

  if (!json?.access_token) {
    throw new Error(`NSW OAuth JSON missing access_token: ${text}`);
  }

  const expiresIn =
    typeof json.expires_in === "number" ? json.expires_in : 3600;

  cache = {
    token: json.access_token,
    expiresAt: now + expiresIn * 1000,
  };

  return json.access_token;
}

/**
 * Generic NSW API fetch helper
 */
export async function nswFetch(path: string, init?: RequestInit) {
  const { apiKey, baseUrl } = getNswEnv();
  const token = await getNswAccessToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",

    // Liquor Register API requires this exact header name
    apikey: apiKey,

    ...(init?.headers as Record<string, string> | undefined),
  };

  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`NSW API error (${res.status}) for ${url}: ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}
