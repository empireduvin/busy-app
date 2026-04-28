'use client';

import { formatTimeForUi } from '@/lib/opening-hours';
import { type ScheduleType } from '@/lib/schedule-rules';
import { hasText, type VenueScheduleRule } from '@/lib/public-venue-discovery';

const EVENT_LABELS: Record<
  Exclude<
    ScheduleType,
    'opening' | 'kitchen' | 'happy_hour' | 'bottle_shop' | 'daily_special' | 'lunch_special' | 'venue_rule'
  >,
  string
> = {
  trivia: 'Trivia',
  live_music: 'Live Music',
  sport: 'Sport Event',
  comedy: 'Comedy',
  karaoke: 'Karaoke',
  dj: 'DJ',
  special_event: 'Special Event',
};

export default function PublicEventRuleCard({
  rule,
  compact = false,
  discoverySummary = false,
}: {
  rule: VenueScheduleRule;
  compact?: boolean;
  discoverySummary?: boolean;
}) {
  const label = EVENT_LABELS[rule.schedule_type as keyof typeof EVENT_LABELS] ?? rule.schedule_type;
  const eventTextParts = [
    rule.title?.trim() || null,
    rule.deal_text?.trim() || null,
    rule.description?.trim() || null,
    rule.notes?.trim() || null,
  ].filter((value): value is string => Boolean(value));
  const extra = eventTextParts.find(
    (value, index) =>
      eventTextParts.findIndex(
        (candidate) => candidate.trim().toLowerCase() === value.trim().toLowerCase()
      ) === index
  ) ?? '';

  return (
    <div
      className={[
        discoverySummary
          ? 'rounded-xl border border-white/8 bg-white/[0.03]'
          : 'rounded-2xl border border-orange-400/20 bg-orange-500/10',
        compact ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={[
            'text-[11px] font-semibold uppercase tracking-[0.18em]',
            discoverySummary ? 'text-white/66' : 'text-orange-100/84',
          ].join(' ')}
        >
          {label}
        </div>
        <div
          className={[
            'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
            discoverySummary
              ? 'border border-white/8 bg-black/18 text-white/68'
              : 'border border-orange-300/25 bg-orange-400/10 text-orange-100',
          ].join(' ')}
        >
          {formatTimeForUi(rule.start_time.slice(0, 5))} - {formatTimeForUi(rule.end_time.slice(0, 5))}
        </div>
      </div>

      {hasText(extra) ? (
        <div
          className={[
            'mt-2',
            discoverySummary ? 'text-[12px] text-white/76 sm:text-[13px]' : 'text-[13px] text-white/84 sm:text-sm',
          ].join(' ')}
        >
          {extra}
        </div>
      ) : null}
    </div>
  );
}
