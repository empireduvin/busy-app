import { supabaseServer } from '@/lib/supabaseServer';

export async function requireAdminRequest(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    throw new Error('Missing admin authorization token.');
  }

  const supabase = supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    throw new Error('Invalid or expired admin session.');
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
    throw new Error('This account is not allowed to perform admin actions.');
  }

  return { supabase, user };
}
