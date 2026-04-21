import { NextResponse } from 'next/server';
import { getErrorStatus } from '@/lib/authz';
import { ensurePublicProfile, requirePublicUserRequest } from '@/lib/public-user-server';

function getVenueIdFromBody(body: unknown) {
  const venueId =
    body && typeof body === 'object' && 'venueId' in body
      ? String((body as { venueId?: unknown }).venueId ?? '').trim()
      : '';
  if (!venueId) {
    throw new Error('Venue ID is required.');
  }
  return venueId;
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requirePublicUserRequest(request);
    await ensurePublicProfile(supabase, user);

    const { data, error } = await supabase
      .from('saved_venues')
      .select('venue_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      savedVenueIds: (data ?? []).map((row) => String(row.venue_id ?? '')).filter(Boolean),
      savedVenues: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: getErrorStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requirePublicUserRequest(request);
    await ensurePublicProfile(supabase, user);
    const body = await request.json();
    const venueId = getVenueIdFromBody(body);

    const { error } = await supabase.from('saved_venues').upsert(
      {
        user_id: user.id,
        venue_id: venueId,
      },
      { onConflict: 'user_id,venue_id' }
    );

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, venueId, saved: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: getErrorStatus(error) }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await requirePublicUserRequest(request);
    await ensurePublicProfile(supabase, user);
    const body = await request.json();
    const venueId = getVenueIdFromBody(body);

    const { error } = await supabase
      .from('saved_venues')
      .delete()
      .eq('user_id', user.id)
      .eq('venue_id', venueId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, venueId, saved: false });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: getErrorStatus(error) }
    );
  }
}
