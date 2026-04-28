'use client';

import GoogleMap from '@/app/components/GoogleMap';
import PublicVenueCard from '@/app/components/PublicVenueCard';
import SaveVenueButton from '@/app/components/SaveVenueButton';
import { usePublicVenueCollections } from '@/app/components/usePublicVenueCollections';
import { formatTimeForUi } from '@/lib/opening-hours';
import { getVenueProductGuardrails } from '@/lib/venue-product-guardrails';
import { type DayOfWeek } from '@/lib/schedule-rules';
import {
  HAPPY_HOUR_CATEGORIES,
  getCompactSpecialLine,
  getCompactVenueRuleSignal,
  getDayOfWeekForOffset,
  getLunchSpecialEligibleRules,
  getPublishedDealRules,
  getDisplayHappyHourItems,
  getPublishedEventRules,
  getPublishedRulesByType,
  getPublishedVenueRulesByKind,
  getRulesForDay,
  hasText,
  type Venue,
  type VenueScheduleRule,
} from '@/lib/public-venue-discovery';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

type WeekFilter =
  | 'all'
  | 'happy_hour'
  | 'specials'
  | 'lunch_specials'
  | 'kid_friendly_now'
  | 'dog_friendly_now'
  | 'events'
  | 'trivia'
  | 'live_music'
  | 'comedy'
  | 'karaoke';

type TimeFilter = 'any' | 'afternoon' | 'evening' | 'late_night';
type SectionKind = 'happy_hour' | 'specials' | 'events' | 'mixed';
type WeekRow = ReturnType<typeof buildWeekRow>;
type DayOption = {
  offset: number;
  label: string;
  shortDate: string;
  fullDate: string;
  dayOfWeek: DayOfWeek;
  isToday: boolean;
};

const WEEK_FILTERS: Array<{ value: WeekFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'happy_hour', label: 'Happy Hour' },
  { value: 'specials', label: 'Specials' },
  { value: 'lunch_specials', label: 'Lunch Specials' },
  { value: 'kid_friendly_now', label: 'Kid Friendly' },
  { value: 'dog_friendly_now', label: 'Dog Friendly' },
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

const DISPLAY_TIMEZONE = 'Australia/Sydney';

