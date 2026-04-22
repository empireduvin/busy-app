'use client';

import SaveVenueButton from '@/app/components/SaveVenueButton';
import { convertGoogleOpeningHours } from '@/lib/convert-google-hours';
import { isBottleShopVenueType } from '@/lib/venue-type-rules';
import { getVenueProductGuardrails } from '@/lib/venue-product-guardrails';
import {
  getCompactSpecialLine,
  getSpecialPrice,
  getCompactVenueRuleSignal,
  fetchPublicVenues,
  getPublishedDealRules,
  getPublishedVenueRulesByKind,
  splitVenuesByLaunchArea,
} from '@/lib/public-venue-discovery';
import { buildPublicVenueHref } from '@/lib/public-venue-discovery';
import {
  formatTimeForUi,
  getClosingSoonText,
  getNextOpeningText,
  isOpenLate,
  isOpenNow,
  isVenueOpenNow,
} from '@/lib/opening-hours';
import type { ReactNode } from 'react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeInstagramUrl } from '@/lib/social-links';
import type { HappyHourDetailItem, HappyHourPrice, ScheduleRuleDetailJson } from '@/lib/venue-data';
import GoogleMap from '../components/GoogleMap';
import TodayHoursSummary from '../components/TodayHoursSummary';
import WeeklyTimelineChart from '../components/WeeklyTimelineChart';
import { useSearchParams } from 'next/navigation';

type OpeningPeriod = {
  open: string;
  close: string;
};

type OpeningHours = {
  monday?: OpeningPeriod[];
  tuesday?: OpeningPeriod[];
  wednesday?: OpeningPeriod[];
  thursday?: OpeningPeriod[];
  friday?: OpeningPeriod[];
  saturday?: OpeningPeriod[];
  sunday?: OpeningPeriod[];
};

type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

type ScheduleType =
  | 'opening'
  | 'kitchen'
  | 'happy_hour'
  | 'bottle_shop'
  | 'daily_special'
  | 'lunch_special'
  | 'venue_rule'
  | 'trivia'
  | 'live_music'
  | 'sport'
  | 'comedy'
  | 'karaoke'
  | 'dj'
  | 'special_event';

type VenueTypeLookup = {
  id: string;
  label?: string | null;
  slug?: string | null;
};

type HappyHourDetailJson = ScheduleRuleDetailJson;

type DisplayHappyHourItem = {
  title: string;
  subtitle: string | null;
  price: number | null;
  priceLabel: string | null;
  description: string | null;
};

type VenueScheduleRule = {
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

type Venue = {
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

  opening_hours: any | null;
  kitchen_hours: OpeningHours | null;
  happy_hour_hours: OpeningHours | null;
  bottle_shop_hours?: OpeningHours | null;

  timezone: string | null;
  is_temporarily_closed: boolean | null;

  status: string | null;

  venue_schedule_rules?: VenueScheduleRule[] | null;
};

type SearchSuggestion = {
  kind: 'venue' | 'suburb';
  label: string;
  value: string;
  helper: string;
};

const DAY_ORDER: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

const HAPPY_HOUR_CATEGORIES: Array<{
  key: keyof Omit<HappyHourDetailJson, 'notes'>;
  label: string;
}> = [
  { key: 'beer', label: '\u{1F37A} Beer' },
  { key: 'wine', label: '\u{1F377} Wine' },
  { key: 'spirits', label: '\u{1F943} Spirits' },
  { key: 'cocktails', label: '\u{1F378} Cocktails' },
  { key: 'food', label: '\u{1F354} Food' },
];

const EVENT_SCHEDULE_TYPES: ScheduleType[] = [
  'trivia',
  'live_music',
  'sport',
  'comedy',
  'karaoke',
  'dj',
  'special_event',
];

const EVENT_FILTER_OPTIONS: Array<{ type: ScheduleType; label: string }> = [
  { type: 'trivia', label: '\u2753 Trivia' },
  { type: 'live_music', label: '\u{1F3B8} Live Music' },
  { type: 'sport', label: '\u{1F3DF}\uFE0F Sport Events' },
  { type: 'comedy', label: '\u{1F602} Comedy' },
  { type: 'karaoke', label: '\u{1F3A4} Karaoke' },
  { type: 'dj', label: '\u{1F3A7} DJ' },
  { type: 'special_event', label: '\u2728 Special Event' },
];

const DEFAULT_VENUE_TYPE_FILTERS = ['Bottle Shop'];

function hasText(v: string | null | undefined) {
  return Boolean(v && v.trim().length > 0);
}

function normalizeBooleanFlag(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', 'f', '0', 'no', 'n', 'off', ''].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return false;
}

function hasValidCoords(lat: number | null, lng: number | null) {
  return (
    typeof lat === 'number' &&
    !Number.isNaN(lat) &&
    typeof lng === 'number' &&
    !Number.isNaN(lng)
  );
}

function formatVenueTypeValue(value: string | null | undefined): string | null {
  if (!value) return null;

  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getVenueTypeLabel(venue: Venue): string | null {
  const fallback = formatVenueTypeValue(venue.venue_type_id);

  if (!venue.venue_types) return fallback;

  if (Array.isArray(venue.venue_types)) {
    const first = venue.venue_types[0];
    return first?.label ?? formatVenueTypeValue(first?.slug) ?? fallback;
  }

  return venue.venue_types.label ?? formatVenueTypeValue(venue.venue_types.slug) ?? fallback;
}

function formatReviewCount(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value.toLocaleString();
}

function formatGoogleRating(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value.toFixed(1);
}

function formatPriceLevel(priceLevel: string | null | undefined): string | null {
  if (!priceLevel) return null;

  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '$',
    PRICE_LEVEL_MODERATE: '$$',
    PRICE_LEVEL_EXPENSIVE: '$$$',
    PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
  };

  return map[priceLevel] ?? null;
}

function getPriceRank(priceLevel: string | null | undefined): number | null {
  if (!priceLevel) return null;

  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };

  return map[priceLevel] ?? null;
}

function matchesMinRating(
  rating: number | null | undefined,
  minRating: string
): boolean {
  if (minRating === 'ALL') return true;
  if (typeof rating !== 'number' || Number.isNaN(rating)) return false;

  return rating >= Number(minRating);
}

function matchesPriceLevel(
  priceLevel: string | null | undefined,
  selected: string
): boolean {
  if (selected === 'ALL') return true;

  const label = formatPriceLevel(priceLevel);
  return label === selected;
}

function matchesVenueTypeFilter(
  selectedType: string,
  venueTypeLabel: string,
  bottleShopHours: OpeningHours | null | undefined
): boolean {
  if (selectedType === 'ALL') return true;

  if (selectedType === 'Bottle Shop') {
    return venueTypeLabel === 'Bottle Shop' || hasAnyHours(bottleShopHours);
  }

  return venueTypeLabel === selectedType;
}

function normalizeSearchValue(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function getSearchPriority(value: string | null | undefined, term: string): number | null {
  const normalizedValue = normalizeSearchValue(value);
  if (!normalizedValue) return null;
  if (normalizedValue === term) return 0;
  if (normalizedValue.startsWith(term)) return 1;
  if (normalizedValue.includes(term)) return 2;
  return null;
}

function matchesSearchTerm(venue: Venue, searchTerm: string): boolean {
  const term = normalizeSearchValue(searchTerm);

  if (!term) return true;

  const venueTypeLabel = getVenueTypeLabel(venue);

  const scheduleFields = (venue.venue_schedule_rules ?? [])
    .filter(
      (rule) =>
        (EVENT_SCHEDULE_TYPES.includes(rule.schedule_type) ||
          rule.schedule_type === 'daily_special' ||
          rule.schedule_type === 'lunch_special' ||
          rule.schedule_type === 'venue_rule') &&
        rule.is_active === true &&
        rule.status === 'published'
    )
    .flatMap((rule) => [rule.title, rule.description, rule.deal_text, rule.notes]);

  const searchableFields = [
    venue.name,
    venue.suburb,
    venue.address,
    venueTypeLabel,
    ...scheduleFields,
  ];

  return searchableFields.some((field) => normalizeSearchValue(field).includes(term));
}

function formatRuleTime(value: string | null | undefined): string {
  if (!value) return '';
  return formatTimeForUi(value.slice(0, 5));
}

function sortScheduleRules(rules: VenueScheduleRule[]): VenueScheduleRule[] {
  return [...rules].sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week);
    if (dayDiff !== 0) return dayDiff;

    const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (sortDiff !== 0) return sortDiff;

    return (a.start_time ?? '').localeCompare(b.start_time ?? '');
  });
}

function getPublishedRulesByType(
  venue: Venue,
  scheduleType: ScheduleType
): VenueScheduleRule[] {
  return sortScheduleRules(
    (venue.venue_schedule_rules ?? []).filter(
      (rule) =>
        rule.schedule_type === scheduleType &&
        rule.is_active === true &&
        rule.status === 'published'
    )
  );
}

function getPublishedEventRules(venue: Venue): VenueScheduleRule[] {
  return sortScheduleRules(
    (venue.venue_schedule_rules ?? []).filter(
      (rule) =>
        EVENT_SCHEDULE_TYPES.includes(rule.schedule_type) &&
        rule.is_active === true &&
        rule.status === 'published'
    )
  );
}

