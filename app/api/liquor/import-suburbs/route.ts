import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { nswFetch } from "@/lib/nsw";

type BrowseRow = {
  licenceID?: string;
  licenceName?: string;
  licensee?: string;
  licenceNumber?: string;
  licenceType?: string;
  status?: string;
  address?: string;
  suburb?: string;
  postcode?: string;
  expiryDate?: string;
  businessNames?: string;
};

function norm(s: string | null | undefined) {
  return (s ?? "").toUpperCase().trim();
}

function isEmptyShell(r: BrowseRow) {
  return (
    !r.licenceName &&
    !r.licensee &&
    !r.licenceType &&
    !r.status &&
    !r.address &&
    !r.suburb
  );
}

// Retry wrapper for NSW browse calls (handles timeouts/408)
async function browseWithRetry(searchText: string): Promise<BrowseRow[]> {
  const path = `/liquorregister/v1/browse?searchText=${encodeURIComponent(searchText)}`;

  const attempts = 3;

  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await nswFetch(path, { method: "GET" });

      // NSW responses vary; support a few shapes
      if (Array.isArray(res)) return res as BrowseRow[];
      if (Array.isArray((res as any)?.data)) return (res as any).data as BrowseRow[];
      if (Array.isArray((res as any)?.results)) return (res as any).results as BrowseRow[];
      if (Array.isArray((res as any)?.rows)) return (res as any).rows as BrowseRow[];

      return [];
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      const isTimeout = msg.includes("(408)") || msg.toLowerCase().includes("timeout");

      if (!isTimeout || i === attempts) throw e;

      // small backoff (600ms, 1200ms)
      await new Promise((r) => setTimeout(r, 600 * i));
    }
  }

  return [];
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // The suburbs you want to KEEP in your DB (strict filter)
    const suburbs: string[] = body?.suburbs ?? ["Newtown", "Enmore", "Erskineville"];
    const wanted = new Set(suburbs.map((s) => norm(s)));

    // Broaden search terms to improve recall
    // - suburb name
    // - "SUBURB NSW"
    // - postcode
    const suburbToPostcode: Record<string, string[]> = {
      NEWTOWN: ["2042"],
      ENMORE: ["2042"],
      ERSKINEVILLE: ["2043"],
    };

    const searchTerms: string[] = [];
    for (const s of suburbs) {
      const S = norm(s);
      searchTerms.push(s);
      searchTerms.push(`${s} NSW`);
      for (const pc of suburbToPostcode[S] ?? []) searchTerms.push(pc);
    }

    // env / supabase
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!SUPABASE_URL) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
    if (!SERVICE_ROLE) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Track unique licence_ids imported per suburb (avoid double counting)
    const importedIdsBySuburb: Record<string, Set<string>> = {};
    for (const s of wanted) importedIdsBySuburb[s] = new Set<string>();

    const debug = {
      searchesRun: searchTerms,
      perSearchReturned: {} as Record<string, number>,
      perSearchKept: {} as Record<string, number>,
    };

    const skipped: Record<string, number> = {};
    const errors: Record<string, string> = {};
    const sampleRows: Record<string, any[]> = {};

    let totalSkipped = 0;

    for (const term of searchTerms) {
      try {
        const rows = await browseWithRetry(term);
        debug.perSearchReturned[term] = rows.length;

        const clean = rows.filter((r) => {
          const licenceId = String(r.licenceID ?? "").trim();
          if (!licenceId) return false;
          if (isEmptyShell(r)) return false;

          const sub = norm(r.suburb);
          if (!sub) return false;
          if (!wanted.has(sub)) return false;

          return true;
        });

        debug.perSearchKept[term] = clean.length;
        totalSkipped += rows.length - clean.length;

        const payload = clean.map((r) => {
          const sub = norm(r.suburb);
          const licenceId = String(r.licenceID).trim();

          // count unique ids per suburb for reporting
          importedIdsBySuburb[sub].add(licenceId);

          return {
            licence_id: licenceId,

            // ✅ map fields to columns so table isn't NULL
            licence_name: r.licenceName ?? null,
            licensee: r.licensee ?? null,
            licence_number: r.licenceNumber ?? null,
            licence_type: r.licenceType ?? null,
            status: r.status ?? null,
            address: r.address ?? null,
            suburb: sub || null,
            postcode: r.postcode ?? null,
            expiry_date: r.expiryDate ?? null,

            // keep full raw
            raw: r,

            // always start inactive
            active: false,
          };
        });

        if (payload.length > 0) {
          const { error } = await supabase
            .from("liquor_venues")
            .upsert(payload, { onConflict: "licence_id" });

          if (error) throw error;
        }

        // store a small sample per suburb (first time we see it)
        for (const r of payload) {
          const suburb = r.suburb ?? 'Unknown';
          if (!sampleRows[suburb]) sampleRows[suburb] = [];
          if (sampleRows[suburb].length < 2) sampleRows[suburb].push(r);
        }
      } catch (e: any) {
        // If one term fails, keep going (you still get partial success)
        errors[term] = e?.message ?? String(e);
      }
    }

    // Final imported counts per suburb (unique)
    const imported: Record<string, number> = {};
    for (const s of wanted) imported[s] = importedIdsBySuburb[s].size;

    // skipped reported as total filtered-out rows across all searches
    skipped.total_filtered_out = totalSkipped;

    return NextResponse.json({
      ok: true,
      imported,
      skipped,
      errors,
      sampleRows,
      debug,
      note:
        "We search suburb + 'SUBURB NSW' + postcode to improve coverage. We only STORE rows whose suburb exactly matches your 3 suburbs. Rows are saved to liquor_venues with active=false.",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}