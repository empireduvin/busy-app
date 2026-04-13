import { supabaseServer } from '@/lib/supabaseServer';
import { AuthzError } from '@/lib/authz';

export async function requireAdminRequest(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    throw new AuthzError('Missing admin authorization token.', 401);
  }

  const supabase = supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    throw new AuthzError('Invalid or expired admin session.', 401);
  }

  const { data: adminRow, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminError) {
    throw new Error(adminError.message);
  }

  if (!adminRow?.user_id) {
    throw new AuthzError('This account is not allowed to perform admin actions.', 403);
  }

  return { supabase, user };
}
