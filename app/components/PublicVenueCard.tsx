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
  const visibleBadges = compact ? allBadges.slice(0, 1) : allBadges.slice(0, 4);
  const hiddenBadgeCount = compact ? 0 : Math.max(0, allBadges.length - visibleBadges.length);
  const secondaryActions = [
    venue.website_url
      ? {
          key: 'website',
          href: venue.website_url,
          label: 'Website',
          external: true,
        }
      : null,
    instagramHref
      ? {
          key: 'instagram',
          href: instagramHref,
          label: 'Instagram',
          external: true,
        }
      : null,
    venue.phone
      ? {
          key: 'call',
          href: `tel:${venue.phone}`,
          label: 'Call',
          external: false,
        }
      : null,
    venue.google_maps_uri
      ? {
          key: 'maps',
          href: venue.google_maps_uri,
          label: 'Maps',
          external: true,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    href: string;
    label: string;
    external: boolean;
  }>;
  const visibleSecondaryActions = compact ? secondaryActions.slice(0, 3) : secondaryActions;
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
        compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5',
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

        <div className="mt-2.5 flex flex-wrap items-start justify-between gap-2.5 sm:mt-3 sm:gap-3">
          <div className="min-w-0 flex-1">
            <h2 className={[compact ? 'text-[20px] sm:text-[26px]' : 'text-[24px] sm:text-3xl', 'break-words font-semibold leading-[1.04] text-white'].join(' ')}>
              {venue.name || 'Untitled venue'}
            </h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-white/58 sm:mt-2 sm:gap-2 sm:text-xs sm:text-white/72">
              {venue.suburb ? <MetaPill>{venue.suburb.toUpperCase()}</MetaPill> : null}
              {venueTypeLabel ? <MetaPill>{venueTypeLabel.toUpperCase()}</MetaPill> : null}
            </div>
          </div>

          {venue.google_rating ? (
            <div className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[10px] text-white/46 sm:border-white/10 sm:bg-black/25 sm:px-2.5 sm:py-1 sm:text-[11px] sm:text-white/68">
              Star {venue.google_rating.toFixed(1)}
            </div>
          ) : null}
        </div>

        {venue.address ? (
          <div className="mt-2 flex min-w-0 items-start gap-2 text-[12px] text-white/46 sm:mt-3 sm:text-sm sm:text-white/56">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400/80" />
            <span className="min-w-0 break-words">{venue.address}</span>
          </div>
        ) : null}

        {summary ? <div className={compact ? 'mt-3' : 'mt-3.5 sm:mt-4'}>{summary}</div> : null}

        <div className={compact ? 'mt-2.5 flex flex-wrap gap-1.5' : 'mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2'}>
          {visibleBadges.map((badge) => (
            <MetaPill key={badge}>{badge}</MetaPill>
          ))}
          {hiddenBadgeCount > 0 ? <MetaPill>+{hiddenBadgeCount} more</MetaPill> : null}
        </div>

        {details ? (
          <div className={compact ? 'mt-3 space-y-2' : 'mt-3.5 space-y-2.5 sm:mt-4 sm:space-y-3'}>
            {details}
          </div>
        ) : null}

        <div
          className={[
            'mt-4 grid grid-cols-2 text-sm',
            compact ? 'gap-1.5' : 'gap-2.5 sm:gap-3',
          ].join(' ')}
        >
          <a
            href={websiteHref}
            onClick={(event) => event.stopPropagation()}
            className={[
              'col-span-2 inline-flex items-center justify-center rounded-xl border border-orange-300/20 bg-orange-500/[0.12] px-3 py-2 font-semibold text-orange-50 transition hover:bg-orange-500/[0.18] hover:text-white sm:border-transparent sm:bg-orange-500 sm:text-black sm:hover:bg-orange-400',
              compact ? 'min-h-[40px] text-[13px]' : 'min-h-[44px] text-sm',
            ].join(' ')}
          >
            Explore venue
          </a>
          {visibleSecondaryActions.map((action) => (
            <a
              key={action.key}
              href={action.href}
              target={action.external ? '_blank' : undefined}
              rel={action.external ? 'noreferrer' : undefined}
              onClick={(event) => event.stopPropagation()}
              className={[
                'inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/12 px-3 py-2 font-medium text-white/64 transition hover:bg-white/8 hover:text-white',
                compact ? 'min-h-[34px] text-[11px]' : 'min-h-[38px] text-[12px] sm:min-h-[44px] sm:text-sm',
              ].join(' ')}
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/8 bg-black/16 px-2.5 py-1 text-[10px] font-medium tracking-[0.04em] text-white/54 sm:border-white/10 sm:px-3 sm:text-xs sm:text-white/75">
      {children}
    </span>
  );
}
