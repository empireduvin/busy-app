import { NextResponse } from "next/server";
import { nswFetch } from "@/lib/nsw";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const searchText = url.searchParams.get("searchText");
    const suburb = url.searchParams.get("suburb");

    if (!searchText || searchText.trim().length < 2) {
      return NextResponse.json(
        { ok: false, error: "searchText must be at least 2 characters" },
        { status: 400 }
      );
    }

    const qs = new URLSearchParams({
      searchText: searchText.trim(),
    });

    if (suburb && suburb.trim()) {
      qs.set("address", suburb.trim());
    }

    const data = await nswFetch(
      `/liquorregister/v1/browse?${qs.toString()}`,
      { method: "GET" }
    );

    return NextResponse.json({ ok: true, results: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
