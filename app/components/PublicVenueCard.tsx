'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { VenueIntentBadge } from '@/app/components/VenueIntentButtons';
import VenuePrimaryImage from '@/app/components/VenuePrimaryImage';
import {
  buildPublicVenueHref,
  getVenueTypeLabel,
  normalizeBooleanFlag,
  type Venue,
} from '@/lib/public-venue-discovery';
import { normalizeInstagramContentUrl, normalizeInstagramUrl } from '@/lib/social-links';

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
  const featuredInstagramHref = normalizeInstagramContentUrl(venue.featured_instagram_url);
  const hasSocialSignal = Boolean(
    venue.social_freshness_label?.trim() ||
      venue.social_note?.trim() ||
      featuredInstagramHref ||
      instagramHref
  );
  const allBadges = [
    ...(badges ?? []),
    ...(normalizeBooleanFlag(venue.shows_sport) ? ['Sport'] : []),
    ...(normalizeBooleanFlag(venue.shows_sport) && normalizeBooleanFlag(venue.plays_with_sound)
      ? ['Live & loud']
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
          <div className="flex items-start gap-2.5 sm:gap-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="min-w-0 flex-1 line-clamp-2 text-[20px] font-semibold leading-[1.04] tracking-tight text-white sm:text-[22px]">
                  {venue.name || 'Untitled venue'}
                </h2>
                {heroBadge ? <div className="shrink-0">{heroBadge}</div> : null}
              </div>
              <VenueIntentBadge venueId={venue.id} />

              {summary ? (
                <div className="mt-1 min-w-0 text-[13px] font-medium leading-4.5 text-white/78 sm:text-[14px] sm:leading-5">
                  {summary}
                </div>
              ) : (
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-200/72">
                  {eyebrow}
                </div>
              )}

              <div className="mt-1 min-w-0 break-words text-[11px] leading-4 text-white/62 sm:text-[12px] sm:leading-5">
                <span>{venue.suburb ?? 'Suburb TBC'}</span>
                {venueTypeLabel ? <span>{` • ${venueTypeLabel}`}</span> : null}
              </div>
              {details ? (
                <div className="mt-0.5 min-w-0 break-words text-[11px] leading-4 text-white/52 sm:text-[12px] sm:leading-5">
                  {details}
                </div>
              ) : null}
              {hasSocialSignal ? (
                <VenueSocialSignal
                  label={venue.social_freshness_label}
                  note={venue.social_note}
                  featuredHref={featuredInstagramHref}
                  instagramHref={instagramHref}
                  compact
                />
              ) : null}
            </div>
            <VenuePrimaryImage
              venue={venue}
              variant="compact-card"
              className="w-[126px] shrink-0 sm:w-[154px]"
            />
          </div>

          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <a
                href={websiteHref}
                onClick={(event) => event.stopPropagation()}
                className="inline-flex min-h-[31px] shrink-0 items-center justify-center rounded-xl border border-orange-300/20 bg-orange-500/12 px-3 py-1.5 text-[12px] font-semibold text-orange-50 transition hover:border-orange-200/35 hover:bg-orange-500/18"
              >
                View venue
              </a>
              {secondaryFooterAction ? (
                <div className="shrink-0" onClick={(event) => event.stopPropagation()}>{secondaryFooterAction}</div>
              ) : null}
              {visibleSecondaryActions.map((action) => (
                <a
                  key={action.key}
                  href={action.href}
                  target={action.external ? '_blank' : undefined}
                  rel={action.external ? 'noreferrer' : undefined}
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex min-h-[31px] items-center justify-center rounded-xl border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-[11px] font-medium text-white/62 transition hover:border-white/14 hover:bg-white/6 hover:text-white"
                >
                  {action.label}
                </a>
              ))}
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
        'p-3.5 sm:p-4',
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
        <div className="flex items-start gap-3 sm:gap-4 lg:gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2.5 sm:gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2.5">
                  <h2
                    className={[
                      compact ? 'text-[20px] sm:text-[26px]' : 'text-[25px] sm:text-[30px]',
                    'min-w-0 flex-1 break-words font-semibold leading-[1.04] text-white',
                    ].join(' ')}
                  >
                    {venue.name || 'Untitled venue'}
                  </h2>
                  {heroBadge ? <div className="shrink-0">{heroBadge}</div> : null}
                </div>
                <VenueIntentBadge venueId={venue.id} />
                {summary ? (
                  <div className="mt-1.5 text-[15px] font-medium leading-5 text-white/76 sm:text-[16px] sm:leading-6">
                    {summary}
                  </div>
                ) : null}
                <div className="mt-1.5 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300/78">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_10px_rgba(255,138,61,0.75)]" />
                  {eyebrow}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-white/58 sm:mt-2 sm:gap-2 sm:text-xs sm:text-white/72">
                  {venue.suburb ? <MetaPill>{venue.suburb}</MetaPill> : null}
                  {venueTypeLabel ? <MetaPill>{venueTypeLabel}</MetaPill> : null}
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
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400/80" />
                <span className="min-w-0 break-words">{venue.address}</span>
              </div>
            ) : null}

            {hasSocialSignal ? (
              <VenueSocialSignal
                label={venue.social_freshness_label}
                note={venue.social_note}
                featuredHref={featuredInstagramHref}
                instagramHref={instagramHref}
              />
            ) : null}

            {!compact && visibleBadges.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
              {visibleBadges.map((badge) => (
                <MetaPill key={badge}>{badge}</MetaPill>
              ))}
              {hiddenBadgeCount > 0 ? <MetaPill>+{hiddenBadgeCount} more</MetaPill> : null}
              </div>
            ) : null}

            {details ? (
              <div className="mt-2.5 text-[13px] leading-5 text-white/58 sm:text-sm sm:leading-6">
                {details}
              </div>
            ) : null}
          </div>

          <VenuePrimaryImage
            venue={venue}
            variant="card"
            className="w-[146px] shrink-0 sm:w-[32%] sm:min-w-[220px] sm:max-w-[280px]"
          />
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2 text-sm sm:gap-2.5">
          <a
            href={websiteHref}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-xl border border-orange-300/20 bg-orange-500/12 px-3 py-1.5 text-[12px] font-semibold text-orange-50 transition hover:border-orange-200/35 hover:bg-orange-500/18 sm:min-h-[36px] sm:px-3 sm:text-[13px]"
          >
            View venue
          </a>
          {secondaryFooterAction ? (
            <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
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
              className="inline-flex min-h-[32px] items-center justify-center rounded-xl border border-white/8 bg-transparent px-2.5 py-1.5 text-[12px] font-medium text-white/60 transition hover:border-white/14 hover:bg-white/6 hover:text-white sm:min-h-[36px] sm:px-3 sm:text-[13px]"
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}

function VenueSocialSignal({
  label,
  note,
  featuredHref,
  instagramHref,
  compact = false,
}: {
  label: string | null | undefined;
  note: string | null | undefined;
  featuredHref: string | null;
  instagramHref: string | null;
  compact?: boolean;
}) {
  const cleanLabel = label?.trim();
  const cleanNote = note?.trim();

  if (!cleanLabel && !cleanNote && !featuredHref && !instagramHref) return null;

  return (
    <div className={compact ? 'mt-1 space-y-1' : 'mt-2 space-y-1.5'}>
      {cleanLabel ? (
        <div className={compact ? 'text-[11px] font-semibold text-orange-100/78' : 'text-[12px] font-semibold leading-5 text-orange-100/80'}>
          🔥 {cleanLabel}
        </div>
      ) : null}
      {cleanNote ? (
        <div className={compact ? 'line-clamp-2 text-[11px] leading-4 text-white/62' : 'line-clamp-2 text-[12px] leading-5 text-white/64'}>
          {cleanNote}
        </div>
      ) : null}
      {(featuredHref || instagramHref) ? (
        <div className="flex flex-wrap gap-1.5">
          {featuredHref ? (
            <a
              href={featuredHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-h-[28px] items-center justify-center rounded-lg border border-orange-300/18 bg-orange-500/8 px-2.5 py-1 text-[11px] font-medium text-orange-100/82 transition hover:border-orange-200/30 hover:bg-orange-500/14 hover:text-orange-50"
            >
              View post
            </a>
          ) : null}
          {instagramHref ? (
            <a
              href={instagramHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-h-[28px] items-center justify-center rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1 text-[11px] font-medium text-white/62 transition hover:border-white/14 hover:bg-white/6 hover:text-white"
            >
              Instagram
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/8 bg-black/16 px-2.5 py-1 text-[10px] font-medium tracking-[0.04em] text-white/62 sm:border-white/10 sm:px-3 sm:text-xs sm:text-white/75">
      {children}
    </span>
  );
}
