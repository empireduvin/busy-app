import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Temporary GET handler so we can confirm the route exists.
 * You can remove this later.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "upsert route is live",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: "Body must include rows: []" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const payload = rows
      .filter((r: any) => r.licenceID)
      .map((r: any) => ({
        licence_id: r.licenceID,
        licence_number: r.licenceNumber ?? null,
        licence_name: r.licenceName ?? null,
        licensee: r.licensee ?? null,
        licence_type: r.licenceType ?? null,
        status: r.status ?? null,
        address: r.address ?? null,
        suburb: r.suburb ?? null,
        postcode: r.postcode ?? null,
        expiry_date: r.expiryDate ?? null,
        business_names: r.businessNames ?? null,
        categories: r.categories ?? null,
        classes: r.classes ?? null,
        raw: r,
      }));

    const { error } = await supabase
      .from("liquor_venues")
      .upsert(payload, { onConflict: "licence_id" });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      upserted: payload.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
