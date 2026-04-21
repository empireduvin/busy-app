import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { fetchPublicVenues } from '@/lib/public-venue-discovery';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const venueId = url.searchParams.get('venueId')?.trim() || undefined;

    const { data, error } = await fetchPublicVenues(supabaseServer(), {
      orderByName: !venueId,
      venueId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      data: data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
