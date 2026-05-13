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
        {
          ok: false,
          authenticated: false,
          isAdmin: false,
          role: 'none',
          reason: 'missing_token',
          error: 'Missing admin authorization token.',
        },
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
        {
          ok: false,
          authenticated: false,
          isAdmin: false,
          role: 'none',
          reason: 'invalid_session',
          error: 'Invalid or expired admin session.',
        },
        { status: 401 }
      );
    }

    await supabase.from('profiles').upsert(
      {
        id: user.id,
        email: user.email ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

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
        authenticated: true,
        isAdmin: true,
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

    const role = (portalRows?.length ?? 0) > 0 ? 'portal' : 'none';
    console.info('[admin-access] denied', {
      reason: role === 'portal' ? 'portal_only' : 'not_admin',
      userId: user.id,
      hasPortalAccess: role === 'portal',
    });

    return NextResponse.json(
      {
        ok: false,
        authenticated: true,
        isAdmin: false,
        role,
        reason: role === 'portal' ? 'portal_only' : 'not_admin',
        email: user.email ?? null,
        error: 'This account is not allowed to use the admin area.',
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
