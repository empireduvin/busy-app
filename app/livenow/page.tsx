'use client';

import GoogleMap from '@/app/components/GoogleMap';
import PublicVenueCard from '@/app/components/PublicVenueCard';
import SaveVenueButton from '@/app/components/SaveVenueButton';
import { usePublicVenueCollections } from '@/app/components/usePublicVenueCollections';
import { formatTimeForUi, isOpenNow } from '@/lib/opening-hours';
import {
  HAPPY_HOUR_CATEGORIES,
  buildHoursJsonFromRules,
  getCompactSpecialLine,
  getCompactVenueRuleSignal,
  getPublishedDealRules,
  getDisplayHappyHourItems,
  getPublishedEventRules,
  getPublishedRulesByType,
  getPublishedVenueRulesByKind,
  getTodayRulesForType,
  hasText,
  type Venue,
  type VenueScheduleRule,
} from '@/lib/public-venue-discovery';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

type LiveNowFilter =
  | 'all'
  | 'happy_hour'
  | 'food_deals_now'
  | 'lunch_specials'
  | 'kid_friendly_now'
  | 'dog_friendly_now'
  | 'events'
  | 'trivia'
  | 'live_music'
  | 'comedy'
  | 'ends_soon';

type TimeFilter = 'any' | 'afternoon' | 'evening' | 'late_night';
type SectionKind = 'happy_hour' | 'events' | 'mixed';
type LiveNowRow = ReturnType<typeof buildLiveNowRow>;

const LIVE_NOW_FILTERS: Array<{ value: LiveNowFilter; label: string }> = [
  { value: 'all', label: 'All live' },
  { value: 'happy_hour', label: 'Happy hour now' },
  { value: 'food_deals_now', label: 'Food deals now' },
  { value: 'lunch_specials', label: 'Lunch specials' },
  { value: 'kid_friendly_now', label: 'Kid friendly now' },
  { value: 'dog_friendly_now', label: 'Dog friendly now' },
  { value: 'events', label: 'Live events' },
  { value: 'trivia', label: 'Trivia live' },
  { value: 'live_music', label: 'Live music now' },
  { value: 'comedy', label: 'Comedy live' },
  { value: 'ends_soon', label: 'Ending soon' },
];

const TIME_FILTERS: Array<{ value: TimeFilter; label: string }> = [
  { value: 'any', label: 'Any live time' },
  { value: 'afternoon', label: '12pm-5pm' },
  { value: 'evening', label: '5pm-8pm' },
  { value: 'late_night', label: 'After 8pm' },
];

