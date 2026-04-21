'use client';

import {
  SCHEDULE_TYPE_PICKER_GROUPS,
  type ScheduleType,
  type VenueRuleKind,
} from '@/lib/schedule-rules';

type GroupedScheduleTypeSelectorProps = {
  scheduleType: ScheduleType;
  venueRuleKind: VenueRuleKind;
  onSelect: (scheduleType: ScheduleType, venueRuleKind?: VenueRuleKind) => void;
  variant?: 'admin' | 'portal';
};

export function GroupedScheduleTypeSelector({
  scheduleType,
  venueRuleKind,
  onSelect,
  variant = 'admin',
}: GroupedScheduleTypeSelectorProps) {
  const titleClass =
    variant === 'portal'
      ? 'text-sm font-medium text-white/82'
      : 'text-sm font-medium text-neutral-900';
  const subtitleClass =
    variant === 'portal'
      ? 'mt-1 text-xs leading-5 text-white/58'
      : 'mt-1 text-xs leading-5 text-neutral-500';
  const groupLabelClass =
    variant === 'portal'
      ? 'text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/78'
      : 'text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500';

  return (
    <div>
      <div className={titleClass}>What do you want to update?</div>
      <div className={subtitleClass}>
        Choose one edit type, then work in the form below.
      </div>
      <div className="mt-3 space-y-4">
        {SCHEDULE_TYPE_PICKER_GROUPS.map((group) => (
          <div key={group.label}>
            <div className={groupLabelClass}>{group.label}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {group.options.map((option) => {
                const active =
                  option.scheduleType === 'venue_rule'
                    ? scheduleType === 'venue_rule' && venueRuleKind === option.venueRuleKind
                    : scheduleType === option.scheduleType;

                const buttonClass =
                  variant === 'portal'
                    ? active
                      ? 'border-orange-300/55 bg-orange-500/16 text-orange-50 shadow-[0_0_0_2px_rgba(251,146,60,0.18)]'
                      : 'border-white/10 bg-black/25 text-white/84 hover:bg-white/[0.04]'
                    : active
                      ? 'border-orange-400 bg-orange-500 text-black shadow-[0_0_0_2px_rgba(251,146,60,0.22)]'
                      : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50';

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onSelect(option.scheduleType, option.venueRuleKind)}
                    className={`min-h-[48px] w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${buttonClass}`}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
