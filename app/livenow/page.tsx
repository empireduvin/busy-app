'use client';

import PublicEventRuleCard from '@/app/components/PublicEventRuleCard';
import PublicHappyHourRuleCard from '@/app/components/PublicHappyHourRuleCard';
import PublicVenueCard from '@/app/components/PublicVenueCard';
import { usePublicVenueCollections } from '@/app/components/usePublicVenueCollections';
import { formatTimeForUi, isOpenNow } from '@/lib/opening-hours';
import {
  buildHoursJsonFromRules,
  getPublishedEventRules,
  getPublishedRulesByType,
  getTodayRulesForType,
  hasText,
  type Venue,
  type VenueScheduleRule,
} from '@/lib/public-venue-discovery';
import { useMemo, useState } from 'react';

type LiveNowFilter =
  | 'all'
  | 'happy_hour'
  | 'sport'
  | 'trivia'
  | 'live_music'
  | 'comedy'
  | 'ends_soon';

type TimeFilter = 'any' | 'afternoon' | 'evening' | 'late_night';

type LiveNowRow = ReturnType<typeof buildLiveNowRow>;

const LIVE_NOW_FILTERS: Array<{ value: LiveNowFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'happy_hour', label: 'Happy Hour' },
  { value: 'sport', label: 'Sport' },
  { value: 'trivia', label: 'Trivia' },
  { value: 'live_music', label: 'Live Music' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'ends_soon', label: 'Ends Soon' },
];

const TIME_FILTERS: Array<{ value: TimeFilter; label: string }> = [
  { value: 'any', label: 'Any time' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'late_night', label: 'Late night' },
];

