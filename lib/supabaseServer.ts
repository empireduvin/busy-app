import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "@/lib/server-env";

export function supabaseServer() {
  const { url, serviceRoleKey } = getSupabaseServerEnv();

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
