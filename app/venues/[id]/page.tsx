'use client';

import GoogleMap from '@/app/components/GoogleMap';
import PublicEventRuleCard from '@/app/components/PublicEventRuleCard';
import PublicHappyHourRuleCard from '@/app/components/PublicHappyHourRuleCard';
import SaveVenueButton from '@/app/components/SaveVenueButton';
import TodayHoursSummary from '@/app/components/TodayHoursSummary';
import WeeklyTimelineChart from '@/app/components/WeeklyTimelineChart';
import { convertGoogleOpeningHours } from '@/lib/convert-google-hours';
import {
  formatTimeForUi,
  getClosingSoonText,
  getNextOpeningText,
  getTodayHoursText,
  isOpenNow,
  isVenueOpenNow,
} from '@/lib/opening-hours';
import {
  HAPPY_HOUR_CATEGORIES,
  getCompactSpecialLine,
  getCompactVenueRuleSignal,
  getDisplayHappyHourItems,
  getPublishedDealRules,
  getEffectiveScheduleHours,
  getPublishedEventRules,
  getPublishedRulesByType,
  getPublishedVenueRulesByKind,
  getTodayRulesForType,
  getVenueTypeLabel,
  isLiveInnerWestSuburb,
  normalizeBooleanFlag,
  type Venue,
  type VenueScheduleRule,
} from '@/lib/public-venue-discovery';
import { normalizeInstagramUrl } from '@/lib/social-links';
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

function clockToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function getCurrentTimeMinutes(timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  });
  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function isRuleLiveNow(rule: VenueScheduleRule, timezone: string) {
  const currentMinutes = getCurrentTimeMinutes(timezone);
  const startMinutes = clockToMinutes(rule.start_time);
  const endMinutes = clockToMinutes(rule.end_time);

  if (endMinutes === startMinutes) return false;
  if (endMinutes < startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

function getRuleTimingSummary(rule: VenueScheduleRule, timezone: string) {
  const start = formatTimeForUi(rule.start_time.slice(0, 5));
  const end = formatTimeForUi(rule.end_time.slice(0, 5));
  return isRuleLiveNow(rule, timezone) ? `Live now until ${end}` : `Starts ${start}`;
}

function minutesUntil(targetMinutes: number, timezone: string) {
  const now = getCurrentTimeMinutes(timezone);
  const delta = targetMinutes - now;
  return delta >= 0 ? delta : delta + 24 * 60;
}

function getEventTypeLabel(rule: VenueScheduleRule) {
  if (rule.schedule_type === 'trivia') return 'Trivia';
  if (rule.schedule_type === 'live_music') return 'Live Music';
  if (rule.schedule_type === 'comedy') return 'Comedy';
  if (rule.schedule_type === 'karaoke') return 'Karaoke';
  if (rule.schedule_type === 'sport') return 'Sport';
  if (rule.schedule_type === 'dj') return 'DJ';
  if (rule.schedule_type === 'special_event') return 'Special Event';
  return 'Event';
}

function getHappyHourCategorySummary(rule: VenueScheduleRule) {
  const categories = HAPPY_HOUR_CATEGORIES.filter((category) =>
    getDisplayHappyHourItems(rule.detail_json, category.key).length > 0
  ).map((category) => category.label.replace(/^[^\s]+\s/, ''));

  return categories.slice(0, 3).join(' • ');
}

function getHappyHourReason(rule: VenueScheduleRule) {
  return (
    getHappyHourCategorySummaryClean(rule) ||
    rule.deal_text?.trim() ||
    rule.description?.trim() ||
    (typeof rule.detail_json?.notes === 'string' ? rule.detail_json.notes.trim() : '') ||
    rule.notes?.trim() ||
    'Happy Hour'
  );
}

function getEventReason(rule: VenueScheduleRule) {
  return (
    rule.title?.trim() ||
    rule.deal_text?.trim() ||
    rule.description?.trim() ||
    rule.notes?.trim() ||
    getEventTypeLabel(rule)
  );
}

function getHappyHourCategorySummaryClean(rule: VenueScheduleRule) {
  const categories = HAPPY_HOUR_CATEGORIES.filter((category) =>
    getDisplayHappyHourItems(rule.detail_json, category.key).length > 0
  ).map((category) => category.label.replace(/^[^\s]+\s/, ''));

  return categories.slice(0, 3).join(' | ');
}

function buildVenueProfileNotes(
  venue: Venue,
  liveKidRule: VenueScheduleRule | null,
  liveDogRule: VenueScheduleRule | null
) {
  const notes: Array<{ label: string; value: string }> = [];

  const sportParts = [
    venue.sport_types?.trim() || null,
    venue.sport_notes?.trim() || null,
  ].filter(Boolean) as string[];
  if (sportParts.length > 0) {
    notes.push({
      label: 'Sport',
      value: sportParts.join(' | '),
    });
  }

  const dogNote = venue.dog_friendly_notes?.trim() || null;
  if (dogNote) {
    notes.push({
      label: 'Dogs',
      value: dogNote,
    });
  } else if (normalizeBooleanFlag(venue.dog_friendly) && !liveDogRule) {
    notes.push({
      label: 'Dogs',
      value: 'Dog friendly',
    });
  }

  const kidNote = venue.kid_friendly_notes?.trim() || null;
  if (kidNote) {
    notes.push({
      label: 'Kids',
      value: kidNote,
    });
  } else if (normalizeBooleanFlag(venue.kid_friendly) && !liveKidRule) {
    notes.push({
      label: 'Kids',
      value: 'Kid friendly',
    });
  }

  return notes;
}

export default function PublicVenueDetailPage() {
  const params = useParams<{ id: string }>();
  const venueId = Array.isArray(params?.id) ? params.id[0] : params?.id;

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

      const response = await fetch(`/api/public-venues?venueId=${encodeURIComponent(venueId)}`, {
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
        setVenue(null);
        setError(payload.error ?? 'Unable to load this venue.');
      } else if (!payload.data) {
        setVenue(null);
        setError('Venue not found.');
      } else {
        const venueRow = Array.isArray(payload.data) ? payload.data[0] ?? null : payload.data;

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
  }, [venueId]);

  const detail = useMemo(() => {
    if (!venue) return null;

    const timezone = venue.timezone ?? 'Australia/Sydney';
    const normalizedOpeningHours = convertGoogleOpeningHours(venue.opening_hours);
    const effectiveKitchenHours = getEffectiveScheduleHours(venue, 'kitchen');
    const effectiveHappyHourHours = getEffectiveScheduleHours(venue, 'happy_hour');
    const effectiveBottleShopHours = getEffectiveScheduleHours(venue, 'bottle_shop');
    const primaryHours = normalizedOpeningHours ?? effectiveBottleShopHours ?? null;
    const specialRules = getPublishedDealRules(venue);
    const happyHourRules = getPublishedRulesByType(venue, 'happy_hour');
    const eventRules = getPublishedEventRules(venue);
    const kidRules = getPublishedVenueRulesByKind(venue, 'kid');
    const dogRules = getPublishedVenueRulesByKind(venue, 'dog');
    const todaySpecialRules = getTodayRulesForType(specialRules, timezone);
    const todayHappyHourRules = getTodayRulesForType(happyHourRules, timezone);
    const todayEventRules = getTodayRulesForType(eventRules, timezone);
    const todayKidRules = getTodayRulesForType(kidRules, timezone);
    const todayDogRules = getTodayRulesForType(dogRules, timezone);
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
      specialRules,
      happyHourRules,
      eventRules,
      kidRules,
      dogRules,
      todaySpecialRules,
      todayHappyHourRules,
      todayEventRules,
      todayKidRules,
      todayDogRules,
      openNow,
      happyHourLive,
      closingSoonText,
      nextOpeningText,
      todayHappyHourStartText: getFirstRuleStartText(todayHappyHourRules),
      todayEventStartText: getFirstRuleStartText(todayEventRules),
      weeklyActivityCount:
        specialRules.length +
        happyHourRules.length +
        eventRules.length +
        kidRules.length +
        dogRules.length,
      weeklyActivityDays: getActiveDayCount([
        ...specialRules,
        ...happyHourRules,
        ...eventRules,
        ...kidRules,
        ...dogRules,
      ]),
      liveItemsCount:
        todaySpecialRules.length + todayHappyHourRules.length + todayEventRules.length,
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
  const instagramHref = normalizeInstagramUrl(venue.instagram_url);
  const liveHappyHourRule =
    detail.todayHappyHourRules.find((rule) => isRuleLiveNow(rule, detail.timezone)) ?? null;
  const liveSpecialRule =
    detail.todaySpecialRules.find((rule) => isRuleLiveNow(rule, detail.timezone)) ?? null;
  const liveEventRule =
    detail.todayEventRules.find((rule) => isRuleLiveNow(rule, detail.timezone)) ?? null;
  const liveKidRule =
    detail.todayKidRules.find((rule) => isRuleLiveNow(rule, detail.timezone)) ?? null;
  const liveDogRule =
    detail.todayDogRules.find((rule) => isRuleLiveNow(rule, detail.timezone)) ?? null;
  const featuredSpecialRule = liveSpecialRule ?? detail.todaySpecialRules[0] ?? null;
  const featuredHappyHourRule = liveHappyHourRule ?? detail.todayHappyHourRules[0] ?? null;
  const featuredEventRule = liveEventRule ?? detail.todayEventRules[0] ?? null;
  const featuredReasonLabel = liveSpecialRule
    ? 'Special live'
    : liveHappyHourRule
    ? 'Happy hour live'
    : liveEventRule
      ? 'Event live'
      : featuredHappyHourRule
        ? 'Happy hour today'
        : featuredEventRule
          ? 'Event today'
          : 'Today';
  const featuredReasonTitle = liveSpecialRule
    ? getCompactSpecialLine(liveSpecialRule)
    : liveHappyHourRule
    ? getHappyHourReason(liveHappyHourRule)
    : liveEventRule
      ? getEventReason(liveEventRule)
      : featuredHappyHourRule
        ? getHappyHourReason(featuredHappyHourRule)
        : featuredEventRule
          ? getEventReason(featuredEventRule)
          : openStatusText;
  const featuredReasonTiming = liveSpecialRule
    ? getRuleTimingSummary(liveSpecialRule, detail.timezone)
    : liveHappyHourRule
    ? getRuleTimingSummary(liveHappyHourRule, detail.timezone)
    : liveEventRule
      ? getRuleTimingSummary(liveEventRule, detail.timezone)
      : featuredHappyHourRule
        ? getRuleTimingSummary(featuredHappyHourRule, detail.timezone)
        : featuredEventRule
          ? getRuleTimingSummary(featuredEventRule, detail.timezone)
          : detail.openNow
            ? detail.closingSoonText ?? "Open now"
            : detail.nextOpeningText ?? 'Check the hours below';
  const urgencyLabel = (() => {
    const liveRule = liveSpecialRule ?? liveHappyHourRule ?? liveEventRule;
    if (liveRule && minutesUntil(clockToMinutes(liveRule.end_time), detail.timezone) <= 30) {
      return 'Ends soon';
    }

    const upcomingRule = liveRule ? null : featuredSpecialRule ?? featuredHappyHourRule ?? featuredEventRule;
    if (
      upcomingRule &&
      !isRuleLiveNow(upcomingRule, detail.timezone) &&
      minutesUntil(clockToMinutes(upcomingRule.start_time), detail.timezone) <= 30
    ) {
      return 'Starts soon';
    }

    const closingSoonWithin30 = getClosingSoonText(
      detail.normalizedOpeningHours ?? detail.effectiveBottleShopHours ?? null,
      detail.timezone,
      venue.is_temporarily_closed ?? false,
      30
    );
    return closingSoonWithin30 ? 'Closing soon' : null;
  })();
  const specialSummary = featuredSpecialRule
    ? getCompactSpecialLine(featuredSpecialRule)
    : 'No specials listed today';
  const specialTiming = featuredSpecialRule
    ? getRuleTimingSummary(featuredSpecialRule, detail.timezone)
    : 'Full weekly detail is further down';
  const happyHourSummary = featuredHappyHourRule
    ? getHappyHourReason(featuredHappyHourRule)
    : 'No happy hour listed today';
  const happyHourTiming = featuredHappyHourRule
    ? getRuleTimingSummary(featuredHappyHourRule, detail.timezone)
    : 'Full weekly detail is further down';
  const eventSummary = featuredEventRule ? getEventReason(featuredEventRule) : 'No events listed today';
  const eventTiming = featuredEventRule
    ? getRuleTimingSummary(featuredEventRule, detail.timezone)
    : 'Check the weekly activity section below';
  const openingTodayText = getTodayHoursText(detail.normalizedOpeningHours, detail.timezone, {
    emptyLabel: 'Closed today',
  });
  const kitchenTodayText = getTodayHoursText(detail.effectiveKitchenHours, detail.timezone, {
    emptyLabel: 'Not listed today',
  });
  const venueRuleSignals = [liveKidRule, liveDogRule]
    .map((rule) => (rule ? getCompactVenueRuleSignal(rule) : null))
    .filter(Boolean)
    .slice(0, 2);
  const venueProfileNotes = buildVenueProfileNotes(venue, liveKidRule, liveDogRule);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-3 py-3.5 sm:px-6 sm:py-8">
        <section className="rounded-[1.6rem] border border-white/9 bg-[radial-gradient(circle_at_top,rgba(255,128,32,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-3.5 shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:rounded-3xl sm:p-7">
          <div className="flex flex-wrap items-center gap-2.5 text-[12px] text-white/64 sm:text-sm">
            <Link href={backHref} className="hover:text-white">
              Back to venues
            </Link>
            <span className="text-white/25">/</span>
            <span>{venue.suburb ?? 'Venue'}</span>
          </div>

          <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)] xl:items-start">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-300/80">
                {venueTypeLabel ?? 'Venue'}
              </div>
              <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-white sm:mt-3 sm:text-5xl">
                {venue.name ?? 'Untitled venue'}
              </h1>
              {venue.address ? (
                <div className="mt-2 max-w-2xl text-[13px] leading-5 text-white/70 sm:mt-3 sm:text-base sm:leading-6">
                  {venue.address}
                </div>
              ) : null}

              <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] sm:mt-4 sm:gap-2 sm:text-sm">
                {venue.suburb ? <MetaChip>{venue.suburb.toUpperCase()}</MetaChip> : null}
                {venueTypeLabel ? <MetaChip>{venueTypeLabel.toUpperCase()}</MetaChip> : null}
              </div>

              <section className="mt-3 rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-3 sm:mt-4 sm:rounded-[1.5rem] sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/74">
                      Why go now
                    </div>
                    <h2 className="mt-1 line-clamp-2 text-[19px] font-semibold leading-6 text-white sm:text-[22px] sm:leading-7">
                      {featuredReasonTitle}
                    </h2>
                    <div className="mt-1 text-[12px] leading-5 text-white/72 sm:text-sm">
                      {featuredReasonTiming}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {urgencyLabel ? <StatusPill>{urgencyLabel}</StatusPill> : null}
                    <StatusPill>{featuredReasonLabel}</StatusPill>
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  <CompactNowRow
                    label="Current status"
                    title={openStatusText}
                    detail={
                      detail.openNow
                        ? detail.closingSoonText ?? 'Open now'
                        : detail.nextOpeningText ?? 'Check today’s hours below.'
                    }
                  />
                  <CompactNowRow
                    label="Specials"
                    title={specialSummary}
                    detail={specialTiming}
                  />
                  <CompactNowRow
                    label="Happy hour / specials"
                    title={happyHourSummary}
                    detail={happyHourTiming}
                  />
                  {venueRuleSignals.length > 0 ? (
                    <CompactNowRow
                      label="Venue rules"
                      title={venueRuleSignals.join(' | ')}
                      detail="Active right now"
                    />
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <CompactNowRow
                      label="Opening hours"
                      title={openingTodayText ?? 'Closed today'}
                      detail="Today"
                    />
                    <CompactNowRow
                      label="Kitchen hours"
                      title={kitchenTodayText ?? 'Not listed today'}
                      detail="Today"
                    />
                  </div>
                  {featuredEventRule ? (
                    <CompactNowRow
                      label="Today"
                      title={eventSummary}
                      detail={eventTiming}
                    />
                  ) : null}
                </div>
              </section>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:flex-wrap sm:gap-2">
                <div className="col-span-2 sm:col-span-1">
                  <SaveVenueButton venueId={venue.id} variant="detail" />
                </div>
                {venue.google_maps_uri ? (
                  <a
                    href={venue.google_maps_uri}
                    target="_blank"
                    rel="noreferrer"
                    className="col-span-2 inline-flex min-h-[36px] items-center justify-center rounded-xl border border-white/12 bg-white/[0.055] px-3 py-1.5 text-[13px] font-medium text-white/88 transition hover:border-white/18 hover:bg-white/[0.09] hover:text-white sm:col-span-1"
                  >
                    Open in Maps
                  </a>
                ) : null}
                {venue.booking_url ? (
                  <a
                    href={venue.booking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[36px] items-center justify-center rounded-xl border border-white/10 bg-transparent px-3 py-1.5 text-[13px] text-white/74 transition hover:border-white/16 hover:bg-white/[0.06] hover:text-white"
                  >
                    Book
                  </a>
                ) : null}
                {venue.website_url ? (
                  <a
                    href={venue.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[36px] items-center justify-center rounded-xl border border-white/10 bg-transparent px-3 py-1.5 text-[13px] text-white/74 transition hover:border-white/16 hover:bg-white/[0.06] hover:text-white"
                  >
                    Website
                  </a>
                ) : null}
                {instagramHref ? (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[36px] items-center justify-center rounded-xl border border-white/10 bg-transparent px-3 py-1.5 text-[13px] text-white/74 transition hover:border-white/16 hover:bg-white/[0.06] hover:text-white"
                  >
                    Instagram
                  </a>
                ) : null}
                {venue.phone ? (
                  <a
                    href={`tel:${venue.phone}`}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-xl border border-white/10 bg-transparent px-3 py-1.5 text-[13px] text-white/74 transition hover:border-white/16 hover:bg-white/[0.06] hover:text-white"
                  >
                    Call
                  </a>
                ) : null}
                <Link
                  href="/contact"
                  className="col-span-2 inline-flex min-h-[36px] items-center justify-center rounded-xl border border-white/10 bg-transparent px-3 py-1.5 text-[13px] text-white/72 transition hover:border-white/16 hover:bg-white/[0.06] hover:text-white sm:col-span-1"
                >
                  Corrections or partner with us
                </Link>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/9 bg-black/28 p-3.5 sm:p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                  This week
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {detail.weeklyActivityCount > 0
                    ? `${detail.weeklyActivityCount} activities`
                    : 'No weekly listings'}
                </div>
                <div className="mt-2 text-sm text-white/62">
                  {detail.weeklyActivityCount > 0
                    ? `Across ${detail.weeklyActivityDays} day${detail.weeklyActivityDays === 1 ? '' : 's'}`
                    : 'No published happy hours or events yet.'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-12">
          <div className="order-1 lg:col-span-7 xl:col-span-8">
            <section className="mb-5 rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-4 sm:rounded-3xl sm:p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                Today
              </div>
              <h2 className="mt-1 text-xl font-semibold text-white">Opening and kitchen hours</h2>
              <p className="mt-2 text-sm leading-6 text-white/66">
                Today&apos;s opening, kitchen, happy hour, and bottle shop hours.
              </p>
              <TodayHoursSummary
                openingHours={detail.normalizedOpeningHours}
                kitchenHours={detail.effectiveKitchenHours}
                happyHourHours={detail.effectiveHappyHourHours}
                bottleShopHours={detail.effectiveBottleShopHours}
                timezone={detail.timezone}
              />
            </section>
            <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-4 sm:rounded-3xl sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                    Today picks
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-white">Specials today</h2>
                  <p className="mt-2 text-sm leading-6 text-white/66">
                    {detail.todaySpecialRules.length > 0
                      ? 'Daily and lunch specials worth knowing before you head out.'
                      : 'No daily or lunch specials are listed for today yet.'}
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/65">
                  {detail.todaySpecialRules.length} special
                  {detail.todaySpecialRules.length === 1 ? '' : 's'}
                </div>
              </div>

              {detail.todaySpecialRules.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {detail.todaySpecialRules.map((rule) => (
                    <CompactNowRow
                      key={rule.id}
                      label={rule.schedule_type === 'lunch_special' ? 'Lunch special' : 'Daily special'}
                      title={getCompactSpecialLine(rule)}
                      detail={getRuleTimingSummary(rule, detail.timezone)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyDetailState>
                  No daily or lunch specials are listed for today yet. Weekly detail below still
                  shows any published specials across the rest of the week.
                </EmptyDetailState>
              )}
            </section>
            <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-4 sm:rounded-3xl sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                    Today picks
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-white">Happy hour today</h2>
                  <p className="mt-2 text-sm leading-6 text-white/66">
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

            <section className="mt-5 rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-4 sm:mt-6 sm:rounded-3xl sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                    Today picks
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-white">Events today</h2>
                  <p className="mt-2 text-sm leading-6 text-white/66">
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

          <div className="order-2 lg:col-span-5 xl:col-span-4">
            <div className="sticky top-[108px] space-y-5">
              <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-4 sm:rounded-3xl sm:p-5">
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
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {normalizeBooleanFlag(venue.shows_sport) ? <StatusPill>Sport</StatusPill> : null}
                  {normalizeBooleanFlag(venue.byo_allowed) ? <StatusPill>BYO</StatusPill> : null}
                  {venueRuleSignals.map((signal) => (
                    <StatusPill key={signal}>{signal}</StatusPill>
                  ))}
                </div>
                {venueProfileNotes.length > 0 ? (
                  <div className="mt-4 space-y-3 text-sm">
                    {venueProfileNotes.map((note) => (
                      <DetailRow key={`${note.label}-${note.value}`} label={note.label} value={note.value} />
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-4 sm:rounded-3xl sm:p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                  Map view
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">Find this venue</h2>
                <p className="mt-2 text-sm leading-6 text-white/66">
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

              <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-4 sm:rounded-3xl sm:p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                  Need something changed?
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">Contact First Round</h2>
                <p className="mt-2 text-sm text-white/66">
                  Spot a correction, want to partner with us, or want your own venue access to
                  publish deals and events?
                </p>
                <div className="mt-4">
                  <Link
                    href="/contact"
                    className="inline-flex min-h-[36px] rounded-xl border border-white/12 bg-white/[0.05] px-3.5 py-2 text-sm text-white/82 transition hover:border-white/18 hover:bg-white/[0.08] hover:text-white"
                  >
                    Contact us
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </div>

        <section className="mt-5">
          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-4 sm:rounded-3xl sm:p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
              This week
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="mt-1 text-xl font-semibold text-white">Weekly activity</h2>
                <p className="mt-2 text-sm leading-6 text-white/66">
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
                const daySpecialRules = detail.specialRules.filter((rule) => rule.day_of_week === dayKey);
                const dayHappyHourRules = detail.happyHourRules.filter(
                  (rule) => rule.day_of_week === dayKey
                );
                const dayEventRules = detail.eventRules.filter(
                  (rule) => rule.day_of_week === dayKey
                );

                if (daySpecialRules.length === 0 && dayHappyHourRules.length === 0 && dayEventRules.length === 0) {
                  return null;
                }

                return (
                  <div className="space-y-2">
                    {daySpecialRules.map((rule) => (
                      <CompactNowRow
                        key={rule.id}
                        label={rule.schedule_type === 'lunch_special' ? 'Lunch special' : 'Daily special'}
                        title={getCompactSpecialLine(rule)}
                        detail={`${formatTimeForUi(rule.start_time.slice(0, 5))} - ${formatTimeForUi(rule.end_time.slice(0, 5))}`}
                      />
                    ))}
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
    <span className="inline-flex items-center rounded-full border border-white/10 bg-black/22 px-2.5 py-0.75 text-[11px] font-medium text-white/72 sm:px-3 sm:py-1 sm:text-xs">
      {children}
    </span>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-0.75 text-[11px] text-white/76 sm:px-3 sm:py-1 sm:text-xs">
      {children}
    </span>
  );
}

function CompactNowRow({
  label,
  title,
  detail,
}: {
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.05rem] border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-semibold leading-5 text-white sm:text-base">{title}</div>
      <div className="mt-1 text-[12px] leading-5 text-white/68 sm:text-sm">{detail}</div>
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
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
      <div className="text-[12px] text-white/45 sm:text-sm">{label}</div>
      <div className="max-w-[60%] text-right text-[12px] text-white/85 sm:text-sm">{value}</div>
    </div>
  );
}

function EmptyDetailState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-white/66">
      {children}
    </div>
  );
}