export default function LiveNowPage() {
  const { liveVenues, loading, error } = usePublicVenueCollections();
  const [activeFilter, setActiveFilter] = useState<LiveNowFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('any');
  const [searchTerm, setSearchTerm] = useState('');

  const liveRows = useMemo(() => {
    return liveVenues
      .map((venue) => buildLiveNowRow(venue))
      .filter((row) => row.isLiveNow)
      .filter((row) => matchesLiveFilter(row, activeFilter))
      .filter((row) => matchesTimeFilter(row.timeAnchorMinutes, timeFilter))
      .filter((row) => matchesSearchText(row, searchTerm))
      .sort(
        (a, b) =>
          b.urgencyScore - a.urgencyScore ||
          (a.venue.name ?? '').localeCompare(b.venue.name ?? '')
      );
  }, [activeFilter, liveVenues, searchTerm, timeFilter]);

  const sections = useMemo(() => {
    if (activeFilter !== 'all') {
      return [
        {
          id: 'live-matches',
          title: 'Live matches',
          description: 'Filtered picks happening now.',
          rows: liveRows,
        },
      ];
    }

    return [
      {
        id: 'live-now',
        title: 'Live now',
        description: 'On now. Go now.',
        rows: liveRows,
      },
      {
        id: 'happy-hour-live',
        title: 'Happy hour live',
        description: 'Deals already pouring.',
        rows: liveRows.filter((row) => row.liveHappyHourRules.length > 0),
      },
      {
        id: 'sport-live',
        title: 'Sport live',
        description: 'Sport on now, with current venue context.',
        rows: liveRows.filter((row) => row.sportLive),
      },
      {
        id: 'events-live',
        title: 'Events live',
        description: 'Trivia, music, comedy, and other sessions happening now.',
        rows: liveRows.filter((row) => row.liveEventRules.length > 0),
      },
    ].filter((section) => section.rows.length > 0);
  }, [activeFilter, liveRows]);

  const headlineStats = useMemo(
    () => [
      { label: 'Live now', value: liveRows.length, sectionId: 'live-now' },
      {
        label: 'Happy hour live',
        value: liveRows.filter((row) => row.liveHappyHourRules.length > 0).length,
        sectionId: 'happy-hour-live',
      },
      {
        label: 'Sport live',
        value: liveRows.filter((row) => row.sportLive).length,
        sectionId: 'sport-live',
      },
      {
        label: 'Events live',
        value: liveRows.filter((row) => row.liveEventRules.length > 0).length,
        sectionId: 'events-live',
      },
    ],
    [liveRows]
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-orange-500/20 via-[#120805] to-black p-5 sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            Live Now
          </div>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                What&apos;s on right now
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base">
                Happy hours, sport, and live events happening now across Newtown, Enmore, and
                Erskineville.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {headlineStats.map((stat) =>
                stat.value > 0 ? (
                  <a
                    key={stat.label}
                    href={`#${stat.sectionId}`}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 transition hover:border-orange-300/35 hover:bg-orange-500/10"
                  >
                    <div className="text-lg font-semibold text-white">{stat.value}</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">{stat.label}</div>
                  </a>
                ) : (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 opacity-60"
                  >
                    <div className="text-lg font-semibold text-white">{stat.value}</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">{stat.label}</div>
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1.2fr)_auto] md:items-center">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search venue, suburb, or what&apos;s on"
              className="h-11 rounded-2xl border border-white/10 bg-black/35 px-4 text-sm text-white placeholder:text-white/35"
            />

            <div className="flex flex-wrap gap-2">
              {TIME_FILTERS.map((filter) => {
                const active = filter.value === timeFilter;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setTimeFilter(filter.value)}
                    className={[
                      'rounded-full border px-3 py-1.5 text-xs transition',
                      active
                        ? 'border-white/20 bg-white/15 text-white'
                        : 'border-white/10 bg-black/20 text-white/60 hover:bg-white/10',
                    ].join(' ')}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {LIVE_NOW_FILTERS.map((filter) => {
              const active = filter.value === activeFilter;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                  className={[
                    'rounded-full border px-4 py-2 text-sm transition',
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
        </section>

        <section className="mt-5">
          {loading ? <div className="text-white/65">Loading live venues...</div> : null}
          {!loading && error ? (
            <div className="rounded-3xl border border-red-500/30 bg-red-950/30 p-5 text-red-100">
              {error}
            </div>
          ) : null}
          {!loading && !error && liveRows.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
              <div>Nothing&apos;s live for this filter right now.</div>
              <div className="mt-2 text-white/55">
                Try another filter or check Today for what&apos;s coming up next.
              </div>
            </div>
          ) : null}

          <div className="space-y-7">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28 space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                        Live lane
                      </div>
                      <h2 className="mt-1 text-xl font-semibold text-white">{section.title}</h2>
                      <p className="text-sm text-white/55">{section.description}</p>
                    </div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">
                      {section.rows.length} venue{section.rows.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    {section.rows.map((row) => (
                      <PublicVenueCard
                        key={`${section.id}-${row.venue.id}`}
                        venue={row.venue}
                        eyebrow={row.cardEyebrow}
                        badges={row.badges}
                        compact
                        tone="live"
                        heroBadge={
                          row.endsSoon ? (
                            <TopBadge className="border-red-400/30 bg-red-500/15 text-red-100">
                              Ends Soon
                            </TopBadge>
                          ) : row.liveHappyHourRules.length > 0 ? (
                            <TopBadge className="border-pink-400/30 bg-pink-500/15 text-pink-100">
                              Live
                            </TopBadge>
                          ) : row.liveEventRules.length > 0 ? (
                            <TopBadge className="border-orange-400/30 bg-orange-500/15 text-orange-100">
                              Now
                            </TopBadge>
                          ) : null
                        }
                        summary={
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {row.liveHappyHourRules.length > 0 ? (
                                <StatusPill className="border-pink-400/30 bg-pink-500/15 text-pink-100">
                                  Happy hour live
                                </StatusPill>
                              ) : null}
                              {row.liveEventRules.length > 0 ? (
                                <StatusPill className="border-orange-400/30 bg-orange-500/15 text-orange-100">
                                  Live now
                                </StatusPill>
                              ) : null}
                              {row.sportLive ? (
                                <StatusPill className="border-cyan-400/30 bg-cyan-500/15 text-cyan-100">
                                  Sport live now
                                </StatusPill>
                              ) : null}
                              {row.endsSoon ? (
                                <StatusPill className="border-red-400/30 bg-red-500/15 text-red-100">
                                  Ends soon
                                </StatusPill>
                              ) : null}
                            </div>
                            {row.timeHighlights.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {row.timeHighlights.map((highlight) => (
                                  <TimePill key={`${row.venue.id}-${highlight}`}>{highlight}</TimePill>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        }
                        details={
                          <div className="space-y-3">
                            {row.liveHappyHourRules.map((rule) => (
                              <PublicHappyHourRuleCard key={rule.id} rule={rule} compact />
                            ))}
                            {row.liveEventRules.map((rule) => (
                              <PublicEventRuleCard key={rule.id} rule={rule} compact />
                            ))}
                            {row.liveHappyHourRules.length === 0 &&
                            row.liveEventRules.length === 0 &&
                            row.sportLive ? (
                              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">
                                Sport is on now at this venue.
                              </div>
                            ) : null}
                          </div>
                        }
                      />
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
  const liveHappyHourRules = getTodayRulesForType(getPublishedRulesByType(venue, 'happy_hour'), timezone).filter((rule) =>
    isOpenNow(buildHoursJsonFromRules([rule]), timezone)
  );
  const liveEventRules = getTodayRulesForType(getPublishedEventRules(venue), timezone).filter((rule) =>
    isOpenNow(buildHoursJsonFromRules([rule]), timezone)
  );
  const sportLive = Boolean(venue.shows_sport) && liveEventRules.some((rule) => rule.schedule_type === 'sport');
  const isLiveNow = liveHappyHourRules.length > 0 || liveEventRules.length > 0 || sportLive;

  const endTimes = [
    ...liveHappyHourRules.map((rule) => clockToMinutes(rule.end_time)),
    ...liveEventRules.map((rule) => clockToMinutes(rule.end_time)),
  ];
  const soonestEnd = endTimes.length > 0 ? Math.min(...endTimes) : null;
  const endsSoon = soonestEnd !== null && minutesUntil(soonestEnd, timezone) <= 90;

  const timeAnchorMinutes = soonestEnd ?? getCurrentTimeMinutes(timezone);
  const badges = [
    liveEventRules.some((rule) => rule.schedule_type === 'trivia') ? 'Trivia now' : null,
    liveEventRules.some((rule) => rule.schedule_type === 'live_music') ? 'Live music now' : null,
    liveEventRules.some((rule) => rule.schedule_type === 'comedy') ? 'Comedy now' : null,
  ].filter(Boolean) as string[];

  const urgencyScore =
    liveEventRules.length * 50 +
    liveHappyHourRules.length * 40 +
    (sportLive ? 25 : 0) +
    (endsSoon ? 15 : 0);

  const cardEyebrow =
    liveHappyHourRules.length > 0
      ? 'Happy Hour Live'
      : liveEventRules.length > 0
        ? 'Happening Now'
        : 'Sport Live';

  const timeHighlights = [
    ...liveHappyHourRules.slice(0, 2).map((rule) => buildLiveRangeLabel(rule, 'Happy hour')),
    ...liveEventRules.slice(0, 2).map((rule) => buildLiveRangeLabel(rule, eventRuleLabel(rule))),
  ];

  return {
    venue,
    liveHappyHourRules,
    liveEventRules,
    liveEventTypes: liveEventRules.map((rule) => rule.schedule_type),
    sportLive,
    isLiveNow,
    endsSoon,
    timeAnchorMinutes,
    urgencyScore,
    badges,
    cardEyebrow,
    timeHighlights,
  };
}

function matchesLiveFilter(row: LiveNowRow, filter: LiveNowFilter) {
  if (filter === 'all') return true;
  if (filter === 'happy_hour') return row.liveHappyHourRules.length > 0;
  if (filter === 'sport') return row.sportLive || row.liveEventTypes.includes('sport');
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
    ...row.liveHappyHourRules.flatMap((rule) => collectRuleSearchParts(rule)),
    ...row.liveEventRules.flatMap((rule) => collectRuleSearchParts(rule)),
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

function buildLiveRangeLabel(rule: VenueScheduleRule, prefix: string) {
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
  if (rule.schedule_type === 'special_event') return 'Special event';
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
  return targetMinutes >= nowMinutes ? targetMinutes - nowMinutes : targetMinutes + 1440 - nowMinutes;
}

function StatusPill({
  children,
  className,
}: {
  children: string;
  className: string;
}) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${className}`}>{children}</span>;
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
