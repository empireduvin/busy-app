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

const VENUE_SELECT =
  'id, name, suburb, venue_type_id, google_place_id, address, lat, lng, phone, website_url, instagram_url, google_rating, price_level, shows_sport, plays_with_sound, sport_types, sport_notes, dog_friendly, dog_friendly_notes, kid_friendly, kid_friendly_notes, opening_hours, kitchen_hours, happy_hour_hours, venue_schedule_rules(id, venue_id, schedule_type, day_of_week, start_time, end_time, sort_order, title, description, deal_text, notes, detail_json, is_active, status)';

const VENUE_TYPE_ATTEMPTS = [
  { select: 'id, name', field: 'name' },
  { select: 'id, label', field: 'label' },
  { select: 'id, title', field: 'title' },
  { select: 'id, venue_type', field: 'venue_type' },
  { select: 'id, slug', field: 'slug' },
  { select: 'id, type_name', field: 'type_name' },
  { select: 'id, display_name', field: 'display_name' },
] as const;

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

function mergeVenueTypeRows(rows: Array<{ id: string; display_name: string; raw_value: string }>) {
  const merged = new Map<string, { id: string; display_name: string; raw_value: string }>();

  rows.forEach((row) => {
    const key =
      normalizeText(row.raw_value) ||
      normalizeText(row.display_name) ||
      normalizeText(row.id);
    if (!key || merged.has(key)) return;
    merged.set(key, row);
  });

  return Array.from(merged.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name)
  );
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminRequest(request);

    const [{ data: venues, error: venuesError }] = await Promise.all([
      supabase.from('venues').select(VENUE_SELECT).order('name', { ascending: true }),
    ]);

    if (venuesError) {
      throw new Error(venuesError.message);
    }

    let venueTypes: Array<{ id: string; display_name: string; raw_value: string }> = [];
    let venueTypeError = '';

    for (const attempt of VENUE_TYPE_ATTEMPTS) {
      const { data, error } = await supabase
        .from('venue_types')
        .select(attempt.select)
        .order(attempt.field, { ascending: true });

      if (!error && data) {
        venueTypes = mergeVenueTypeRows(
          (data as Array<Record<string, unknown>>)
            .map((row) => ({
              id: String(row.id ?? ''),
              display_name: String(row[attempt.field] ?? ''),
              raw_value: String(row[attempt.field] ?? ''),
            }))
            .filter((row) => row.id && row.display_name)
        );
        venueTypeError = '';
        break;
      }

      if (error) {
        venueTypeError = error.message;
      }
    }

    return NextResponse.json({
      ok: true,
      venues: venues ?? [],
      venueTypes,
      venueTypeError: venueTypeError || null,
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
      sport_notes: String(venue.sport_notes ?? '').trim() || null,
      dog_friendly:
        typeof venue.dog_friendly === 'boolean' ? venue.dog_friendly : null,
      dog_friendly_notes: String(venue.dog_friendly_notes ?? '').trim() || null,
      kid_friendly:
        typeof venue.kid_friendly === 'boolean' ? venue.kid_friendly : null,
      kid_friendly_notes: String(venue.kid_friendly_notes ?? '').trim() || null,
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
          'id, name, suburb, venue_type_id, google_place_id, address, lat, lng, phone, website_url, instagram_url, google_rating, price_level, shows_sport, plays_with_sound, sport_types, sport_notes, dog_friendly, dog_friendly_notes, kid_friendly, kid_friendly_notes, opening_hours'
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
        'id, name, suburb, venue_type_id, google_place_id, address, lat, lng, phone, website_url, instagram_url, google_rating, price_level, shows_sport, plays_with_sound, sport_types, sport_notes, dog_friendly, dog_friendly_notes, kid_friendly, kid_friendly_notes, opening_hours'
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