function buildHoursJsonFromRules(rules: VenueScheduleRule[]): OpeningHours | null {
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

function hasAnyHours(hours: OpeningHours | null | undefined) {
  if (!hours) return false;

  return DAY_ORDER.some((day) => Array.isArray(hours[day]) && (hours[day]?.length ?? 0) > 0);
}

function getEffectiveScheduleHours(venue: Venue, scheduleType: ScheduleType): OpeningHours | null {
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

function getTodayDayOfWeek(timezone: string): DayOfWeek {
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

function getTodayHappyHourRules(
  rules: VenueScheduleRule[],
  timezone: string
): VenueScheduleRule[] {
  const today = getTodayDayOfWeek(timezone);
  return rules.filter((rule) => rule.day_of_week === today);
}

function getHappyHourItems(
  detail: HappyHourDetailJson | null | undefined,
  category: keyof Omit<HappyHourDetailJson, 'notes'>
): HappyHourDetailItem[] {
  const items = detail?.[category];
  return Array.isArray(items) ? items.filter((item) => item && hasText(item.item)) : [];
}

function getDisplayHappyHourItems(
  detail: HappyHourDetailJson | null | undefined,
  category: keyof Omit<HappyHourDetailJson, 'notes'>
): DisplayHappyHourItem[] {
  return getHappyHourItems(detail, category)
    .map((item) => {
      const title = item.item?.trim() || item.name?.trim() || '';
      if (!title) return null;

      const firstPrice =
        Array.isArray(item.prices) && item.prices.length > 0
          ? item.prices.find((price) => typeof price.amount === 'number' && !Number.isNaN(price.amount))
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

function formatHappyHourPrice(
  price: number | null,
  priceLabel: string | null
): string | null {
  if (price == null) return null;
  const amount = `$${price}`;
  return priceLabel ? `${amount} ${priceLabel}` : amount;
}

function formatHappyHourAmount(price: number | null): string | null {
  if (price == null) return null;
  return `$${price}`;
}

function hasHappyHourItems(
  detail: HappyHourDetailJson | null | undefined,
  category: keyof Omit<HappyHourDetailJson, 'notes'>
): boolean {
  return getHappyHourItems(detail, category).length > 0;
}

function getMinCategoryPrice(
  rules: VenueScheduleRule[],
  category: keyof Omit<HappyHourDetailJson, 'notes'>
): number | null {
  const prices = rules.flatMap((rule) =>
    getHappyHourItems(rule.detail_json, category)
      .map((item) => item.price)
      .filter((price): price is number => typeof price === 'number' && !Number.isNaN(price))
  );

  if (!prices.length) return null;
  return Math.min(...prices);
}

function getOverallMinHappyHourPrice(rules: VenueScheduleRule[]): number | null {
  const categories: Array<keyof Omit<HappyHourDetailJson, 'notes'>> = [
    'beer',
    'wine',
    'spirits',
    'cocktails',
    'food',
  ];

  const prices = categories.flatMap((category) =>
    rules.flatMap((rule) =>
      getHappyHourItems(rule.detail_json, category)
        .map((item) => item.price)
        .filter((price): price is number => typeof price === 'number' && !Number.isNaN(price))
    )
  );

  if (!prices.length) return null;
  return Math.min(...prices);
}

function getMinSpecialPrice(
  rules: VenueScheduleRule[],
  scheduleType?: 'daily_special' | 'lunch_special'
): number | null {
  const prices = rules
    .filter((rule) => (scheduleType ? rule.schedule_type === scheduleType : true))
    .map((rule) => getSpecialPrice(rule))
    .filter((price): price is number => typeof price === 'number' && !Number.isNaN(price));

  if (!prices.length) return null;
  return Math.min(...prices);
}

function matchesMaxPrice(value: number | null, selected: string): boolean {
  if (selected === 'ALL') return true;
  if (value == null) return false;
  return value <= Number(selected);
}

function VenuesPageContent() {
  const searchParams = useSearchParams();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>(() => searchParams.get('search') ?? '');
  const [suburb, setSuburb] = useState<string>('ALL');
  const [venueType, setVenueType] = useState<string>('ALL');

  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [openLateOnly, setOpenLateOnly] = useState(false);
  const [happyHourNowOnly, setHappyHourNowOnly] = useState(false);
  const [foodDealsNowOnly, setFoodDealsNowOnly] = useState(false);
  const [lunchSpecialsOnly, setLunchSpecialsOnly] = useState(false);
  const [specialsTodayOnly, setSpecialsTodayOnly] = useState(false);
  const [kitchenOpenNowOnly, setKitchenOpenNowOnly] = useState(false);

  const [filterSport, setFilterSport] = useState(false);
  const [filterBYO, setFilterBYO] = useState(false);
  const [filterDog, setFilterDog] = useState(false);
  const [filterKid, setFilterKid] = useState(false);
  const [filterDogNow, setFilterDogNow] = useState(false);
  const [filterKidNow, setFilterKidNow] = useState(false);
  const [eventsOnly, setEventsOnly] = useState(false);
  const [eventFilters, setEventFilters] = useState<Record<string, boolean>>({
    trivia: false,
    live_music: false,
    sport: false,
    comedy: false,
    karaoke: false,
    dj: false,
    special_event: false,
  });

  const [hhWine, setHhWine] = useState(false);
  const [hhBeer, setHhBeer] = useState(false);
  const [hhSpirits, setHhSpirits] = useState(false);
  const [hhCocktails, setHhCocktails] = useState(false);
  const [hhFood, setHhFood] = useState(false);

  const [beerMaxPrice, setBeerMaxPrice] = useState<string>('ALL');
  const [wineMaxPrice, setWineMaxPrice] = useState<string>('ALL');
  const [cocktailMaxPrice, setCocktailMaxPrice] = useState<string>('ALL');
  const [foodMaxPrice, setFoodMaxPrice] = useState<string>('ALL');
  const [overallHhMaxPrice, setOverallHhMaxPrice] = useState<string>('ALL');
  const [dailySpecialMaxPrice, setDailySpecialMaxPrice] = useState<string>('ALL');
  const [lunchSpecialMaxPrice, setLunchSpecialMaxPrice] = useState<string>('ALL');

  const [minGoogleRating, setMinGoogleRating] = useState<string>('ALL');
  const [priceFilter, setPriceFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('NAME');

  const [expandedVenueIds, setExpandedVenueIds] = useState<Record<string, boolean>>({});
  const [showDesktopMap, setShowDesktopMap] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const mapSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const nextSearch = searchParams.get('search') ?? '';
    setSearchTerm(nextSearch);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/public-venues', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: Venue[];
        error?: string;
      };

      if (cancelled) return;

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Unable to load venues right now.');
        setVenues([]);
      } else {
        setVenues(splitVenuesByLaunchArea(payload.data ?? []).live);
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const suburbs = useMemo(() => {
    return ['ALL', 'NEWTOWN', 'ENMORE', 'ERSKINEVILLE'];
  }, []);

  const venueTypes = useMemo(() => {
    const set = new Set<string>();

    DEFAULT_VENUE_TYPE_FILTERS.forEach((label) => set.add(label));

    venues.forEach((v) => {
      const label = getVenueTypeLabel(v);
      if (label) set.add(label);
    });

    return ['ALL', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [venues]);

  const advancedFilterCount = useMemo(() => {
    let count = 0;

    if (suburb !== 'ALL') count += 1;
    if (openLateOnly) count += 1;
    if (foodDealsNowOnly) count += 1;
    if (lunchSpecialsOnly) count += 1;
    if (specialsTodayOnly) count += 1;
    if (filterDogNow) count += 1;
    if (filterKidNow) count += 1;
    if (minGoogleRating !== 'ALL') count += 1;
    if (priceFilter !== 'ALL') count += 1;
    if (hhWine) count += 1;
    if (hhBeer) count += 1;
    if (hhSpirits) count += 1;
    if (hhCocktails) count += 1;
    if (hhFood) count += 1;
    if (beerMaxPrice !== 'ALL') count += 1;
    if (wineMaxPrice !== 'ALL') count += 1;
    if (cocktailMaxPrice !== 'ALL') count += 1;
    if (foodMaxPrice !== 'ALL') count += 1;
    if (overallHhMaxPrice !== 'ALL') count += 1;
    if (dailySpecialMaxPrice !== 'ALL') count += 1;
    if (lunchSpecialMaxPrice !== 'ALL') count += 1;

    Object.values(eventFilters).forEach((value) => {
      if (value) count += 1;
    });

    return count;
  }, [
    suburb,
    openLateOnly,
    foodDealsNowOnly,
    lunchSpecialsOnly,
    specialsTodayOnly,
    filterDogNow,
    filterKidNow,
    minGoogleRating,
    priceFilter,
    hhWine,
    hhBeer,
    hhSpirits,
    hhCocktails,
    hhFood,
    beerMaxPrice,
    wineMaxPrice,
    cocktailMaxPrice,
    foodMaxPrice,
    overallHhMaxPrice,
    dailySpecialMaxPrice,
    lunchSpecialMaxPrice,
    eventFilters,
  ]);

  const hasActiveFilters = useMemo(
    () =>
      searchTerm.trim().length > 0 ||
      suburb !== 'ALL' ||
      venueType !== 'ALL' ||
      openNowOnly ||
      openLateOnly ||
      happyHourNowOnly ||
      foodDealsNowOnly ||
      lunchSpecialsOnly ||
      specialsTodayOnly ||
      kitchenOpenNowOnly ||
      filterSport ||
      filterBYO ||
      filterDog ||
      filterKid ||
      filterDogNow ||
      filterKidNow ||
      eventsOnly ||
      Object.values(eventFilters).some(Boolean) ||
      hhWine ||
      hhBeer ||
      hhSpirits ||
      hhCocktails ||
      hhFood ||
      beerMaxPrice !== 'ALL' ||
      wineMaxPrice !== 'ALL' ||
      cocktailMaxPrice !== 'ALL' ||
      foodMaxPrice !== 'ALL' ||
      overallHhMaxPrice !== 'ALL' ||
      dailySpecialMaxPrice !== 'ALL' ||
      lunchSpecialMaxPrice !== 'ALL' ||
      minGoogleRating !== 'ALL' ||
      priceFilter !== 'ALL' ||
      sortBy !== 'NAME',
    [
      beerMaxPrice,
      cocktailMaxPrice,
      eventFilters,
      eventsOnly,
      filterBYO,
      filterDog,
      filterDogNow,
      filterKid,
      filterKidNow,
      filterSport,
      foodDealsNowOnly,
      foodMaxPrice,
      happyHourNowOnly,
      hhBeer,
      hhCocktails,
      hhFood,
      hhSpirits,
      hhWine,
      kitchenOpenNowOnly,
      lunchSpecialsOnly,
      minGoogleRating,
      openLateOnly,
      openNowOnly,
      overallHhMaxPrice,
      dailySpecialMaxPrice,
      lunchSpecialMaxPrice,
      priceFilter,
      searchTerm,
      sortBy,
      specialsTodayOnly,
      suburb,
      venueType,
      wineMaxPrice,
    ]
  );

  const appliedFilterLabels = useMemo(() => {
    const labels: string[] = [];

    if (searchTerm.trim()) labels.push(`Search: "${searchTerm.trim()}"`);
    if (suburb !== 'ALL') labels.push(`Suburb: ${suburb}`);
    if (venueType !== 'ALL') labels.push(`Type: ${venueType}`);
    if (openNowOnly) labels.push('Open now');
    if (openLateOnly) labels.push('Open late');
    if (happyHourNowOnly) labels.push('Happy hour live');
    if (foodDealsNowOnly) labels.push('Food deals now');
    if (lunchSpecialsOnly) labels.push('Lunch specials');
    if (specialsTodayOnly) labels.push('Specials today');
    if (kitchenOpenNowOnly) labels.push('Kitchen open');
    if (filterSport) labels.push('Sport');
    if (filterBYO) labels.push('BYO');
    if (filterDog) labels.push('Dog');
    if (filterKid) labels.push('Kid');
    if (filterDogNow) labels.push('Dog friendly now');
    if (filterKidNow) labels.push('Kid friendly now');
    if (eventsOnly) labels.push('Any events');

    Object.entries(eventFilters).forEach(([key, enabled]) => {
      if (!enabled) return;
      const match = EVENT_FILTER_OPTIONS.find((option) => option.type === key);
      if (match) labels.push(match.label.replace(/[^\x20-\x7E]/g, '').trim());
    });

    if (hhWine) labels.push('Wine deals');
    if (hhBeer) labels.push('Beer deals');
    if (hhSpirits) labels.push('Spirits deals');
    if (hhCocktails) labels.push('Cocktail deals');
    if (hhFood) labels.push('Food deals');
    if (beerMaxPrice !== 'ALL') labels.push(`Beer <= $${beerMaxPrice}`);
    if (wineMaxPrice !== 'ALL') labels.push(`Wine <= $${wineMaxPrice}`);
    if (cocktailMaxPrice !== 'ALL') labels.push(`Cocktails <= $${cocktailMaxPrice}`);
    if (foodMaxPrice !== 'ALL') labels.push(`Food <= $${foodMaxPrice}`);
    if (overallHhMaxPrice !== 'ALL') labels.push(`Any deal <= $${overallHhMaxPrice}`);
    if (dailySpecialMaxPrice !== 'ALL') labels.push(`Daily special <= $${dailySpecialMaxPrice}`);
    if (lunchSpecialMaxPrice !== 'ALL') labels.push(`Lunch special <= $${lunchSpecialMaxPrice}`);
    if (minGoogleRating !== 'ALL') labels.push(`Rating ${minGoogleRating}+`);
    if (priceFilter !== 'ALL') labels.push(`Price ${priceFilter}`);
    if (sortBy !== 'NAME') {
      const sortLabel =
        sortBy === 'RATING_DESC'
          ? 'Highest Rated'
          : sortBy === 'REVIEWS_DESC'
            ? 'Most Reviews'
            : sortBy === 'PRICE_ASC'
              ? 'Cheapest'
              : sortBy === 'PRICE_DESC'
                ? 'Most Expensive'
                : null;
      if (sortLabel) labels.push(`Sort: ${sortLabel}`);
    }

    return labels;
  }, [
    beerMaxPrice,
    cocktailMaxPrice,
    eventFilters,
    eventsOnly,
    filterBYO,
    filterDog,
    filterDogNow,
    filterKid,
    filterKidNow,
    filterSport,
    foodDealsNowOnly,
    foodMaxPrice,
    happyHourNowOnly,
    hhBeer,
    hhCocktails,
    hhFood,
    hhSpirits,
    hhWine,
    kitchenOpenNowOnly,
    lunchSpecialsOnly,
    lunchSpecialMaxPrice,
    minGoogleRating,
    overallHhMaxPrice,
    openLateOnly,
    openNowOnly,
    priceFilter,
    searchTerm,
    sortBy,
    specialsTodayOnly,
    suburb,
    venueType,
    wineMaxPrice,
    dailySpecialMaxPrice,
  ]);

  const filtered = useMemo(() => {
    const result = venues.filter((v) => {
      const venueTypeLabel = getVenueTypeLabel(v) ?? '';
      const normalizedOpeningHours = convertGoogleOpeningHours(v.opening_hours);
      const effectiveKitchenHours = getEffectiveScheduleHours(v, 'kitchen');
      const effectiveHappyHourHours = getEffectiveScheduleHours(v, 'happy_hour');
      const effectiveBottleShopHours = getEffectiveScheduleHours(v, 'bottle_shop');
      const primaryHours = normalizedOpeningHours ?? effectiveBottleShopHours ?? null;
      const happyHourRules = getPublishedRulesByType(v, 'happy_hour');
      const dealRules = getPublishedDealRules(v);
      const eventRules = getPublishedEventRules(v);
      const timezone = v.timezone ?? 'Australia/Sydney';
      const todayDealRules = getTodayRulesForType(dealRules, timezone);
      const liveDealRules = todayDealRules.filter((rule) =>
        isRuleLiveNow(rule, timezone)
      );
      const liveFoodDealRules = liveDealRules.filter(isFoodDealRule);
      const lunchSpecialRules = dealRules.filter((rule) => rule.schedule_type === 'lunch_special');
      const activeDogRule = getTodayRulesForType(getPublishedVenueRulesByKind(v, 'dog'), timezone).find(
        (rule) => isRuleLiveNow(rule, timezone)
      );
      const activeKidRule = getTodayRulesForType(getPublishedVenueRulesByKind(v, 'kid'), timezone).find(
        (rule) => isRuleLiveNow(rule, timezone)
      );

      if (v.status && !['active', 'open', 'published'].includes(v.status.toLowerCase())) {
        return false;
      }

      if (!matchesSearchTerm(v, searchTerm)) return false;
      if (suburb !== 'ALL' && (v.suburb ?? '') !== suburb) return false;
      if (!matchesVenueTypeFilter(venueType, venueTypeLabel, effectiveBottleShopHours)) {
        return false;
      }

      if (filterSport && !normalizeBooleanFlag(v.shows_sport)) return false;
      if (filterBYO && !v.byo_allowed) return false;
      if (filterDog && !normalizeBooleanFlag(v.dog_friendly)) return false;
      if (filterKid && !normalizeBooleanFlag(v.kid_friendly)) return false;
      if (eventsOnly && eventRules.length === 0) return false;

      const enabledEventFilters = Object.entries(eventFilters).filter(([, enabled]) => enabled);
      if (
        enabledEventFilters.length > 0 &&
        !enabledEventFilters.every(([type]) =>
          eventRules.some((rule) => rule.schedule_type === type)
        )
      ) {
        return false;
      }

      if (hhWine && !happyHourRules.some((rule) => hasHappyHourItems(rule.detail_json, 'wine'))) {
        return false;
      }

      if (hhBeer && !happyHourRules.some((rule) => hasHappyHourItems(rule.detail_json, 'beer'))) {
        return false;
      }

      if (
        hhSpirits &&
        !happyHourRules.some((rule) => hasHappyHourItems(rule.detail_json, 'spirits'))
      ) {
        return false;
      }

      if (
        hhCocktails &&
        !happyHourRules.some((rule) => hasHappyHourItems(rule.detail_json, 'cocktails'))
      ) {
        return false;
      }

      if (hhFood && !happyHourRules.some((rule) => hasHappyHourItems(rule.detail_json, 'food'))) {
        return false;
      }

      if (!matchesMaxPrice(getMinCategoryPrice(happyHourRules, 'beer'), beerMaxPrice)) {
        return false;
      }

      if (!matchesMaxPrice(getMinCategoryPrice(happyHourRules, 'wine'), wineMaxPrice)) {
        return false;
      }

      if (
        !matchesMaxPrice(getMinCategoryPrice(happyHourRules, 'cocktails'), cocktailMaxPrice)
      ) {
        return false;
      }

      if (!matchesMaxPrice(getMinCategoryPrice(happyHourRules, 'food'), foodMaxPrice)) {
        return false;
      }

      if (!matchesMaxPrice(getOverallMinHappyHourPrice(happyHourRules), overallHhMaxPrice)) {
        return false;
      }

      if (!matchesMaxPrice(getMinSpecialPrice(dealRules, 'daily_special'), dailySpecialMaxPrice)) {
        return false;
      }

      if (!matchesMaxPrice(getMinSpecialPrice(dealRules, 'lunch_special'), lunchSpecialMaxPrice)) {
        return false;
      }

      if (
        openNowOnly &&
        !isVenueOpenNow(
          primaryHours,
          v.timezone ?? 'Australia/Sydney',
          v.is_temporarily_closed ?? false
        )
      ) {
        return false;
      }

      if (openLateOnly && !isOpenLate(primaryHours, '02:00')) return false;

      if (
        happyHourNowOnly &&
        !isOpenNow(effectiveHappyHourHours, v.timezone ?? 'Australia/Sydney')
      ) {
        return false;
      }

      if (
        kitchenOpenNowOnly &&
        !isOpenNow(effectiveKitchenHours, timezone)
      ) {
        return false;
      }

      if (foodDealsNowOnly && liveFoodDealRules.length === 0) return false;
      if (lunchSpecialsOnly && lunchSpecialRules.length === 0) return false;
      if (specialsTodayOnly && todayDealRules.length === 0) return false;
      if (filterDogNow && !activeDogRule) return false;
      if (filterKidNow && !activeKidRule) return false;

      if (!matchesMinRating(v.google_rating, minGoogleRating)) return false;
      if (!matchesPriceLevel(v.price_level, priceFilter)) return false;

      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'NAME') {
        const aGuardrails = getVenueProductGuardrails(a);
        const bGuardrails = getVenueProductGuardrails(b);
        const fitDiff =
          Number(bGuardrails.coreDiscoveryEligible) - Number(aGuardrails.coreDiscoveryEligible);
        if (fitDiff !== 0) return fitDiff;

        const publishDiff =
          Number(bGuardrails.isPublishReady) - Number(aGuardrails.isPublishReady);
        if (publishDiff !== 0) return publishDiff;
      }

      if (sortBy === 'RATING_DESC') {
        return (b.google_rating ?? -1) - (a.google_rating ?? -1);
      }

      if (sortBy === 'REVIEWS_DESC') {
        return (b.google_user_rating_count ?? -1) - (a.google_user_rating_count ?? -1);
      }

      if (sortBy === 'PRICE_ASC') {
        return (getPriceRank(a.price_level) ?? 999) - (getPriceRank(b.price_level) ?? 999);
      }

      if (sortBy === 'PRICE_DESC') {
        return (getPriceRank(b.price_level) ?? -1) - (getPriceRank(a.price_level) ?? -1);
      }

      return (a.name ?? '').localeCompare(b.name ?? '');
    });

    return result;
  }, [
    venues,
    searchTerm,
    suburb,
    venueType,
    filterSport,
    filterBYO,
    filterDog,
    filterKid,
    eventsOnly,
    eventFilters,
    hhWine,
    hhBeer,
    hhSpirits,
    hhCocktails,
    hhFood,
    beerMaxPrice,
    wineMaxPrice,
    cocktailMaxPrice,
    foodMaxPrice,
    overallHhMaxPrice,
    dailySpecialMaxPrice,
    lunchSpecialMaxPrice,
    openNowOnly,
    openLateOnly,
    happyHourNowOnly,
    foodDealsNowOnly,
    lunchSpecialsOnly,
    specialsTodayOnly,
    kitchenOpenNowOnly,
    filterDogNow,
    filterKidNow,
    minGoogleRating,
    priceFilter,
    sortBy,
  ]);

  const mapVenues = useMemo(() => {
    return filtered.filter((v) => hasValidCoords(v.lat, v.lng));
  }, [filtered]);

  const searchSuggestions = useMemo(() => {
    const term = normalizeSearchValue(searchTerm);
    if (term.length < 2) return [] as SearchSuggestion[];

    type RankedVenueSuggestion = SearchSuggestion & { kind: 'venue'; priority: number };

    const venueMatches = venues
      .map((venue) => {
        const priorities = [
          getSearchPriority(venue.name, term),
          getSearchPriority(venue.suburb, term),
          getSearchPriority(venue.address, term),
        ].filter((priority): priority is number => priority != null);

        if (priorities.length === 0 || !venue.name?.trim()) return null;

        return {
          kind: 'venue' as const,
          label: venue.name.trim(),
          value: venue.name.trim(),
          helper: venue.suburb?.trim() || 'Venue',
          priority: Math.min(...priorities),
        };
      })
      .filter((suggestion): suggestion is RankedVenueSuggestion => suggestion !== null)
      .sort(
        (a, b) =>
          a.priority - b.priority ||
          a.label.localeCompare(b.label) ||
          a.helper.localeCompare(b.helper)
      )
      .slice(0, 4)
      .map(({ kind, label, value, helper }) => ({ kind, label, value, helper }));

    const seenSuburbs = new Set<string>();
    const suburbMatches = venues
      .map((venue) => venue.suburb?.trim() || '')
      .filter(Boolean)
      .filter((suburbValue) => {
        const normalizedSuburb = normalizeSearchValue(suburbValue);
        if (seenSuburbs.has(normalizedSuburb)) return false;
        if (getSearchPriority(suburbValue, term) == null) return false;
        seenSuburbs.add(normalizedSuburb);
        return true;
      })
      .sort((a, b) => {
        const aPriority = getSearchPriority(a, term) ?? 9;
        const bPriority = getSearchPriority(b, term) ?? 9;
        return aPriority - bPriority || a.localeCompare(b);
      })
      .slice(0, 3)
      .map((suburbValue) => ({
        kind: 'suburb' as const,
        label: suburbValue,
        value: suburbValue,
        helper: 'Suburb',
      }));

    return [...venueMatches, ...suburbMatches].slice(0, 6);
  }, [searchTerm, venues]);

  useEffect(() => {
    if (!showDesktopMap) return;

    const timeout = window.setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [showDesktopMap]);

  function clearFilters() {
    setSearchTerm('');
    setSuburb('ALL');
    setVenueType('ALL');
    setOpenNowOnly(false);
    setOpenLateOnly(false);
    setHappyHourNowOnly(false);
    setFoodDealsNowOnly(false);
    setLunchSpecialsOnly(false);
    setSpecialsTodayOnly(false);
    setKitchenOpenNowOnly(false);
    setFilterSport(false);
    setFilterBYO(false);
    setFilterDog(false);
    setFilterKid(false);
    setFilterDogNow(false);
    setFilterKidNow(false);
    setEventsOnly(false);
    setEventFilters({
      trivia: false,
      live_music: false,
      sport: false,
      comedy: false,
      karaoke: false,
      dj: false,
      special_event: false,
    });
    setHhWine(false);
    setHhBeer(false);
    setHhSpirits(false);
    setHhCocktails(false);
    setHhFood(false);
    setBeerMaxPrice('ALL');
    setWineMaxPrice('ALL');
    setCocktailMaxPrice('ALL');
    setFoodMaxPrice('ALL');
    setOverallHhMaxPrice('ALL');
    setDailySpecialMaxPrice('ALL');
    setLunchSpecialMaxPrice('ALL');
    setMinGoogleRating('ALL');
    setPriceFilter('ALL');
    setSortBy('NAME');
  }

  function toggleExpanded(id: string) {
    setExpandedVenueIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-black text-white">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-8">
        <div className="rounded-[1.45rem] border border-white/9 bg-white/[0.03] px-3.5 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur sm:rounded-3xl sm:px-5 sm:py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-orange-300/78">
            {'\u{1F37B} Venues'}
          </div>
          <div className="mt-1.5 flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-white sm:text-[32px]">
                Where to go tonight
              </h1>
              <p className="max-w-2xl text-[13px] leading-5 text-white/66 sm:text-sm">
                Search Newtown, Enmore, and Erskineville by suburb, venue type, and what matters
                right now.
              </p>
            </div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/42">
              Search first. Map if you need it.
            </div>
          </div>
        </div>

        <div className="z-40 mt-3 rounded-[1.4rem] border border-white/9 bg-white/[0.04] p-2.5 shadow-[0_16px_36px_rgba(0,0,0,0.2)] backdrop-blur sm:mt-4 sm:rounded-3xl sm:p-4 lg:sticky lg:top-24">
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(260px,1.45fr)_minmax(170px,0.9fr)_minmax(170px,0.95fr)_auto]">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search venue, suburb, or what you're after"
                className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 pr-20 text-sm text-white placeholder:text-white/38"
              />
              {searchTerm.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/72 hover:bg-white/10 hover:text-white"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <select
              value={suburb}
              onChange={(e) => setSuburb(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white"
            >
              {suburbs.map((s) => (
                <option key={s} value={s}>
                  {s === 'ALL' ? 'All suburbs' : s.toUpperCase()}
                </option>
              ))}
            </select>

            <select
              value={venueType}
              onChange={(e) => setVenueType(e.target.value)}
              className="h-10 min-w-0 rounded-xl border border-white/10 bg-black px-3 text-sm text-white"
            >
              {venueTypes.map((typeOption) => (
                <option key={typeOption} value={typeOption}>
                  {typeOption === 'ALL' ? 'All venue types' : typeOption}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] font-medium text-white/78 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
              >
                {showFilters ? 'Hide advanced filters' : 'Advanced filters'}
                {advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ''}
              </button>

              <button
                type="button"
                onClick={() => setShowDesktopMap((prev) => !prev)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] text-white/78 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
              >
                {showDesktopMap ? 'Hide map' : 'Map'}
              </button>

              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] text-white/78 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
              >
                Clear all
              </button>
            </div>
          </div>

          {searchSuggestions.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 overflow-hidden">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Quick picks
              </div>
              {searchSuggestions.map((suggestion) => (
                <button
                  key={`${suggestion.kind}-${suggestion.label}`}
                  type="button"
                  onClick={() => {
                    if (suggestion.kind === 'suburb') {
                      setSuburb(suggestion.value);
                    } else {
                      setSearchTerm(suggestion.value);
                    }
                  }}
                  className="max-w-full rounded-full border border-white/10 bg-black/22 px-3 py-1 text-left text-[11px] text-white/78 transition hover:border-orange-300/35 hover:bg-orange-500/10 hover:text-white"
                >
                  <span className="block break-words font-medium">{suggestion.label}</span>
                  <span className="block break-words text-white/48 sm:inline sm:ml-2">{suggestion.helper}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-2 space-y-2">
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
                Best bets
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <CompactToggle label={'\u{1F7E2} Open now'} checked={openNowOnly} onChange={setOpenNowOnly} />
                <CompactToggle label={'\u{1F37A} Drinks deals'} checked={happyHourNowOnly} onChange={setHappyHourNowOnly} />
                <CompactToggle label={'\u{1F354} Food deals now'} checked={foodDealsNowOnly} onChange={setFoodDealsNowOnly} />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/32">
                Quick extras
              </div>
              <div className="flex flex-wrap items-center gap-1.5 opacity-90">
                <CompactToggle label={'\u2600\uFE0F Lunch specials'} checked={lunchSpecialsOnly} onChange={setLunchSpecialsOnly} />
                <CompactToggle label={'\u{1F525} Specials today'} checked={specialsTodayOnly} onChange={setSpecialsTodayOnly} />
                <CompactToggle label={'\u{1F37D}\uFE0F Kitchen open'} checked={kitchenOpenNowOnly} onChange={setKitchenOpenNowOnly} />
                <CompactToggle label={'\u2728 Live events'} checked={eventsOnly} onChange={setEventsOnly} />
                <CompactToggle label={'\u26BD Sport'} checked={filterSport} onChange={setFilterSport} />
                <CompactToggle label={'\u{1F377} BYO'} checked={filterBYO} onChange={setFilterBYO} />
                <CompactToggle label={'\u{1F436} Dog'} checked={filterDog} onChange={setFilterDog} />
                <CompactToggle label={'\u{1F476} Kid'} checked={filterKid} onChange={setFilterKid} />
                <CompactToggle label={'\u{1F476} Kid friendly now'} checked={filterKidNow} onChange={setFilterKidNow} />
                <CompactToggle label={'\u{1F436} Dog friendly now'} checked={filterDogNow} onChange={setFilterDogNow} />
              </div>
            </div>
          </div>

          {hasActiveFilters ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Filters on
              </span>
              {appliedFilterLabels.slice(0, 8).map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/74"
                >
                  {label}
                </span>
              ))}
              {appliedFilterLabels.length > 8 ? (
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/62">
                  +{appliedFilterLabels.length - 8} more
                </span>
              ) : null}
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-orange-200 underline underline-offset-4 hover:text-white"
              >
                Clear all
              </button>
            </div>
          ) : null}

          {showFilters ? (
            <div className="hidden">
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/75">
                      Advanced filters
                    </div>
                    <div className="mt-1 text-sm text-white/62">
                      Ratings, pricing, event subtypes, and detailed happy hour filters.
                    </div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                    {advancedFilterCount} active
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                <select
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white"
                >
                  {suburbs.map((s) => (
                    <option key={s} value={s}>
                      {s.toUpperCase()}
                    </option>
                  ))}
                </select>

                <select
                  value={minGoogleRating}
                  onChange={(e) => setMinGoogleRating(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white"
                >
                  <option value="ALL">All ratings</option>
                  <option value="4">4.0+</option>
                  <option value="4.5">4.5+</option>
                  <option value="4.8">4.8+</option>
                </select>

                <select
                  value={priceFilter}
                  onChange={(e) => setPriceFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white"
                >
                  <option value="ALL">All prices</option>
                  <option value="$">$</option>
                  <option value="$$">$$</option>
                  <option value="$$$">$$$</option>
                  <option value="$$$$">$$$$</option>
                </select>

                <div className="flex items-center rounded-xl border border-white/10 bg-black px-3 text-sm text-white/70">
                  Inner West launch area only
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CompactToggle label="Open late" checked={openLateOnly} onChange={setOpenLateOnly} />
              </div>

              <div className="hidden">
                <CompactToggle label="🟢 Open now" checked={openNowOnly} onChange={setOpenNowOnly} />
                <CompactToggle label="🌙 Open late" checked={openLateOnly} onChange={setOpenLateOnly} />
                <CompactToggle label="🍸 Happy hour live" checked={happyHourNowOnly} onChange={setHappyHourNowOnly} />
                <CompactToggle label="🍽️ Kitchen open" checked={kitchenOpenNowOnly} onChange={setKitchenOpenNowOnly} />
                <CompactToggle label="🏈 Sport" checked={filterSport} onChange={setFilterSport} />
                <CompactToggle label="🍾 BYO" checked={filterBYO} onChange={setFilterBYO} />
                <CompactToggle label="🐶 Dog" checked={filterDog} onChange={setFilterDog} />
                <CompactToggle label="🧒 Kid" checked={filterKid} onChange={setFilterKid} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="mr-1 text-[11px] font-medium uppercase tracking-wide text-white/45">
                  Events
                </div>
                <CompactToggle label="🎉 Any Events" checked={eventsOnly} onChange={setEventsOnly} />
                {EVENT_FILTER_OPTIONS.map((option) => (
                  <CompactToggle
                    key={option.type}
                    label={option.label}
                    checked={eventFilters[option.type] ?? false}
                    onChange={(checked) =>
                      setEventFilters((current) => ({
                        ...current,
                        [option.type]: checked,
                      }))
                    }
                  />
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="mr-1 text-[11px] font-medium uppercase tracking-wide text-white/45">
                  Happy Hour
                </div>
                <CompactToggle label="🍷 Wine" checked={hhWine} onChange={setHhWine} />
                <CompactToggle label="🍺 Beer" checked={hhBeer} onChange={setHhBeer} />
                <CompactToggle label="🥃 Spirits" checked={hhSpirits} onChange={setHhSpirits} />
                <CompactToggle label="🍸 Cocktails" checked={hhCocktails} onChange={setHhCocktails} />
                <CompactToggle label="🍔 Food" checked={hhFood} onChange={setHhFood} />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
                <select
                  value={beerMaxPrice}
                  onChange={(e) => setBeerMaxPrice(e.target.value)}
                  className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                >
                  <option value="ALL">Beer price</option>
                  <option value="7">Beer &lt;= $7</option>
                  <option value="8">Beer &lt;= $8</option>
                  <option value="10">Beer &lt;= $10</option>
                  <option value="12">Beer &lt;= $12</option>
                </select>

                <select
                  value={wineMaxPrice}
                  onChange={(e) => setWineMaxPrice(e.target.value)}
                  className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                >
                  <option value="ALL">Wine price</option>
                  <option value="8">Wine &lt;= $8</option>
                  <option value="10">Wine &lt;= $10</option>
                  <option value="12">Wine &lt;= $12</option>
                  <option value="15">Wine &lt;= $15</option>
                </select>

                <select
                  value={cocktailMaxPrice}
                  onChange={(e) => setCocktailMaxPrice(e.target.value)}
                  className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                >
                  <option value="ALL">Cocktail price</option>
                  <option value="10">Cocktails &lt;= $10</option>
                  <option value="12">Cocktails &lt;= $12</option>
                  <option value="15">Cocktails &lt;= $15</option>
                  <option value="18">Cocktails &lt;= $18</option>
                </select>

                <select
                  value={foodMaxPrice}
                  onChange={(e) => setFoodMaxPrice(e.target.value)}
                  className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                >
                  <option value="ALL">Food price</option>
                  <option value="8">Food &lt;= $8</option>
                  <option value="10">Food &lt;= $10</option>
                  <option value="15">Food &lt;= $15</option>
                  <option value="20">Food &lt;= $20</option>
                </select>

                <select
                  value={overallHhMaxPrice}
                  onChange={(e) => setOverallHhMaxPrice(e.target.value)}
                  className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                >
                  <option value="ALL">Any HH price</option>
                  <option value="7">Any deal &lt;= $7</option>
                  <option value="10">Any deal &lt;= $10</option>
                  <option value="12">Any deal &lt;= $12</option>
                  <option value="15">Any deal &lt;= $15</option>
                </select>
              </div>
            </div>
          ) : null}
        </div>

        {showDesktopMap ? (
          <section
            ref={mapSectionRef}
            id="map-section"
            className="mt-4 rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-3.5 sm:mt-5 sm:rounded-3xl sm:p-5"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                  Map
                </div>
                <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">See what&apos;s nearby</h2>
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                {mapVenues.length} mapped venue{mapVenues.length === 1 ? '' : 's'}
              </div>
            </div>

            {mapVenues.length > 0 ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                <GoogleMap venues={mapVenues} />
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/65">
                No mapped venues match this filter mix yet. Try another suburb or widen the filters.
              </div>
            )}
          </section>
        ) : null}

        <div className="mt-6 sm:mt-8">
          <div>
            {loading && <div className="text-white/70">Loading venues...</div>}

            {!loading && error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6">
                <div className="text-xl font-semibold">Couldn&apos;t load venues</div>
                <div className="mt-2 text-white/70">{error}</div>
              </div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-6 text-white/70">
                <div>Nothing matches this filter mix right now.</div>
                <div className="mt-2 text-white/62">
                  Clear a few filters or open advanced filters to widen the search.
                </div>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 text-sm text-orange-200 underline underline-offset-4 hover:text-white"
                  >
                    Clear all filters
                  </button>
                ) : null}
              </div>
            )}

            {!loading && !error && filtered.length > 0 && (
              <>
                <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/64">
                  <span className="font-medium text-white">
                    {filtered.length} place{filtered.length === 1 ? '' : 's'} to choose from
                  </span>
                  {searchTerm.trim() ? ` for "${searchTerm.trim()}"` : ''}
                  {suburb !== 'ALL' ? ` in ${suburb}` : ''}
                  {venueType !== 'ALL' ? ` for ${venueType.toLowerCase()}` : ''}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {filtered.map((v) => {
                    const timezone = v.timezone ?? 'Australia/Sydney';
                    const isExpanded = !!expandedVenueIds[v.id];
                    const venueTypeLabel = getVenueTypeLabel(v);
                    const normalizedOpeningHours = convertGoogleOpeningHours(v.opening_hours);
                    const effectiveKitchenHours = getEffectiveScheduleHours(v, 'kitchen');
                    const effectiveHappyHourHours = getEffectiveScheduleHours(v, 'happy_hour');
                    const effectiveBottleShopHours = getEffectiveScheduleHours(v, 'bottle_shop');
                    const primaryHours =
                      normalizedOpeningHours ??
                      effectiveBottleShopHours ??
                      null;
                    const happyHourRules = getPublishedRulesByType(v, 'happy_hour');
                    const dealRules = getPublishedDealRules(v);
                    const eventRules = getPublishedEventRules(v);
                    const todayHappyHourRules = getTodayRulesForType(happyHourRules, timezone);
                    const todayDealRules = getTodayRulesForType(dealRules, timezone);
                    const todayEventRules = getTodayRulesForType(eventRules, timezone);
                    const liveDealRules = todayDealRules.filter((rule) => isRuleLiveNow(rule, timezone));
                    const featuredSpecialRule = liveDealRules[0] ?? todayDealRules[0] ?? null;
                    const activeKidRule = getTodayRulesForType(
                      getPublishedVenueRulesByKind(v, 'kid'),
                      timezone
                    ).find((rule) => isRuleLiveNow(rule, timezone));
                    const activeDogRule = getTodayRulesForType(
                      getPublishedVenueRulesByKind(v, 'dog'),
                      timezone
                    ).find((rule) => isRuleLiveNow(rule, timezone));
                    const venueRuleSignals = [activeKidRule, activeDogRule]
                      .map((rule) => (rule ? getVenueRuleBadge(rule) : null))
                      .filter((value): value is string => Boolean(value))
                      .slice(0, 2);
                    const todayLabel = DAY_LABELS[getTodayDayOfWeek(timezone)];

                    const openNow = isVenueOpenNow(
                      primaryHours,
                      timezone,
                      v.is_temporarily_closed ?? false
                    );

                    const closingSoonText = getClosingSoonText(
                      primaryHours,
                      timezone,
                      v.is_temporarily_closed ?? false
                    );

                    const nextOpeningText = getNextOpeningText(
                      primaryHours,
                      timezone,
                      v.is_temporarily_closed ?? false
                    );

                    const happyHourNow = isOpenNow(effectiveHappyHourHours, timezone, false);
                    const kitchenOpenNow = isOpenNow(effectiveKitchenHours, timezone, false);
                    const bottleShopNow = isOpenNow(effectiveBottleShopHours, timezone, false);
                    const openLate = isOpenLate(primaryHours, '02:00');

                    const ratingText = formatGoogleRating(v.google_rating);
                    const reviewCountText = formatReviewCount(v.google_user_rating_count);
                    const priceText = formatPriceLevel(v.price_level);

                    return (
                      <div
                        id={`venue-${v.id}`}
                        key={v.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"
                      >
                        <div className="space-y-2">
                          <div className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[30px]">
                            {v.name ?? 'Unnamed venue'}
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                            {v.suburb ? <MetaChip>{v.suburb.toUpperCase()}</MetaChip> : null}
                            {venueTypeLabel ? (
                              <MetaChip>{venueTypeLabel.toUpperCase()}</MetaChip>
                            ) : null}
                            {ratingText ? (
                              <MetaChip>
                                Star {ratingText}
                                {reviewCountText ? ` (${reviewCountText})` : ''}
                              </MetaChip>
                            ) : null}
                            {priceText ? <MetaChip>{priceText}</MetaChip> : null}
                          </div>

                          <div className="flex flex-wrap gap-2 text-sm">
                            {v.is_temporarily_closed ? (
                              <StatusPill className="border-red-500/30 bg-red-500/15 text-red-200">
                                Temporarily closed
                              </StatusPill>
                            ) : openNow ? (
                              <StatusPill className="border-green-500/30 bg-green-500/15 text-green-200">
                                🟢 Open now
                              </StatusPill>
                            ) : (
                              <StatusPill className="border-white/15 bg-white/5 text-white/75">
                                Closed
                              </StatusPill>
                            )}

                            {closingSoonText ? (
                              <StatusPill className="border-amber-500/30 bg-amber-500/15 text-amber-200">
                                {closingSoonText}
                              </StatusPill>
                            ) : null}

                            {happyHourNow ? (
                              <StatusPill className="border-pink-500/30 bg-pink-500/15 text-pink-200">
                                🍸 Happy hour live
                              </StatusPill>
                            ) : null}

                            {kitchenOpenNow ? (
                              <StatusPill className="border-orange-500/30 bg-orange-500/15 text-orange-200">
                                🍽️ Kitchen open
                              </StatusPill>
                            ) : null}

                            {bottleShopNow ? (
                              <StatusPill className="border-sky-500/30 bg-sky-500/15 text-sky-200">
                                Bottle shop open now
                              </StatusPill>
                            ) : null}

                            {openLate ? (
                              <StatusPill className="border-indigo-500/30 bg-indigo-500/15 text-indigo-200">
                                🌙 Open late
                              </StatusPill>
                            ) : null}
                          </div>

                          {v.address ? (
                            <div className="text-sm text-white/60 sm:text-base">{v.address}</div>
                          ) : null}

                          {!openNow && !v.is_temporarily_closed && nextOpeningText ? (
                            <div className="text-sm text-white/60">{nextOpeningText}</div>
                          ) : null}

                          <div className="flex flex-wrap gap-2 text-sm">
                            {normalizeBooleanFlag(v.shows_sport) ? <Pill>🏈 Sport</Pill> : null}
                            {normalizeBooleanFlag(v.shows_sport) &&
                            normalizeBooleanFlag(v.plays_with_sound) ? (
                              <Pill>🏈 Sound</Pill>
                            ) : null}
                            {v.byo_allowed ? <Pill>🍾 BYO</Pill> : null}
                          </div>

                          {featuredSpecialRule ? (
                            <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                                {liveDealRules.length > 0 ? 'Special live now' : 'Specials today'}
                              </div>
                              <div className="mt-1 font-medium text-white">
                                {getSpecialBadge(featuredSpecialRule)}
                              </div>
                            </div>
                          ) : null}

                          {venueRuleSignals.length > 0 ? (
                            <div className="flex flex-wrap gap-2 text-sm">
                              {venueRuleSignals.map((signal) => (
                                <StatusPill
                                  key={signal}
                                  className="border-white/15 bg-white/5 text-white/80"
                                >
                                  {signal}
                                </StatusPill>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4">
                          <TodayHoursSummary
                            openingHours={normalizedOpeningHours}
                            kitchenHours={effectiveKitchenHours}
                            happyHourHours={effectiveHappyHourHours}
                            bottleShopHours={effectiveBottleShopHours}
                            timezone={timezone}
                          />
                        </div>

                        {todayHappyHourRules.length > 0 ? (
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                            <div className="text-sm font-semibold text-white/80">
                              Happy Hour Today
                            </div>

                            <div className="mt-3 space-y-2">
                              {todayHappyHourRules.map((rule) => (
                                <HappyHourRuleCard
                                  key={rule.id}
                                  rule={rule}
                                  dayLabel={todayLabel}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {todayDealRules.length > 0 ? (
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                            <div className="text-sm font-semibold text-white/80">Specials Today</div>

                            <div className="mt-3 space-y-2">
                              {todayDealRules.map((rule) => (
                                <SpecialRuleCard
                                  key={rule.id}
                                  rule={rule}
                                  dayLabel={todayLabel}
                                  highlightLive={isRuleLiveNow(rule, timezone)}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {todayEventRules.length > 0 ? (
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                            <div className="text-sm font-semibold text-white/80">Events Today</div>

                            <div className="mt-3 space-y-2">
                              {todayEventRules.map((rule) => (
                                <EventRuleCard key={rule.id} rule={rule} dayLabel={todayLabel} />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(v.id)}
                            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                          >
                            {isExpanded ? 'Hide weekly hours' : 'View weekly hours'}
                          </button>

                          {hasValidCoords(v.lat, v.lng) ? (
                            <button
                              type="button"
                              onClick={() => setShowDesktopMap(true)}
                              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 lg:hidden"
                            >
                              View on map
                            </button>
                          ) : null}
                        </div>

                        {isExpanded ? (
                          <div className="mt-4 space-y-4">
                            <WeeklyTimelineChart
                              openingHours={normalizedOpeningHours}
                              kitchenHours={effectiveKitchenHours}
                              happyHourHours={effectiveHappyHourHours}
                              bottleShopHours={effectiveBottleShopHours}
                              timezone={timezone}
                              renderDayExtras={(dayKey) => {
                                const dayHappyHourRules = happyHourRules.filter(
                                  (rule) => rule.day_of_week === dayKey
                                );
                                const dayDealRules = dealRules.filter(
                                  (rule) => rule.day_of_week === dayKey
                                );
                                const dayEventRules = eventRules.filter(
                                  (rule) => rule.day_of_week === dayKey
                                );

                                if (
                                  dayHappyHourRules.length === 0 &&
                                  dayDealRules.length === 0 &&
                                  dayEventRules.length === 0
                                ) {
                                  return null;
                                }

                                return (
                                  <div className="space-y-2">
                                    {dayHappyHourRules.map((rule) => (
                                      <HappyHourRuleCard
                                        key={rule.id}
                                        rule={rule}
                                        dayLabel={undefined}
                                      />
                                    ))}
                                    {dayDealRules.map((rule) => (
                                      <SpecialRuleCard
                                        key={rule.id}
                                        rule={rule}
                                        dayLabel={undefined}
                                        highlightLive={false}
                                      />
                                    ))}
                                    {dayEventRules.map((rule) => (
                                      <EventRuleCard key={rule.id} rule={rule} dayLabel={undefined} />
                                    ))}
                                  </div>
                                );
                              }}
                            />
                          </div>
                        ) : null}

                        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap sm:gap-3">
                          <a
                            className="col-span-2 min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10 sm:col-span-1"
                            href={buildPublicVenueHref(v)}
                          >
                            View venue
                          </a>

                          <div className="col-span-2 sm:col-span-1">
                            <SaveVenueButton venueId={v.id} variant="detail" />
                          </div>

                          {isExpanded ? (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(v.id)}
                              className="min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
                            >
                              Hide weekly view
                            </button>
                          ) : null}

                          {v.booking_url ? (
                            <a
                              className="min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
                              href={v.booking_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Book
                            </a>
                          ) : null}

                          {v.website_url ? (
                            <a
                              className="min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
                              href={v.website_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Website
                            </a>
                          ) : null}

                          {normalizeInstagramUrl(v.instagram_url) ? (
                            <a
                              className="min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
                              href={normalizeInstagramUrl(v.instagram_url) ?? undefined}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Instagram
                            </a>
                          ) : null}

                          {v.phone ? (
                            <a
                              className="min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
                              href={`tel:${v.phone}`}
                            >
                              Call
                            </a>
                          ) : null}

                          {v.google_maps_uri ? (
                            <a
                              className="min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
                              href={v.google_maps_uri}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Maps
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {showFilters ? (
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0b0d] shadow-[0_28px_100px_rgba(0,0,0,0.55)]">
              <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,128,32,0.16),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Advanced filters</h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                      {advancedFilterCount} active
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFilters(false)}
                      className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>

              <div className="max-h-[calc(90vh-96px)] overflow-y-auto px-5 py-5 sm:px-6">
                <div className="grid gap-5">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                      Area and venue details
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white"
                      >
                        <option value="NAME">Sort by venue</option>
                        <option value="RATING_DESC">Highest rated</option>
                        <option value="REVIEWS_DESC">Most reviews</option>
                        <option value="PRICE_ASC">Cheapest first</option>
                        <option value="PRICE_DESC">Most expensive</option>
                      </select>

                      <select
                        value={minGoogleRating}
                        onChange={(e) => setMinGoogleRating(e.target.value)}
                        className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white"
                      >
                        <option value="ALL">All ratings</option>
                        <option value="4">4.0+</option>
                        <option value="4.5">4.5+</option>
                        <option value="4.8">4.8+</option>
                      </select>

                      <select
                        value={priceFilter}
                        onChange={(e) => setPriceFilter(e.target.value)}
                        className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white"
                      >
                        <option value="ALL">All prices</option>
                        <option value="$">$</option>
                        <option value="$$">$$</option>
                        <option value="$$$">$$$</option>
                        <option value="$$$$">$$$$</option>
                      </select>

                      <div className="flex items-center rounded-xl border border-white/10 bg-black px-3 text-sm text-white/70">
                        Inner West
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <CompactToggle label="Open late" checked={openLateOnly} onChange={setOpenLateOnly} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                      Specials and venue rules
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <CompactToggle label="Food deals now" checked={foodDealsNowOnly} onChange={setFoodDealsNowOnly} />
                      <CompactToggle label="Lunch specials" checked={lunchSpecialsOnly} onChange={setLunchSpecialsOnly} />
                      <CompactToggle label="Specials today" checked={specialsTodayOnly} onChange={setSpecialsTodayOnly} />
                      <CompactToggle label="Kid friendly now" checked={filterKidNow} onChange={setFilterKidNow} />
                      <CompactToggle label="Dog friendly now" checked={filterDogNow} onChange={setFilterDogNow} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                      <select
                        value={dailySpecialMaxPrice}
                        onChange={(e) => setDailySpecialMaxPrice(e.target.value)}
                        className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                      >
                        <option value="ALL">Daily special price</option>
                        <option value="10">Daily special &lt;= $10</option>
                        <option value="15">Daily special &lt;= $15</option>
                        <option value="20">Daily special &lt;= $20</option>
                        <option value="25">Daily special &lt;= $25</option>
                      </select>
                      <select
                        value={lunchSpecialMaxPrice}
                        onChange={(e) => setLunchSpecialMaxPrice(e.target.value)}
                        className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                      >
                        <option value="ALL">Lunch special price</option>
                        <option value="10">Lunch special &lt;= $10</option>
                        <option value="15">Lunch special &lt;= $15</option>
                        <option value="20">Lunch special &lt;= $20</option>
                        <option value="25">Lunch special &lt;= $25</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                      Event filters
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <CompactToggle label="Any events" checked={eventsOnly} onChange={setEventsOnly} />
                      {EVENT_FILTER_OPTIONS.map((option) => (
                        <CompactToggle
                          key={option.type}
                          label={option.label}
                          checked={eventFilters[option.type] ?? false}
                          onChange={(checked) =>
                            setEventFilters((current) => ({
                              ...current,
                              [option.type]: checked,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                      Happy hour filters
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <CompactToggle label="Wine" checked={hhWine} onChange={setHhWine} />
                      <CompactToggle label="Beer" checked={hhBeer} onChange={setHhBeer} />
                      <CompactToggle label="Spirits" checked={hhSpirits} onChange={setHhSpirits} />
                      <CompactToggle label="Cocktails" checked={hhCocktails} onChange={setHhCocktails} />
                      <CompactToggle label="Food" checked={hhFood} onChange={setHhFood} />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                      <select
                        value={beerMaxPrice}
                        onChange={(e) => setBeerMaxPrice(e.target.value)}
                        className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                      >
                        <option value="ALL">Beer price</option>
                        <option value="7">Beer &lt;= $7</option>
                        <option value="8">Beer &lt;= $8</option>
                        <option value="10">Beer &lt;= $10</option>
                        <option value="12">Beer &lt;= $12</option>
                      </select>

                      <select
                        value={wineMaxPrice}
                        onChange={(e) => setWineMaxPrice(e.target.value)}
                        className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                      >
                        <option value="ALL">Wine price</option>
                        <option value="8">Wine &lt;= $8</option>
                        <option value="10">Wine &lt;= $10</option>
                        <option value="12">Wine &lt;= $12</option>
                        <option value="15">Wine &lt;= $15</option>
                      </select>

                      <select
                        value={cocktailMaxPrice}
                        onChange={(e) => setCocktailMaxPrice(e.target.value)}
                        className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                      >
                        <option value="ALL">Cocktail price</option>
                        <option value="10">Cocktails &lt;= $10</option>
                        <option value="12">Cocktails &lt;= $12</option>
                        <option value="15">Cocktails &lt;= $15</option>
                        <option value="18">Cocktails &lt;= $18</option>
                      </select>

                      <select
                        value={foodMaxPrice}
                        onChange={(e) => setFoodMaxPrice(e.target.value)}
                        className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                      >
                        <option value="ALL">Food price</option>
                        <option value="8">Food &lt;= $8</option>
                        <option value="10">Food &lt;= $10</option>
                        <option value="15">Food &lt;= $15</option>
                        <option value="20">Food &lt;= $20</option>
                      </select>

                      <select
                        value={overallHhMaxPrice}
                        onChange={(e) => setOverallHhMaxPrice(e.target.value)}
                        className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                      >
                        <option value="ALL">Any HH price</option>
                        <option value="7">Any deal &lt;= $7</option>
                        <option value="10">Any deal &lt;= $10</option>
                        <option value="12">Any deal &lt;= $12</option>
                        <option value="15">Any deal &lt;= $15</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-10 text-xs text-white/40">
          Uses <code className="text-white">venue_types.label</code>, opening hours, kitchen
          hours, happy hour hours, bottle shop hours, schedule rules, Google rating, review
          count, price level and Maps link from Supabase.
        </div>
      </div>
    </div>
  );
}

function CompactToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        'inline-flex min-h-[32px] max-w-full items-center gap-1.5 rounded-[0.95rem] border px-2.25 py-1 text-[11px] leading-tight sm:min-h-[34px] sm:px-2.5 sm:text-xs',
        checked
          ? 'border-white/16 bg-white/[0.08] text-white'
          : 'border-white/10 bg-white/[0.025] text-white/68 hover:bg-white/[0.08] hover:text-white',
      ].join(' ')}
      aria-pressed={checked}
    >
      <span
        className={[
          'inline-flex h-3 w-3 items-center justify-center rounded border text-[8px]',
          checked ? 'border-white bg-white text-black' : 'border-white/20 bg-transparent',
        ].join(' ')}
      >
        {checked ? 'x' : ''}
      </span>
      <span className="break-words text-left select-none">{label}</span>
    </button>
  );
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/75">
      {children}
    </span>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs">
      {children}
    </span>
  );
}

function StatusPill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function HappyHourRuleCard({
  rule,
  dayLabel,
}: {
  rule: VenueScheduleRule;
  dayLabel?: string;
}) {
  const hasStructuredItems = HAPPY_HOUR_CATEGORIES.some(
    (category) => getDisplayHappyHourItems(rule.detail_json, category.key).length > 0
  );

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          {dayLabel ? `${dayLabel} | Happy Hour` : 'Happy Hour'}
        </div>
        <div className="rounded-full border border-pink-400/20 bg-pink-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-pink-200">
          {formatRuleTime(rule.start_time)} - {formatRuleTime(rule.end_time)}
        </div>
      </div>

      <div className="mt-2.5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {HAPPY_HOUR_CATEGORIES.map((category) => {
          const items = getDisplayHappyHourItems(rule.detail_json, category.key);
          if (items.length === 0) return null;
          const isFoodCategory = category.key === 'food';

          return (
            <div
              key={category.key}
              className={`rounded-md border border-white/10 bg-black/20 p-2.5 ${
                isFoodCategory ? 'md:col-span-2 xl:col-span-3' : ''
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                {category.label}
              </div>

              <div className={`mt-1.5 ${isFoodCategory ? 'space-y-2' : 'space-y-1.5'}`}>
                {items.map((item, index) => (
                  <div
                    key={`${category.key}-${index}-${item.title}`}
                    className={`${
                      isFoodCategory
                        ? 'rounded-md border border-white/10 bg-white/[0.03] px-3 py-2'
                        : ''
                    }`}
                  >
                    {isFoodCategory ? (
                      <div className="space-y-1">
                        <div className="space-y-2">
                          <div className="text-sm font-medium leading-5 text-white break-words">
                            {item.title}
                          </div>
                          {item.price != null ? (
                            <div className="inline-flex max-w-full rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                              {formatHappyHourAmount(item.price)}
                            </div>
                          ) : null}
                        </div>
                        {item.priceLabel ? (
                          <div className="text-[11px] leading-4 text-amber-200/90 break-words">
                            {item.priceLabel}
                          </div>
                        ) : null}
                        {item.description ? (
                          <div className="text-[11px] leading-4 text-amber-100/90 break-words whitespace-pre-wrap">
                            {item.description}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium leading-5 text-white">{item.title}</div>
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
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!hasStructuredItems && (rule.deal_text?.trim() || rule.description?.trim()) ? (
        <div className="mt-2.5 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
          {rule.deal_text?.trim() || rule.description?.trim()}
        </div>
      ) : null}

      {hasText(rule.detail_json?.notes) ? (
        <div className="mt-2.5 border-t border-white/10 pt-2.5 text-[11px] leading-4 text-white/45">
          {rule.detail_json?.notes}
        </div>
      ) : null}
    </div>
  );
}

function SpecialRuleCard({
  rule,
  dayLabel,
  highlightLive,
}: {
  rule: VenueScheduleRule;
  dayLabel?: string;
  highlightLive: boolean;
}) {
  const label = rule.schedule_type === 'lunch_special' ? 'Lunch Special' : 'Daily Special';
  const detail = [rule.description?.trim(), rule.notes?.trim()]
    .filter((value): value is string => Boolean(value))
    .join(' | ');

  return (
    <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/75">
            {label}
          </div>
          <div className="mt-1 text-sm font-semibold text-white">{getSpecialBadge(rule)}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {highlightLive ? (
            <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
              Live now
            </span>
          ) : null}
          <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
            {dayLabel ? `${dayLabel} | ` : ''}
            {formatRuleTime(rule.start_time)} - {formatRuleTime(rule.end_time)}
          </span>
        </div>
      </div>

      {detail ? <div className="mt-2 text-sm text-white/85">{detail}</div> : null}
    </div>
  );
}

export default function VenuesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
              Loading venues...
            </div>
          </div>
        </div>
      }
    >
      <VenuesPageContent />
    </Suspense>
  );
}

function EventRuleCard({
  rule,
  dayLabel,
}: {
  rule: VenueScheduleRule;
  dayLabel?: string;
}) {
  const displayTitle = getMeaningfulEventTitle(rule);
  const summary = formatEventRuleSummary(rule);

  return (
    <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-200/75">
            {getScheduleTypeDisplayLabel(rule.schedule_type)}
          </div>
          {displayTitle ? (
            <div className="mt-1 text-sm font-semibold text-white">{displayTitle}</div>
          ) : null}
        </div>

        <span className="rounded-full border border-violet-300/25 bg-violet-400/10 px-2 py-0.5 text-[11px] font-semibold text-violet-100">
          {dayLabel ? `${dayLabel} | ` : ''}
          {formatRuleTime(rule.start_time)} - {formatRuleTime(rule.end_time)}
        </span>
      </div>

      {summary ? <div className="mt-2 text-sm text-white/85">{summary}</div> : null}

      {rule.notes?.trim() && rule.notes.trim() !== summary ? (
        <div className="mt-2 text-xs text-white/60">{rule.notes.trim()}</div>
      ) : null}
    </div>
  );
}

function getScheduleTypeDisplayLabel(type: ScheduleType): string {
  return {
    opening: 'Opening Hours',
    kitchen: 'Kitchen Hours',
    happy_hour: 'Happy Hour',
    bottle_shop: 'Bottle Shop Hours',
    daily_special: 'Daily Special',
    lunch_special: 'Lunch Special',
    venue_rule: 'Venue Rule',
    trivia: '\u2753 Trivia',
    live_music: '\u{1F3B8} Live Music',
    sport: '\u{1F3DF}\uFE0F Sport Events',
    comedy: '\u{1F602} Comedy',
    karaoke: '\u{1F3A4} Karaoke',
    dj: '\u{1F3A7} DJ',
    special_event: '\u2728 Special Event',
  }[type];
}

function getScheduleTypeBaseLabel(type: ScheduleType): string {
  return {
    opening: 'Opening Hours',
    kitchen: 'Kitchen Hours',
    happy_hour: 'Happy Hour',
    bottle_shop: 'Bottle Shop Hours',
    daily_special: 'Daily Special',
    lunch_special: 'Lunch Special',
    venue_rule: 'Venue Rule',
    trivia: 'Trivia',
    live_music: 'Live Music',
    sport: 'Sport Events',
    comedy: 'Comedy',
    karaoke: 'Karaoke',
    dj: 'DJ',
    special_event: 'Special Event',
  }[type];
}

function normalizeComparisonText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function getMeaningfulEventTitle(rule: VenueScheduleRule): string | null {
  const trimmed = rule.title?.trim() ?? '';
  if (!trimmed) return null;

  const typeLabel = getScheduleTypeBaseLabel(rule.schedule_type);
  return normalizeComparisonText(trimmed) === normalizeComparisonText(typeLabel)
    ? null
    : trimmed;
}

function formatEventRuleSummary(rule: VenueScheduleRule): string | null {
  const parts = [
    getMeaningfulEventTitle(rule),
    rule.deal_text?.trim() || null,
    rule.description?.trim() || null,
  ].filter((value): value is string => Boolean(value));

  if (parts.length > 0) return parts.join(' | ');
  return rule.notes?.trim() || null;
}

function getVenueRuleBadge(rule: VenueScheduleRule): string | null {
  return getCompactVenueRuleSignal(rule);
}

function getSpecialBadge(rule: VenueScheduleRule): string | null {
  return getCompactSpecialLine(rule);
}

function getTodayRulesForType(
  rules: VenueScheduleRule[],
  timezone: string
): VenueScheduleRule[] {
  const today = getTodayDayOfWeek(timezone);
  return rules.filter((rule) => rule.day_of_week === today);
}

function isRuleLiveNow(rule: Pick<VenueScheduleRule, 'start_time' | 'end_time'>, timezone: string) {
  const hours = buildHoursJsonFromRules([
    {
      id: 'temp',
      venue_id: 'temp',
      schedule_type: 'daily_special',
      day_of_week: getTodayDayOfWeek(timezone),
      start_time: rule.start_time,
      end_time: rule.end_time,
      sort_order: 0,
      title: null,
      description: null,
      deal_text: null,
      notes: null,
      is_active: true,
      status: 'published',
      detail_json: null,
    },
  ]);

  return isOpenNow(hours, timezone, false);
}

function isFoodDealRule(rule: VenueScheduleRule) {
  const text = [rule.title, rule.deal_text, rule.description, rule.notes]
    .map((value) => normalizeComparisonText(value))
    .join(' ');

  if (rule.schedule_type === 'lunch_special') return true;

  return ['steak', 'parmi', 'burger', 'pizza', 'chips', 'food', 'lunch', 'meal'].some((term) =>
    text.includes(term)
  );
}






