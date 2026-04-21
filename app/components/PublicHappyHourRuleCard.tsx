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
  discoverySummary = false,
}: {
  rule: VenueScheduleRule;
  compact?: boolean;
  discoverySummary?: boolean;
}) {
  const categoriesWithItems = HAPPY_HOUR_CATEGORIES.filter(
    (category) => getDisplayHappyHourItems(rule.detail_json, category.key).length > 0
  );
  const hasStructuredItems = categoriesWithItems.length > 0;
  const summaryCategories = categoriesWithItems.map((category) => category.label);
  const hasFallbackSummary = hasText(rule.deal_text) || hasText(rule.description) || hasText(rule.detail_json?.notes);
  const summaryLabel = summaryCategories.length > 0 ? summaryCategories : hasFallbackSummary ? ['Specials'] : [];

  return (
    <div
      className={[
        discoverySummary
          ? 'rounded-xl border border-white/8 bg-white/[0.03]'
          : 'rounded-2xl border border-pink-400/20 bg-pink-500/10',
        compact ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={[
            'text-[11px] font-semibold uppercase tracking-[0.18em]',
            discoverySummary ? 'text-white/66' : 'text-pink-100/80',
          ].join(' ')}
        >
          Happy Hour
        </div>
        <div
          className={[
            'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
            discoverySummary
              ? 'border border-white/8 bg-black/18 text-white/68'
              : 'border border-pink-300/25 bg-pink-400/10 text-pink-100',
          ].join(' ')}
        >
          {formatTimeForUi(rule.start_time.slice(0, 5))} - {formatTimeForUi(rule.end_time.slice(0, 5))}
        </div>
      </div>

      {discoverySummary ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {summaryLabel.length > 0 ? (
            summaryLabel.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full border border-white/8 bg-black/16 px-2 py-0.5 text-[10px] font-medium text-white/72"
              >
                {label}
              </span>
            ))
          ) : (
            <div className="rounded-xl border border-white/8 bg-black/16 px-3 py-2 text-[12px] text-white/66 sm:text-[13px]">
              Specials listed. Open the venue page for full detail.
            </div>
          )}
        </div>
      ) : null}

      {!discoverySummary && hasStructuredItems ? (
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
                <div className="mt-2 space-y-1.5">
                  {items.map((item, index) =>
                    isFoodCategory ? (
                      <div
                        key={`${category.key}-${index}-${item.title}`}
                        className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 text-[13px] font-medium leading-5 text-white [overflow-wrap:anywhere] break-words sm:text-sm">
                            {item.title}
                          </div>
                          {item.price != null ? (
                            <div className="mt-0.5 shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                              {`$${item.price}`}
                            </div>
                          ) : null}
                        </div>
                        {item.priceLabel ? (
                          <div className="mt-0.5 text-[11px] leading-4 text-amber-200/90 [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                            {item.priceLabel}
                          </div>
                        ) : null}
                        {item.description ? (
                          <div className="mt-0.5 text-[11px] leading-4 text-amber-100/90 [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
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
                            <div className="mt-0.5 text-[11px] leading-4 text-white/64">{item.subtitle}</div>
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

      {!discoverySummary && !hasStructuredItems && (rule.deal_text?.trim() || rule.description?.trim()) ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[13px] text-white/85 sm:text-sm">
          {rule.deal_text?.trim() || rule.description?.trim()}
        </div>
      ) : null}

      {!discoverySummary && hasText(rule.detail_json?.notes) ? (
        <div className="mt-3 text-[11px] leading-4 text-white/60">{rule.detail_json?.notes}</div>
      ) : null}
    </div>
  );
}
