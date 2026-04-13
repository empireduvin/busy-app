import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import process from 'process';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

console.log('SUPABASE URL loaded:', !!SUPABASE_URL);
console.log('SERVICE ROLE loaded:', !!SUPABASE_SERVICE_ROLE_KEY);
console.log('GOOGLE API KEY loaded:', !!GOOGLE_MAPS_API_KEY);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GOOGLE_MAPS_API_KEY) {
  throw new Error(
    'Missing env vars. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GOOGLE_MAPS_API_KEY (or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY fallback)'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TEST_MODE = false;

const TEST_VENUES = [
  'The Hive Bar',
  'Rose of Australia',
  "Young Henry's",
  "Jacoby's Tiki Bar",
  'Courthouse Hotel',
];

const SLEEP_MS = 300;

const PLACE_ID_OVERRIDES = {
  'Alexandria - Erskinville Bowling Club Limited': 'ChIJC1s-B8uxEmsRih7fWneMyVU',
  "Buddy's Newtown": 'ChIJDQcKTTOxEmsREi-sFwzcvTE',
  'Duke of Edinburgh Hotel': 'ChIJu6X4QziwEmsRja9YB52kWVs',
  'Erskineville Hotel': 'ChIJ32-7XTSwEmsR19jxwhiHcAY',
  'Flightpath Wine Bar': 'ChIJc-wU3gixEmsREvSA18FWb6k',
  'Imperial Hotel - Erskineville': 'ChIJn2KDQDSwEmsRqtyqeKSgUb8',
  'VANGUARD NEWTOWN': 'ChIJq6rmTi2wEmsRkczijJVRNek',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildTextQuery(venue) {
  return [venue.name, venue.suburb, venue.city, venue.state, venue.postcode, 'Australia']
    .filter(Boolean)
    .join(' ');
}

async function textSearchPlace(query) {
  const url = 'https://places.googleapis.com/v1/places:searchText';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.googleMapsUri',
    },
    body: JSON.stringify({
      textQuery: query,
      regionCode: 'AU',
      languageCode: 'en',
      maxResultCount: 5,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Text Search failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function getPlaceDetails(placeId) {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask':
        'id,displayName,formattedAddress,location,regularOpeningHours.weekdayDescriptions,regularOpeningHours.periods,currentOpeningHours.weekdayDescriptions,currentOpeningHours.periods,websiteUri,nationalPhoneNumber,googleMapsUri,rating,userRatingCount,priceLevel,primaryType,types,businessStatus',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Place Details failed: ${res.status} ${text}`);
  }

  return res.json();
}

function normalise(s) {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function chooseBestMatch(venue, candidates = []) {
  const venueName = normalise(venue.name);
  const venueSuburb = normalise(venue.suburb);

  let best = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    let score = 0;

    const displayName = normalise(candidate.displayName?.text);
    const formattedAddress = normalise(candidate.formattedAddress);

    if (displayName === venueName) score += 100;
    if (displayName.includes(venueName)) score += 50;
    if (venueName.includes(displayName)) score += 30;
    if (formattedAddress.includes(venueSuburb)) score += 25;
    if (formattedAddress.includes('newtown') && venueSuburb === 'newtown') score += 10;
    if (formattedAddress.includes('enmore') && venueSuburb === 'enmore') score += 10;
    if (formattedAddress.includes('erskineville') && venueSuburb === 'erskineville') score += 10;

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return bestScore >= 45 ? best : null;
}

function buildOpeningHours(details) {
  const regular = details.regularOpeningHours ?? null;
  const current = details.currentOpeningHours ?? null;

  if (!regular && !current) return null;

  return {
    regularOpeningHours: regular,
    currentOpeningHours: current,
  };
}

async function fetchVenues() {
  let query = supabase
    .from('venues')
    .select(
      'id, name, address, suburb, city, state, postcode, google_place_id, lat, lng, venue_type_id, opening_hours'
    )
    .or('google_place_id.is.null,opening_hours.is.null')
    .order('name', { ascending: true });

  if (TEST_MODE) {
    query = query.in('name', TEST_VENUES);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

async function updateVenue(venueId, details) {
  const payload = {
    google_place_id: details.id ?? null,
    google_maps_uri: details.googleMapsUri ?? null,
    google_rating: details.rating ?? null,
    google_user_rating_count: details.userRatingCount ?? null,
    price_level: details.priceLevel ?? null,
    google_primary_type: details.primaryType ?? null,
    google_types: details.types ?? null,
    google_display_name: details.displayName?.text ?? null,
    google_formatted_address: details.formattedAddress ?? null,
    google_business_status: details.businessStatus ?? null,
    google_last_synced_at: new Date().toISOString(),
    lat: details.location?.latitude ?? null,
    lng: details.location?.longitude ?? null,
    opening_hours: buildOpeningHours(details),
    website_url: details.websiteUri ?? null,
    phone: details.nationalPhoneNumber ?? null,
  };

  const { error } = await supabase.from('venues').update(payload).eq('id', venueId);

  if (error) throw error;
}

async function main() {
  const venues = await fetchVenues();
  console.log(`Found ${venues.length} venue(s) to process`);

  const results = [];

  for (const venue of venues) {
    const query = buildTextQuery(venue);
    console.log(`\nSearching for: ${venue.name} -> ${query}`);

    const overridePlaceId = PLACE_ID_OVERRIDES[venue.name];

    if (overridePlaceId) {
      console.log(`Using override for ${venue.name}: ${overridePlaceId}`);

      try {
        const details = await getPlaceDetails(overridePlaceId);

        console.log(
          'Opening hours for',
          venue.name,
          JSON.stringify(buildOpeningHours(details), null, 2)
        );

        await updateVenue(venue.id, details);

        console.log(`Updated ${venue.name} via override`);
        results.push({
          venue: venue.name,
          status: 'updated',
          google_place_id: details.id,
          google_name: details.displayName?.text,
          via: 'override',
        });

        await sleep(SLEEP_MS);
        continue;
      } catch (err) {
        console.error(`Error for ${venue.name}:`, err.message);
        results.push({
          venue: venue.name,
          status: 'error',
          error: err.message,
          via: 'override',
        });
        continue;
      }
    }

    try {
      const searchResult = await textSearchPlace(query);
      const candidates = searchResult.places || [];

      if (!candidates.length) {
        console.log(`No Google candidates found for ${venue.name}`);
        results.push({ venue: venue.name, status: 'no_candidates' });
        continue;
      }

      const best = chooseBestMatch(venue, candidates);

      if (!best) {
        console.log(`No confident match for ${venue.name}`);
        results.push({
          venue: venue.name,
          status: 'needs_review',
          candidates: candidates.map((c) => ({
            id: c.id,
            name: c.displayName?.text,
            address: c.formattedAddress,
          })),
        });
        continue;
      }

      console.log(`Matched: ${best.displayName?.text} (${best.id})`);

      await sleep(SLEEP_MS);

      const details = await getPlaceDetails(best.id);

      console.log(
        'Opening hours for',
        venue.name,
        JSON.stringify(buildOpeningHours(details), null, 2)
      );

      await updateVenue(venue.id, details);

      console.log(`Updated ${venue.name}`);
      results.push({
        venue: venue.name,
        status: 'updated',
        google_place_id: details.id,
        google_name: details.displayName?.text,
      });

      await sleep(SLEEP_MS);
    } catch (err) {
      console.error(`Error for ${venue.name}:`, err.message);
      results.push({
        venue: venue.name,
        status: 'error',
        error: err.message,
      });
    }
  }

  const outputPath = path.join(process.cwd(), 'scripts', 'google-places-sync-results.json');
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2), 'utf8');

  console.log(`\nDone. Results written to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
