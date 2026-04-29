import { NextResponse } from 'next/server';
import { getErrorStatus } from '@/lib/authz';
import { ensurePublicProfile, requirePublicUserRequest } from '@/lib/public-user-server';
import { supabaseServer } from '@/lib/supabaseServer';

type IntentType = 'thinking' | 'going';

function getTodayIntentDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getVenueId(value: unknown) {
  const venueId = String(value ?? '').trim();
  if (!venueId) {
    throw new Error('Venue ID is required.');
  }
  return venueId;
}

function getIntentType(value: unknown): IntentType {
  if (value === 'thinking' || value === 'going') return value;
  throw new Error('Intent type must be thinking or going.');
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
}

async function getIntentPayload(
  supabase: ReturnType<typeof supabaseServer>,
  venueId: string,
  userId: string | null
) {
  const intentDate = getTodayIntentDate();

  const { data: countRows, error: countError } = await supabase
    .from('venue_user_intents')
    .select('intent_type')
    .eq('venue_id', venueId)
    .eq('intent_date', intentDate);

  if (countError) throw new Error(countError.message);

  let userIntent: IntentType | null = null;

  if (userId) {
    const { data: userRow, error: userError } = await supabase
      .from('venue_user_intents')
      .select('intent_type')
      .eq('user_id', userId)
      .eq('venue_id', venueId)
      .eq('intent_date', intentDate)
      .maybeSingle();

    if (userError) throw new Error(userError.message);
    userIntent =
      userRow?.intent_type === 'thinking' || userRow?.intent_type === 'going'
        ? userRow.intent_type
        : null;
  }

  return {
    ok: true,
    venue_id: venueId,
    intent_date: intentDate,
    thinking_count: (countRows ?? []).filter((row) => row.intent_type === 'thinking').length,
    going_count: (countRows ?? []).filter((row) => row.intent_type === 'going').length,
    user_intent: userIntent,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const venueId = getVenueId(url.searchParams.get('venue_id') ?? url.searchParams.get('venueId'));
    const token = getBearerToken(request);
    const supabase = supabaseServer();
    let userId: string | null = null;

    if (token) {
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      userId = user?.id ?? null;
    }

    return NextResponse.json(await getIntentPayload(supabase, venueId, userId));
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
    const venueId = getVenueId(
      body && typeof body === 'object' && 'venueId' in body
        ? (body as { venueId?: unknown }).venueId
        : null
    );
    const intentType = getIntentType(
      body && typeof body === 'object' && 'intentType' in body
        ? (body as { intentType?: unknown }).intentType
        : null
    );
    const intentDate = getTodayIntentDate();

    const { data: existing, error: existingError } = await supabase
      .from('venue_user_intents')
      .select('id, intent_type')
      .eq('user_id', user.id)
      .eq('venue_id', venueId)
      .eq('intent_date', intentDate)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing?.intent_type === intentType) {
      const { error } = await supabase
        .from('venue_user_intents')
        .delete()
        .eq('id', existing.id);

      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('venue_user_intents').upsert(
        {
          user_id: user.id,
          venue_id: venueId,
          intent_type: intentType,
          intent_date: intentDate,
        },
        { onConflict: 'user_id,venue_id,intent_date' }
      );

      if (error) throw new Error(error.message);
    }

    return NextResponse.json(await getIntentPayload(supabase, venueId, user.id));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: getErrorStatus(error) }
    );
  }
}
