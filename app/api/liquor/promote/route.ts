import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "promote route is live" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const licenceId = (body?.licenceId ?? "").toString().trim();

    if (!licenceId) {
      return NextResponse.json(
        { ok: false, error: "licenceId is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    );

    // IMPORTANT: find by either:
    // 1) liquor_venues.licence_id (snake_case) OR
    // 2) liquor_venues.licenceID stored inside raw JSON (fallback)
    //
    // We fetch with .maybeSingle() and handle "not found" ourselves.

    // Try primary: top-level licence_id column
    let liquor: any = null;

    {
      const { data, error } = await supabase
        .from("liquor_venues")
        .select("licence_id,licence_name,suburb,address,status,licence_type,raw")
        .eq("licence_id", licenceId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      liquor = data;
    }

    // Fallback: if not found, try raw->>licenceID
    if (!liquor) {
      const { data, error } = await supabase
        .from("liquor_venues")
        .select("licence_id,licence_name,suburb,address,status,licence_type,raw")
        // PostgREST JSON filter syntax
        .filter("raw->>licenceID", "eq", licenceId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      liquor = data;
    }

    if (!liquor) {
      return NextResponse.json(
        { ok: false, error: `No liquor_venues row found for licenceId=${licenceId}` },
        { status: 404 }
      );
    }

    // Normalise ID in case only raw had it
    const resolvedLicenceId =
      liquor.licence_id ?? liquor.raw?.licenceID ?? licenceId;

    const payload = {
      name: liquor.licence_name ?? liquor.raw?.licenceName ?? "Unknown",
      suburb: liquor.suburb ?? liquor.raw?.suburb ?? "Unknown",
      address: liquor.address ?? liquor.raw?.address ?? null,
      venue_type: null,
      status: "active",
      liquor_licence_id: resolvedLicenceId,

      byo_allowed: null,
      byo_notes: null,
      dog_friendly: null,
      kid_friendly: null,
      shows_sport: null,
      plays_with_sound: null,
      sport_types: null,
    };

    const { error: upsertErr } = await supabase
      .from("venues")
      .upsert(payload, { onConflict: "liquor_licence_id" });

    if (upsertErr) throw new Error(upsertErr.message);

    // Tracking flag in raw table
    await supabase
      .from("liquor_venues")
      .update({ active: true })
      .eq("licence_id", resolvedLicenceId);

    return NextResponse.json({ ok: true, promoted: resolvedLicenceId });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
