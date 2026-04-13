import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/lib/public-env";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const suburb = url.searchParams.get("suburb")?.trim() ?? "";
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 200);

    const { url: supabaseUrl, anonKey } = getPublicSupabaseEnv();
    const sb = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    let query = sb
      .from("liquor_venues")
      .select(
        "licence_id,licence_name,licensee,licence_type,status,address,suburb,postcode,expiry_date"
      )
      .limit(limit)
      .order("licence_name", { ascending: true });

    if (suburb) query = query.ilike("suburb", `%${suburb}%`);
    if (q) query = query.or(`licence_name.ilike.%${q}%,licensee.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    const message = e?.message ?? "Unknown error";
    const status = message.includes("Missing Supabase browser env vars") ? 503 : 500;

    return NextResponse.json(
      { ok: false, error: message },
      { status }
    );
  }
}
