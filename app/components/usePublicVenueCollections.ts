'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import {
  PUBLIC_VENUE_SELECT,
  splitVenuesByLaunchArea,
  type Venue,
} from '@/lib/public-venue-discovery';

export function usePublicVenueCollections() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      if (!supabase) {
        setError(
          'Missing Supabase env vars. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY and restart.'
        );
        setVenues([]);
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from('venues')
        .select(PUBLIC_VENUE_SELECT)
        .order('name', { ascending: true });

      if (cancelled) return;

      if (loadError) {
        setError(loadError.message);
        setVenues([]);
      } else {
        setVenues(((data ?? []) as unknown) as Venue[]);
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const split = useMemo(() => splitVenuesByLaunchArea(venues), [venues]);

  return {
    venues,
    liveVenues: split.live,
    futureVenues: split.future,
    loading,
    error,
  };
}
