import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnvResult } from "@/lib/public-env";

const publicEnv = getPublicSupabaseEnvResult();

export const supabase = publicEnv.env
  ? createClient(publicEnv.env.url, publicEnv.env.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
