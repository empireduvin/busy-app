'use client';

import {
  formatHappyHourPrice,
  getDisplayHappyHourItems,
  HAPPY_HOUR_CATEGORIES,
  hasText,
  type VenueScheduleRule,
} from '@/lib/public-venue-discovery';
import { formatTimeForUi } from '@/lib/opening-hours';

export default function PublicHappyHourRuleCard({
  rule,
  compact = false,
}: {
  rule: VenueScheduleRule;
  compact?: boolean;
}) {
  const hasStructuredItems = HAPPY_HOUR_CATEGORIES.some(
    (category) => getDisplayHappyHourItems(rule.detail_json, category.key).length > 0
  );

  return (
    <div
      className={[
        'rounded-2xl border border-pink-400/20 bg-pink-500/10',
        compact ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-pink-100/75">
          Happy Hour
        </div>
        <div className="rounded-full border border-pink-300/25 bg-pink-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-pink-100">
          {formatTimeForUi(rule.start_time.slice(0, 5))} - {formatTimeForUi(rule.end_time.slice(0, 5))}
        </div>
      </div>

      {hasStructuredItems ? (
        <div className={['mt-3 grid gap-2', compact ? 'grid-cols-1' : 'md:grid-cols-2'].join(' ')}>
          {HAPPY_HOUR_CATEGORIES.map((category) => {
            const items = getDisplayHappyHourItems(rule.detail_json, category.key);
            if (items.length === 0) return null;
            const isFoodCategory = category.key === 'food';

            return (
              <div
                key={category.key}
                className="rounded-xl border border-white/10 bg-black/20 p-2.5 sm:p-3"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  {category.label}
                </div>
                <div className="mt-2 space-y-2">
                  {items.map((item, index) =>
                    isFoodCategory ? (
                      <div
                        key={`${category.key}-${index}-${item.title}`}
                        className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <div className="space-y-2">
                          <div className="text-[13px] font-medium leading-5 text-white [overflow-wrap:anywhere] break-words sm:text-sm">
                            {item.title}
                          </div>
                          {item.price != null ? (
                            <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                              {`$${item.price}`}
                            </div>
                          ) : null}
                        </div>
                        {item.priceLabel ? (
                          <div className="mt-1 text-[11px] leading-4 text-amber-200/90 [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                            {item.priceLabel}
                          </div>
                        ) : null}
                        {item.description ? (
                          <div className="mt-1 text-[11px] leading-4 text-amber-100/90 [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                            {item.description}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div
                        key={`${category.key}-${index}-${item.title}`}
                        className="flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium leading-5 text-white sm:text-sm">{item.title}</div>
                          {item.subtitle ? (
                            <div className="mt-0.5 text-[11px] leading-4 text-white/55">{item.subtitle}</div>
                          ) : null}
                        </div>
                        {item.price != null ? (
                          <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                            {formatHappyHourPrice(item.price, item.priceLabel)}
                          </div>
                        ) : null}
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!hasStructuredItems && (rule.deal_text?.trim() || rule.description?.trim()) ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[13px] text-white/85 sm:text-sm">
          {rule.deal_text?.trim() || rule.description?.trim()}
        </div>
      ) : null}

      {hasText(rule.detail_json?.notes) ? (
        <div className="mt-3 text-[11px] leading-4 text-white/50">{rule.detail_json?.notes}</div>
      ) : null}
    </div>
  );
}
