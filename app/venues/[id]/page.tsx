'use client';

import GoogleMap from '@/app/components/GoogleMap';
import PublicEventRuleCard from '@/app/components/PublicEventRuleCard';
import PublicHappyHourRuleCard from '@/app/components/PublicHappyHourRuleCard';
import TodayHoursSummary from '@/app/components/TodayHoursSummary';
import WeeklyTimelineChart from '@/app/components/WeeklyTimelineChart';
import { convertGoogleOpeningHours } from '@/lib/convert-google-hours';
import {
  formatTimeForUi,
  getClosingSoonText,
  getNextOpeningText,
  isOpenNow,
  isVenueOpenNow,
} from '@/lib/opening-hours';
import {
  fetchPublicVenues,
  getEffectiveScheduleHours,
  getPublishedEventRules,
  getPublishedRulesByType,
  getTodayRulesForType,
  getVenueTypeLabel,
  isLiveInnerWestSuburb,
  normalizeBooleanFlag,
  type Venue,
  type VenueScheduleRule,
} from '@/lib/public-venue-discovery';
import { getSupabaseBrowserClientResult } from '@/lib/supabase-browser';
import { BROWSER_SUPABASE_ENV_ERROR } from '@/lib/public-env';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

function getFirstRuleStartText(rules: VenueScheduleRule[]) {
  if (rules.length === 0) return null;

  const [firstRule] = [...rules].sort((a, b) => a.start_time.localeCompare(b.start_time));
  return formatTimeForUi(firstRule.start_time.slice(0, 5));
}

function getActiveDayCount(rules: VenueScheduleRule[]) {
  return new Set(rules.map((rule) => rule.day_of_week)).size;
}

