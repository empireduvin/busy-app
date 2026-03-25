'use client';

import { getTodayHoursText, type WeeklyHours } from '@/lib/opening-hours';

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

function toPercent(minute: number) {
  return ((minute - WINDOW_START) / WINDOW_TOTAL) * 100;
}

function getSegments(
  hours: WeeklyHours | null | undefined,
  timezone = 'Australia/Sydney'
) {
  if (!hours) return [];

  const dayName = getLocalDayName(timezone) as keyof WeeklyHours;
  const periods = hours[dayName] ?? [];

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

function TimelineRow({
  label,
  text,
  hours,
  timezone,
  colorClass,
}: {
  label: string;
  text: string | null;
  hours: WeeklyHours | null | undefined;
  timezone: string;
  colorClass: string;
}) {
  const segments = getSegments(hours, timezone);
  const nowMinute = getNowMinute(timezone);
  const nowLeft = nowMinute !== null ? toPercent(nowMinute) : null;
  const showNow = nowLeft !== null && nowLeft >= 0 && nowLeft <= 100;

  return (
    <div className="grid grid-cols-[80px_1fr] gap-4">
      <div className="pt-1 text-sm text-white/75">{label}</div>

      <div>
        <div className="mb-2 text-sm text-white">
          {text ?? 'Closed'}
        </div>

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

          {showNow ? (
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

export default function TodayHoursSummary({
  openingHours,
  kitchenHours,
  happyHourHours,
  timezone = 'Australia/Sydney',
}: Props) {
  const openText = getTodayHoursText(openingHours, timezone, { emptyLabel: 'Closed' });
  const kitchenText = getTodayHoursText(kitchenHours, timezone, { emptyLabel: 'Closed' });
  const happyHourText = getTodayHoursText(happyHourHours, timezone, { emptyLabel: 'Closed' });

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.04] to-white/[0.02] p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="text-lg font-semibold text-white">Today</div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-white/70">
          <LegendDot className="bg-emerald-500" label="Open" />
          <LegendDot className="bg-amber-500" label="Kitchen" />
          <LegendDot className="bg-pink-500" label="Happy Hour" />
          <LegendDot className="bg-cyan-400" label="Now" />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-[80px_1fr] gap-4">
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

      <div className="space-y-6">
        <TimelineRow
          label="Open"
          text={openText}
          hours={openingHours}
          timezone={timezone}
          colorClass="bg-emerald-500"
        />

        <TimelineRow
          label="Kitchen"
          text={kitchenText}
          hours={kitchenHours}
          timezone={timezone}
          colorClass="bg-amber-500"
        />

        <TimelineRow
          label="Happy Hour"
          text={happyHourText}
          hours={happyHourHours}
          timezone={timezone}
          colorClass="bg-pink-500"
        />
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