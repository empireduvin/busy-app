'use client';

import GoogleMap from '@/app/components/GoogleMap';
import PublicEventRuleCard from '@/app/components/PublicEventRuleCard';
import PublicHappyHourRuleCard from '@/app/components/PublicHappyHourRuleCard';
import PublicVenueCard from '@/app/components/PublicVenueCard';
import { usePublicVenueCollections } from '@/app/components/usePublicVenueCollections';
import { formatTimeForUi } from '@/lib/opening-hours';
import {
  getPublishedEventRules,
  getPublishedRulesByType,
  getTodayRulesForType,
  hasText,
  type Venue,
  type VenueScheduleRule,
} from '@/lib/public-venue-discovery';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

type TodayFilter =
  | 'all'
  | 'happy_hour'
  | 'events'
  | 'trivia'
  | 'live_music'
  | 'comedy'
  | 'karaoke';

type TimeFilter = 'any' | 'afternoon' | 'evening' | 'late_night';
type SectionKind = 'happy_hour' | 'events' | 'mixed';
type TodayRow = ReturnType<typeof buildTodayRow>;

const TODAY_FILTERS: Array<{ value: TodayFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'happy_hour', label: 'Happy Hour' },
  { value: 'events', label: 'Events' },
  { value: 'trivia', label: 'Trivia' },
  { value: 'live_music', label: 'Live Music' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'karaoke', label: 'Karaoke' },
];

const TIME_FILTERS: Array<{ value: TimeFilter; label: string }> = [
  { value: 'any', label: 'Any time' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'late_night', label: 'Late night' },
];

