import { supabaseServer } from '@/lib/supabaseServer';

export async function requirePortalVenueRequest(
  request: Request,
  venueId: string
) {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    throw new Error('Missing portal authorization token.');
  }

  if (!venueId?.trim()) {
    throw new Error('Missing portal venue id.');
  }

  const supabase = supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    throw new Error('Invalid or expired portal session.');
  }

  const { data: adminRow, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminError) {
    throw new Error(adminError.message);
  }

  const isAdmin = Boolean(adminRow?.user_id);

  if (!isAdmin) {
    const { data: venueAccessRow, error: venueAccessError } = await supabase
      .from('venue_user_access')
      .select('venue_id, role')
      .eq('user_id', user.id)
      .eq('venue_id', venueId)
      .maybeSingle();

    if (venueAccessError) {
      throw new Error(venueAccessError.message);
    }

    if (!venueAccessRow?.venue_id) {
      throw new Error('This account is not allowed to manage this venue.');
    }
  }

  return { supabase, user, isAdmin };
}
