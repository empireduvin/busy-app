import { NextResponse } from 'next/server';
import { requirePortalVenueRequest } from '@/lib/portal-server';
import { getErrorStatus } from '@/lib/authz';
import {
  normalizeInstagramContentUrl,
  normalizeInstagramHandle,
  normalizeInstagramUrl,
} from '@/lib/social-links';

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

function isMissingSocialColumnError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('column') &&
    (message.includes('instagram_handle') ||
      message.includes('featured_instagram_url') ||
      message.includes('social_freshness_label') ||
      message.includes('social_note') ||
      message.includes('social_last_updated_at')) &&
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

function withoutOptionalSocialPayload<T extends Record<string, unknown>>(payload: T) {
  const next = { ...payload };
  delete next.instagram_handle;
  delete next.featured_instagram_url;
  delete next.social_freshness_label;
  delete next.social_note;
  delete next.social_last_updated_at;
  return next;
}

function normalizeSocialFreshnessLabel(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim();
  const allowed = ['Posted today', 'Posted this week', 'New event post', 'Fresh update'];
  return allowed.includes(trimmed) ? trimmed : null;
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
      instagram_handle: normalizeInstagramHandle(String(venue.instagram_handle ?? '')),
      instagram_url: normalizeInstagramUrl(String(venue.instagram_url ?? '')),
      featured_instagram_url: normalizeInstagramContentUrl(
        String(venue.featured_instagram_url ?? '')
      ),
      social_freshness_label: normalizeSocialFreshnessLabel(
        String(venue.social_freshness_label ?? '')
      ),
      social_note: String(venue.social_note ?? '').trim() || null,
      social_last_updated_at:
        String(venue.instagram_handle ?? '').trim() ||
        String(venue.instagram_url ?? '').trim() ||
        String(venue.featured_instagram_url ?? '').trim() ||
        String(venue.social_freshness_label ?? '').trim() ||
        String(venue.social_note ?? '').trim()
          ? new Date().toISOString()
          : null,
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
        'id, name, suburb, address, phone, website_url, instagram_handle, instagram_url, featured_instagram_url, social_freshness_label, social_note, social_last_updated_at, primary_image_url, primary_image_source, primary_image_attribution, primary_image_alt, shows_sport, plays_with_sound, sport_types, sport_notes, dog_friendly, dog_friendly_notes, kid_friendly, kid_friendly_notes'
      )
      .single();

    if (isMissingPrimaryImageColumnError(error) || isMissingSocialColumnError(error)) {
      const fallbackPayload = isMissingSocialColumnError(error)
        ? withoutOptionalSocialPayload(withoutPrimaryImagePayload(payload))
        : withoutPrimaryImagePayload(payload);
      const fallback = await supabase
        .from('venues')
        .update(fallbackPayload)
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