export default function LiveNowPage() {
  const { liveVenues, loading, error } = usePublicVenueCollections();
  const [activeFilter, setActiveFilter] = useState<LiveNowFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('any');
  const [searchTerm, setSearchTerm] = useState('');
  const [showMap, setShowMap] = useState(false);
  const mapSectionRef = useRef<HTMLElement | null>(null);

  const liveRows = useMemo(() => {
    return liveVenues
      .map((venue) => buildLiveNowRow(venue))
      .filter((row) => row.isLiveNow)
      .filter((row) => matchesLiveFilter(row, activeFilter))
      .filter((row) => matchesTimeFilter(row.primaryStartMinutes, timeFilter))
      .filter((row) => matchesSearchText(row, searchTerm))
      .sort(
        (a, b) =>
          a.primaryStartMinutes - b.primaryStartMinutes ||
          b.urgencyScore - a.urgencyScore ||
          (a.venue.name ?? '').localeCompare(b.venue.name ?? '')
      );
  }, [activeFilter, liveVenues, searchTerm, timeFilter]);

  const sections = useMemo(() => {
    if (activeFilter === 'all') {
      return [
        {
          id: 'happy-hour-live',
          title: 'Happy hour live',
          description: 'Deals already running right now.',
          kind: 'happy_hour' as SectionKind,
          rows: liveRows.filter((row) => row.liveHappyHourRules.length > 0),
        },
        {
          id: 'events-live',
          title: 'Events live',
          description: 'Trivia, music, comedy, and live sessions already underway.',
          kind: 'events' as SectionKind,
          rows: liveRows.filter((row) => row.liveEventRules.length > 0),
        },
      ].filter((section) => section.rows.length > 0);
    }

    return [
      {
        id: 'live-matches',
        title: getFilterHeading(activeFilter),
        description: 'Filtered picks happening now.',
        kind: getFilterSectionKind(activeFilter),
        rows: liveRows,
      },
    ];
  }, [activeFilter, liveRows]);

  const hasActiveFilters = activeFilter !== 'all' || timeFilter !== 'any' || searchTerm.trim().length > 0;

  const appliedFilterLabels = useMemo(() => {
    const labels: string[] = [];

    if (searchTerm.trim()) labels.push(`Search: "${searchTerm.trim()}"`);

    const selectedLiveFilter = LIVE_NOW_FILTERS.find((filter) => filter.value === activeFilter);
    if (selectedLiveFilter && selectedLiveFilter.value !== 'all') {
      labels.push(selectedLiveFilter.label);
    }

    const selectedTimeFilter = TIME_FILTERS.find((filter) => filter.value === timeFilter);
    if (selectedTimeFilter && selectedTimeFilter.value !== 'any') {
      labels.push(selectedTimeFilter.label);
    }

    return labels;
  }, [activeFilter, searchTerm, timeFilter]);

  const headlineStats = useMemo(
    () => [
      {
        label: 'Happy hour live',
        value: liveRows.filter((row) => row.liveHappyHourRules.length > 0).length,
        sectionId: activeFilter === 'all' ? 'happy-hour-live' : 'live-matches',
        emptyLabel: 'No live deals',
      },
      {
        label: 'Events live',
        value: liveRows.filter((row) => row.liveEventRules.length > 0).length,
        sectionId: activeFilter === 'all' ? 'events-live' : 'live-matches',
        emptyLabel: 'Nothing live',
      },
      {
        label: 'Ending soon',
        value: liveRows.filter((row) => row.endsSoon).length,
        sectionId: 'live-matches',
        emptyLabel: 'Nothing urgent',
      },
    ],
    [activeFilter, liveRows]
  );

  const mapVenues = useMemo(() => {
    const seen = new Set<string>();

    return liveRows
      .filter(
        (row) =>
          typeof row.venue.lat === 'number' &&
          !Number.isNaN(row.venue.lat) &&
          typeof row.venue.lng === 'number' &&
          !Number.isNaN(row.venue.lng)
      )
      .filter((row) => {
        if (seen.has(row.venue.id)) return false;
        seen.add(row.venue.id);
        return true;
      })
      .map((row) => ({
        id: row.venue.id,
        name: row.venue.name,
        lat: row.venue.lat,
        lng: row.venue.lng,
      }));
  }, [liveRows]);

  function resetFilters() {
    setActiveFilter('all');
    setTimeFilter('any');
    setSearchTerm('');
  }

  useEffect(() => {
    if (!showMap) return;

    const timeout = window.setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [showMap]);

  return (
    <div className="min-h-screen overflow-x-clip bg-black text-white">
      <div className="mx-auto max-w-6xl px-3 py-3.5 sm:px-6 sm:py-8">
        <section className="rounded-[1.4rem] border border-white/9 bg-gradient-to-br from-orange-500/14 via-[#120805] to-black p-3 sm:rounded-3xl sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            {'\u{1F525} Live now'}
          </div>
          <div className="mt-2 flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-[24px] font-semibold tracking-tight sm:text-4xl">
                What&apos;s worth tapping right now
              </h1>
              <p className="mt-1.5 text-[13px] leading-5 text-white/70 sm:text-base">
                Live deals and events across Newtown, Enmore, and Erskineville.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/today"
                className="inline-flex min-h-[30px] items-center justify-center rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/58 transition hover:border-white/16 hover:bg-white/[0.07] hover:text-white"
              >
                See today
              </Link>
              <Link
                href="/week"
                className="inline-flex min-h-[30px] items-center justify-center rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/58 transition hover:border-white/16 hover:bg-white/[0.07] hover:text-white"
              >
                See this week
              </Link>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:max-w-[420px] sm:gap-2">
            {headlineStats.map((stat) =>
              stat.value > 0 ? (
                <a
                  key={stat.label}
                  href={`#${stat.sectionId}`}
                    className="rounded-2xl border border-white/9 bg-black/22 px-2.5 py-2 transition hover:border-orange-300/25 hover:bg-orange-500/8 sm:px-3"
                >
                  <div className="text-base font-semibold text-white">{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-white/46">
                    {stat.label}
                  </div>
                </a>
              ) : (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/9 bg-black/16 px-2.5 py-2 opacity-60 sm:px-3"
                >
                  <div className="text-base font-semibold text-white">{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-white/46">
                    {stat.emptyLabel}
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        <section className="mt-3.5 rounded-[1.4rem] border border-white/7 bg-white/[0.025] p-3 sm:mt-5 sm:rounded-3xl sm:border-white/10 sm:bg-white/5 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
                Filters
              </div>
              <p className="mt-1 text-[12px] leading-5 text-white/62 sm:text-sm">
                Start with happy hour now, live events, or the time window that suits.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMap((current) => !current)}
              className={[
                'hidden rounded-full border px-2.5 py-1 text-[11px] font-medium transition sm:inline-flex',
                showMap
                  ? 'border-orange-400/30 bg-orange-500/12 text-orange-100'
                  : 'border-white/8 bg-black/18 text-white/62 hover:bg-white/10',
              ].join(' ')}
            >
              {showMap ? 'Hide map' : 'Show map'}
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(220px,1.2fr)_auto] md:items-center md:gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search venue, suburb, or what's on"
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

            <div className="grid grid-cols-[1fr_1fr_auto] gap-1 sm:hidden">
              <label className="min-w-0">
                <span className="sr-only">Filter by time</span>
                <select
                  value={timeFilter}
                  onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
                  className="h-8 w-full rounded-[0.95rem] border border-white/7 bg-black/18 px-2 text-[11px] text-white/78 outline-none"
                >
                  {TIME_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="sr-only">Filter by category</span>
                <select
                  value={activeFilter}
                  onChange={(event) => setActiveFilter(event.target.value as LiveNowFilter)}
                  className="h-8 w-full rounded-[0.95rem] border border-white/7 bg-black/18 px-2 text-[11px] text-white/78 outline-none"
                >
                  {LIVE_NOW_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setShowMap((current) => !current)}
                className={[
                  'inline-flex h-8 min-w-[56px] items-center justify-center rounded-[0.95rem] border px-2 text-[10px] font-medium transition',
                  showMap
                    ? 'border-orange-400/22 bg-orange-500/[0.10] text-orange-100'
                    : 'border-white/7 bg-black/15 text-white/54 hover:bg-white/8 hover:text-white',
                ].join(' ')}
              >
                {showMap ? 'Map on' : 'Map'}
              </button>
            </div>

            <div className="hidden sm:flex sm:flex-wrap sm:gap-1.5">
              {TIME_FILTERS.map((filter) => {
                const active = filter.value === timeFilter;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setTimeFilter(filter.value)}
                    className={[
                      'min-w-0 rounded-full border px-2.5 py-1 text-[11px] transition',
                      active
                      ? 'border-white/12 bg-white/[0.07] text-white'
                      : 'border-white/7 bg-black/18 text-white/58 hover:bg-white/8 hover:text-white',
                    ].join(' ')}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden sm:flex sm:flex-wrap sm:gap-1.5">
            {LIVE_NOW_FILTERS.map((filter) => {
              const active = filter.value === activeFilter;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                  className={[
                    'min-w-0 rounded-full border px-2.5 py-1 text-[12px] transition sm:px-3 sm:py-1.25 sm:text-[13px]',
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
              {appliedFilterLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/74"
                >
                  {label}
                </span>
              ))}
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm text-orange-200 underline underline-offset-4 hover:text-white"
              >
                Reset filters
              </button>
              <div className="text-[11px] text-white/50">
                Back to the full live view across happy hour and events.
              </div>
            </div>
          ) : null}
        </section>

        {showMap ? (
          <section
            ref={mapSectionRef}
            className="mt-4 rounded-[1.6rem] border border-white/8 bg-white/[0.02] p-3 sm:mt-5 sm:rounded-3xl sm:border-white/10 sm:bg-white/[0.03] sm:p-5"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                  Map view
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">What&apos;s live now</h2>
                <div className="mt-1 text-sm text-white/62">
                  Live happy hours and events only for the current filter set.
                </div>
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/35">
                {mapVenues.length} venue{mapVenues.length === 1 ? '' : 's'}
              </div>
            </div>
            {mapVenues.length > 0 ? (
              <div className="mt-4">
                <GoogleMap venues={mapVenues} />
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/65">
                No mapped venues match this live filter yet. Try another filter or widen the time
                window.
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-3 block text-sm text-orange-200 underline underline-offset-4 hover:text-white"
                  >
                    Reset filters
                  </button>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        <section className="mt-5">
          {loading ? <div className="text-white/65">Loading live venues...</div> : null}
          {!loading && error ? (
            <div className="rounded-3xl border border-red-500/30 bg-red-950/30 p-5 text-red-100">
              {error}
            </div>
          ) : null}
          {!loading && !error && liveRows.length === 0 ? (
            <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5 text-white/72">
              <div>Nothing&apos;s live for this filter right now.</div>
              <div className="mt-2 text-white/62">
                Try another filter or check Today for what&apos;s coming up next.
              </div>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 text-sm text-orange-200 underline underline-offset-4 hover:text-white"
                >
                  Reset filters
                </button>
              ) : null}
            </div>
          ) : null}

          {!loading && !error && liveRows.length > 0 ? (
            <div className="mb-3 px-1 text-sm text-white/64 sm:mb-4 sm:rounded-2xl sm:border sm:border-white/10 sm:bg-white/[0.03] sm:px-4 sm:py-3">
              Showing {liveRows.length} live venue{liveRows.length === 1 ? '' : 's'}
              {searchTerm.trim() ? ` for "${searchTerm.trim()}"` : ''}
              {activeFilter !== 'all' ? ` in ${getFilterHeading(activeFilter).toLowerCase()}` : ''}
              {timeFilter !== 'any'
                ? `${activeFilter !== 'all' ? ' during ' : ' for '} ${TIME_FILTERS.find((filter) => filter.value === timeFilter)?.label.toLowerCase()}`
                : ''}
            </div>
          ) : null}

          <div className="space-y-5 sm:space-y-7">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28 space-y-3 sm:space-y-4">
                <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.02] p-3.5 sm:rounded-3xl sm:border-white/10 sm:bg-white/[0.03] sm:p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                        {'\u{1F525} Live now'}
                      </div>
                      <h2 className="mt-1 text-xl font-semibold text-white">{section.title}</h2>
                      <p className="text-sm text-white/62">{section.description}</p>
                    </div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">
                      {section.rows.length} venue{section.rows.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-4 sm:mt-4 sm:space-y-5">
                    {groupRowsByTime(section.rows, section.kind).map((group) => (
                      <div key={`${section.id}-${group.label}`} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full border border-orange-400/15 bg-orange-500/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-100 sm:border-orange-400/20 sm:bg-orange-500/10 sm:px-3 sm:text-xs sm:tracking-[0.18em]">
                            {group.label}
                          </div>
                          <div className="h-px flex-1 bg-white/10" />
                        </div>
                        <div className="grid gap-3">
                          {group.rows.map((row) => (
                            <PublicVenueCard
                              key={`${section.id}-${row.venue.id}`}
                              venue={row.venue}
                              eyebrow={row.cardEyebrow}
                              compact
                              tone="live"
                              heroBadge={
                                row.endsSoon ? (
                                  <TopBadge className="border-red-400/35 bg-red-500/18 text-red-50 shadow-[0_0_20px_rgba(239,68,68,0.16)]">
                                    Ends Soon
                                  </TopBadge>
                                ) : row.liveHappyHourRules.length > 0 ? (
                                  <TopBadge className="border-pink-400/35 bg-pink-500/18 text-pink-50 shadow-[0_0_20px_rgba(236,72,153,0.16)]">
                                    Live
                                  </TopBadge>
                                ) : (
                                  <TopBadge className="border-orange-400/35 bg-orange-500/18 text-orange-50 shadow-[0_0_20px_rgba(249,115,22,0.16)]">
                                    Now
                                  </TopBadge>
                                )
                              }
                              summary={buildReasonToCare(row.liveSpecialRules, row.liveHappyHourRules, row.liveEventRules)}
                              details={buildSecondaryLine(row.liveSpecialRules, row.liveHappyHourRules, row.timeHighlights, row.endsSoon, row.liveKidRule, row.liveDogRule)}
                              secondaryFooterAction={
                                <SaveVenueButton venueId={row.venue.id} variant="card" />
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function buildLiveNowRow(venue: Venue) {
  const timezone = venue.timezone || 'Australia/Sydney';
  const liveSpecialRules = getTodayRulesForType(getPublishedDealRules(venue), timezone).filter(
    (rule) => isOpenNow(buildHoursJsonFromRules([rule]), timezone)
  );
  const liveHappyHourRules = getTodayRulesForType(
    getPublishedRulesByType(venue, 'happy_hour'),
    timezone
  ).filter((rule) => isOpenNow(buildHoursJsonFromRules([rule]), timezone));
  const liveEventRules = getTodayRulesForType(getPublishedEventRules(venue), timezone).filter(
    (rule) => isOpenNow(buildHoursJsonFromRules([rule]), timezone)
  );
  const liveKidRule =
    getTodayRulesForType(getPublishedVenueRulesByKind(venue, 'kid'), timezone).find((rule) =>
      isOpenNow(buildHoursJsonFromRules([rule]), timezone)
    ) ?? null;
  const liveDogRule =
    getTodayRulesForType(getPublishedVenueRulesByKind(venue, 'dog'), timezone).find((rule) =>
      isOpenNow(buildHoursJsonFromRules([rule]), timezone)
    ) ?? null;
  const isLiveNow =
    liveSpecialRules.length > 0 ||
    liveHappyHourRules.length > 0 ||
    liveEventRules.length > 0 ||
    Boolean(liveKidRule || liveDogRule);

  const startTimes = [
    ...liveSpecialRules.map((rule) => clockToMinutes(rule.start_time)),
    ...liveHappyHourRules.map((rule) => clockToMinutes(rule.start_time)),
    ...liveEventRules.map((rule) => clockToMinutes(rule.start_time)),
  ];
  const endTimes = [
    ...liveSpecialRules.map((rule) => clockToMinutes(rule.end_time)),
    ...liveHappyHourRules.map((rule) => clockToMinutes(rule.end_time)),
    ...liveEventRules.map((rule) => clockToMinutes(rule.end_time)),
  ];

  const primaryStartMinutes =
    startTimes.length > 0 ? Math.min(...startTimes) : getCurrentTimeMinutes(timezone);
  const soonestEnd = endTimes.length > 0 ? Math.min(...endTimes) : null;
  const endsSoon = soonestEnd !== null && minutesUntil(soonestEnd, timezone) <= 30;

  const liveEventTypes = liveEventRules.map((rule) => rule.schedule_type);
  const badges = [
    liveEventTypes.includes('trivia') ? 'Trivia now' : null,
    liveEventTypes.includes('live_music') ? 'Live music now' : null,
    liveEventTypes.includes('comedy') ? 'Comedy now' : null,
    liveEventTypes.includes('karaoke') ? 'Karaoke now' : null,
  ].filter(Boolean) as string[];

  const urgencyScore =
    liveEventRules.length * 50 +
    liveHappyHourRules.length * 40 +
    liveSpecialRules.length * 45 +
    (endsSoon ? 15 : 0);

  const cardEyebrow =
    liveSpecialRules.length > 0
      ? liveSpecialRules.some((rule) => rule.schedule_type === 'lunch_special')
        ? '\u2600 LUNCH'
        : '\u{1F525} SPECIAL'
      : liveHappyHourRules.length > 0
      ? '\u{1F37B} HAPPY HOUR'
      : liveEventRules.some((rule) => rule.schedule_type === 'trivia')
        ? '\u2753 TRIVIA'
        : liveEventRules.some((rule) => rule.schedule_type === 'live_music')
          ? '\u{1F3B5} LIVE MUSIC'
          : liveEventRules.some((rule) => rule.schedule_type === 'sport')
            ? '\u26BD SPORT'
            : '\u{1F525} LIVE NOW';

  const timeHighlights = [
    ...liveSpecialRules
      .slice(0, 2)
      .map((rule) =>
        buildRangeLabel(rule, rule.schedule_type === 'lunch_special' ? 'Lunch' : 'Special')
      ),
    ...liveHappyHourRules.slice(0, 2).map((rule) => buildRangeLabel(rule, 'Happy hour')),
    ...liveEventRules.slice(0, 2).map((rule) => buildRangeLabel(rule, eventRuleLabel(rule))),
  ];

  return {
    venue,
    liveSpecialRules,
    liveHappyHourRules,
    liveEventRules,
    liveEventTypes,
    liveKidRule,
    liveDogRule,
    isLiveNow,
    endsSoon,
    primaryStartMinutes,
    urgencyScore,
    badges,
    cardEyebrow,
    timeHighlights,
  };
}

function matchesLiveFilter(row: LiveNowRow, filter: LiveNowFilter) {
  if (filter === 'all') return true;
  if (filter === 'happy_hour') return row.liveHappyHourRules.length > 0;
  if (filter === 'food_deals_now') return row.liveSpecialRules.length > 0 || row.liveHappyHourRules.length > 0;
  if (filter === 'lunch_specials') {
    return row.liveSpecialRules.some((rule) => rule.schedule_type === 'lunch_special');
  }
  if (filter === 'kid_friendly_now') return Boolean(row.liveKidRule);
  if (filter === 'dog_friendly_now') return Boolean(row.liveDogRule);
  if (filter === 'events') return row.liveEventRules.length > 0;
  if (filter === 'trivia') return row.liveEventTypes.includes('trivia');
  if (filter === 'live_music') return row.liveEventTypes.includes('live_music');
  if (filter === 'comedy') return row.liveEventTypes.includes('comedy');
  if (filter === 'ends_soon') return row.endsSoon;
  return true;
}

function matchesTimeFilter(minutes: number, filter: TimeFilter) {
  if (filter === 'any') return true;
  if (filter === 'afternoon') return minutes >= 12 * 60 && minutes < 17 * 60;
  if (filter === 'evening') return minutes >= 17 * 60 && minutes < 20 * 60;
  if (filter === 'late_night') return minutes >= 20 * 60 || minutes < 4 * 60;
  return true;
}

function matchesSearchText(row: LiveNowRow, searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;

  const searchSource = [
    row.venue.name,
    row.venue.suburb,
    row.venue.address,
    ...row.liveSpecialRules.flatMap((rule) => collectRuleSearchParts(rule)),
    ...row.liveHappyHourRules.flatMap((rule) => collectRuleSearchParts(rule)),
    ...row.liveEventRules.flatMap((rule) => collectRuleSearchParts(rule)),
    row.liveKidRule ? getCompactVenueRuleSignal(row.liveKidRule) : null,
    row.liveDogRule ? getCompactVenueRuleSignal(row.liveDogRule) : null,
  ]
    .filter(hasText)
    .join(' ')
    .toLowerCase();

  return searchSource.includes(normalized);
}

function collectRuleSearchParts(rule: VenueScheduleRule) {
  return [
    rule.title,
    rule.deal_text,
    rule.description,
    rule.notes,
    typeof rule.detail_json?.notes === 'string' ? rule.detail_json.notes : null,
  ];
}

function getFilterHeading(filter: LiveNowFilter) {
  if (filter === 'happy_hour') return 'Happy hour live';
  if (filter === 'food_deals_now') return 'Food deals now';
  if (filter === 'lunch_specials') return 'Lunch specials now';
  if (filter === 'kid_friendly_now') return 'Kid friendly now';
  if (filter === 'dog_friendly_now') return 'Dog friendly now';
  if (filter === 'events') return 'Events live';
  if (filter === 'trivia') return 'Trivia live';
  if (filter === 'live_music') return 'Live music now';
  if (filter === 'comedy') return 'Comedy live';
  if (filter === 'ends_soon') return 'Ending soon';
  return 'Live now';
}

function getFilterSectionKind(filter: LiveNowFilter): SectionKind {
  if (filter === 'happy_hour') return 'happy_hour';
  if (filter === 'food_deals_now') return 'happy_hour';
  if (filter === 'lunch_specials') return 'happy_hour';
  if (filter === 'events') return 'events';
  if (filter === 'trivia') return 'events';
  if (filter === 'live_music') return 'events';
  if (filter === 'comedy') return 'events';
  return 'mixed';
}

function groupRowsByTime(rows: LiveNowRow[], kind: SectionKind) {
  const groups = new Map<number, LiveNowRow[]>();

  rows.forEach((row) => {
    const minutes = getGroupMinutes(row, kind);
    const current = groups.get(minutes) ?? [];
    current.push(row);
    groups.set(minutes, current);
  });

  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([minutes, groupedRows]) => ({
      label: formatTimeHeading(minutes),
      rows: groupedRows.sort(
        (a, b) =>
          a.primaryStartMinutes - b.primaryStartMinutes ||
          (a.venue.name ?? '').localeCompare(b.venue.name ?? '')
      ),
    }));
}

function getGroupMinutes(row: LiveNowRow, kind: SectionKind) {
  if (kind === 'happy_hour' && row.liveHappyHourRules.length > 0) {
    return Math.min(...row.liveHappyHourRules.map((rule) => clockToMinutes(rule.start_time)));
  }

  if (kind === 'events' && row.liveEventRules.length > 0) {
    return Math.min(...row.liveEventRules.map((rule) => clockToMinutes(rule.start_time)));
  }

  return row.primaryStartMinutes;
}

function buildRangeLabel(rule: VenueScheduleRule, prefix: string) {
  const start = formatTimeForUi(rule.start_time.slice(0, 5));
  const end = formatTimeForUi(rule.end_time.slice(0, 5));
  return `${prefix} ${start} - ${end}`;
}

function eventRuleLabel(rule: VenueScheduleRule) {
  if (rule.schedule_type === 'trivia') return 'Trivia';
  if (rule.schedule_type === 'live_music') return 'Live music';
  if (rule.schedule_type === 'comedy') return 'Comedy';
  if (rule.schedule_type === 'karaoke') return 'Karaoke';
  if (rule.schedule_type === 'dj') return 'DJ';
  if (rule.schedule_type === 'special_event') return 'Event';
  if (rule.schedule_type === 'sport') return 'Sport';
  return 'Event';
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

function minutesUntil(targetMinutes: number, timezone: string) {
  const nowMinutes = getCurrentTimeMinutes(timezone);
  return targetMinutes >= nowMinutes
    ? targetMinutes - nowMinutes
    : targetMinutes + 1440 - nowMinutes;
}

function formatTimeHeading(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minute = String(normalized % 60).padStart(2, '0');
  return formatTimeForUi(`${hour}:${minute}`);
}

function TopBadge({
  children,
  className,
}: {
  children: string;
  className: string;
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.75 text-[9px] font-semibold uppercase tracking-[0.14em] ${className}`}
    >
      {children}
    </span>
  );
}

function CardTimingPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-[22px] items-center rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.75 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/82">
      {children}
    </span>
  );
}

function buildReasonToCare(
  specialRules: VenueScheduleRule[],
  happyHourRules: VenueScheduleRule[],
  eventRules: VenueScheduleRule[]
) {
  const firstSpecialRule = specialRules[0];
  const firstHappyHourRule = happyHourRules[0];
  const firstEvent = eventRules[0];

  if (firstSpecialRule) {
    return getCompactSpecialLine(firstSpecialRule);
  }

  if (happyHourRules.length > 0) {
    return getHappyHourOfferLine(firstHappyHourRule) ?? 'Happy hour live now';
  }

  if (firstEvent) {
    return getEventHeroLine(firstEvent);
  }

  return 'Something is happening now';
}

function buildCompactTimeLabel(startTime: string, endTime: string) {
  return `${formatTimeForUi(startTime.slice(0, 5))}-${formatTimeForUi(endTime.slice(0, 5))}`;
}

function buildSecondaryLine(
  specialRules: VenueScheduleRule[],
  happyHourRules: VenueScheduleRule[],
  timeHighlights: string[],
  endsSoon: boolean,
  liveKidRule?: VenueScheduleRule | null,
  liveDogRule?: VenueScheduleRule | null
) {
  const firstTiming = timeHighlights[0]?.replace(
    /^(Happy hour|Lunch|Special|Trivia|Live music|Comedy|Karaoke|DJ|Event|Sport)\s+/i,
    ''
  );
  const categorySummary = happyHourRules.length > 0 ? buildHappyHourCategorySummary(happyHourRules) : null;
  const specialSummary = specialRules[0] ? getCompactSpecialLine(specialRules[0]) : null;
  const supportiveSignals = [liveKidRule, liveDogRule]
    .map((rule) => (rule ? getCompactVenueRuleSignal(rule) : null))
    .filter(Boolean)
    .slice(0, 2)
    .join(' | ');

  if (specialSummary && supportiveSignals) return `${specialSummary} | ${supportiveSignals}${endsSoon ? ' | Ends soon' : ''}`;
  if (specialSummary && firstTiming) return `${specialSummary} | ${firstTiming}${endsSoon ? ' | Ends soon' : ''}`;
  if (categorySummary && firstTiming) return `${categorySummary} | ${firstTiming}${endsSoon ? ' | Ends soon' : ''}`;
  if (supportiveSignals && firstTiming) return `${supportiveSignals} | ${firstTiming}${endsSoon ? ' | Ends soon' : ''}`;
  if (supportiveSignals) return endsSoon ? `${supportiveSignals} | Ends soon` : supportiveSignals;
  if (specialSummary) return endsSoon ? `${specialSummary} | Ends soon` : specialSummary;
  if (categorySummary) return endsSoon ? `${categorySummary} | Ends soon` : categorySummary;
  if (endsSoon && firstTiming) return `${firstTiming} | Ends soon`;
  if (endsSoon) return 'Ends soon';
  return firstTiming ?? 'Happening now';
}

function getHappyHourOfferLine(rule: VenueScheduleRule | undefined) {
  if (!rule) return null;

  const categories = HAPPY_HOUR_CATEGORIES.flatMap((category) =>
    getDisplayHappyHourItems(rule.detail_json, category.key)
      .slice(0, 1)
      .map((item) => {
        const price = item.price != null ? `$${item.price}` : null;
        const label = item.priceLabel?.trim() ? ` ${item.priceLabel.trim()}` : '';
        if (price) return `${price}${label} ${item.title}`.trim();
        return item.title;
      })
  ).filter(Boolean) as string[];

  if (categories.length > 0) {
    return categories.slice(0, 2).join(' + ');
  }

  return rule.deal_text?.trim() || rule.description?.trim() || null;
}

function getEventHeroLine(rule: VenueScheduleRule) {
  const text =
    rule.deal_text?.trim() ||
    rule.title?.trim() ||
    rule.description?.trim() ||
    eventRuleLabel(rule);
  const timing = buildCompactTimeLabel(rule.start_time, rule.end_time);
  if (text.toLowerCase().includes('now')) return text;
  return `${text} ${timing ? `from ${formatTimeForUi(rule.start_time.slice(0, 5))}` : ''}`.trim();
}

function buildHappyHourCategorySummary(rules: VenueScheduleRule[]) {
  const categories = HAPPY_HOUR_CATEGORIES.filter((category) =>
    rules.some((rule) => getDisplayHappyHourItems(rule.detail_json, category.key).length > 0)
  ).map((category) => category.label.replace(/^[^\s]+\s/, ''));

  return categories.slice(0, 3).join(' | ');
}


