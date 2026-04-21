import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getErrorStatus } from '@/lib/authz';

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization') ?? '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Missing admin authorization token.' },
        { status: 401 }
      );
    }

    const supabase = supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired admin session.' },
        { status: 401 }
      );
    }

    const { data: adminRow, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError) {
      throw new Error(adminError.message);
    }

    if (adminRow?.user_id) {
      return NextResponse.json({
        ok: true,
        role: 'admin',
        email: user.email ?? null,
      });
    }

    const { data: portalRows, error: portalError } = await supabase
      .from('venue_user_access')
      .select('venue_id')
      .eq('user_id', user.id)
      .limit(1);

    if (portalError) {
      throw new Error(portalError.message);
    }

    return NextResponse.json(
      {
        ok: false,
        role: (portalRows?.length ?? 0) > 0 ? 'portal' : 'none',
        email: user.email ?? null,
      },
      { status: 403 }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: getErrorStatus(error) }
    );
  }
}
