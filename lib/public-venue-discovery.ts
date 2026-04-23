import { isBottleShopVenueType } from '@/lib/venue-type-rules';
import {
  DAY_OPTIONS,
  DEAL_SCHEDULE_TYPES,
  EVENT_SCHEDULE_TYPES,
  getScheduleTypeLabel,
  type DayOfWeek,
  type ScheduleType,
  type VenueRuleKind,
} from '@/lib/schedule-rules';
import {
  type ScheduleRuleDetailJson,
  normalizeScheduleRuleDetailJson,
} from '@/lib/venue-data';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  detail_json?: ScheduleRuleDetailJson | null;
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
  instagram_url: string | null;
  booking_url: string | null;
  google_maps_uri: string | null;
  google_rating: number | null;
  google_user_rating_count: number | null;
  price_level: string | null;
  shows_sport: boolean | null;
  plays_with_sound?: boolean | null;
  sport_types: string | null;
  sport_notes: string | null;
  byo_allowed: boolean | null;
  byo_notes: string | null;
  dog_friendly: boolean | null;
  dog_friendly_notes: string | null;
  kid_friendly: boolean | null;
  kid_friendly_notes: string | null;
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
  instagram_url,
  booking_url,
  google_maps_uri,
  google_rating,
  google_user_rating_count,
  price_level,
  shows_sport,
  plays_with_sound,
  sport_types,
  sport_notes,
  byo_allowed,
  byo_notes,
  dog_friendly,
  dog_friendly_notes,
  kid_friendly,
  kid_friendly_notes,
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

export const PUBLIC_VENUE_SELECT_WITH_BOTTLE_SHOP = `
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
  instagram_url,
  booking_url,
  google_maps_uri,
  google_rating,
  google_user_rating_count,
  price_level,
  shows_sport,
  plays_with_sound,
  sport_types,
  sport_notes,
  byo_allowed,
  byo_notes,
  dog_friendly,
  dog_friendly_notes,
  kid_friendly,
  kid_friendly_notes,
  opening_hours,
  kitchen_hours,
  happy_hour_hours,
  bottle_shop_hours,
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

export const DAY_ORDER: DayOfWeek[] = DAY_OPTIONS.map((option) => option.value);

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

export function getPublishedVenueRulesByKind(venue: Venue, kind: VenueRuleKind) {
  return sortScheduleRules(
    (venue.venue_schedule_rules ?? []).filter(
      (rule) =>
        rule.schedule_type === 'venue_rule' &&
        rule.is_active === true &&
        rule.status === 'published' &&
        getVenueRuleKind(rule) === kind
    )
  );
}

export function getPublishedDealRules(venue: Venue) {
  return sortScheduleRules(
    (venue.venue_schedule_rules ?? []).filter(
      (rule) =>
        DEAL_SCHEDULE_TYPES.includes(rule.schedule_type) &&
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
  return getDayOfWeekForOffset(timezone, 0);
}

export function getDayOfWeekForOffset(timezone: string, offsetDays = 0) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: timezone,
  });

  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  const value = formatter.format(date).toLowerCase();

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

function normalizeDiscoveryText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

export function isFoodLedSpecialRule(
  rule: Pick<VenueScheduleRule, 'schedule_type' | 'title' | 'deal_text' | 'description' | 'notes'>
) {
  const text = [
    rule.title,
    rule.deal_text,
    rule.description,
    rule.notes,
  ]
    .map((value) => normalizeDiscoveryText(value))
    .join(' ');

  if (rule.schedule_type === 'lunch_special') return true;

  return [
    'parmi',
    'parma',
    'steak',
    'burger',
    'pizza',
    'pasta',
    'taco',
    'tacos',
    'schnitzel',
    'snitzel',
    'roast',
    'meal',
    'lunch',
    'dinner',
    'food',
    'fries',
    'chips',
    'wings',
    'dumpling',
    'dumplings',
    'salad',
    'fish',
    'chicken',
    'beef',
    'rice',
    'noodle',
    'noodles',
    'banh mi',
    'pho',
  ].some((keyword) => text.includes(keyword));
}

function overlapsLunchWindow(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.slice(0, 5).split(':').map(Number);
  const [endHour, endMinute] = endTime.slice(0, 5).split(':').map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;

  if (end <= start) {
    end += 24 * 60;
  }

  const lunchStart = 11 * 60;
  const lunchEnd = 15 * 60;
  return start < lunchEnd && end > lunchStart;
}

export function isLunchSpecialEligibleRule(
  rule: Pick<
    VenueScheduleRule,
    'schedule_type' | 'title' | 'deal_text' | 'description' | 'notes' | 'start_time' | 'end_time'
  >
) {
  if (rule.schedule_type === 'lunch_special') return true;
  if (rule.schedule_type !== 'daily_special') return false;
  if (!isFoodLedSpecialRule(rule)) return false;
  return overlapsLunchWindow(rule.start_time, rule.end_time);
}

export function getLunchSpecialEligibleRules<
  T extends Pick<
    VenueScheduleRule,
    'schedule_type' | 'title' | 'deal_text' | 'description' | 'notes' | 'start_time' | 'end_time'
  >,
>(rules: T[]) {
  return rules.filter((rule) => isLunchSpecialEligibleRule(rule));
}

export function getRulesForDay(rules: VenueScheduleRule[], day: DayOfWeek) {
  return rules.filter((rule) => rule.day_of_week === day);
}

export function getVenueRuleKind(rule: Pick<VenueScheduleRule, 'detail_json'>): VenueRuleKind | null {
  const normalized = normalizeScheduleRuleDetailJson(rule.detail_json);
  return normalized?.rule_kind === 'kid' || normalized?.rule_kind === 'dog'
    ? normalized.rule_kind
    : null;
}

export function getVenueRuleDisplayLabel(kind: VenueRuleKind) {
  return kind === 'kid' ? 'Kids allowed' : 'Dog friendly';
}

export function getSpecialPrice(
  rule: Pick<VenueScheduleRule, 'detail_json'>
): number | null {
  const normalized = normalizeScheduleRuleDetailJson(rule.detail_json);
  return typeof normalized?.special_price === 'number' &&
    Number.isFinite(normalized.special_price)
    ? normalized.special_price
    : null;
}

function formatMoneyCompact(amount: number) {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2).replace(/\.?0+$/, '')}`;
}

