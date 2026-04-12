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
}: {
  rule: VenueScheduleRule;
  compact?: boolean;
}) {
  const label = EVENT_LABELS[rule.schedule_type as keyof typeof EVENT_LABELS] ?? rule.schedule_type;
  const extra = rule.title?.trim() || rule.deal_text?.trim() || rule.description?.trim() || rule.notes?.trim() || '';

  return (
    <div
      className={[
        'rounded-2xl border border-orange-400/20 bg-orange-500/10',
        compact ? 'p-3' : 'p-4',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100/80">
          {label}
        </div>
        <div className="rounded-full border border-orange-300/25 bg-orange-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-orange-100">
          {formatTimeForUi(rule.start_time.slice(0, 5))} - {formatTimeForUi(rule.end_time.slice(0, 5))}
        </div>
      </div>

      {hasText(extra) ? <div className="mt-2 text-sm text-white/85">{extra}</div> : null}
    </div>
  );
}
