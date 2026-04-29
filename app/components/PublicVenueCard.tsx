'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { VenueIntentBadge } from '@/app/components/VenueIntentButtons';
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
  secondaryFooterAction,
}: {
  venue: Venue;
  eyebrow: string;
  badges?: string[];
  summary?: ReactNode;
  details?: ReactNode;
  compact?: boolean;
  tone?: CardTone;
  heroBadge?: ReactNode;
  secondaryFooterAction?: ReactNode;
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
  ];
  const visibleBadges = compact ? [] : allBadges.slice(0, 4);
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
  const visibleSecondaryActions = compact ? secondaryActions.slice(0, 2) : secondaryActions.slice(0, 3);
  const toneClasses =
    tone === 'live'
      ? 'border-orange-400/18 bg-[linear-gradient(180deg,rgba(255,111,36,0.13),rgba(255,255,255,0.035)_30%,rgba(255,255,255,0.025))]'
      : tone === 'today'
        ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,179,71,0.08),rgba(255,255,255,0.035)_28%,rgba(255,255,255,0.025))]'
        : 'border-white/9 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))]';

  if (compact) {
    return (
      <article
        className={[
          'relative overflow-hidden rounded-[24px] border p-2.25 shadow-[0_18px_52px_rgba(0,0,0,0.24)] transition hover:border-white/18 hover:bg-white/[0.06] sm:p-2.75',
          toneClasses,
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
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,40,0.10),transparent_30%)]" />

        <div className="relative">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-200/88">
              {eyebrow}
            </div>
            {heroBadge ? <div className="shrink-0">{heroBadge}</div> : null}
          </div>

          <h2 className="mt-1 line-clamp-2 text-[20px] font-semibold leading-[1.02] tracking-tight text-white sm:mt-1.5 sm:text-[24px]">
            {venue.name || 'Untitled venue'}
          </h2>
          <VenueIntentBadge venueId={venue.id} />

          {summary ? <div className="mt-0.5 min-w-0 text-[13px] font-medium leading-4.5 text-white/94 sm:text-[14px]">{summary}</div> : null}

          <div className="mt-0.5 min-w-0 break-words text-[11px] leading-4 text-white/68 sm:mt-1 sm:text-[12px] sm:leading-5">
            <span>{venue.suburb ?? 'Suburb TBC'}</span>
            {venueTypeLabel ? <span>{` | ${venueTypeLabel}`}</span> : null}
            {details ? <span>{` | `}{details}</span> : null}
          </div>

          <div className="mt-1.5">
            <div className="grid gap-1.5">
              <a
                href={websiteHref}
                onClick={(event) => event.stopPropagation()}
                className="inline-flex min-h-[31px] w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-white/72 transition hover:border-white/16 hover:bg-white/[0.06] hover:text-white"
              >
                View venue
              </a>
              {secondaryFooterAction ? (
                <div onClick={(event) => event.stopPropagation()}>{secondaryFooterAction}</div>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={[
        'relative overflow-hidden rounded-[28px] border shadow-[0_20px_60px_rgba(0,0,0,0.28)] transition hover:border-white/18 hover:bg-white/[0.06]',
        toneClasses,
        'p-4 sm:p-5',
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
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,40,0.10),transparent_32%)]" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_10px_rgba(255,138,61,0.75)]" />
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/88">
              {eyebrow}
            </div>
          </div>
          {heroBadge ? <div className="shrink-0">{heroBadge}</div> : null}
        </div>

        <div className="mt-2.5 flex flex-wrap items-start justify-between gap-2.5 sm:mt-3 sm:gap-3">
          <div className="min-w-0 flex-1">
            <h2
              className={[
                compact ? 'text-[20px] sm:text-[26px]' : 'text-[24px] sm:text-3xl',
                'break-words font-semibold leading-[1.04] text-white',
              ].join(' ')}
            >
              {venue.name || 'Untitled venue'}
            </h2>
            <VenueIntentBadge venueId={venue.id} />
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

        {summary ? <div className="mt-3.5 sm:mt-4">{summary}</div> : null}

        {!compact && visibleBadges.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
          {visibleBadges.map((badge) => (
            <MetaPill key={badge}>{badge}</MetaPill>
          ))}
          {hiddenBadgeCount > 0 ? <MetaPill>+{hiddenBadgeCount} more</MetaPill> : null}
          </div>
        ) : null}

        {details ? <div className="mt-3.5 space-y-2.5 sm:mt-4 sm:space-y-3">{details}</div> : null}

        <div className="mt-3.5 grid grid-cols-2 gap-2 text-sm sm:gap-2.5">
          <a
            href={websiteHref}
            onClick={(event) => event.stopPropagation()}
            className="col-span-2 inline-flex min-h-[34px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white/80 transition hover:border-white/16 hover:bg-white/[0.07] hover:text-white sm:min-h-[36px] sm:px-3 sm:text-[13px]"
          >
            View venue
          </a>
          {secondaryFooterAction ? (
            <div className="col-span-2" onClick={(event) => event.stopPropagation()}>
              {secondaryFooterAction}
            </div>
          ) : null}
          {visibleSecondaryActions.map((action) => (
            <a
              key={action.key}
              href={action.href}
              target={action.external ? '_blank' : undefined}
              rel={action.external ? 'noreferrer' : undefined}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-h-[32px] items-center justify-center rounded-xl border border-white/8 bg-transparent px-3 py-1.5 text-[12px] font-medium text-white/60 transition hover:border-white/14 hover:bg-white/6 hover:text-white sm:min-h-[36px] sm:text-[13px]"
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
    <span className="inline-flex items-center rounded-full border border-white/8 bg-black/16 px-2.5 py-1 text-[10px] font-medium tracking-[0.04em] text-white/62 sm:border-white/10 sm:px-3 sm:text-xs sm:text-white/75">
      {children}
    </span>
  );
}
