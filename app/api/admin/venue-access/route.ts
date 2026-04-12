import { NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin-server';

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminRequest(request);
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venueId')?.trim() ?? '';
    let query = supabase
      .from('venue_user_access')
      .select('user_id, venue_id, role, profiles(email, full_name), venues(name)')
      .order('created_at', { ascending: true });

    if (venueId) {
      query = query.eq('venue_id', venueId);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, rows: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdminRequest(request);
    const body = await request.json();
    const venueId = String(body?.venueId ?? '').trim();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const role = String(body?.role ?? 'manager').trim() || 'manager';

    if (!venueId || !email) {
      return NextResponse.json(
        { ok: false, error: 'Venue id and email are required.' },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile?.id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No profile found for that email. Create the auth user first, then try again.',
        },
        { status: 404 }
      );
    }

    const { error: insertError } = await supabase
      .from('venue_user_access')
      .insert({
        user_id: profile.id,
        venue_id: venueId,
        role,
      });

    if (insertError && !insertError.message.toLowerCase().includes('duplicate key')) {
      throw new Error(insertError.message);
    }

    return NextResponse.json({
      ok: true,
      row: {
        user_id: profile.id,
        venue_id: venueId,
        role,
        profiles: {
          email: profile.email,
          full_name: profile.full_name,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase } = await requireAdminRequest(request);
    const body = await request.json();
    const venueId = String(body?.venueId ?? '').trim();
    const userId = String(body?.userId ?? '').trim();

    if (!venueId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'Venue id and user id are required.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('venue_user_access')
      .delete()
      .eq('venue_id', venueId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
