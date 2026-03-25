'use client';

import {
  DAY_KEYS,
  DAY_LABELS,
  getDisplayRows,
  type WeeklyHours,
} from '@/lib/opening-hours';

type Props = {
  openingHours: WeeklyHours | null | undefined;
  kitchenHours: WeeklyHours | null | undefined;
  happyHourHours: WeeklyHours | null | undefined;
  timezone?: string;
};

const WINDOW_START = 10 * 60; // 10:00
const WINDOW_END = 28 * 60; // 04:00 next day
const WINDOW_TOTAL = WINDOW_END - WINDOW_START;

const TICKS = [
  { label: '10am', minute: 10 * 60 },
  { label: '12pm', minute: 12 * 60 },
  { label: '2pm', minute: 14 * 60 },
  { label: '4pm', minute: 16 * 60 },
  { label: '6pm', minute: 18 * 60 },
  { label: '8pm', minute: 20 * 60 },
  { label: '10pm', minute: 22 * 60 },
  { label: '12am', minute: 24 * 60 },
  { label: '2am', minute: 26 * 60 },
  { label: '4am', minute: 28 * 60 },
];

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function toPercent(minute: number) {
  return ((minute - WINDOW_START) / WINDOW_TOTAL) * 100;
}

function getLocalDayName(timezone = 'Australia/Sydney') {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    timeZone: timezone,
  })
    .format(new Date())
    .toLowerCase();
}

function getNowMinute(timezone = 'Australia/Sydney'): number | null {
  const timeString = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date());

  const mins = timeToMinutes(timeString);

  if (mins >= WINDOW_START) return mins;
  if (mins <= 4 * 60) return mins + 24 * 60;

  return null;
}

function getSegments(periods: Array<{ open: string; close: string }> | undefined) {
  if (!periods || periods.length === 0) return [];

  return periods
    .map((period) => {
      let start = timeToMinutes(period.open);
      let end = timeToMinutes(period.close);

      if (end <= start) {
        end += 24 * 60;
      }

      const clampedStart = Math.max(start, WINDOW_START);
      const clampedEnd = Math.min(end, WINDOW_END);

      if (clampedEnd <= clampedStart) return null;

      return {
        left: toPercent(clampedStart),
        width: ((clampedEnd - clampedStart) / WINDOW_TOTAL) * 100,
      };
    })
    .filter(Boolean) as Array<{ left: number; width: number }>;
}

function Row({
  label,
  text,
  periods,
  colorClass,
  showNow,
  nowLeft,
}: {
  label: string;
  text: string;
  periods: Array<{ open: string; close: string }>;
  colorClass: string;
  showNow: boolean;
  nowLeft: number | null;
}) {
  const segments = getSegments(periods);

  return (
    <div className="grid grid-cols-[70px_1fr] gap-4">
      <div className="pt-1 text-sm text-white/75">{label}</div>

      <div>
        <div className="mb-2 text-sm text-white">{text}</div>

        <div className="relative h-7 rounded-md border border-white/10 bg-white/[0.03]">
          {TICKS.slice(1, -1).map((tick) => (
            <div
              key={tick.label}
              className="absolute top-0 bottom-0 w-px bg-white/10"
              style={{ left: `${toPercent(tick.minute)}%` }}
            />
          ))}

          {segments.map((segment, index) => (
            <div
              key={index}
              className={`absolute top-1 bottom-1 rounded-md ${colorClass}`}
              style={{
                left: `${segment.left}%`,
                width: `${segment.width}%`,
              }}
            />
          ))}

          {showNow && nowLeft !== null ? (
            <div
              className="absolute top-0 bottom-0 z-20 w-[2px] bg-cyan-400"
              style={{ left: `${nowLeft}%` }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function WeeklyTimelineChart({
  openingHours,
  kitchenHours,
  happyHourHours,
  timezone = 'Australia/Sydney',
}: Props) {
  const openingRows = getDisplayRows(openingHours, { emptyLabel: 'Closed' });
  const kitchenRows = getDisplayRows(kitchenHours, { emptyLabel: 'Closed' });
  const happyHourRows = getDisplayRows(happyHourHours, { emptyLabel: 'Closed' });

  const today = getLocalDayName(timezone);
  const nowMinute = getNowMinute(timezone);
  const nowLeft = nowMinute !== null ? toPercent(nowMinute) : null;
  const showNow = nowLeft !== null && nowLeft >= 0 && nowLeft <= 100;

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.04] to-white/[0.02] p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="text-lg font-semibold text-white">Weekly Timeline</div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-white/70">
          <LegendDot className="bg-emerald-500" label="Open" />
          <LegendDot className="bg-amber-500" label="Kitchen" />
          <LegendDot className="bg-pink-500" label="Happy Hour" />
          <LegendDot className="bg-cyan-400" label="Now" />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-[70px_1fr] gap-4">
        <div />
        <div className="relative h-5 text-xs text-white/50">
          {TICKS.map((tick) => (
            <div
              key={tick.label}
              className="absolute -translate-x-1/2"
              style={{ left: `${toPercent(tick.minute)}%` }}
            >
              {tick.label}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {DAY_KEYS.map((dayKey) => {
          const openingRow = openingRows.find((r) => r.day === dayKey);
          const kitchenRow = kitchenRows.find((r) => r.day === dayKey);
          const happyHourRow = happyHourRows.find((r) => r.day === dayKey);

          const isToday = dayKey === today;

          return (
            <div
              key={dayKey}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="text-lg font-semibold text-white">{DAY_LABELS[dayKey]}</div>
                {isToday ? (
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-300">
                    Today
                  </span>
                ) : null}
              </div>

              <div className="space-y-5">
                <Row
                  label="Open"
                  text={openingRow?.text ?? 'Closed'}
                  periods={openingRow?.periods ?? []}
                  colorClass="bg-emerald-500"
                  showNow={isToday && showNow}
                  nowLeft={isToday ? nowLeft : null}
                />

                <Row
                  label="Kitchen"
                  text={kitchenRow?.text ?? 'Closed'}
                  periods={kitchenRow?.periods ?? []}
                  colorClass="bg-amber-500"
                  showNow={isToday && showNow}
                  nowLeft={isToday ? nowLeft : null}
                />

                <Row
                  label="Happy Hour"
                  text={happyHourRow?.text ?? 'Closed'}
                  periods={happyHourRow?.periods ?? []}
                  colorClass="bg-pink-500"
                  showNow={isToday && showNow}
                  nowLeft={isToday ? nowLeft : null}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegendDot({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-3 w-3 rounded-full ${className}`} />
      <span>{label}</span>
    </div>
  );
}