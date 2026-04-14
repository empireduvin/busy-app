import { NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin-server';
import { getErrorStatus } from '@/lib/authz';
import { getEffectiveKitchenHours } from '@/lib/venue-type-rules';
import { normalizeInstagramUrl } from '@/lib/social-links';

type OpeningHours = {
  monday?: Array<{ open: string; close: string }>;
  tuesday?: Array<{ open: string; close: string }>;
  wednesday?: Array<{ open: string; close: string }>;
  thursday?: Array<{ open: string; close: string }>;
  friday?: Array<{ open: string; close: string }>;
  saturday?: Array<{ open: string; close: string }>;
  sunday?: Array<{ open: string; close: string }>;
};

function normalizeVenueSuburb(value: string | null | undefined) {
  return value?.trim().toUpperCase() || null;
}

function parseOptionalNumber(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value: ${text}`);
  }
  return parsed;
}

function formatVenueTypeId(value: string | null | undefined) {
  if (!value) return '';
  return value
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[_-]/g, ' ').trim();
}

function isUuid(value: string | null | undefined) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    (value ?? '').trim()
  );
}

async function ensureVenueTypeId(
  supabase: ReturnType<typeof import('@/lib/supabaseServer').supabaseServer>,
  selectedType: string
) {
  if (isUuid(selectedType)) return selectedType;

  const normalizedType = normalizeText(selectedType);

  const { data: existing, error: existingError } = await supabase
    .from('venue_types')
    .select('id, label, slug')
    .or(`label.ilike.${formatVenueTypeId(selectedType)},slug.eq.${selectedType}`)
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing?.id) return String(existing.id);

  const { data: inserted, error: insertError } = await supabase
    .from('venue_types')
    .insert({
      label: formatVenueTypeId(selectedType),
      slug: selectedType,
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(
      `Venue type "${formatVenueTypeId(selectedType)}" is not configured in Supabase yet. ${insertError.message}`
    );
  }

  if (!inserted?.id) {
    throw new Error(`Unable to resolve venue type "${formatVenueTypeId(selectedType)}".`);
  }

  return String(inserted.id);
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdminRequest(request);
    const body = await request.json();
    const venue = body?.venue ?? null;

    if (!venue || !String(venue.name ?? '').trim()) {
      return NextResponse.json(
        { ok: false, error: 'Venue name is required.' },
        { status: 400 }
      );
    }

    if (!String(venue.venue_type_id ?? '').trim()) {
      return NextResponse.json(
        { ok: false, error: 'Venue type is required.' },
        { status: 400 }
      );
    }

    const resolvedVenueTypeId = await ensureVenueTypeId(
      supabase,
      String(venue.venue_type_id).trim()
    );

    const { data: venueTypeRow } = await supabase
      .from('venue_types')
      .select('label, slug')
      .eq('id', resolvedVenueTypeId)
      .maybeSingle();

    const venueTypeName =
      venueTypeRow?.label ?? formatVenueTypeId(String(venue.venue_type_id).trim()) ?? null;

    const originalVenueId = String(venue.id ?? '').trim() || null;
    let originalVenue: { kitchen_hours?: OpeningHours | null } | null = null;

    if (originalVenueId) {
      const { data } = await supabase
        .from('venues')
        .select('kitchen_hours')
        .eq('id', originalVenueId)
        .maybeSingle();
      originalVenue = data ?? null;
    }

    const showsSport =
      typeof venue.shows_sport === 'boolean' ? venue.shows_sport : null;
    const playsWithSound =
      typeof venue.plays_with_sound === 'boolean'
        ? venue.plays_with_sound
        : null;
    const normalizedShowsSport = playsWithSound ? true : showsSport;
    const normalizedPlaysWithSound =
      normalizedShowsSport === false ? false : playsWithSound;

    const openingHours = (venue.opening_hours ?? null) as OpeningHours | null;
    const payload = {
      name: String(venue.name ?? '').trim() || null,
      suburb: normalizeVenueSuburb(String(venue.suburb ?? '')),
      venue_type_id: resolvedVenueTypeId,
      google_place_id: String(venue.google_place_id ?? '').trim() || null,
      address: String(venue.address ?? '').trim() || null,
      lat: parseOptionalNumber(venue.lat),
      lng: parseOptionalNumber(venue.lng),
      phone: String(venue.phone ?? '').trim() || null,
      website_url: String(venue.website_url ?? '').trim() || null,
      instagram_url: normalizeInstagramUrl(String(venue.instagram_url ?? '')),
      google_rating: parseOptionalNumber(venue.google_rating),
      price_level: String(venue.price_level ?? '').trim() || null,
      shows_sport: normalizedShowsSport,
      plays_with_sound: normalizedPlaysWithSound,
      sport_types: String(venue.sport_types ?? '').trim() || null,
      dog_friendly:
        typeof venue.dog_friendly === 'boolean' ? venue.dog_friendly : null,
      kid_friendly:
        typeof venue.kid_friendly === 'boolean' ? venue.kid_friendly : null,
      opening_hours: openingHours,
      kitchen_hours: getEffectiveKitchenHours(
        venueTypeName,
        openingHours,
        originalVenue?.kitchen_hours ?? null
      ),
    };

    let existingVenueId = originalVenueId;

    if (!existingVenueId && payload.google_place_id) {
      const { data: existingByPlaceId, error: lookupError } = await supabase
        .from('venues')
        .select('id')
        .eq('google_place_id', payload.google_place_id)
        .maybeSingle();

      if (lookupError) throw new Error(lookupError.message);
      existingVenueId = existingByPlaceId?.id ?? null;
    }

    if (existingVenueId) {
      const { data, error } = await supabase
        .from('venues')
        .update(payload)
        .eq('id', existingVenueId)
        .select(
          'id, name, suburb, venue_type_id, google_place_id, address, lat, lng, phone, website_url, instagram_url, google_rating, price_level, shows_sport, plays_with_sound, sport_types, dog_friendly, kid_friendly, opening_hours'
        )
        .single();

      if (error) throw new Error(error.message);
      return NextResponse.json({
        ok: true,
        id: existingVenueId,
        mode: 'update',
        venue: data,
      });
    }

    const { data, error } = await supabase
      .from('venues')
      .insert(payload)
      .select(
        'id, name, suburb, venue_type_id, google_place_id, address, lat, lng, phone, website_url, instagram_url, google_rating, price_level, shows_sport, plays_with_sound, sport_types, dog_friendly, kid_friendly, opening_hours'
      )
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      id: data?.id ?? null,
      mode: 'insert',
      venue: data,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: getErrorStatus(error) }
    );
  }
}