export default function WeekPage() {
  const { liveVenues, loading, error } = usePublicVenueCollections();
  const [selectedOffset, setSelectedOffset] = useState(1);
  const [activeFilter, setActiveFilter] = useState<WeekFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('any');
  const [searchTerm, setSearchTerm] = useState('');
  const [showMap, setShowMap] = useState(false);
  const mapSectionRef = useRef<HTMLElement | null>(null);

  const dayOptions = useMemo(() => buildDayOptions(), []);
  const selectedDay = dayOptions.find((option) => option.offset === selectedOffset) ?? dayOptions[0];

  const rows = useMemo(
    () =>
      liveVenues
        .filter((venue) => getVenueProductGuardrails(venue).coreDiscoveryEligible)
        .map((venue) => buildWeekRow(venue, selectedDay))
        .filter((row) => row.isRelevantOnDay)
        .filter((row) => matchesWeekFilter(row, activeFilter))
        .filter((row) => matchesTimeFilter(row, timeFilter))
        .filter((row) => matchesSearchText(row, searchTerm))
        .sort(
          (a, b) =>
            a.primaryStartMinutes - b.primaryStartMinutes ||
            (a.venue.name ?? '').localeCompare(b.venue.name ?? '')
        ),
    [activeFilter, liveVenues, searchTerm, selectedDay, timeFilter]
  );

  const sections = useMemo(() => {
    if (activeFilter === 'all') {
      return [
        {
          id: 'week-happy-hour',
          title: selectedDay.isToday ? 'Happy hour today' : `Happy hour ${selectedDay.fullDate}`,
          description: 'Lunch pours, after-work deals, and happy hours!',
          kind: 'happy_hour' as SectionKind,
          rows: rows.filter((row) => row.dayHappyHourRules.length > 0),
        },
        {
          id: 'week-specials',
          title: selectedDay.isToday ? 'Specials today' : `Specials ${selectedDay.fullDate}`,
          description: `Daily and lunch specials lined up for ${selectedDay.fullDate.toLowerCase()}.`,
          kind: 'specials' as SectionKind,
          rows: rows.filter((row) => row.daySpecialRules.length > 0),
        },
        {
          id: 'week-events',
          title: selectedDay.isToday ? 'Events today' : `Events ${selectedDay.fullDate}`,
          description: `Trivia, music, comedy, karaoke, and live sessions lined up for ${selectedDay.fullDate.toLowerCase()}.`,
          kind: 'events' as SectionKind,
          rows: rows.filter((row) => row.dayEventRules.length > 0),
        },
      ].filter((section) => section.rows.length > 0);
    }

    return [
      {
        id: 'week-matches',
        title: getFilterHeading(activeFilter, selectedDay),
        description: `Filtered picks for ${selectedDay.fullDate.toLowerCase()}.`,
        kind: getFilterSectionKind(activeFilter),
        rows,
      },
    ];
  }, [activeFilter, rows, selectedDay]);

  const renderedRows = useMemo(() => {
    const seen = new Set<string>();
    return sections.flatMap((section) =>
      section.rows.filter((row) => {
        if (seen.has(row.venue.id)) return false;
        seen.add(row.venue.id);
        return true;
      })
    );
  }, [sections]);

  const hasActiveFilters = activeFilter !== 'all' || timeFilter !== 'any' || searchTerm.trim().length > 0;

  const appliedFilterLabels = useMemo(() => {
    const labels: string[] = [];

    if (searchTerm.trim()) labels.push(`Search: "${searchTerm.trim()}"`);

    const selectedWeekFilter = WEEK_FILTERS.find((filter) => filter.value === activeFilter);
    if (selectedWeekFilter && selectedWeekFilter.value !== 'all') {
      labels.push(selectedWeekFilter.label);
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
        label: selectedDay.isToday ? 'Happy hour today' : 'Happy hour picks',
        value: rows.filter((row) => row.dayHappyHourRules.length > 0).length,
        sectionId: activeFilter === 'all' ? 'week-happy-hour' : 'week-matches',
        emptyLabel: 'No deals yet',
      },
      {
        label: selectedDay.isToday ? 'Events today' : 'Events lined up',
        value: rows.filter((row) => row.dayEventRules.length > 0).length,
        sectionId: activeFilter === 'all' ? 'week-events' : 'week-matches',
        emptyLabel: 'No events yet',
      },
      {
        label: 'Lunch specials',
        value: rows.filter((row) => row.hasLunchSpecials).length,
        sectionId: activeFilter === 'all' ? 'week-specials' : 'week-matches',
        emptyLabel: 'No lunch deals',
      },
    ],
    [activeFilter, rows, selectedDay]
  );

  const mapVenues = useMemo(() => {
    const seen = new Set<string>();

    return renderedRows
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
  }, [renderedRows]);

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
      <div className="mx-auto max-w-6xl px-3 py-2.5 sm:px-6 sm:py-8">
        <section className="rounded-[1.25rem] border border-white/9 bg-gradient-to-br from-orange-500/14 via-[#120805] to-black p-2.5 sm:rounded-3xl sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            📅 This week
          </div>
          <div className="mt-1.5 flex flex-col gap-1.5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-[24px] font-semibold tracking-tight sm:text-4xl">
                Line up the next good move
              </h1>
              <p className="mt-1 text-[12px] leading-5 text-white/70 sm:mt-1.5 sm:text-base">
                Start with tomorrow, then scan the next six days for the right venue.
              </p>
            </div>
            <div className="hidden flex-wrap gap-2 sm:flex">
              <Link
                href="/livenow"
                className="inline-flex min-h-[30px] items-center justify-center rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/58 transition hover:border-white/16 hover:bg-white/[0.07] hover:text-white"
              >
                See live now
              </Link>
              <Link
                href="/today"
                className="inline-flex min-h-[30px] items-center justify-center rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/58 transition hover:border-white/16 hover:bg-white/[0.07] hover:text-white"
              >
                See today
              </Link>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 sm:max-w-[420px] sm:gap-2">
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

        <section className="mt-2.5 rounded-[1.25rem] border border-white/7 bg-white/[0.025] p-2.5 sm:mt-5 sm:rounded-3xl sm:border-white/10 sm:bg-white/5 sm:p-4">
          <div className="mb-1.5 flex items-center justify-between gap-3 sm:mb-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
                Filters
              </div>
              <p className="mt-1 hidden text-[12px] leading-5 text-white/62 sm:block sm:text-sm">
                Pick a day, narrow the time window, then scan the feed.
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

          <div className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:gap-1.5">
            {dayOptions.map((option) => {
              const active = option.offset === selectedOffset;
              return (
                <button
                  key={option.offset}
                  type="button"
                  onClick={() => setSelectedOffset(option.offset)}
                  className={[
                    'min-w-0 rounded-[0.95rem] border px-2 py-1 text-left transition sm:min-w-[84px] sm:rounded-2xl sm:px-3 sm:py-1.5',
                    active
                      ? 'border-orange-400/45 bg-orange-500/18 text-orange-50'
                      : 'border-white/7 bg-black/18 text-white/62 hover:bg-white/8 hover:text-white',
                  ].join(' ')}
                >
                  <div className="text-[10px] font-semibold sm:text-[13px]">
                    <span className="sm:hidden">
                      {option.isToday ? 'Today' : option.label.slice(0, 3)}
                    </span>
                    <span className="hidden sm:inline">{option.label}</span>
                  </div>
                  <div className={active ? 'text-[10px] text-orange-100/72' : 'text-[10px] text-white/40'}>
                    {option.shortDate}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid gap-2 md:mt-3.5 md:grid-cols-[minmax(220px,1.2fr)_auto] md:items-center md:gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Search venue, suburb, or ${selectedDay.isToday ? "today's" : `${selectedDay.label.toLowerCase()}'s`} plan`}
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
                  className="h-8 w-full rounded-[0.95rem] border border-white/7 bg-black/18 px-2.5 text-[11px] text-white/78 outline-none"
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
                  onChange={(event) => setActiveFilter(event.target.value as WeekFilter)}
                  className="h-8 w-full rounded-[0.95rem] border border-white/7 bg-black/18 px-2.5 text-[11px] text-white/78 outline-none"
                >
                  {WEEK_FILTERS.map((filter) => (
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
            {WEEK_FILTERS.map((filter) => {
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

          <div className="mt-2.5 text-sm text-white/60">
            Viewing {selectedDay.fullDate}.
          </div>

          {hasActiveFilters ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
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
              <div className="text-xs text-white/50">
                Back to the full week view across happy hour and events.
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
                <h2 className="mt-1 text-xl font-semibold text-white">
                  What&apos;s on {selectedDay.isToday ? 'today' : selectedDay.label.toLowerCase()}
                </h2>
                <div className="mt-1 text-sm text-white/62">
                  {selectedDay.fullDate}&apos;s filtered happy hours and events on the map.
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
                No mapped venues match this day and filter set yet. Try another filter or another day.
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
          {loading ? <div className="text-white/65">Loading week picks...</div> : null}
          {!loading && error ? (
            <div className="rounded-3xl border border-red-500/30 bg-red-950/30 p-5 text-red-100">
              {error}
            </div>
          ) : null}
          {!loading && !error && renderedRows.length === 0 ? (
            <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5 text-white/72">
              <div>Nothing matches this week filter yet.</div>
              <div className="mt-2 text-white/62">
                Try another day, widen the filters, or search for a venue, suburb, or event style.
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

          {!loading && !error && renderedRows.length > 0 ? (
            <div className="mb-3 px-1 text-sm text-white/64 sm:mb-4 sm:rounded-2xl sm:border sm:border-white/10 sm:bg-white/[0.03] sm:px-4 sm:py-3">
              Showing {renderedRows.length} venue{renderedRows.length === 1 ? '' : 's'}
              {searchTerm.trim() ? ` for "${searchTerm.trim()}"` : ''}
              {activeFilter !== 'all' ? ` in ${getFilterHeading(activeFilter, selectedDay).toLowerCase()}` : ''}
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
                        {'\u{1F4C5} This week'}
                      </div>
                      <div className="mt-1 text-sm font-medium text-white/70">
                        {selectedDay.fullDate}
                      </div>
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
                              tone="today"
                              heroBadge={
                                row.urgencyLabel ? (
                                  <TopBadge className="border-amber-400/30 bg-amber-500/15 text-amber-100">
                                    {row.urgencyLabel}
                                  </TopBadge>
                                ) : row.daySpecialRules.length > 0 ? (
                                  <TopBadge className="border-orange-400/30 bg-orange-500/15 text-orange-100">
                                    {selectedDay.isToday ? 'Special' : row.dayBadgeLabel}
                                  </TopBadge>
                                ) : row.dayHappyHourRules.length > 0 ? (
                                  <TopBadge className="border-pink-400/30 bg-pink-500/15 text-pink-100">
                                    {selectedDay.isToday ? 'Today' : row.dayBadgeLabel}
                                  </TopBadge>
                                ) : (
                                  <TopBadge className="border-orange-400/30 bg-orange-500/15 text-orange-100">
                                    {selectedDay.isToday ? 'Event' : row.dayBadgeLabel}
                                  </TopBadge>
                                )
                              }
                              summary={buildReasonToCare(row.daySpecialRules, row.dayHappyHourRules, row.dayEventRules)}
                              details={buildSecondaryLine(
                                row.daySpecialRules,
                                row.dayHappyHourRules,
                                row.timeHighlights,
                                row.dayBadgeLabel,
                                row.activeKidRule,
                                row.activeDogRule
                              )}
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

function buildDayOptions(): DayOption[] {
  const shortFormatter = new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    timeZone: DISPLAY_TIMEZONE,
  });
  const fullFormatter = new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: DISPLAY_TIMEZONE,
  });

  return Array.from({ length: 6 }, (_, index) => {
    const offset = index + 1;
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const shortText = shortFormatter.format(date);
    const fullText = fullFormatter.format(date);
    const label =
      offset === 1
        ? 'Tomorrow'
        : fullText.split(' ')[0]?.replace(/,$/, '') ?? fullText;

    return {
      offset,
      label,
      shortDate: shortText,
      fullDate: fullText,
      dayOfWeek: getDayOfWeekForOffset(DISPLAY_TIMEZONE, offset),
      isToday: false,
    };
  });
}

function buildWeekRow(venue: Venue, selectedDay: DayOption) {
  const dayHappyHourRules = getRulesForDay(
    getPublishedRulesByType(venue, 'happy_hour'),
    selectedDay.dayOfWeek
  );
  const daySpecialRules = getRulesForDay(getPublishedDealRules(venue), selectedDay.dayOfWeek);
  const dayEventRules = getRulesForDay(getPublishedEventRules(venue), selectedDay.dayOfWeek);
  const activeKidRule =
    getRulesForDay(getPublishedVenueRulesByKind(venue, 'kid'), selectedDay.dayOfWeek)[0] ?? null;
  const activeDogRule =
    getRulesForDay(getPublishedVenueRulesByKind(venue, 'dog'), selectedDay.dayOfWeek)[0] ?? null;
  const dayEventTypes = dayEventRules.map((rule) => rule.schedule_type);
  const isRelevantOnDay =
    dayHappyHourRules.length > 0 ||
    daySpecialRules.length > 0 ||
    dayEventRules.length > 0 ||
    Boolean(activeKidRule || activeDogRule);

  const startTimes = [
    ...daySpecialRules.map((rule) => clockToMinutes(rule.start_time)),
    ...dayHappyHourRules.map((rule) => clockToMinutes(rule.start_time)),
    ...dayEventRules.map((rule) => clockToMinutes(rule.start_time)),
  ];
  const primaryStartMinutes = startTimes.length > 0 ? Math.min(...startTimes) : 18 * 60;
  const hasLunchSpecials = getLunchSpecialEligibleRules(daySpecialRules).length > 0;

  const dayLower = selectedDay.label.toLowerCase();
  const badges = [
    dayEventTypes.includes('trivia') ? `Trivia ${dayLower}` : null,
    dayEventTypes.includes('live_music') ? `Live music ${dayLower}` : null,
    dayEventTypes.includes('comedy') ? `Comedy ${dayLower}` : null,
    dayEventTypes.includes('karaoke') ? `Karaoke ${dayLower}` : null,
    dayEventTypes.includes('sport') ? 'Sport session' : null,
  ].filter(Boolean) as string[];

  const primaryEventType = [
    'trivia',
    'live_music',
    'comedy',
    'karaoke',
    'special_event',
    'sport',
  ].find((type) => dayEventTypes.includes(type as (typeof dayEventTypes)[number]));

  const dayLabel = selectedDay.label;
  const cardEyebrow = daySpecialRules.length > 0
    ? hasLunchSpecials
      ? '\u2600 LUNCH'
      : '\u{1F525} SPECIAL'
    : dayHappyHourRules.length > 0
      ? '\u{1F37B} HAPPY HOUR'
      : primaryEventType === 'trivia'
        ? '\u2753 TRIVIA'
        : primaryEventType === 'live_music'
          ? '\u{1F3B5} LIVE MUSIC'
          : primaryEventType === 'comedy'
            ? '\u{1F3A4} COMEDY'
            : primaryEventType === 'karaoke'
              ? '\u{1F3A4} KARAOKE'
              : primaryEventType === 'sport'
                ? '\u26BD SPORT'
                : '\u{1F4C5} THIS WEEK';

  const timeHighlights = [
    ...daySpecialRules
      .slice(0, 2)
      .map((rule) =>
        buildRangeLabel(rule, rule.schedule_type === 'lunch_special' ? 'Lunch' : 'Special')
      ),
    ...dayHappyHourRules.slice(0, 2).map((rule) => buildRangeLabel(rule, 'Happy hour')),
    ...dayEventRules.slice(0, 2).map((rule) => buildRangeLabel(rule, eventRuleLabel(rule))),
  ];

  return {
    venue,
    daySpecialRules,
    dayHappyHourRules,
    dayEventRules,
    dayEventTypes,
    isRelevantOnDay,
    primaryStartMinutes,
    hasLunchSpecials,
    activeKidRule,
    activeDogRule,
    urgencyLabel: null,
    badges,
    cardEyebrow,
    timeHighlights,
    dayBadgeLabel: dayLabel,
  };
}

function matchesWeekFilter(row: WeekRow, filter: WeekFilter) {
  if (filter === 'all') return true;
  if (filter === 'happy_hour') return row.dayHappyHourRules.length > 0;
  if (filter === 'specials') return row.daySpecialRules.length > 0;
  if (filter === 'lunch_specials') return row.hasLunchSpecials;
  if (filter === 'kid_friendly_now') return Boolean(row.activeKidRule);
  if (filter === 'dog_friendly_now') return Boolean(row.activeDogRule);
  if (filter === 'events') return row.dayEventRules.length > 0;
  if (filter === 'trivia') return row.dayEventTypes.includes('trivia');
  if (filter === 'live_music') return row.dayEventTypes.includes('live_music');
  if (filter === 'comedy') return row.dayEventTypes.includes('comedy');
  if (filter === 'karaoke') return row.dayEventTypes.includes('karaoke');
  return true;
}

function timeRangeOverlapsFilter(startTime: string, endTime: string, filter: TimeFilter) {
  if (filter === 'any') return true;
  const start = clockToMinutes(startTime);
  let end = clockToMinutes(endTime);
  if (end <= start) end += 24 * 60;

  const windows: Record<Exclude<TimeFilter, 'any'>, [number, number]> = {
    afternoon: [12 * 60, 17 * 60],
    evening: [17 * 60, 20 * 60],
    late_night: [20 * 60, 4 * 60],
  };

  const [windowStart, windowEndRaw] = windows[filter];
  const windowEnd =
    windowEndRaw <= windowStart ? windowEndRaw + 24 * 60 : windowEndRaw;

  return (
    (start < windowEnd && end > windowStart) ||
    (start + 24 * 60 < windowEnd && end + 24 * 60 > windowStart) ||
    (start < windowEnd + 24 * 60 && end > windowStart + 24 * 60)
  );
}

function matchesTimeFilter(row: WeekRow, filter: TimeFilter) {
  if (filter === 'any') return true;
  return [...row.daySpecialRules, ...row.dayHappyHourRules, ...row.dayEventRules].some((rule) =>
    timeRangeOverlapsFilter(rule.start_time, rule.end_time, filter)
  );
}

function matchesSearchText(row: WeekRow, searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;

  const searchSource = [
    row.venue.name,
    row.venue.suburb,
    row.venue.address,
    ...row.daySpecialRules.flatMap((rule) => collectRuleSearchParts(rule)),
    ...row.dayHappyHourRules.flatMap((rule) => collectRuleSearchParts(rule)),
    ...row.dayEventRules.flatMap((rule) => collectRuleSearchParts(rule)),
    row.activeKidRule ? getCompactVenueRuleSignal(row.activeKidRule) : null,
    row.activeDogRule ? getCompactVenueRuleSignal(row.activeDogRule) : null,
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

function getFilterHeading(filter: WeekFilter, selectedDay: DayOption) {
  const suffix = selectedDay.isToday ? 'today' : selectedDay.label.toLowerCase();
  if (filter === 'happy_hour') return `Happy hour ${suffix}`;
  if (filter === 'specials') return `Specials ${suffix}`;
  if (filter === 'lunch_specials') return `Lunch specials ${suffix}`;
  if (filter === 'kid_friendly_now') return `Kid friendly ${suffix}`;
  if (filter === 'dog_friendly_now') return `Dog friendly ${suffix}`;
  if (filter === 'events') return `Events ${suffix}`;
  if (filter === 'trivia') return `Trivia ${suffix}`;
  if (filter === 'live_music') return `Live music ${suffix}`;
  if (filter === 'comedy') return `Comedy ${suffix}`;
  if (filter === 'karaoke') return `Karaoke ${suffix}`;
  return selectedDay.isToday ? "What's on today" : `What's on ${suffix}`;
}

function getFilterSectionKind(filter: WeekFilter): SectionKind {
  if (filter === 'happy_hour') return 'happy_hour';
  if (filter === 'specials') return 'specials';
  if (filter === 'lunch_specials') return 'specials';
  if (filter === 'events') return 'events';
  if (filter === 'trivia') return 'events';
  if (filter === 'live_music') return 'events';
  if (filter === 'comedy') return 'events';
  if (filter === 'karaoke') return 'events';
  return 'mixed';
}

function groupRowsByTime(rows: WeekRow[], kind: SectionKind) {
  const groups = new Map<number, WeekRow[]>();

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

function getGroupMinutes(row: WeekRow, kind: SectionKind) {
  if (kind === 'happy_hour' && row.dayHappyHourRules.length > 0) {
    return Math.min(...row.dayHappyHourRules.map((rule) => clockToMinutes(rule.start_time)));
  }

  if (kind === 'specials' && row.daySpecialRules.length > 0) {
    return Math.min(...row.daySpecialRules.map((rule) => clockToMinutes(rule.start_time)));
  }

  if (kind === 'events' && row.dayEventRules.length > 0) {
    return Math.min(...row.dayEventRules.map((rule) => clockToMinutes(rule.start_time)));
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

function TopBadge({
  children,
  className,
}: {
  children: string;
  className: string;
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.75 text-[9px] font-semibold uppercase tracking-[0.12em] ${className}`}
    >
      {children}
    </span>
  );
}

function buildReasonToCare(
  specialRules: VenueScheduleRule[],
  happyHourRules: VenueScheduleRule[],
  eventRules: VenueScheduleRule[]
) {
  if (specialRules.length > 0) {
    return getCompactSpecialLine(specialRules[0]);
  }

  if (happyHourRules.length > 0) {
    return getHappyHourOfferLine(happyHourRules[0]) ?? 'Happy hour this week';
  }

  if (eventRules.length > 0) {
    const firstEvent = eventRules[0];
    return getEventHeroLine(firstEvent);
  }

  return 'Worth planning for';
}

function buildSecondaryLine(
  specialRules: VenueScheduleRule[],
  happyHourRules: VenueScheduleRule[],
  timeHighlights: string[],
  dayBadgeLabel: string,
  activeKidRule?: VenueScheduleRule | null,
  activeDogRule?: VenueScheduleRule | null
) {
  const firstTiming = timeHighlights[0]?.replace(
    /^(Happy hour|Lunch|Special|Trivia|Live music|Comedy|Karaoke|DJ|Event|Sport)\s+/i,
    ''
  );
  const categorySummary =
    happyHourRules.length > 0 ? buildHappyHourCategorySummary(happyHourRules) : null;
  const specialSummary = specialRules[0] ? getCompactSpecialLine(specialRules[0]) : null;
  const supportiveSignals = [activeKidRule, activeDogRule]
    .map((rule) => (rule ? getCompactVenueRuleSignal(rule) : null))
    .filter(Boolean)
    .slice(0, 2)
    .join(' | ');

  if (specialSummary && supportiveSignals) return `${specialSummary} | ${supportiveSignals}`;
  if (specialSummary && firstTiming) return `${specialSummary} | ${firstTiming}`;
  if (categorySummary && firstTiming) return `${categorySummary} | ${firstTiming}`;
  if (supportiveSignals && firstTiming) return `${supportiveSignals} | ${firstTiming}`;
  if (supportiveSignals) return supportiveSignals;
  if (specialSummary) return specialSummary;
  if (categorySummary) return categorySummary;
  return firstTiming ?? dayBadgeLabel;
}

function buildHappyHourCategorySummary(rules: VenueScheduleRule[]) {
  const categories = HAPPY_HOUR_CATEGORIES.filter((category) =>
    rules.some((rule) => getDisplayHappyHourItems(rule.detail_json, category.key).length > 0)
  ).map((category) => category.label.replace(/^[^\s]+\s/, ''));

  return categories.slice(0, 3).join(' | ');
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
  if (text.toLowerCase().includes('from ') || text.toLowerCase().includes('now')) return text;
  return `${text} from ${formatTimeForUi(rule.start_time.slice(0, 5))}`;
}

