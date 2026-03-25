import { NextResponse } from "next/server";
import { nswFetch } from "@/lib/nsw";

/**
 * Call like:
 *   /api/nsw/liquor?path=/YOUR/ENDPOINT?param=1
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path");

    if (!path) {
      return NextResponse.json(
        { error: "Missing query param: path" },
        { status: 400 }
      );
    }

    // safety: only allow relative API paths
    if (!path.startsWith("/")) {
      return NextResponse.json(
        { error: "path must start with /" },
        { status: 400 }
      );
    }

    const data = await nswFetch(path, { method: "GET" });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
