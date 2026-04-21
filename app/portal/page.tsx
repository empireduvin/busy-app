'use client';

import { getSupabaseBrowserClientResult } from '@/lib/supabase-browser';
import { BROWSER_SUPABASE_ENV_ERROR } from '@/lib/public-env';
import { buildPublicVenueHref } from '@/lib/public-venue-discovery';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type PortalVenueRow = {
  venue_id: string;
  role: string | null;
  venue: PortalVenueDetail | null;
};

type PortalVenueDetail = {
  id: string;
  name: string | null;
  suburb: string | null;
  venue_type_id: string | null;
  address?: string | null;
  website_url?: string | null;
  shows_sport?: boolean | null;
  plays_with_sound?: boolean | null;
  dog_friendly?: boolean | null;
  kid_friendly?: boolean | null;
  byo_allowed?: boolean | null;
  venue_types?:
    | {
        label?: string | null;
        slug?: string | null;
      }
    | Array<{
        label?: string | null;
        slug?: string | null;
      }>
    | null;
};

type VenueAccessRow = {
  venue_id: string;
  role: string | null;
};

function formatVenueType(value: string | null | undefined) {
  if (!value) return 'Venue';

  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getVenueTypeLabel(venue: PortalVenueDetail | null) {
  if (!venue) return 'Venue';

  const relation = venue.venue_types;
  if (Array.isArray(relation)) {
    return relation[0]?.label ?? formatVenueType(relation[0]?.slug) ?? 'Venue';
  }

  return relation?.label ?? formatVenueType(relation?.slug) ?? 'Venue';
}

function normalizeBooleanFlag(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', 'f', '0', 'no', 'n', 'off', ''].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return false;
}

function normalizePortalVenueRows(
  rows: VenueAccessRow[],
  venueMap: Map<string, PortalVenueDetail>
): PortalVenueRow[] {
  return rows.map((row) => ({
    venue_id: row.venue_id,
    role: row.role,
    venue: venueMap.get(row.venue_id) ?? null,
  }));
}

export default function VenuePortalPage() {
  const supabase = useMemo(() => getSupabaseBrowserClientResult().client, []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [venues, setVenues] = useState<PortalVenueRow[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadPortalData() {
      setLoading(true);
      setErrorMessage(null);
      if (!supabase) {
        setErrorMessage(BROWSER_SUPABASE_ENV_ERROR);
        setLoading(false);
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError) {
        setErrorMessage(sessionError.message);
        setLoading(false);
        return;
      }

      if (!session?.user) {
        setLoading(false);
        return;
      }

      setUserEmail(session.user.email ?? null);

      const [{ data: adminRow, error: adminError }, { data, error }] = await Promise.all([
        supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', session.user.id)
          .maybeSingle(),
        supabase
          .from('venue_user_access')
          .select('venue_id, role')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true }),
      ]);

      if (!mounted) return;

      if (adminError) {
        setErrorMessage(adminError.message);
        setLoading(false);
        return;
      }

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      const accessRows = (data ?? []) as VenueAccessRow[];
      const venueIds = accessRows.map((row) => row.venue_id).filter(Boolean);
      let venueMap = new Map<string, PortalVenueDetail>();

      if (venueIds.length > 0) {
        const { data: venueRows, error: venueError } = await supabase
          .from('venues')
          .select(
            'id, name, suburb, venue_type_id, address, website_url, shows_sport, plays_with_sound, dog_friendly, kid_friendly, byo_allowed, venue_types(label, slug)'
          )
          .in('id', venueIds);

        if (!mounted) return;

        if (venueError) {
          setErrorMessage(venueError.message);
          setLoading(false);
          return;
        }

        venueMap = new Map(
          ((venueRows ?? []) as PortalVenueDetail[]).map((venue) => [venue.id, venue])
        );
      }

      setIsAdmin(Boolean(adminRow?.user_id));
      setVenues(normalizePortalVenueRows(accessRows, venueMap));
      setLoading(false);
    }

    void loadPortalData();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const filteredVenues = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return venues;

    return venues.filter((row) => {
      const haystack = [
        row.venue?.name ?? '',
        row.venue?.suburb ?? '',
        row.venue?.address ?? '',
        getVenueTypeLabel(row.venue),
        row.role ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [search, venues]);

  return (
    <div className="portal-shell min-h-screen bg-neutral-950 px-4 py-5 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <section className="portal-surface rounded-[24px] border p-4 sm:rounded-[28px] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300/80">
                Venue Portal
              </div>
              <h1 className="mt-2 text-[1.55rem] font-semibold tracking-tight sm:text-3xl">
                Pick a venue and edit fast
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/68">
                Search your venues, open the right workspace, and update details or schedules on the fly.
              </p>
            </div>
            <div className="portal-surface-subtle rounded-2xl border px-3.5 py-3 text-sm text-white/78 sm:min-w-[220px]">
              <div>{userEmail ?? 'Loading user...'}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/50">
                {isAdmin ? 'Admin access also enabled' : 'Venue manager access'}
              </div>
            </div>
          </div>

          {isAdmin ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              This account is also a full admin. You can still use the venue portal
              for scoped testing, or open{' '}
              <Link href="/admin" className="font-semibold underline underline-offset-4">
                /admin
              </Link>{' '}
              for the full management screen.
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {errorMessage}
            </div>
          ) : null}
        </section>

        <section className="mt-6 sm:mt-8">
          <div className="mb-3 flex flex-col gap-2.5 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Assigned venues</h2>
              <p className="mt-1 text-sm text-white/58">
                Search first, then jump straight into the venue you need.
              </p>
            </div>
            <div className="portal-surface-subtle rounded-full border px-3.5 py-2 text-sm text-white/78">
              {filteredVenues.length}
              {filteredVenues.length !== venues.length ? ` of ${venues.length}` : ''} venue
              {filteredVenues.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="mb-4 grid gap-2.5 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search venue, suburb, type, or role"
                className="h-11 w-full rounded-2xl border px-4 pr-24 text-sm text-white outline-none focus:border-orange-300/40"
              />
              {search.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="portal-ghost-button absolute right-2 top-1/2 -translate-y-1/2 rounded-full border px-3 py-1 text-[11px]"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <Link
              href="/venues"
              className="portal-ghost-button inline-flex min-h-[42px] items-center justify-center whitespace-nowrap rounded-2xl border px-4 py-2.5 text-sm font-semibold"
            >
              Open public website
            </Link>
          </div>

          {loading ? (
            <div className="portal-surface rounded-3xl border p-6 text-sm text-white/70">
              Loading assigned venues...
            </div>
          ) : filteredVenues.length === 0 ? (
            <div className="portal-surface rounded-3xl border border-dashed p-6 text-sm text-white/70">
              {venues.length === 0
                ? 'No venues are linked to this account yet.'
                : 'No assigned venues match this search.'}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredVenues.map((row) => (
                <div
                  key={`${row.venue_id}-${row.role ?? 'manager'}`}
                  className="portal-surface group rounded-3xl border p-4 transition hover:border-orange-300/30 hover:bg-white/[0.02] sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-300/75">
                        {getVenueTypeLabel(row.venue)}
                      </div>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">
                        {row.venue?.name ?? 'Untitled venue'}
                      </h3>
                    </div>
                    <div className="portal-surface-subtle rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/68">
                      {row.role ?? 'manager'}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-white/55">
                    {row.venue?.suburb ? (
                      <span className="portal-surface-subtle rounded-full border px-3 py-1">
                        {row.venue.suburb}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-white/72">
                    {row.venue?.address ? <div>{row.venue.address}</div> : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/80">
                    {normalizeBooleanFlag(row.venue?.shows_sport) ? (
                      <span className="portal-surface-subtle rounded-full border px-2.5 py-1">{'\u{1F3C8}'} Sport</span>
                    ) : null}
                    {normalizeBooleanFlag(row.venue?.shows_sport) &&
                    normalizeBooleanFlag(row.venue?.plays_with_sound) ? (
                      <span className="portal-surface-subtle rounded-full border px-2.5 py-1">{'\u{1F50A}'} Sound</span>
                    ) : null}
                    {normalizeBooleanFlag(row.venue?.dog_friendly) ? (
                      <span className="portal-surface-subtle rounded-full border px-2.5 py-1">{'\u{1F436}'} Dog</span>
                    ) : null}
                    {normalizeBooleanFlag(row.venue?.kid_friendly) ? (
                      <span className="portal-surface-subtle rounded-full border px-2.5 py-1">{'\u{1F9D2}'} Kid</span>
                    ) : null}
                    {normalizeBooleanFlag(row.venue?.byo_allowed) ? (
                      <span className="portal-surface-subtle rounded-full border px-2.5 py-1">{'\u{1F37E}'} BYO</span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/portal/venues/${row.venue_id}`)}
                      className="portal-primary-button inline-flex min-h-[40px] items-center rounded-xl border px-3 py-2 text-sm font-medium"
                    >
                      Open workspace
                    </button>
                    <Link
                      href={row.venue ? buildPublicVenueHref(row.venue) : '/venues'}
                      className="portal-ghost-button inline-flex min-h-[40px] items-center rounded-xl border px-3 py-2 text-sm font-medium"
                    >
                      View on website
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


