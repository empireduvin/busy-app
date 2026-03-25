export type OpeningPeriod = {
  open: string;
  close: string;
};

export type OpeningHours = {
  monday?: OpeningPeriod[];
  tuesday?: OpeningPeriod[];
  wednesday?: OpeningPeriod[];
  thursday?: OpeningPeriod[];
  friday?: OpeningPeriod[];
  saturday?: OpeningPeriod[];
  sunday?: OpeningPeriod[];
};

const GOOGLE_DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const APP_DAY_NAMES: Array<keyof OpeningHours> = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

function hasAppDayKeys(value: any): value is OpeningHours {
  if (!isObject(value)) return false;

  return (
    'monday' in value ||
    'tuesday' in value ||
    'wednesday' in value ||
    'thursday' in value ||
    'friday' in value ||
    'saturday' in value ||
    'sunday' in value
  );
}

function makeEmptyHours(): OpeningHours {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

function cleanupHours(hours: OpeningHours): OpeningHours | null {
  const cleaned: OpeningHours = {};
  let hasAny = false;

  for (const day of APP_DAY_NAMES) {
    const periods = hours[day];
    if (periods && periods.length > 0) {
      cleaned[day] = periods;
      hasAny = true;
    }
  }

  return hasAny ? cleaned : null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function fromHourMinute(hour: unknown, minute: unknown): string | null {
  if (typeof hour !== 'number' || typeof minute !== 'number') return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${pad2(hour)}:${pad2(minute)}`;
}

function fromStringTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed.slice(0, 2)}:${trimmed.slice(2, 4)}`;
  }

  return null;
}

function toHHMM(value: any): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    return fromStringTime(value);
  }

  if (isObject(value)) {
    const hm = fromHourMinute(value.hour, value.minute);
    if (hm) return hm;

    if (typeof value.time === 'string') {
      return fromStringTime(value.time);
    }
  }

  return null;
}

function normaliseExistingHours(value: any): OpeningHours | null {
  if (!hasAppDayKeys(value)) return null;

  const result = makeEmptyHours();
  let hasAny = false;

  for (const day of APP_DAY_NAMES) {
    const periods = value[day];
    if (!Array.isArray(periods)) continue;

    for (const period of periods) {
      const open = toHHMM(period?.open);
      const close = toHHMM(period?.close);

      if (!open || !close) continue;

      result[day]?.push({ open, close });
      hasAny = true;
    }
  }

  return hasAny ? cleanupHours(result) : null;
}

export function convertGoogleOpeningHours(input: any): OpeningHours | null {
  if (!input) return null;

  const existing = normaliseExistingHours(input);
  if (existing) return existing;

  if (!isObject(input)) return null;

  const regularPeriods = input?.regularOpeningHours?.periods;
  const currentPeriods = input?.currentOpeningHours?.periods;

  const periods = Array.isArray(regularPeriods)
    ? regularPeriods
    : Array.isArray(currentPeriods)
      ? currentPeriods
      : null;

  if (!periods || periods.length === 0) return null;

  const result = makeEmptyHours();

  for (const period of periods) {
    const open = period?.open;
    const close = period?.close;

    if (!isObject(open)) continue;
    if (typeof open.day !== 'number') continue;

    const openDay = open.day;
    const openTime = toHHMM(open);

    if (openDay < 0 || openDay > 6 || !openTime) continue;

    if (!isObject(close) || typeof close.day !== 'number') {
      const openDayName = GOOGLE_DAY_NAMES[openDay];
      result[openDayName]?.push({
        open: '00:00',
        close: '23:59',
      });
      continue;
    }

    const closeDay = close.day;
    const closeTime = toHHMM(close);

    if (closeDay < 0 || closeDay > 6 || !closeTime) continue;

    const openDayName = GOOGLE_DAY_NAMES[openDay];

    // IMPORTANT:
    // only store the range on the OPENING day.
    // your existing opening-hours logic already handles overnight periods
    // where close < open, so this prevents duplicated display.
    result[openDayName]?.push({
      open: openTime,
      close: closeTime,
    });
  }

  return cleanupHours(result);
}