export default function PublicVenueDetailPage() {
  const params = useParams<{ id: string }>();
  const venueId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const supabase = useMemo(() => getSupabaseBrowserClientResult().client, []);

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVenue() {
      setLoading(true);
      setError(null);

      if (!venueId) {
        setVenue(null);
        setError('Venue not found.');
        setLoading(false);
        return;
      }

      if (!supabase) {
        setVenue(null);
        setError(BROWSER_SUPABASE_ENV_ERROR);
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await fetchPublicVenues(supabase, {
        venueId,
      });

      if (cancelled) return;

      if (loadError) {
        setVenue(null);
        setError(loadError.message);
      } else if (!data) {
        setVenue(null);
        setError('Venue not found.');
      } else {
        const venueRow = Array.isArray(data) ? data[0] ?? null : data;

        if (!venueRow) {
          setVenue(null);
          setError('Venue not found.');
        } else {
          setVenue((venueRow as unknown) as Venue);
        }
      }

      setLoading(false);
    }

    void loadVenue();

    return () => {
      cancelled = true;
    };
  }, [supabase, venueId]);

  const detail = useMemo(() => {
    if (!venue) return null;

    const timezone = venue.timezone ?? 'Australia/Sydney';
    const normalizedOpeningHours = convertGoogleOpeningHours(venue.opening_hours);
    const effectiveKitchenHours = getEffectiveScheduleHours(venue, 'kitchen');
    const effectiveHappyHourHours = getEffectiveScheduleHours(venue, 'happy_hour');
    const effectiveBottleShopHours = getEffectiveScheduleHours(venue, 'bottle_shop');
    const primaryHours = normalizedOpeningHours ?? effectiveBottleShopHours ?? null;
    const happyHourRules = getPublishedRulesByType(venue, 'happy_hour');
    const eventRules = getPublishedEventRules(venue);
    const todayHappyHourRules = getTodayRulesForType(happyHourRules, timezone);
    const todayEventRules = getTodayRulesForType(eventRules, timezone);
    const openNow = isVenueOpenNow(
      primaryHours,
      timezone,
      venue.is_temporarily_closed ?? false
    );
    const happyHourLive = isOpenNow(effectiveHappyHourHours, timezone, false);
    const closingSoonText = getClosingSoonText(
      primaryHours,
      timezone,
      venue.is_temporarily_closed ?? false
    );
    const nextOpeningText = getNextOpeningText(
      primaryHours,
      timezone,
      venue.is_temporarily_closed ?? false
    );

    return {
      timezone,
      normalizedOpeningHours,
      effectiveKitchenHours,
      effectiveHappyHourHours,
      effectiveBottleShopHours,
      happyHourRules,
      eventRules,
      todayHappyHourRules,
      todayEventRules,
      openNow,
      happyHourLive,
      closingSoonText,
      nextOpeningText,
      todayHappyHourStartText: getFirstRuleStartText(todayHappyHourRules),
      todayEventStartText: getFirstRuleStartText(todayEventRules),
      weeklyActivityCount: happyHourRules.length + eventRules.length,
      weeklyActivityDays: getActiveDayCount([...happyHourRules, ...eventRules]),
      liveItemsCount: todayHappyHourRules.length + todayEventRules.length,
    };
  }, [venue]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/65">
            Loading venue...
          </div>
        </div>
      </div>
    );
  }

  if (!venue || !detail) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xl font-semibold text-white">Venue not available</div>
            <div className="mt-2 text-white/60">{error ?? 'This venue could not be loaded.'}</div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/venues"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Back to venues
              </Link>
              <Link
                href="/contact"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const venueTypeLabel = getVenueTypeLabel(venue);
  const backHref = isLiveInnerWestSuburb(venue.suburb) ? '/venues' : '/futurevenues';
  const mappedVenue =
    typeof venue.lat === 'number' &&
    !Number.isNaN(venue.lat) &&
    typeof venue.lng === 'number' &&
    !Number.isNaN(venue.lng)
      ? [{ id: venue.id, name: venue.name, lat: venue.lat, lng: venue.lng }]
      : [];
  const ratingText = venue.google_rating ? `Star ${venue.google_rating.toFixed(1)}` : null;
  const reviewsText = venue.google_user_rating_count
    ? `${venue.google_user_rating_count.toLocaleString()} ratings`
    : null;
  const openStatusText = venue.is_temporarily_closed
    ? 'Temporarily closed'
    : detail.openNow
      ? 'Open now'
      : detail.nextOpeningText
        ? 'Opens later'
        : 'Closed';

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,128,32,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-7">
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
            <Link href={backHref} className="hover:text-white">
              Back to venues
            </Link>
            <span className="text-white/25">/</span>
            <span>{venue.suburb ?? 'Venue'}</span>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)] xl:items-end">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-300/80">
                {venueTypeLabel ?? 'Venue'}
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                {venue.name ?? 'Untitled venue'}
              </h1>
              {venue.address ? (
                <div className="mt-3 max-w-2xl text-sm leading-6 text-white/68 sm:text-base">
                  {venue.address}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
                {venue.suburb ? <MetaChip>{venue.suburb.toUpperCase()}</MetaChip> : null}
                {venueTypeLabel ? <MetaChip>{venueTypeLabel.toUpperCase()}</MetaChip> : null}
                {ratingText ? (
                  <MetaChip>{reviewsText ? `${ratingText} - ${reviewsText}` : ratingText}</MetaChip>
                ) : null}
                {detail.closingSoonText ? <MetaChip>{detail.closingSoonText}</MetaChip> : null}
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/62 sm:text-base">
                Today&apos;s hours, happy hours, and weekly activity are all in one place so people
                can decide fast and head straight out.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                {venue.google_maps_uri ? (
                  <a
                    href={venue.google_maps_uri}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-orange-400/30 bg-orange-500/12 px-4 py-2 text-sm font-medium text-orange-100 hover:bg-orange-500/18"
                  >
                    Open in Maps
                  </a>
                ) : null}
                {venue.booking_url ? (
                  <a
                    href={venue.booking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/15 bg-white/6 px-4 py-2 text-sm text-white hover:bg-white/10"
                  >
                    Book
                  </a>
                ) : null}
                {venue.website_url ? (
                  <a
                    href={venue.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/15 bg-white/6 px-4 py-2 text-sm text-white hover:bg-white/10"
                  >
                    Website
                  </a>
                ) : null}
                {venue.phone ? (
                  <a
                    href={`tel:${venue.phone}`}
                    className="rounded-xl border border-white/15 bg-white/6 px-4 py-2 text-sm text-white hover:bg-white/10"
                  >
                    Call
                  </a>
                ) : null}
                <Link
                  href="/contact"
                  className="rounded-xl border border-white/15 bg-black/25 px-4 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-white"
                >
                  Corrections or partner with us
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                  Right now
                </div>
                <div className="mt-2 text-lg font-semibold text-white">{openStatusText}</div>
                <div className="mt-2 text-sm text-white/55">
                  {detail.openNow
                    ? detail.closingSoonText ?? "Today's hours are shown below."
                    : detail.nextOpeningText ?? 'Check weekly hours below.'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                  Today
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {detail.liveItemsCount} listed today
                </div>
                <div className="mt-2 text-sm text-white/55">
                  {detail.liveItemsCount > 0
                    ? 'Deals and events are grouped further down the page.'
                    : 'No scheduled activity is listed for today yet.'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {detail.openNow ? <StatusPill>Open now</StatusPill> : null}
            {detail.happyHourLive ? <StatusPill>Happy hour live</StatusPill> : null}
            {detail.closingSoonText ? <StatusPill>{detail.closingSoonText}</StatusPill> : null}
            {normalizeBooleanFlag(venue.shows_sport) ? <StatusPill>Sport</StatusPill> : null}
            {normalizeBooleanFlag(venue.byo_allowed) ? <StatusPill>BYO</StatusPill> : null}
            {normalizeBooleanFlag(venue.dog_friendly) ? <StatusPill>Dog friendly</StatusPill> : null}
            {normalizeBooleanFlag(venue.kid_friendly) ? <StatusPill>Kid friendly</StatusPill> : null}
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AtAGlanceCard
            eyebrow="Open status"
            title={openStatusText}
            description={
              detail.openNow
                ? detail.closingSoonText ?? "Today's opening timeline is shown below."
                : detail.nextOpeningText ?? 'Weekly hours are available below.'
            }
          />
          <AtAGlanceCard
            eyebrow="Happy hour today"
            title={
              detail.happyHourLive
                ? 'Live now'
                : detail.todayHappyHourRules.length > 0
                  ? `${detail.todayHappyHourRules.length} listed`
                  : 'Not listed'
            }
            description={
              detail.happyHourLive
                ? 'A deal is live right now.'
                : detail.todayHappyHourStartText
                  ? `Starts ${detail.todayHappyHourStartText}`
                  : 'No happy hour listed.'
            }
          />
          <AtAGlanceCard
            eyebrow="Events today"
            title={
              detail.todayEventRules.length > 0
                ? `${detail.todayEventRules.length} listed`
                : 'None today'
            }
            description={
              detail.todayEventStartText
                ? `Starts ${detail.todayEventStartText}`
                : 'No events listed.'
            }
          />
          <AtAGlanceCard
            eyebrow="This week"
            title={
              detail.weeklyActivityCount > 0
                ? `${detail.weeklyActivityCount} activities`
                : 'No weekly listings'
            }
            description={
              detail.weeklyActivityCount > 0
                ? `Across ${detail.weeklyActivityDays} day${detail.weeklyActivityDays === 1 ? '' : 's'}`
                : 'No published happy hours or events yet.'
            }
          />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="order-2 lg:col-span-7 lg:order-1 xl:col-span-8">
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                Today at this venue
              </div>
              <h2 className="mt-1 text-xl font-semibold text-white">Hours and timing</h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Opening hours, kitchen windows, happy hour timing, and bottle shop trading are
                shown on the same timeline so people can make a quick call.
              </p>
              <TodayHoursSummary
                openingHours={detail.normalizedOpeningHours}
                kitchenHours={detail.effectiveKitchenHours}
                happyHourHours={detail.effectiveHappyHourHours}
                bottleShopHours={detail.effectiveBottleShopHours}
                timezone={detail.timezone}
              />
            </section>

            <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                    Today picks
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-white">Happy hour today</h2>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {detail.happyHourLive
                      ? 'A deal is live right now.'
                      : detail.todayHappyHourStartText
                        ? `First pour starts at ${detail.todayHappyHourStartText}.`
                        : 'No happy hour is listed for today yet.'}
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/65">
                  {detail.todayHappyHourRules.length} venue deal
                  {detail.todayHappyHourRules.length === 1 ? '' : 's'}
                </div>
              </div>

              {detail.todayHappyHourRules.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {detail.todayHappyHourRules.map((rule) => (
                    <PublicHappyHourRuleCard key={rule.id} rule={rule} />
                  ))}
                </div>
              ) : (
                <EmptyDetailState>
                  No happy hour is listed for today yet. Check the weekly timeline below or contact
                  us if something needs correcting.
                </EmptyDetailState>
              )}
            </section>

            <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                    Today picks
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-white">Events today</h2>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {detail.todayEventStartText
                      ? `First listed event starts at ${detail.todayEventStartText}.`
                      : 'No events are listed for today yet.'}
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/65">
                  {detail.todayEventRules.length} event
                  {detail.todayEventRules.length === 1 ? '' : 's'}
                </div>
              </div>

              {detail.todayEventRules.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {detail.todayEventRules.map((rule) => (
                    <PublicEventRuleCard key={rule.id} rule={rule} />
                  ))}
                </div>
              ) : (
                <EmptyDetailState>
                  No events are listed for today yet. The weekly timeline below still shows any
                  published activity across the rest of the week.
                </EmptyDetailState>
              )}
            </section>
          </div>

          <div className="order-1 lg:col-span-5 lg:order-2 xl:col-span-4">
            <div className="sticky top-[140px] space-y-6">
              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                  Venue details
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">At a glance</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <DetailRow label="Suburb" value={venue.suburb ?? 'Not listed'} />
                  <DetailRow label="Type" value={venueTypeLabel ?? 'Not listed'} />
                  <DetailRow
                    label="Rating"
                    value={
                      ratingText
                        ? reviewsText
                          ? `${ratingText} - ${reviewsText}`
                          : ratingText
                        : 'Not listed'
                    }
                  />
                  <DetailRow label="Status" value={openStatusText} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {detail.openNow ? <StatusPill>Open now</StatusPill> : null}
                  {detail.happyHourLive ? <StatusPill>Happy hour live</StatusPill> : null}
                  {normalizeBooleanFlag(venue.shows_sport) ? <StatusPill>Sport</StatusPill> : null}
                  {normalizeBooleanFlag(venue.byo_allowed) ? <StatusPill>BYO</StatusPill> : null}
                  {normalizeBooleanFlag(venue.dog_friendly) ? <StatusPill>Dog friendly</StatusPill> : null}
                  {normalizeBooleanFlag(venue.kid_friendly) ? <StatusPill>Kid friendly</StatusPill> : null}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                  Map view
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">Find this venue</h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Use the venue map for fast directions, then jump out to Google Maps if you need
                  full navigation.
                </p>
                {mappedVenue.length > 0 ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                    <GoogleMap venues={mappedVenue} />
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/65">
                    No map coordinates are available for this venue yet.
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                  Need something changed?
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">Contact First Round</h2>
                <p className="mt-2 text-sm text-white/60">
                  Spot a correction, want to partner with us, or want your own venue access to
                  publish deals and events?
                </p>
                <div className="mt-4">
                  <Link
                    href="/contact"
                    className="inline-flex rounded-xl border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-sm text-orange-100 hover:bg-orange-500/15"
                  >
                    Contact us
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </div>

        <section className="mt-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
              This week
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="mt-1 text-xl font-semibold text-white">Weekly activity</h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Browse the full week to see recurring happy hours, kitchen timing, bottle shop
                  hours, and any published events.
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/65">
                {detail.weeklyActivityCount} published item
                {detail.weeklyActivityCount === 1 ? '' : 's'}
              </div>
            </div>

            <WeeklyTimelineChart
              openingHours={detail.normalizedOpeningHours}
              kitchenHours={detail.effectiveKitchenHours}
              happyHourHours={detail.effectiveHappyHourHours}
              bottleShopHours={detail.effectiveBottleShopHours}
              timezone={detail.timezone}
              renderDayExtras={(dayKey) => {
                const dayHappyHourRules = detail.happyHourRules.filter(
                  (rule) => rule.day_of_week === dayKey
                );
                const dayEventRules = detail.eventRules.filter(
                  (rule) => rule.day_of_week === dayKey
                );

                if (dayHappyHourRules.length === 0 && dayEventRules.length === 0) {
                  return null;
                }

                return (
                  <div className="space-y-2">
                    {dayHappyHourRules.map((rule) => (
                      <PublicHappyHourRuleCard key={rule.id} rule={rule} compact />
                    ))}
                    {dayEventRules.map((rule) => (
                      <PublicEventRuleCard key={rule.id} rule={rule} compact />
                    ))}
                  </div>
                );
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-medium text-white/75">
      {children}
    </span>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
      {children}
    </span>
  );
}

function AtAGlanceCard({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
        {eyebrow}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-white/58">{description}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
      <div className="text-white/45">{label}</div>
      <div className="max-w-[60%] text-right text-white/85">{value}</div>
    </div>
  );
}

function EmptyDetailState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-white/60">
      {children}
    </div>
  );
}
