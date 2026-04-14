'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  buildPublicVenueHref,
  getVenueTypeLabel,
  normalizeBooleanFlag,
  type Venue,
} from '@/lib/public-venue-discovery';
import { normalizeInstagramUrl } from '@/lib/social-links';

type CardTone = 'default' | 'live' | 'today';

export default function PublicVenueCard({
  venue,
  eyebrow,
  badges,
  summary,
  details,
  compact = false,
  tone = 'default',
  heroBadge,
}: {
  venue: Venue;
  eyebrow: string;
  badges?: string[];
  summary?: ReactNode;
  details?: ReactNode;
  compact?: boolean;
  tone?: CardTone;
  heroBadge?: ReactNode;
}) {
  const router = useRouter();
  const venueTypeLabel = getVenueTypeLabel(venue);
  const websiteHref = buildPublicVenueHref(venue);
  const instagramHref = normalizeInstagramUrl(venue.instagram_url);
  const allBadges = [
    ...(badges ?? []),
    ...(normalizeBooleanFlag(venue.shows_sport) ? ['Sport'] : []),
    ...(normalizeBooleanFlag(venue.shows_sport) && normalizeBooleanFlag(venue.plays_with_sound)
      ? ['With sound']
      : []),
    ...(normalizeBooleanFlag(venue.byo_allowed) ? ['BYO'] : []),
    ...(normalizeBooleanFlag(venue.dog_friendly) ? ['Dog'] : []),
    ...(normalizeBooleanFlag(venue.kid_friendly) ? ['Kid'] : []),
  ];
  const visibleBadges = compact ? allBadges.slice(0, 3) : allBadges;
  const hiddenBadgeCount = compact ? Math.max(0, allBadges.length - visibleBadges.length) : 0;
  const toneClasses =
    tone === 'live'
      ? 'border-orange-400/20 bg-[linear-gradient(180deg,rgba(255,111,36,0.16),rgba(255,255,255,0.04)_30%,rgba(255,255,255,0.03))]'
      : tone === 'today'
        ? 'border-white/12 bg-[linear-gradient(180deg,rgba(255,179,71,0.10),rgba(255,255,255,0.04)_28%,rgba(255,255,255,0.03))]'
        : 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]';

  return (
    <article
      className={[
        'relative overflow-hidden rounded-[28px] border shadow-[0_20px_60px_rgba(0,0,0,0.28)] transition hover:border-white/20 hover:bg-white/[0.07]',
        toneClasses,
        compact ? 'p-4' : 'p-5',
      ].join(' ')}
      role="link"
      tabIndex={0}
      onClick={() => router.push(websiteHref)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          router.push(websiteHref);
        }
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,40,0.12),transparent_32%)]" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(255,138,61,0.85)]" />
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/90">
              {eyebrow}
            </div>
          </div>
          {heroBadge ? <div className="shrink-0">{heroBadge}</div> : null}
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className={[compact ? 'text-[18px] sm:text-[26px]' : 'text-[22px] sm:text-3xl', 'break-words font-semibold leading-[1.05] text-white'].join(' ')}>
              {venue.name || 'Untitled venue'}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/75">
              {venue.suburb ? <MetaPill>{venue.suburb.toUpperCase()}</MetaPill> : null}
              {venueTypeLabel ? <MetaPill>{venueTypeLabel.toUpperCase()}</MetaPill> : null}
            </div>
          </div>

          {venue.google_rating ? (
            <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/70">
              Star {venue.google_rating.toFixed(1)}
            </div>
          ) : null}
        </div>

        {venue.address ? (
          <div className="mt-3 flex min-w-0 items-start gap-2 text-sm text-white/58">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400/80" />
            <span className="min-w-0 break-words">{venue.address}</span>
          </div>
        ) : null}

        {summary ? <div className="mt-4">{summary}</div> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {visibleBadges.map((badge) => (
            <MetaPill key={badge}>{badge}</MetaPill>
          ))}
          {hiddenBadgeCount > 0 ? <MetaPill>+{hiddenBadgeCount} more</MetaPill> : null}
        </div>

        {details ? <div className="mt-4 space-y-3">{details}</div> : null}

        <div
          className={[
            'mt-5 grid grid-cols-2 text-sm',
            compact ? 'gap-2' : 'gap-3',
          ].join(' ')}
        >
          <a
            href={websiteHref}
            onClick={(event) => event.stopPropagation()}
            className="col-span-2 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/6 px-3 py-2 text-white transition hover:bg-white/10 sm:col-span-1"
          >
            Explore venue
          </a>
          {venue.website_url ? (
            <a
              href={venue.website_url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              Website
            </a>
          ) : null}
          {instagramHref ? (
            <a
              href={instagramHref}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              Instagram
            </a>
          ) : null}
          {venue.phone ? (
            <a
              href={`tel:${venue.phone}`}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              Call
            </a>
          ) : null}
          {venue.google_maps_uri ? (
            <a
              href={venue.google_maps_uri}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              Maps
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-medium text-white/75">
      {children}
    </span>
  );
}
