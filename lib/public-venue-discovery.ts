import { isBottleShopVenueType } from '@/lib/venue-type-rules';

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

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type ScheduleType =
  | 'opening'
  | 'kitchen'
  | 'happy_hour'
  | 'bottle_shop'
  | 'trivia'
  | 'live_music'
  | 'sport'
  | 'comedy'
  | 'karaoke'
  | 'dj'
  | 'special_event';

export type VenueTypeLookup = {
  id: string;
  label?: string | null;
  slug?: string | null;
};

export type HappyHourPrice = {
  label?: string | null;
  amount: number | null;
};

export type HappyHourDetailItem = {
  item?: string | null;
  name?: string | null;
  description?: string | null;
  price?: number | null;
  prices?: HappyHourPrice[] | null;
};

export type HappyHourDetailJson = {
  beer?: HappyHourDetailItem[] | string | null;
  wine?: HappyHourDetailItem[] | string | null;
  spirits?: HappyHourDetailItem[] | string | null;
  cocktails?: HappyHourDetailItem[] | string | null;
  food?: HappyHourDetailItem[] | string | null;
  notes?: string | null;
};

export type DisplayHappyHourItem = {
  title: string;
  subtitle: string | null;
  price: number | null;
  priceLabel: string | null;
  description: string | null;
};

export type VenueScheduleRule = {
  id: string;
  venue_id: string;
  schedule_type: ScheduleType;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  sort_order: number | null;
  title: string | null;
  description: string | null;
  deal_text: string | null;
  notes: string | null;
  is_active: boolean | null;
  status: string | null;
  detail_json?: HappyHourDetailJson | null;
};

export type Venue = {
  id: string;
  name: string | null;
  suburb: string | null;
  venue_type_id: string | null;
  venue_types: VenueTypeLookup | VenueTypeLookup[] | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website_url: string | null;
  booking_url: string | null;
  google_maps_uri: string | null;
  google_rating: number | null;
  google_user_rating_count: number | null;
  price_level: string | null;
  shows_sport: boolean | null;
  plays_with_sound?: boolean | null;
  sport_types: string | null;
  byo_allowed: boolean | null;
  byo_notes: string | null;
  dog_friendly: boolean | null;
  kid_friendly: boolean | null;
  opening_hours: unknown | null;
  kitchen_hours: OpeningHours | null;
  happy_hour_hours: OpeningHours | null;
  bottle_shop_hours?: OpeningHours | null;
  timezone: string | null;
  is_temporarily_closed: boolean | null;
  status: string | null;
  venue_schedule_rules?: VenueScheduleRule[] | null;
};

export const PUBLIC_VENUE_SELECT = `
  id,
  name,
  suburb,
  venue_type_id,
  venue_types (
    id,
    label,
    slug
  ),
  address,
  lat,
  lng,
  phone,
  website_url,
  booking_url,
  google_maps_uri,
  google_rating,
  google_user_rating_count,
  price_level,
  shows_sport,
  plays_with_sound,
  sport_types,
  byo_allowed,
  byo_notes,
  dog_friendly,
  kid_friendly,
  opening_hours,
  kitchen_hours,
  happy_hour_hours,
  timezone,
  is_temporarily_closed,
  status,
  venue_schedule_rules (
    id,
    venue_id,
    schedule_type,
    day_of_week,
    start_time,
    end_time,
    sort_order,
    title,
    description,
    deal_text,
    notes,
    is_active,
    status,
    detail_json
  )
`;

export const INNER_WEST_LIVE_SUBURBS = ['NEWTOWN', 'ENMORE', 'ERSKINEVILLE'] as const;

export const EVENT_SCHEDULE_TYPES: ScheduleType[] = [
  'trivia',
  'live_music',
  'sport',
  'comedy',
  'karaoke',
  'dj',
  'special_event',
];

export const DAY_ORDER: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export const HAPPY_HOUR_CATEGORIES: Array<{
  key: keyof Omit<HappyHourDetailJson, 'notes'>;
  label: string;
}> = [
  { key: 'beer', label: 'Beer' },
  { key: 'wine', label: 'Wine' },
  { key: 'spirits', label: 'Spirits' },
  { key: 'cocktails', label: 'Cocktails' },
  { key: 'food', label: 'Food' },
];

export function normalizeBooleanFlag(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', 'f', '0', 'no', 'n', 'off', ''].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return false;
}

export function normalizeSuburbForLaunch(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase();
}

export function isLiveInnerWestSuburb(value: string | null | undefined) {
  return INNER_WEST_LIVE_SUBURBS.includes(
    normalizeSuburbForLaunch(value) as (typeof INNER_WEST_LIVE_SUBURBS)[number]
  );
}

export function splitVenuesByLaunchArea(venues: Venue[]) {
  return venues.reduce(
    (acc, venue) => {
      if (isLiveInnerWestSuburb(venue.suburb)) {
        acc.live.push(venue);
      } else {
        acc.future.push(venue);
      }
      return acc;
    },
    { live: [] as Venue[], future: [] as Venue[] }
  );
}

