'use client';

import PublicVenueCard from '@/app/components/PublicVenueCard';
import SaveVenueButton from '@/app/components/SaveVenueButton';
import InstallAppPrompt from '@/app/components/InstallAppPrompt';
import { usePublicUser } from '@/app/components/PublicUserProvider';
import { usePublicVenueCollections } from '@/app/components/usePublicVenueCollections';
import { convertGoogleOpeningHours } from '@/lib/convert-google-hours';
import { isOpenNow, isVenueOpenNow } from '@/lib/opening-hours';
import {
  buildHoursJsonFromRules,
  getCompactSpecialLine,
  getCompactVenueRuleSignal,
  getDisplayHappyHourItems,
  getEffectiveScheduleHours,
  getPublishedDealRules,
  getPublishedRulesByType,
  getPublishedVenueRulesByKind,
  getTodayRulesForType,
  type Venue,
  type VenueScheduleRule,
} from '@/lib/public-venue-discovery';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type SavedFilter =
  | 'all'
  | 'open_now'
  | 'drinks_deals'
  | 'food_deals'
  | 'lunch_specials'
  | 'specials_today'
  | 'kid_friendly_now'
  | 'dog_friendly_now';

type SavedVenueRow = ReturnType<typeof buildSavedVenueRow>;

const SAVED_FILTERS: Array<{ value: SavedFilter; label: string }> = [
  { value: 'all', label: 'All saved' },
  { value: 'open_now', label: 'Open now' },
  { value: 'drinks_deals', label: 'Drinks deals' },
  { value: 'food_deals', label: 'Food deals' },
  { value: 'lunch_specials', label: 'Lunch specials' },
  { value: 'specials_today', label: 'Specials today' },
  { value: 'kid_friendly_now', label: 'Kid friendly now' },
  { value: 'dog_friendly_now', label: 'Dog friendly now' },
];

