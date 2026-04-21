export type TimePeriod = {
  open: string;
  close: string;
};

export type WeeklyHours = {
  monday?: TimePeriod[];
  tuesday?: TimePeriod[];
  wednesday?: TimePeriod[];
  thursday?: TimePeriod[];
  friday?: TimePeriod[];
  saturday?: TimePeriod[];
  sunday?: TimePeriod[];
};

export const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function formatTimeForUi(value: string): string {
  const minutes = timeToMinutes(value);
  const hrs = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const suffix = hrs >= 12 ? 'pm' : 'am';
  const displayHour = hrs % 12 === 0 ? 12 : hrs % 12;

  if (mins === 0) return `${displayHour} ${suffix}`;
  return `${displayHour}:${String(mins).padStart(2, '0')} ${suffix}`;
}

function minutesTo12Hour(minutes: number): string {
  const hrs = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const suffix = hrs >= 12 ? 'pm' : 'am';
  const displayHour = hrs % 12 === 0 ? 12 : hrs % 12;

  if (mins === 0) return `${displayHour} ${suffix}`;
  return `${displayHour}:${String(mins).padStart(2, '0')} ${suffix}`;
}

function getNowParts(timezone = 'Australia/Sydney') {
  const now = new Date();

  const dayName = new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    timeZone: timezone,
  })
    .format(now)
    .toLowerCase() as keyof WeeklyHours;

  const timeString = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(now);

  return {
    dayName,
    minutesNow: timeToMinutes(timeString),
  };
}

export function isOpenNow(
  hours: WeeklyHours | null | undefined,
  timezone = 'Australia/Sydney',
  isClosed = false
): boolean {
  if (!hours || isClosed) return false;

  const { dayName, minutesNow } = getNowParts(timezone);
  const todayPeriods = hours[dayName] ?? [];

  for (const period of todayPeriods) {
    const openMin = timeToMinutes(period.open);
    const closeMin = timeToMinutes(period.close);

    if (closeMin > openMin) {
      if (minutesNow >= openMin && minutesNow < closeMin) return true;
    } else {
      if (minutesNow >= openMin || minutesNow < closeMin) return true;
    }
  }

  const dayIndex = DAY_KEYS.indexOf(dayName as (typeof DAY_KEYS)[number]);
  const previousDay = DAY_KEYS[(dayIndex + 6) % 7];
  const prevPeriods = hours[previousDay] ?? [];

  for (const period of prevPeriods) {
    const openMin = timeToMinutes(period.open);
    const closeMin = timeToMinutes(period.close);

    if (closeMin <= openMin && minutesNow < closeMin) {
      return true;
    }
  }

  return false;
}

export function getClosingSoonText(
  hours: WeeklyHours | null | undefined,
  timezone = 'Australia/Sydney',
  isClosed = false,
  thresholdMinutes = 60
): string | null {
  if (!hours || isClosed) return null;

  const { dayName, minutesNow } = getNowParts(timezone);
  const todayPeriods = hours[dayName] ?? [];

  for (const period of todayPeriods) {
    const openMin = timeToMinutes(period.open);
    const closeMin = timeToMinutes(period.close);

    if (closeMin > openMin) {
      if (minutesNow >= openMin && minutesNow < closeMin) {
        const remaining = closeMin - minutesNow;
        if (remaining <= thresholdMinutes) return `Closing in ${remaining} min`;
      }
    } else {
      if (minutesNow >= openMin) {
        const remaining = 24 * 60 - minutesNow + closeMin;
        if (remaining <= thresholdMinutes) return `Closing in ${remaining} min`;
      } else if (minutesNow < closeMin) {
        const remaining = closeMin - minutesNow;
        if (remaining <= thresholdMinutes) return `Closing in ${remaining} min`;
      }
    }
  }

  return null;
}

export function getNextOpeningText(
  hours: WeeklyHours | null | undefined,
  timezone = 'Australia/Sydney',
  isClosed = false
): string | null {
  if (!hours || isClosed) return null;
  if (isOpenNow(hours, timezone, isClosed)) return null;

  const { dayName, minutesNow } = getNowParts(timezone);
  const currentIndex = DAY_KEYS.indexOf(dayName as (typeof DAY_KEYS)[number]);

  for (let offset = 0; offset < 7; offset++) {
    const dayIndex = (currentIndex + offset) % 7;
    const dayKey = DAY_KEYS[dayIndex];
    const periods = hours[dayKey] ?? [];

    if (!periods.length) continue;

    for (const period of periods) {
      const openMin = timeToMinutes(period.open);

      if (offset === 0) {
        if (openMin > minutesNow) return `Opens at ${minutesTo12Hour(openMin)}`;
      } else if (offset === 1) {
        return `Opens tomorrow at ${minutesTo12Hour(openMin)}`;
      } else {
        const label = dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
        return `Opens ${label} at ${minutesTo12Hour(openMin)}`;
      }
    }
  }

  return null;
}

export function isOpenLate(
  hours: WeeklyHours | null | undefined,
  threshold = '02:00'
): boolean {
  if (!hours) return false;

  const thresholdMin = timeToMinutes(threshold);

  for (const day of DAY_KEYS) {
    const periods = hours[day] ?? [];
    for (const period of periods) {
      const openMin = timeToMinutes(period.open);
      const closeMin = timeToMinutes(period.close);

      if (closeMin <= openMin && closeMin > thresholdMin) return true;
    }
  }

  return false;
}

export function getDisplayRows(
  hours: WeeklyHours | null | undefined,
  options?: { emptyLabel?: string }
) {
  const emptyLabel = options?.emptyLabel ?? 'Closed';

  return DAY_KEYS.map((day) => {
    const periods = hours?.[day] ?? [];
    return {
      day,
      label: DAY_LABELS[day],
      periods,
      text: periods.length
        ? periods
            .map((p) => `${formatTimeForUi(p.open)} - ${formatTimeForUi(p.close)}`)
            .join(', ')
        : emptyLabel,
    };
  });
}

export function getTodayHoursText(
  hours: WeeklyHours | null | undefined,
  timezone = 'Australia/Sydney',
  options?: { emptyLabel?: string }
): string | null {
  if (!hours) return options?.emptyLabel ?? 'Closed';

  const { dayName } = getNowParts(timezone);
  const periods = hours[dayName] ?? [];
  const emptyLabel = options?.emptyLabel ?? 'Closed';

  if (!periods.length) return emptyLabel;

  return periods
    .map((p) => `${formatTimeForUi(p.open)} - ${formatTimeForUi(p.close)}`)
    .join(', ');
}

export type OpeningPeriod = TimePeriod;
export type OpeningHours = WeeklyHours;

export function isVenueOpenNow(
  openingHours: OpeningHours | null | undefined,
  timezone = 'Australia/Sydney',
  isTemporarilyClosed = false
) {
  return isOpenNow(openingHours, timezone, isTemporarilyClosed);
}
