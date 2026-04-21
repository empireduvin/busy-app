import { AuthzError } from '@/lib/authz';
import { supabaseServer } from '@/lib/supabaseServer';

export async function requirePublicUserRequest(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    throw new AuthzError('Missing public user authorization token.', 401);
  }

  const supabase = supabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new AuthzError('Invalid or expired public user session.', 401);
  }

  return { supabase, user, token };
}

export async function ensurePublicProfile(
  supabase: ReturnType<typeof import('@/lib/supabaseServer').supabaseServer>,
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  }
) {
  const fullName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === 'string'
        ? user.user_metadata.name
        : null;

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: fullName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw new Error(error.message);
  }
}