function textAlreadyHasPrice(text: string) {
  return /\$\s*\d/.test(text);
}

function prefixSignalWithEmoji(kind: VenueRuleKind | null, text: string | null) {
  if (!kind || !text) return text;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const emoji = kind === 'kid' ? '👶' : '🐶';
  if (trimmed.startsWith(emoji)) return trimmed;
  return `${emoji} ${trimmed}`;
}

export function getCompactVenueRuleSignal(
  rule: Pick<VenueScheduleRule, 'deal_text' | 'description' | 'notes' | 'detail_json'>
) {
  const kind = getVenueRuleKind(rule);
  const fallback = kind === 'kid' ? 'Kids allowed now' : kind === 'dog' ? 'Dog friendly now' : null;
  return prefixSignalWithEmoji(
    kind,
    rule.deal_text?.trim() || rule.description?.trim() || rule.notes?.trim() || fallback
  );
}

export function getCompactSpecialLine(
  rule: Pick<
    VenueScheduleRule,
    'deal_text' | 'description' | 'title' | 'schedule_type' | 'detail_json'
  >
) {
  const specialPrice = getSpecialPrice(rule);
  const dealText = rule.deal_text?.trim() || null;
  const title = rule.title?.trim() || null;
  const description = rule.description?.trim() || null;
  const primaryText = dealText || title || description;

  if (primaryText && (specialPrice == null || textAlreadyHasPrice(primaryText))) {
    return primaryText;
  }

  if (specialPrice != null) {
    const priceLabel = formatMoneyCompact(specialPrice);
    if (rule.schedule_type === 'lunch_special') {
      if (dealText && !textAlreadyHasPrice(dealText)) return `${dealText} ${priceLabel}`;
      if (title && !textAlreadyHasPrice(title)) return `${title} ${priceLabel}`;
      if (description && !textAlreadyHasPrice(description)) return `${description} ${priceLabel}`;
      return `Lunch special ${priceLabel}`;
    }

    if (dealText && !textAlreadyHasPrice(dealText)) return `${dealText} ${priceLabel}`;
    if (title && !textAlreadyHasPrice(title)) return `${title} ${priceLabel}`;
    if (description && !textAlreadyHasPrice(description)) return `${description} ${priceLabel}`;
    return `Daily special ${priceLabel}`;
  }

  if (rule.schedule_type === 'daily_special') return 'Daily special';
  if (rule.schedule_type === 'lunch_special') return 'Lunch special';
  return getScheduleTypeLabel(rule.schedule_type);
}

export function buildPublicVenueHref(venue: Pick<Venue, 'id' | 'name' | 'suburb'>) {
  if (venue.id?.trim()) {
    return `/venues/${encodeURIComponent(venue.id.trim())}`;
  }

  const basePath = isLiveInnerWestSuburb(venue.suburb) ? '/venues' : '/futurevenues';
  if (!venue.name?.trim()) return basePath;
  return `${basePath}?search=${encodeURIComponent(venue.name.trim())}`;
}

function isMissingBottleShopHoursColumnError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('column') &&
    message.includes('bottle_shop_hours') &&
    message.includes('does not exist')
  );
}

export async function fetchPublicVenues(
  supabase: SupabaseClient,
  options?: {
    orderByName?: boolean;
    venueId?: string;
  }
) {
  const buildQuery = (selectText: string) => {
    let query = supabase.from('venues').select(selectText);

    if (options?.venueId) {
      query = query.eq('id', options.venueId);
    }

    if (options?.orderByName) {
      query = query.order('name', { ascending: true });
    }

    return query;
  };

  const primaryResult = await buildQuery(PUBLIC_VENUE_SELECT_WITH_BOTTLE_SHOP);

  if (!isMissingBottleShopHoursColumnError(primaryResult.error)) {
    return primaryResult;
  }

  return buildQuery(PUBLIC_VENUE_SELECT);
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
