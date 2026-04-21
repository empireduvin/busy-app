'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  splitVenuesByLaunchArea,
  type Venue,
} from '@/lib/public-venue-discovery';

export function usePublicVenueCollections() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/public-venues', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: Venue[];
        error?: string;
      };

      if (cancelled) return;

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Unable to load venues right now.');
        setVenues([]);
      } else {
        setVenues(payload.data ?? []);
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const split = useMemo(() => splitVenuesByLaunchArea(venues), [venues]);

  return {
    venues,
    liveVenues: split.live,
    futureVenues: split.future,
    loading,
    error,
  };
}
