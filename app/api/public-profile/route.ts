import { NextResponse } from 'next/server';
import { getErrorStatus } from '@/lib/authz';
import { ensurePublicProfile, requirePublicUserRequest } from '@/lib/public-user-server';

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requirePublicUserRequest(request);
    await ensurePublicProfile(supabase, user);

    return NextResponse.json({
      ok: true,
      profile: {
        id: user.id,
        email: user.email ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: getErrorStatus(error) }
    );
  }
}
