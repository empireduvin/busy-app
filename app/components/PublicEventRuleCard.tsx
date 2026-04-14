'use client';

import { formatTimeForUi } from '@/lib/opening-hours';
import { hasText, type ScheduleType, type VenueScheduleRule } from '@/lib/public-venue-discovery';

const EVENT_LABELS: Record<Exclude<ScheduleType, 'opening' | 'kitchen' | 'happy_hour' | 'bottle_shop'>, string> = {
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
  const extra = rule.title?.trim() || rule.deal_text?.trim() || rule.description?.trim() || rule.notes?.trim() || '';

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
            discoverySummary ? 'text-white/58' : 'text-orange-100/80',
          ].join(' ')}
        >
          {label}
        </div>
        <div
          className={[
            'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
            discoverySummary
              ? 'border border-white/8 bg-black/18 text-white/62'
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
            discoverySummary ? 'text-[12px] text-white/68 sm:text-[13px]' : 'text-[13px] text-white/82 sm:text-sm',
          ].join(' ')}
        >
          {extra}
        </div>
      ) : null}
    </div>
  );
}
