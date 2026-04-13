import { supabaseServer } from '@/lib/supabaseServer';
import { AuthzError } from '@/lib/authz';

export async function requirePortalVenueRequest(
  request: Request,
  venueId: string
) {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    throw new AuthzError('Missing portal authorization token.', 401);
  }

  if (!venueId?.trim()) {
    throw new AuthzError('Missing portal venue id.', 400);
  }

  const supabase = supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    throw new AuthzError('Invalid or expired portal session.', 401);
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
      throw new AuthzError('This account is not allowed to manage this venue.', 403);
    }
  }

  return { supabase, user, isAdmin };
}
