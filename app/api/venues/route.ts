import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getPublicSupabaseKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    (() => {
      throw new Error(
        "Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY (or legacy NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)"
      );
    })()
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const suburb = url.searchParams.get("suburb")?.trim() ?? "";
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 200);

    const sb = createClient(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getPublicSupabaseKey(),
      { auth: { persistSession: false } }
    );

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
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
