'use client';

import PublicVenueCard from '@/app/components/PublicVenueCard';
import { usePublicVenueCollections } from '@/app/components/usePublicVenueCollections';
import { getVenueTypeLabel } from '@/lib/public-venue-discovery';
import { useMemo, useState } from 'react';

export default function FutureVenuesPage() {
  const { futureVenues, loading, error } = usePublicVenueCollections();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return futureVenues;

    return futureVenues.filter((venue) =>
      [venue.name, venue.suburb, venue.address, getVenueTypeLabel(venue)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [futureVenues, search]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            Internal staging
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Future venues</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base">
            This page is for venues outside the current Inner West launch area. It is intentionally
            not linked in the public navigation.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search future venue, suburb, or type"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-orange-400/50"
          />
        </section>

        <section className="mt-6">
          {loading ? <div className="text-white/65">Loading future venues...</div> : null}
          {!loading && error ? (
            <div className="rounded-3xl border border-red-500/30 bg-red-950/30 p-5 text-red-100">
              {error}
            </div>
          ) : null}
          {!loading && !error && filtered.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
              No future venues match this search yet.
            </div>
          ) : null}

          <div className="grid gap-4">
            {filtered.map((venue) => (
              <PublicVenueCard
                key={venue.id}
                venue={venue}
                eyebrow="Future Venue"
                summary={
                  <div className="text-sm text-white/70">
                    Staged outside the current launch suburbs.
                  </div>
                }
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
