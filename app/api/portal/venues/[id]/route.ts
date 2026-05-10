import { NextResponse } from 'next/server';
import { requirePortalVenueRequest } from '@/lib/portal-server';
import { getErrorStatus } from '@/lib/authz';
import { normalizeInstagramUrl } from '@/lib/social-links';

function normalizeVenueSuburb(value: string | null | undefined) {
  return value?.trim().toUpperCase() || null;
}

function isMissingPrimaryImageColumnError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('column') &&
    message.includes('primary_image_') &&
    message.includes('does not exist')
  );
}

function withoutPrimaryImagePayload<T extends Record<string, unknown>>(payload: T) {
  const next = { ...payload };
  delete next.primary_image_url;
  delete next.primary_image_source;
  delete next.primary_image_attribution;
  delete next.primary_image_alt;
  return next;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { supabase } = await requirePortalVenueRequest(request, id);
    const body = await request.json();
    const venue = body?.venue ?? null;

    if (!venue || !String(venue.name ?? '').trim()) {
      return NextResponse.json(
        { ok: false, error: 'Venue name is required.' },
        { status: 400 }
      );
    }

    const showsSport =
      typeof venue.shows_sport === 'boolean' ? venue.shows_sport : null;
    const playsWithSound =
      typeof venue.plays_with_sound === 'boolean' ? venue.plays_with_sound : null;
    const normalizedShowsSport = playsWithSound ? true : showsSport;
    const normalizedPlaysWithSound =
      normalizedShowsSport === false ? false : playsWithSound;

    const payload = {
      name: String(venue.name ?? '').trim() || null,
      suburb: normalizeVenueSuburb(String(venue.suburb ?? '')),
      address: String(venue.address ?? '').trim() || null,
      phone: String(venue.phone ?? '').trim() || null,
      website_url: String(venue.website_url ?? '').trim() || null,
      instagram_url: normalizeInstagramUrl(String(venue.instagram_url ?? '')),
      primary_image_url: String(venue.primary_image_url ?? '').trim() || null,
      primary_image_source: String(venue.primary_image_source ?? '').trim() || null,
      primary_image_attribution:
        String(venue.primary_image_attribution ?? '').trim() || null,
      primary_image_alt: String(venue.primary_image_alt ?? '').trim() || null,
      shows_sport: normalizedShowsSport,
      plays_with_sound: normalizedPlaysWithSound,
      sport_types: String(venue.sport_types ?? '').trim() || null,
      sport_notes: String(venue.sport_notes ?? '').trim() || null,
      dog_friendly:
        typeof venue.dog_friendly === 'boolean' ? venue.dog_friendly : null,
      dog_friendly_notes: String(venue.dog_friendly_notes ?? '').trim() || null,
      kid_friendly:
        typeof venue.kid_friendly === 'boolean' ? venue.kid_friendly : null,
      kid_friendly_notes: String(venue.kid_friendly_notes ?? '').trim() || null,
    };

    let { data, error } = await supabase
      .from('venues')
      .update(payload)
      .eq('id', id)
      .select(
        'id, name, suburb, address, phone, website_url, instagram_url, primary_image_url, primary_image_source, primary_image_attribution, primary_image_alt, shows_sport, plays_with_sound, sport_types, sport_notes, dog_friendly, dog_friendly_notes, kid_friendly, kid_friendly_notes'
      )
      .single();

    if (isMissingPrimaryImageColumnError(error)) {
      const fallback = await supabase
        .from('venues')
        .update(withoutPrimaryImagePayload(payload))
        .eq('id', id)
        .select(
          'id, name, suburb, address, phone, website_url, instagram_url, shows_sport, plays_with_sound, sport_types, sport_notes, dog_friendly, dog_friendly_notes, kid_friendly, kid_friendly_notes'
        )
        .single();
      data = fallback.data as typeof data;
      error = fallback.error;
    }

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, id, venue: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: getErrorStatus(error) }
    );
  }
}