export function formatVenueTypeValue(value: string | null | undefined): string | null {
  if (!value) return null;

  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getVenueTypeLabel(venue: Venue): string | null {
  const fallback = formatVenueTypeValue(venue.venue_type_id);

  if (!venue.venue_types) return fallback;

  if (Array.isArray(venue.venue_types)) {
    const first = venue.venue_types[0];
    return first?.label ?? formatVenueTypeValue(first?.slug) ?? fallback;
  }

  return venue.venue_types.label ?? formatVenueTypeValue(venue.venue_types.slug) ?? fallback;
}

export function sortScheduleRules(rules: VenueScheduleRule[]): VenueScheduleRule[] {
  return [...rules].sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week);
    if (dayDiff !== 0) return dayDiff;

    const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (sortDiff !== 0) return sortDiff;

    return (a.start_time ?? '').localeCompare(b.start_time ?? '');
  });
}

export function getPublishedRulesByType(venue: Venue, scheduleType: ScheduleType): VenueScheduleRule[] {
  return sortScheduleRules(
    (venue.venue_schedule_rules ?? []).filter(
      (rule) =>
        rule.schedule_type === scheduleType &&
        rule.is_active === true &&
        rule.status === 'published'
    )
  );
}

export function getPublishedEventRules(venue: Venue): VenueScheduleRule[] {
  return sortScheduleRules(
    (venue.venue_schedule_rules ?? []).filter(
      (rule) =>
        EVENT_SCHEDULE_TYPES.includes(rule.schedule_type) &&
        rule.is_active === true &&
        rule.status === 'published'
    )
  );
}

export function buildHoursJsonFromRules(rules: VenueScheduleRule[]): OpeningHours | null {
  const output: OpeningHours = {};

  for (const day of DAY_ORDER) {
    const matching = rules
      .filter((rule) => rule.day_of_week === day)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((rule) => ({
        open: rule.start_time?.slice(0, 5) ?? '',
        close: rule.end_time?.slice(0, 5) ?? '',
      }))
      .filter((period) => period.open && period.close);

    if (matching.length > 0) {
      output[day] = matching;
    }
  }

  return Object.keys(output).length > 0 ? output : null;
}

export function getEffectiveScheduleHours(venue: Venue, scheduleType: ScheduleType): OpeningHours | null {
  const rules = getPublishedRulesByType(venue, scheduleType);
  const ruleHours = buildHoursJsonFromRules(rules);
  const venueTypeLabel = getVenueTypeLabel(venue);

  if (ruleHours) return ruleHours;

  if (scheduleType === 'kitchen') {
    if (isBottleShopVenueType(venueTypeLabel)) {
      return null;
    }
    return venue.kitchen_hours ?? null;
  }

  if (scheduleType === 'happy_hour') {
    return venue.happy_hour_hours ?? null;
  }

  if (scheduleType === 'bottle_shop') {
    return venue.bottle_shop_hours ?? null;
  }

  return null;
}

export function getTodayDayOfWeek(timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: timezone,
  });

  const value = formatter.format(new Date()).toLowerCase();

  const map: Record<string, DayOfWeek> = {
    monday: 'monday',
    tuesday: 'tuesday',
    wednesday: 'wednesday',
    thursday: 'thursday',
    friday: 'friday',
    saturday: 'saturday',
    sunday: 'sunday',
  };

  return map[value] ?? 'monday';
}

export function getTodayRulesForType(rules: VenueScheduleRule[], timezone: string) {
  const today = getTodayDayOfWeek(timezone);
  return rules.filter((rule) => rule.day_of_week === today);
}

export function buildPublicVenueHref(venue: Pick<Venue, 'name' | 'suburb'>) {
  const basePath = isLiveInnerWestSuburb(venue.suburb) ? '/venues' : '/futurevenues';
  if (!venue.name?.trim()) return basePath;
  return `${basePath}?search=${encodeURIComponent(venue.name.trim())}`;
}

export function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export function getHappyHourItems(
  detail: HappyHourDetailJson | null | undefined,
  category: keyof Omit<HappyHourDetailJson, 'notes'>
): HappyHourDetailItem[] {
  const items = detail?.[category];
  return Array.isArray(items)
    ? items.filter((item) => item && hasText(item.item ?? item.name ?? null))
    : [];
}

export function getDisplayHappyHourItems(
  detail: HappyHourDetailJson | null | undefined,
  category: keyof Omit<HappyHourDetailJson, 'notes'>
): DisplayHappyHourItem[] {
  return getHappyHourItems(detail, category)
    .map((item) => {
      const title = item.item?.trim() || item.name?.trim() || '';
      if (!title) return null;

      const firstPrice =
        Array.isArray(item.prices) && item.prices.length > 0
          ? item.prices.find(
              (price) => typeof price.amount === 'number' && !Number.isNaN(price.amount)
            )
          : typeof item.price === 'number' && !Number.isNaN(item.price)
            ? { label: null, amount: item.price }
            : null;

      return {
        title,
        subtitle: item.description?.trim() || null,
        price: firstPrice?.amount ?? null,
        priceLabel: firstPrice?.label ?? null,
        description: item.description?.trim() || null,
      };
    })
    .filter(Boolean) as DisplayHappyHourItem[];
}

export function formatHappyHourPrice(price: number | null, priceLabel: string | null): string | null {
  if (price == null) return null;
  const amount = `$${price}`;
  return priceLabel ? `${amount} ${priceLabel}` : amount;
}