export default function SavedVenuesPage() {
  const { authLoading, savedVenueIdsSet, savedVenuesLoading, user } = usePublicUser();
  const { venues, loading, error } = usePublicVenueCollections();
  const [activeFilter, setActiveFilter] = useState<SavedFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const savedRows = useMemo(
    () =>
      venues
        .filter((venue) => savedVenueIdsSet.has(venue.id))
        .map((venue) => buildSavedVenueRow(venue))
        .filter((row) => matchesSavedFilter(row, activeFilter))
        .filter((row) => matchesSearch(row, searchTerm))
        .sort((a, b) => {
          if (a.openNow !== b.openNow) return a.openNow ? -1 : 1;
          if (a.liveSpecialRule && !b.liveSpecialRule) return -1;
          if (!a.liveSpecialRule && b.liveSpecialRule) return 1;
          return (a.venue.name ?? '').localeCompare(b.venue.name ?? '');
        }),
    [activeFilter, savedVenueIdsSet, searchTerm, venues]
  );

  const hasActiveFilters = activeFilter !== 'all' || searchTerm.trim().length > 0;

  if (authLoading || loading || savedVenuesLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-3 py-3.5 sm:px-6 sm:py-8">
          <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5 text-white/70">
            Loading saved venues...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-3xl px-3 py-3.5 sm:px-6 sm:py-8">
          <section className="rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,128,32,0.16),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:rounded-3xl sm:p-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
              Saved venues
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Keep a shortlist for later
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68 sm:text-base">
              Sign in or create a First Round account to save venues, come back to them later,
              and run the same filters across just your shortlist.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                href="/login?next=%2Fsaved"
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400"
              >
                Log in or sign up
              </Link>
              <Link
                href="/venues"
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/[0.08] hover:text-white"
              >
                Explore venues
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-3 py-3.5 sm:px-6 sm:py-8">
        <section className="rounded-[1.4rem] border border-white/9 bg-gradient-to-br from-orange-500/14 via-[#120805] to-black p-3.5 sm:rounded-3xl sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            Saved
          </div>
          <div className="mt-2 flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-[24px] font-semibold tracking-tight sm:text-4xl">
                Your saved venues
              </h1>
              <p className="mt-1.5 text-[13px] leading-5 text-white/70 sm:text-base">
                Keep the shortlist tidy, then filter it down to where you want to go right now.
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-black/22 px-3 py-1.5 text-xs text-white/65">
              {savedVenueIdsSet.size} saved venue{savedVenueIdsSet.size === 1 ? '' : 's'}
            </div>
          </div>
        </section>

        <div className="mt-3.5 sm:mt-5">
          <InstallAppPrompt />
        </div>

        <section className="mt-3.5 rounded-[1.4rem] border border-white/7 bg-white/[0.025] p-3 sm:mt-5 sm:rounded-3xl sm:border-white/10 sm:bg-white/5 sm:p-4">
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1.2fr)_auto] md:items-center md:gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search saved venue, suburb, or reason to go"
                className="h-10 w-full rounded-[1rem] border border-white/8 bg-black/28 px-3.5 pr-20 text-[13px] text-white placeholder:text-white/36 sm:h-11 sm:rounded-2xl sm:border-white/10 sm:px-4 sm:pr-24 sm:text-sm"
              />
              {searchTerm.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/62 hover:bg-white/10 hover:text-white sm:border-white/10 sm:px-3 sm:text-[11px]"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/55">
              Filtering only within your saved list
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {SAVED_FILTERS.map((filter) => {
              const active = filter.value === activeFilter;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                  className={[
                    'rounded-full border px-2.5 py-1 text-[12px] transition sm:px-3 sm:py-1.25 sm:text-[13px]',
                    active
                      ? 'border-orange-400/40 bg-orange-500/14 text-orange-50'
                      : 'border-white/7 bg-black/18 text-white/60 hover:bg-white/8 hover:text-white',
                  ].join(' ')}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          {hasActiveFilters ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Applied
              </span>
              {searchTerm.trim() ? (
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/74">
                  Search: &quot;{searchTerm.trim()}&quot;
                </span>
              ) : null}
              {activeFilter !== 'all' ? (
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/74">
                  {SAVED_FILTERS.find((filter) => filter.value === activeFilter)?.label}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('all');
                  setSearchTerm('');
                }}
                className="text-sm text-orange-200 underline underline-offset-4 hover:text-white"
              >
                Reset filters
              </button>
            </div>
          ) : null}
        </section>

        <section className="mt-5">
          {error ? (
            <div className="rounded-3xl border border-red-500/30 bg-red-950/30 p-5 text-red-100">
              {error}
            </div>
          ) : null}

          {!error && savedVenueIdsSet.size === 0 ? (
            <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5 text-white/72">
              <div className="text-lg font-semibold text-white">No saved venues yet</div>
              <div className="mt-2 text-white/62">
                Save a few venues from discovery cards or any venue page, then come back here to
                narrow them down.
              </div>
              <Link
                href="/venues"
                className="mt-4 inline-flex min-h-[36px] items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] px-3.5 py-2 text-sm text-white/82 transition hover:border-white/18 hover:bg-white/[0.08] hover:text-white"
              >
                Explore venues
              </Link>
            </div>
          ) : null}

          {!error && savedVenueIdsSet.size > 0 && savedRows.length === 0 ? (
            <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5 text-white/72">
              <div>No saved venues match this filter right now.</div>
              <div className="mt-2 text-white/62">
                Try another filter or reset to your full saved list.
              </div>
            </div>
          ) : null}

          {!error && savedRows.length > 0 ? (
            <div className="mb-3 px-1 text-sm text-white/64 sm:mb-4 sm:rounded-2xl sm:border sm:border-white/10 sm:bg-white/[0.03] sm:px-4 sm:py-3">
              Showing {savedRows.length} saved venue{savedRows.length === 1 ? '' : 's'}
              {searchTerm.trim() ? ` for "${searchTerm.trim()}"` : ''}
            </div>
          ) : null}

          <div className="grid gap-3">
            {savedRows.map((row) => (
              <PublicVenueCard
                key={row.venue.id}
                venue={row.venue}
                eyebrow={row.eyebrow}
                compact
                tone={row.liveSpecialRule || row.liveHappyHourRule ? 'live' : 'today'}
                heroBadge={<SavedStatusPill text={row.openNow ? 'Open' : 'Saved'} />}
                summary={row.summary}
                details={row.details}
                secondaryFooterAction={<SaveVenueButton venueId={row.venue.id} variant="card" />}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function buildSavedVenueRow(venue: Venue) {
  const timezone = venue.timezone || 'Australia/Sydney';
  const openingHours = convertGoogleOpeningHours(venue.opening_hours);
  const bottleShopHours = getEffectiveScheduleHours(venue, 'bottle_shop');
  const primaryHours = openingHours ?? bottleShopHours ?? null;
  const happyHourRules = getTodayRulesForType(getPublishedRulesByType(venue, 'happy_hour'), timezone);
  const specialRules = getTodayRulesForType(getPublishedDealRules(venue), timezone);
  const kidRules = getTodayRulesForType(getPublishedVenueRulesByKind(venue, 'kid'), timezone);
  const dogRules = getTodayRulesForType(getPublishedVenueRulesByKind(venue, 'dog'), timezone);

  const liveHappyHourRule = happyHourRules.find((rule) => isRuleLiveNow(rule, timezone)) ?? null;
  const liveSpecialRule = specialRules.find((rule) => isRuleLiveNow(rule, timezone)) ?? null;
  const liveKidRule = kidRules.find((rule) => isRuleLiveNow(rule, timezone)) ?? null;
  const liveDogRule = dogRules.find((rule) => isRuleLiveNow(rule, timezone)) ?? null;
  const firstSpecialRule = liveSpecialRule ?? specialRules[0] ?? null;
  const openNow = isVenueOpenNow(primaryHours, timezone, venue.is_temporarily_closed ?? false);
  const hasFoodHappyHour = happyHourRules.some(
    (rule) => getDisplayHappyHourItems(rule.detail_json, 'food').length > 0
  );
  const lunchSpecialRule =
    specialRules.find((rule) => rule.schedule_type === 'lunch_special') ?? null;

  const supportiveSignals = [liveKidRule, liveDogRule]
    .map((rule) => (rule ? getCompactVenueRuleSignal(rule) : null))
    .filter(Boolean)
    .slice(0, 2);

  const summary =
    firstSpecialRule
      ? getCompactSpecialLine(firstSpecialRule)
      : liveHappyHourRule
        ? 'Happy hour now'
        : openNow
          ? 'Open now'
          : 'Saved for later';

  const detailParts = [
    openNow ? 'Open now' : 'Check hours',
    liveHappyHourRule ? 'Drinks deals now' : null,
    supportiveSignals.join(' | ') || null,
  ].filter(Boolean);

  const eyebrow =
    lunchSpecialRule != null
      ? '☀ LUNCH'
      : firstSpecialRule != null
        ? '🔥 SPECIAL'
        : liveHappyHourRule != null
          ? '🍻 HAPPY HOUR'
          : 'SAVED VENUE';

  return {
    venue,
    openNow,
    liveHappyHourRule,
    liveSpecialRule,
    todaySpecialRules: specialRules,
    hasLunchSpecials: lunchSpecialRule != null,
    hasSpecialsToday: specialRules.length > 0,
    hasDrinksDeals: liveHappyHourRule != null,
    hasFoodDeals: liveSpecialRule != null || hasFoodHappyHour,
    liveKidRule,
    liveDogRule,
    eyebrow,
    summary,
    details: detailParts.join(' | '),
    searchableText: [
      venue.name,
      venue.suburb,
      venue.address,
      summary,
      ...specialRules.map((rule) => getCompactSpecialLine(rule)),
      ...supportiveSignals,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
}

function matchesSavedFilter(row: SavedVenueRow, filter: SavedFilter) {
  if (filter === 'all') return true;
  if (filter === 'open_now') return row.openNow;
  if (filter === 'drinks_deals') return row.hasDrinksDeals;
  if (filter === 'food_deals') return row.hasFoodDeals;
  if (filter === 'lunch_specials') return row.hasLunchSpecials;
  if (filter === 'specials_today') return row.hasSpecialsToday;
  if (filter === 'kid_friendly_now') return Boolean(row.liveKidRule);
  if (filter === 'dog_friendly_now') return Boolean(row.liveDogRule);
  return true;
}

function matchesSearch(row: SavedVenueRow, searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;
  return row.searchableText.includes(normalized);
}

function isRuleLiveNow(rule: VenueScheduleRule, timezone: string) {
  return isOpenNow(buildHoursJsonFromRules([rule]), timezone);
}

function SavedStatusPill({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-0.75 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/82">
      {text}
    </span>
  );
}