export default function TodayPage() {
  const { liveVenues, loading, error } = usePublicVenueCollections();
  const [activeFilter, setActiveFilter] = useState<TodayFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('any');
  const [searchTerm, setSearchTerm] = useState('');
  const [showMap, setShowMap] = useState(false);
  const mapSectionRef = useRef<HTMLElement | null>(null);

  const rows = useMemo(
    () =>
      liveVenues
        .map((venue) => buildTodayRow(venue))
        .filter((row) => row.isRelevantToday)
        .filter((row) => matchesTodayFilter(row, activeFilter))
        .filter((row) => matchesTimeFilter(row.primaryStartMinutes, timeFilter))
        .filter((row) => matchesSearchText(row, searchTerm))
        .sort(
          (a, b) =>
            a.primaryStartMinutes - b.primaryStartMinutes ||
            (a.venue.name ?? '').localeCompare(b.venue.name ?? '')
        ),
    [activeFilter, liveVenues, searchTerm, timeFilter]
  );

  const sections = useMemo(() => {
    if (activeFilter === 'all') {
      return [
        {
          id: 'happy-hour-today',
          title: 'Happy hour today',
          description: 'Lunch pours, after-work deals, and happy hours!',
          kind: 'happy_hour' as SectionKind,
          rows: rows.filter((row) => row.todayHappyHourRules.length > 0),
        },
        {
          id: 'events-today',
          title: 'Events today',
          description: 'Trivia, music, comedy, karaoke, and live sessions across the day.',
          kind: 'events' as SectionKind,
          rows: rows.filter((row) => row.todayEventRules.length > 0),
        },
      ].filter((section) => section.rows.length > 0);
    }

    return [
      {
        id: 'today-matches',
        title: getFilterHeading(activeFilter),
        description: 'Filtered picks for the day ahead.',
        kind: getFilterSectionKind(activeFilter),
        rows,
      },
    ];
  }, [activeFilter, rows]);

  const hasActiveFilters = activeFilter !== 'all' || timeFilter !== 'any' || searchTerm.trim().length > 0;

  const appliedFilterLabels = useMemo(() => {
    const labels: string[] = [];

    if (searchTerm.trim()) labels.push(`Search: "${searchTerm.trim()}"`);

    const selectedTodayFilter = TODAY_FILTERS.find((filter) => filter.value === activeFilter);
    if (selectedTodayFilter && selectedTodayFilter.value !== 'all') {
      labels.push(selectedTodayFilter.label);
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
        label: 'Happy hour today',
        value: rows.filter((row) => row.todayHappyHourRules.length > 0).length,
        sectionId: activeFilter === 'all' ? 'happy-hour-today' : 'today-matches',
        emptyLabel: 'No deals yet',
      },
      {
        label: 'Events today',
        value: rows.filter((row) => row.todayEventRules.length > 0).length,
        sectionId: activeFilter === 'all' ? 'events-today' : 'today-matches',
        emptyLabel: 'No events yet',
      },
      {
        label: 'Lunch specials',
        value: rows.filter((row) => row.hasLunchSpecials).length,
        sectionId: activeFilter === 'all' ? 'happy-hour-today' : 'today-matches',
        emptyLabel: 'No lunch deals',
      },
    ],
    [activeFilter, rows]
  );

  const mapVenues = useMemo(() => {
    const seen = new Set<string>();

    return rows
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
  }, [rows]);

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
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-8">
        <section className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-orange-500/20 via-[#120805] to-black p-4 sm:rounded-3xl sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            Today
          </div>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight sm:text-4xl">
                What&apos;s on today
              </h1>
              <p className="mt-2 text-[13px] leading-5 text-white/68 sm:hidden">
                Happy hours and events across Newtown, Enmore, and Erskineville.
              </p>
              <p className="mt-2.5 hidden max-w-2xl text-[13px] leading-5 text-white/68 sm:mt-3 sm:block sm:text-base">
                Today&apos;s happy hours and events across Newtown, Enmore, and Erskineville.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
              {headlineStats.map((stat) =>
                stat.value > 0 ? (
                  <a
                    key={stat.label}
                    href={`#${stat.sectionId}`}
                    className="min-h-[68px] rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 transition hover:border-orange-300/35 hover:bg-orange-500/10 sm:min-h-[88px] sm:px-4 sm:py-3"
                  >
                    <div className="text-lg font-semibold text-white">{stat.value}</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-white/45 sm:text-xs sm:tracking-[0.18em]">
                      {stat.label}
                    </div>
                  </a>
                ) : (
                  <div
                    key={stat.label}
                    className="min-h-[68px] rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 opacity-60 sm:min-h-[88px] sm:px-4 sm:py-3"
                  >
                    <div className="text-lg font-semibold text-white">{stat.value}</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-white/45 sm:text-xs sm:tracking-[0.18em]">
                      {stat.emptyLabel}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-3 sm:mt-5 sm:rounded-3xl sm:border-white/10 sm:bg-white/5 sm:p-4">
          <div className="mb-3 rounded-[1.5rem] border border-orange-400/15 bg-orange-500/[0.08] p-3 sm:mb-4 sm:rounded-3xl sm:border-orange-400/20 sm:bg-orange-500/10 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-200/80">
                  New
                </div>
                <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">See the next 7 days</h2>
                <p className="mt-1 text-[13px] leading-5 text-white/65 sm:hidden">
                  Jump into the rolling week view and see what&apos;s next.
                </p>
                <p className="mt-1 hidden max-w-2xl text-[13px] leading-5 text-white/65 sm:block sm:text-sm">
                  Jump from today into the rolling week view to check what&apos;s coming up next across happy hour and events.
                </p>
              </div>
              <Link
                href="/week"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-orange-300/30 bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 sm:w-auto"
              >
                Open This Week
              </Link>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(220px,1.2fr)_auto] md:items-center">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search venue, suburb, or today&apos;s plan"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 pr-24 text-sm text-white placeholder:text-white/35"
              />
              {searchTerm.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:hidden">
              <label className="min-w-0">
                <span className="sr-only">Filter by time</span>
                <select
                  value={timeFilter}
                  onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
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
                  onChange={(event) => setActiveFilter(event.target.value as TodayFilter)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
                >
                  {TODAY_FILTERS.map((filter) => (
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
                  'inline-flex h-10 min-w-[72px] items-center justify-center rounded-xl border px-3 text-xs font-medium transition',
                  showMap
                    ? 'border-orange-400/30 bg-orange-500/12 text-orange-100'
                    : 'border-white/10 bg-black/20 text-white/70 hover:bg-white/10',
                ].join(' ')}
              >
                {showMap ? 'Map on' : 'Map'}
              </button>
            </div>

            <div className="hidden sm:flex sm:flex-wrap sm:gap-2.5">
              {TIME_FILTERS.map((filter) => {
                const active = filter.value === timeFilter;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setTimeFilter(filter.value)}
                    className={[
                      'min-w-0 rounded-full border px-4 py-2 text-sm transition sm:px-3 sm:py-1.5 sm:text-xs',
                      active
                        ? 'border-white/20 bg-white/15 text-white'
                        : 'border-white/10 bg-black/20 text-white/60 hover:bg-white/10',
                    ].join(' ')}
                  >
                    {filter.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowMap((current) => !current)}
                className={[
                  'min-w-0 rounded-full border px-4 py-2 text-sm transition sm:px-3 sm:py-1.5 sm:text-xs',
                  showMap
                    ? 'border-orange-400/30 bg-orange-500/12 text-orange-100'
                    : 'border-white/10 bg-black/20 text-white/60 hover:bg-white/10',
                ].join(' ')}
              >
                {showMap ? 'Hide map' : 'Show map'}
              </button>
            </div>
          </div>

          <div className="hidden sm:flex sm:flex-wrap sm:gap-2.5">
            {TODAY_FILTERS.map((filter) => {
              const active = filter.value === activeFilter;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                  className={[
                    'min-w-0 rounded-full border px-3 py-2.5 text-sm transition sm:px-4 sm:py-2',
                    active
                      ? 'border-orange-400 bg-orange-500 text-black'
                      : 'border-white/10 bg-black/30 text-white/75 hover:bg-white/10',
                  ].join(' ')}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          {hasActiveFilters ? (
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Applied
              </span>
              {appliedFilterLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/70"
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
              <div className="text-xs text-white/45">
                Back to the full today view across happy hour and events.
              </div>
            </div>
          ) : null}
        </section>

        {showMap ? (
          <section
            ref={mapSectionRef}
            className="mt-4 rounded-[1.75rem] border border-white/8 bg-white/[0.02] p-3 sm:mt-5 sm:rounded-3xl sm:border-white/10 sm:bg-white/[0.03] sm:p-5"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                  Map view
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">What&apos;s on today</h2>
                <div className="mt-1 text-sm text-white/55">
                  Today&apos;s filtered happy hours and events on the map.
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
                No mapped venues match this today filter yet. Try another filter or widen the time
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
          {loading ? <div className="text-white/65">Loading today&apos;s venues...</div> : null}
          {!loading && error ? (
            <div className="rounded-3xl border border-red-500/30 bg-red-950/30 p-5 text-red-100">
              {error}
            </div>
          ) : null}
          {!loading && !error && rows.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
              <div>Nothing matches this today filter yet.</div>
              <div className="mt-2 text-white/55">
                Try another filter or search for a venue, suburb, or event style.
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

          {!loading && !error && rows.length > 0 ? (
            <div className="mb-3 px-1 text-sm text-white/60 sm:mb-4 sm:rounded-2xl sm:border sm:border-white/10 sm:bg-white/[0.03] sm:px-4 sm:py-3">
              Showing {rows.length} venue{rows.length === 1 ? '' : 's'}
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
                <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.02] p-3.5 sm:rounded-3xl sm:border-white/10 sm:bg-white/[0.03] sm:p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                        What&apos;s on today
                      </div>
                      <p className="mt-1 text-sm text-white/55">{section.description}</p>
                    </div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">
                      {section.rows.length} venue{section.rows.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-4 sm:mt-4 sm:space-y-5">
                    {groupRowsByTime(section.rows, section.kind).map((group) => (
                      <div key={`${section.id}-${group.label}`} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full border border-orange-400/15 bg-orange-500/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-100 sm:border-orange-400/20 sm:bg-orange-500/10 sm:px-3 sm:text-xs sm:tracking-[0.18em]">
                            {group.label}
                          </div>
                          <div className="h-px flex-1 bg-white/10" />
                        </div>
                        <div className="grid gap-4">
                          {group.rows.map((row) => (
                            <PublicVenueCard
                              key={`${section.id}-${row.venue.id}`}
                              venue={row.venue}
                              eyebrow={row.cardEyebrow}
                              badges={row.badges}
                              compact
                              tone="today"
                              heroBadge={
                                row.todayHappyHourRules.length > 0 ? (
                                  <TopBadge className="border-pink-400/30 bg-pink-500/15 text-pink-100">
                                    Today
                                  </TopBadge>
                                ) : (
                                  <TopBadge className="border-orange-400/30 bg-orange-500/15 text-orange-100">
                                    Event
                                  </TopBadge>
                                )
                              }
                              summary={
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-2">
                                    {row.todayHappyHourRules.length > 0 ? (
                                      <StatusPill className="border-pink-400/30 bg-pink-500/15 text-pink-100">
                                        Happy hour today
                                      </StatusPill>
                                    ) : null}
                                    {row.todayEventRules.length > 0 ? (
                                      <StatusPill className="border-orange-400/30 bg-orange-500/15 text-orange-100">
                                        Events today
                                      </StatusPill>
                                    ) : null}
                                  </div>
                                  {row.timeHighlights.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {row.timeHighlights.map((highlight) => (
                                        <TimePill key={`${row.venue.id}-${highlight}`}>
                                          {highlight}
                                        </TimePill>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              }
                              details={
                                <div className="space-y-3">
                                  {row.todayHappyHourRules.map((rule) => (
                                    <PublicHappyHourRuleCard key={rule.id} rule={rule} compact />
                                  ))}
                                  {row.todayEventRules.map((rule) => (
                                    <PublicEventRuleCard key={rule.id} rule={rule} compact />
                                  ))}
                                </div>
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

function buildTodayRow(venue: Venue) {
  const timezone = venue.timezone || 'Australia/Sydney';
  const todayHappyHourRules = getTodayRulesForType(
    getPublishedRulesByType(venue, 'happy_hour'),
    timezone
  );
  const todayEventRules = getTodayRulesForType(getPublishedEventRules(venue), timezone);
  const todayEventTypes = todayEventRules.map((rule) => rule.schedule_type);
  const isRelevantToday = todayHappyHourRules.length > 0 || todayEventRules.length > 0;

  const startTimes = [
    ...todayHappyHourRules.map((rule) => clockToMinutes(rule.start_time)),
    ...todayEventRules.map((rule) => clockToMinutes(rule.start_time)),
  ];
  const primaryStartMinutes = startTimes.length > 0 ? Math.min(...startTimes) : 18 * 60;
  const hasLunchSpecials = todayHappyHourRules.some((rule) => {
    const minutes = clockToMinutes(rule.start_time);
    return minutes >= 11 * 60 && minutes <= 15 * 60;
  });

  const badges = [
    todayEventTypes.includes('trivia') ? 'Trivia tonight' : null,
    todayEventTypes.includes('live_music') ? 'Live music tonight' : null,
    todayEventTypes.includes('comedy') ? 'Comedy tonight' : null,
    todayEventTypes.includes('karaoke') ? 'Karaoke tonight' : null,
    todayEventTypes.includes('sport') ? 'Sport session' : null,
  ].filter(Boolean) as string[];

  const primaryEventType = [
    'trivia',
    'live_music',
    'comedy',
    'karaoke',
    'special_event',
    'sport',
  ].find((type) => todayEventTypes.includes(type as (typeof todayEventTypes)[number]));

  const cardEyebrow =
    todayHappyHourRules.length > 0
      ? 'Happy Hour Today'
      : primaryEventType === 'trivia'
        ? 'Trivia Today'
        : primaryEventType === 'live_music'
          ? 'Live Music Today'
          : primaryEventType === 'comedy'
            ? 'Comedy Today'
            : primaryEventType === 'karaoke'
              ? 'Karaoke Today'
              : 'Events Today';

  const timeHighlights = [
    ...todayHappyHourRules.slice(0, 2).map((rule) => buildRangeLabel(rule, 'Happy hour')),
    ...todayEventRules.slice(0, 2).map((rule) => buildRangeLabel(rule, eventRuleLabel(rule))),
  ];

  return {
    venue,
    todayHappyHourRules,
    todayEventRules,
    todayEventTypes,
    isRelevantToday,
    primaryStartMinutes,
    hasLunchSpecials,
    badges,
    cardEyebrow,
    timeHighlights,
  };
}

function matchesTodayFilter(row: TodayRow, filter: TodayFilter) {
  if (filter === 'all') return true;
  if (filter === 'happy_hour') return row.todayHappyHourRules.length > 0;
  if (filter === 'events') return row.todayEventRules.length > 0;
  if (filter === 'trivia') return row.todayEventTypes.includes('trivia');
  if (filter === 'live_music') return row.todayEventTypes.includes('live_music');
  if (filter === 'comedy') return row.todayEventTypes.includes('comedy');
  if (filter === 'karaoke') return row.todayEventTypes.includes('karaoke');
  return true;
}

function matchesTimeFilter(minutes: number, filter: TimeFilter) {
  if (filter === 'any') return true;
  if (filter === 'afternoon') return minutes >= 12 * 60 && minutes < 17 * 60;
  if (filter === 'evening') return minutes >= 17 * 60 && minutes < 20 * 60;
  if (filter === 'late_night') return minutes >= 20 * 60 || minutes < 4 * 60;
  return true;
}

function matchesSearchText(row: TodayRow, searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;

  const searchSource = [
    row.venue.name,
    row.venue.suburb,
    row.venue.address,
    ...row.todayHappyHourRules.flatMap((rule) => collectRuleSearchParts(rule)),
    ...row.todayEventRules.flatMap((rule) => collectRuleSearchParts(rule)),
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

function getFilterHeading(filter: TodayFilter) {
  if (filter === 'happy_hour') return 'Happy hour today';
  if (filter === 'events') return 'Events today';
  if (filter === 'trivia') return 'Trivia today';
  if (filter === 'live_music') return 'Live music today';
  if (filter === 'comedy') return 'Comedy today';
  if (filter === 'karaoke') return 'Karaoke today';
  return 'What&apos;s on today';
}

function getFilterSectionKind(filter: TodayFilter): SectionKind {
  if (filter === 'happy_hour') return 'happy_hour';
  if (filter === 'events') return 'events';
  if (filter === 'trivia') return 'events';
  if (filter === 'live_music') return 'events';
  if (filter === 'comedy') return 'events';
  if (filter === 'karaoke') return 'events';
  return 'mixed';
}

function groupRowsByTime(rows: TodayRow[], kind: SectionKind) {
  const groups = new Map<number, TodayRow[]>();

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

function getGroupMinutes(row: TodayRow, kind: SectionKind) {
  if (kind === 'happy_hour' && row.todayHappyHourRules.length > 0) {
    return Math.min(...row.todayHappyHourRules.map((rule) => clockToMinutes(rule.start_time)));
  }

  if (kind === 'events' && row.todayEventRules.length > 0) {
    return Math.min(...row.todayEventRules.map((rule) => clockToMinutes(rule.start_time)));
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


function formatTimeHeading(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minute = String(normalized % 60).padStart(2, '0');
  return formatTimeForUi(`${hour}:${minute}`);
}

function StatusPill({
  children,
  className,
}: {
  children: string;
  className: string;
}) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function TimePill({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-white/70">
      {children}
    </span>
  );
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
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${className}`}
    >
      {children}
    </span>
  );
}
