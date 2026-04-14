'use client';

import GoogleMap from '@/app/components/GoogleMap';
import PublicEventRuleCard from '@/app/components/PublicEventRuleCard';
import PublicHappyHourRuleCard from '@/app/components/PublicHappyHourRuleCard';
import PublicVenueCard from '@/app/components/PublicVenueCard';
import { usePublicVenueCollections } from '@/app/components/usePublicVenueCollections';
import { formatTimeForUi } from '@/lib/opening-hours';
import {
  getDayOfWeekForOffset,
  getPublishedEventRules,
  getPublishedRulesByType,
  getRulesForDay,
  hasText,
  type DayOfWeek,
  type Venue,
  type VenueScheduleRule,
} from '@/lib/public-venue-discovery';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

type WeekFilter =
  | 'all'
  | 'happy_hour'
  | 'events'
  | 'trivia'
  | 'live_music'
  | 'comedy'
  | 'karaoke';

type TimeFilter = 'any' | 'afternoon' | 'evening' | 'late_night';
type SectionKind = 'happy_hour' | 'events' | 'mixed';
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
  const [selectedOffset, setSelectedOffset] = useState(0);
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
        .map((venue) => buildWeekRow(venue, selectedDay))
        .filter((row) => row.isRelevantOnDay)
        .filter((row) => matchesWeekFilter(row, activeFilter))
        .filter((row) => matchesTimeFilter(row.primaryStartMinutes, timeFilter))
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
        sectionId: activeFilter === 'all' ? 'week-happy-hour' : 'week-matches',
        emptyLabel: 'No lunch deals',
      },
    ],
    [activeFilter, rows, selectedDay]
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
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-orange-500/20 via-[#120805] to-black p-5 sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            This Week
          </div>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                What&apos;s on this week
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base">
                Start with today, then jump through the next 6 days to see happy hours and events coming up.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
              {headlineStats.map((stat) =>
                stat.value > 0 ? (
                  <a
                    key={stat.label}
                    href={`#${stat.sectionId}`}
                    className="min-h-[76px] rounded-2xl border border-white/10 bg-black/30 px-3 py-3 transition hover:border-orange-300/35 hover:bg-orange-500/10 sm:min-h-[88px] sm:px-4"
                  >
                    <div className="text-lg font-semibold text-white">{stat.value}</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-white/45 sm:text-xs sm:tracking-[0.18em]">
                      {stat.label}
                    </div>
                  </a>
                ) : (
                  <div
                    key={stat.label}
                    className="min-h-[76px] rounded-2xl border border-white/10 bg-black/20 px-3 py-3 opacity-60 sm:min-h-[88px] sm:px-4"
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

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="mb-4 rounded-3xl border border-orange-400/20 bg-orange-500/10 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-200/80">
                  Live options
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">Need something on right now?</h2>
                <p className="mt-1 max-w-2xl text-sm text-white/65">
                  Switch to the live view for venues with happy hours and events already happening.
                </p>
              </div>
              <Link
                href="/livenow"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-orange-300/30 bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 sm:w-auto"
              >
                Open Live Now
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
            {dayOptions.map((option) => {
              const active = option.offset === selectedOffset;
              return (
                <button
                  key={option.offset}
                  type="button"
                  onClick={() => setSelectedOffset(option.offset)}
                  className={[
                    'min-w-0 rounded-2xl border px-3 py-3 text-left transition sm:min-w-[92px] sm:px-4',
                    active
                      ? 'border-orange-400 bg-orange-500 text-black'
                      : 'border-white/10 bg-black/30 text-white/80 hover:bg-white/10',
                  ].join(' ')}
                >
                  <div className="text-sm font-semibold">{option.label}</div>
                  <div className={active ? 'text-xs text-black/70' : 'text-xs text-white/50'}>
                    {option.shortDate}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(220px,1.2fr)_auto] md:items-center">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Search venue, suburb, or ${selectedDay.isToday ? "today's" : `${selectedDay.label.toLowerCase()}'s`} plan`}
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

            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
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

          <div className="mt-3 grid grid-cols-3 gap-2.5 sm:flex sm:flex-wrap">
            {WEEK_FILTERS.map((filter) => {
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

          <div className="mt-3 text-sm text-white/55">
            Viewing {selectedDay.fullDate}.
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
                Back to the full week view across happy hour and events.
              </div>
            </div>
          ) : null}
        </section>

        {showMap ? (
          <section
            ref={mapSectionRef}
            className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                  Map view
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  What&apos;s on {selectedDay.isToday ? 'today' : selectedDay.label.toLowerCase()}
                </h2>
                <div className="mt-1 text-sm text-white/55">
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
          {!loading && !error && rows.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
              <div>Nothing matches this week filter yet.</div>
              <div className="mt-2 text-white/55">
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

          {!loading && !error && rows.length > 0 ? (
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
              Showing {rows.length} venue{rows.length === 1 ? '' : 's'}
              {searchTerm.trim() ? ` for "${searchTerm.trim()}"` : ''}
              {activeFilter !== 'all' ? ` in ${getFilterHeading(activeFilter, selectedDay).toLowerCase()}` : ''}
              {timeFilter !== 'any'
                ? `${activeFilter !== 'all' ? ' during ' : ' for '} ${TIME_FILTERS.find((filter) => filter.value === timeFilter)?.label.toLowerCase()}`
                : ''}
            </div>
          ) : null}

          <div className="space-y-7">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28 space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                        What&apos;s on this week
                      </div>
                      <div className="mt-1 text-sm font-medium text-white/70">
                        {selectedDay.fullDate}
                      </div>
                      <p className="text-sm text-white/55">{section.description}</p>
                    </div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">
                      {section.rows.length} venue{section.rows.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="mt-4 space-y-5">
                    {groupRowsByTime(section.rows, section.kind).map((group) => (
                      <div key={`${section.id}-${group.label}`} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-100">
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
                                row.dayHappyHourRules.length > 0 ? (
                                  <TopBadge className="border-pink-400/30 bg-pink-500/15 text-pink-100">
                                    {selectedDay.isToday ? 'Today' : row.dayBadgeLabel}
                                  </TopBadge>
                                ) : (
                                  <TopBadge className="border-orange-400/30 bg-orange-500/15 text-orange-100">
                                    {selectedDay.isToday ? 'Event' : row.dayBadgeLabel}
                                  </TopBadge>
                                )
                              }
                              summary={
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-2">
                                    {row.dayHappyHourRules.length > 0 ? (
                                      <StatusPill className="border-pink-400/30 bg-pink-500/15 text-pink-100">
                                        {selectedDay.isToday ? 'Happy hour today' : `Happy hour ${row.dayBadgeLabel.toLowerCase()}`}
                                      </StatusPill>
                                    ) : null}
                                    {row.dayEventRules.length > 0 ? (
                                      <StatusPill className="border-orange-400/30 bg-orange-500/15 text-orange-100">
                                        {selectedDay.isToday ? 'Events today' : `Events ${row.dayBadgeLabel.toLowerCase()}`}
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
                                  {row.dayHappyHourRules.map((rule) => (
                                    <PublicHappyHourRuleCard key={rule.id} rule={rule} compact />
                                  ))}
                                  {row.dayEventRules.map((rule) => (
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

  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const shortText = shortFormatter.format(date);
    const fullText = fullFormatter.format(date);
    const label =
      offset === 0
        ? 'Today'
        : fullText.split(' ')[0]?.replace(/,$/, '') ?? fullText;

    return {
      offset,
      label,
      shortDate: shortText,
      fullDate: fullText,
      dayOfWeek: getDayOfWeekForOffset(DISPLAY_TIMEZONE, offset),
      isToday: offset === 0,
    };
  });
}

function buildWeekRow(venue: Venue, selectedDay: DayOption) {
  const dayHappyHourRules = getRulesForDay(
    getPublishedRulesByType(venue, 'happy_hour'),
    selectedDay.dayOfWeek
  );
  const dayEventRules = getRulesForDay(getPublishedEventRules(venue), selectedDay.dayOfWeek);
  const dayEventTypes = dayEventRules.map((rule) => rule.schedule_type);
  const isRelevantOnDay = dayHappyHourRules.length > 0 || dayEventRules.length > 0;

  const startTimes = [
    ...dayHappyHourRules.map((rule) => clockToMinutes(rule.start_time)),
    ...dayEventRules.map((rule) => clockToMinutes(rule.start_time)),
  ];
  const primaryStartMinutes = startTimes.length > 0 ? Math.min(...startTimes) : 18 * 60;
  const hasLunchSpecials = dayHappyHourRules.some((rule) => {
    const minutes = clockToMinutes(rule.start_time);
    return minutes >= 11 * 60 && minutes <= 15 * 60;
  });

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

  const dayLabel = selectedDay.isToday ? 'Today' : selectedDay.label;
  const cardEyebrow =
    dayHappyHourRules.length > 0
      ? `Happy Hour ${dayLabel}`
      : primaryEventType === 'trivia'
        ? `Trivia ${dayLabel}`
        : primaryEventType === 'live_music'
          ? `Live Music ${dayLabel}`
          : primaryEventType === 'comedy'
            ? `Comedy ${dayLabel}`
            : primaryEventType === 'karaoke'
              ? `Karaoke ${dayLabel}`
              : `Events ${dayLabel}`;

  const timeHighlights = [
    ...dayHappyHourRules.slice(0, 2).map((rule) => buildRangeLabel(rule, 'Happy hour')),
    ...dayEventRules.slice(0, 2).map((rule) => buildRangeLabel(rule, eventRuleLabel(rule))),
  ];

  return {
    venue,
    dayHappyHourRules,
    dayEventRules,
    dayEventTypes,
    isRelevantOnDay,
    primaryStartMinutes,
    hasLunchSpecials,
    badges,
    cardEyebrow,
    timeHighlights,
    dayBadgeLabel: dayLabel,
  };
}

function matchesWeekFilter(row: WeekRow, filter: WeekFilter) {
  if (filter === 'all') return true;
  if (filter === 'happy_hour') return row.dayHappyHourRules.length > 0;
  if (filter === 'events') return row.dayEventRules.length > 0;
  if (filter === 'trivia') return row.dayEventTypes.includes('trivia');
  if (filter === 'live_music') return row.dayEventTypes.includes('live_music');
  if (filter === 'comedy') return row.dayEventTypes.includes('comedy');
  if (filter === 'karaoke') return row.dayEventTypes.includes('karaoke');
  return true;
}

function matchesTimeFilter(minutes: number, filter: TimeFilter) {
  if (filter === 'any') return true;
  if (filter === 'afternoon') return minutes >= 12 * 60 && minutes < 17 * 60;
  if (filter === 'evening') return minutes >= 17 * 60 && minutes < 20 * 60;
  if (filter === 'late_night') return minutes >= 20 * 60 || minutes < 4 * 60;
  return true;
}

function matchesSearchText(row: WeekRow, searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;

  const searchSource = [
    row.venue.name,
    row.venue.suburb,
    row.venue.address,
    ...row.dayHappyHourRules.flatMap((rule) => collectRuleSearchParts(rule)),
    ...row.dayEventRules.flatMap((rule) => collectRuleSearchParts(rule)),
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
  if (filter === 'events') return `Events ${suffix}`;
  if (filter === 'trivia') return `Trivia ${suffix}`;
  if (filter === 'live_music') return `Live music ${suffix}`;
  if (filter === 'comedy') return `Comedy ${suffix}`;
  if (filter === 'karaoke') return `Karaoke ${suffix}`;
  return selectedDay.isToday ? 'What&apos;s on today' : `What&apos;s on ${suffix}`;
}

function getFilterSectionKind(filter: WeekFilter): SectionKind {
  if (filter === 'happy_hour') return 'happy_hour';
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
