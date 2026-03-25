'use client';

import { convertGoogleOpeningHours } from '@/lib/convert-google-hours';
import {
  getClosingSoonText,
  getNextOpeningText,
  isOpenLate,
  isOpenNow,
  isVenueOpenNow,
} from '@/lib/opening-hours';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import GoogleMap from '../components/GoogleMap';
import TodayHoursSummary from '../components/TodayHoursSummary';
import WeeklyTimelineChart from '../components/WeeklyTimelineChart';

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
  | 'trivia'
  | 'live_music'
  | 'sport'
  | 'comedy'
  | 'karaoke'
  | 'dj'
  | 'special_event';

type VenueTypeLookup = {
  id: string;
  label: string;
  slug: string;
};

type HappyHourPrice = {
  label?: string | null;
  amount: number | null;
};

type HappyHourDetailItem = {
  item?: string | null;
  name?: string | null;
  description?: string | null;
  price?: number | null;
  prices?: HappyHourPrice[] | null;
};

type HappyHourDetailJson = {
  beer?: HappyHourDetailItem[] | string | null;
  wine?: HappyHourDetailItem[] | string | null;
  spirits?: HappyHourDetailItem[] | string | null;
  cocktails?: HappyHourDetailItem[] | string | null;
  food?: HappyHourDetailItem[] | string | null;
  notes?: string | null;
};

type DisplayHappyHourItem = {
  title: string;
  subtitle: string | null;
  price: number | null;
  priceLabel: string | null;
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
  detail_json?: HappyHourDetailJson | null;
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
  booking_url: string | null;
  google_maps_uri: string | null;

  google_rating: number | null;
  google_user_rating_count: number | null;
  price_level: string | null;

  shows_sport: boolean | null;
  sport_types: string | null;

  byo_allowed: boolean | null;
  byo_notes: string | null;

  dog_friendly: boolean | null;
  kid_friendly: boolean | null;

  opening_hours: any | null;
  kitchen_hours: OpeningHours | null;
  happy_hour_hours: OpeningHours | null;

  timezone: string | null;
  is_temporarily_closed: boolean | null;

  status: string | null;

  venue_schedule_rules?: VenueScheduleRule[] | null;
};

const supabase = getSupabaseBrowserClient();

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

function hasText(v: string | null | undefined) {
  return Boolean(v && v.trim().length > 0);
}

function hasValidCoords(lat: number | null, lng: number | null) {
  return (
    typeof lat === 'number' &&
    !Number.isNaN(lat) &&
    typeof lng === 'number' &&
    !Number.isNaN(lng)
  );
}

function getVenueTypeLabel(venue: Venue): string | null {
  if (!venue.venue_types) return null;

  if (Array.isArray(venue.venue_types)) {
    return venue.venue_types[0]?.label ?? null;
  }

  return venue.venue_types.label ?? null;
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

function normalizeSearchValue(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function matchesSearchTerm(venue: Venue, searchTerm: string): boolean {
  const term = normalizeSearchValue(searchTerm);

  if (!term) return true;

  const venueTypeLabel = getVenueTypeLabel(venue);

  const searchableFields = [venue.name, venue.suburb, venue.address, venueTypeLabel];

  return searchableFields.some((field) => normalizeSearchValue(field).includes(term));
}

function formatRuleTime(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 5);
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

function getPublishedHappyHourRules(venue: Venue): VenueScheduleRule[] {
  return sortScheduleRules(
    (venue.venue_schedule_rules ?? []).filter(
      (rule) =>
        rule.schedule_type === 'happy_hour' &&
        rule.is_active === true &&
        rule.status === 'published'
    )
  );
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
): HappyHourItem[] {
  const items = detail?.[category];
  return Array.isArray(items) ? items.filter((item) => item && hasText(item.item)) : [];
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

function matchesMaxPrice(value: number | null, selected: string): boolean {
  if (selected === 'ALL') return true;
  if (value == null) return false;
  return value <= Number(selected);
}

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [suburb, setSuburb] = useState<string>('ALL');
  const [venueType, setVenueType] = useState<string>('ALL');

  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [openLateOnly, setOpenLateOnly] = useState(false);
  const [happyHourNowOnly, setHappyHourNowOnly] = useState(false);
  const [kitchenOpenNowOnly, setKitchenOpenNowOnly] = useState(false);

  const [filterSport, setFilterSport] = useState(false);
  const [filterBYO, setFilterBYO] = useState(false);
  const [filterDog, setFilterDog] = useState(false);
  const [filterKid, setFilterKid] = useState(false);

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

  const [minGoogleRating, setMinGoogleRating] = useState<string>('ALL');
  const [priceFilter, setPriceFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('NAME');

  const [expandedVenueIds, setExpandedVenueIds] = useState<Record<string, boolean>>({});
  const [showDesktopMap, setShowDesktopMap] = useState(true);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      if (!supabase) {
        setError(
          'Missing Supabase env vars. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart npm run dev.'
        );
        setVenues([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('venues')
        .select(`
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
        `)
        .order('name', { ascending: true });

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setVenues([]);
      } else {
        setVenues(((data ?? []) as unknown) as Venue[]);
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const suburbs = useMemo(() => {
    const set = new Set<string>();
    venues.forEach((v) => {
      if (v.suburb) set.add(v.suburb);
    });
    return ['ALL', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [venues]);

  const venueTypes = useMemo(() => {
    const set = new Set<string>();

    venues.forEach((v) => {
      const label = getVenueTypeLabel(v);
      if (label) set.add(label);
    });

    return ['ALL', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [venues]);

  const filtered = useMemo(() => {
    const result = venues.filter((v) => {
      const venueTypeLabel = getVenueTypeLabel(v) ?? '';
      const normalizedOpeningHours = convertGoogleOpeningHours(v.opening_hours);
      const happyHourRules = getPublishedHappyHourRules(v);

      if (v.status && !['active', 'open', 'published'].includes(v.status.toLowerCase())) {
        return false;
      }

      if (!matchesSearchTerm(v, searchTerm)) return false;
      if (suburb !== 'ALL' && (v.suburb ?? '') !== suburb) return false;
      if (venueType !== 'ALL' && venueTypeLabel !== venueType) return false;

      if (filterSport && !v.shows_sport) return false;
      if (filterBYO && !v.byo_allowed) return false;
      if (filterDog && !v.dog_friendly) return false;
      if (filterKid && !v.kid_friendly) return false;

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

      if (
        openNowOnly &&
        !isVenueOpenNow(
          normalizedOpeningHours,
          v.timezone ?? 'Australia/Sydney',
          v.is_temporarily_closed ?? false
        )
      ) {
        return false;
      }

      if (openLateOnly && !isOpenLate(normalizedOpeningHours, '02:00')) return false;

      if (
        happyHourNowOnly &&
        !isOpenNow(v.happy_hour_hours, v.timezone ?? 'Australia/Sydney')
      ) {
        return false;
      }

      if (
        kitchenOpenNowOnly &&
        !isOpenNow(v.kitchen_hours, v.timezone ?? 'Australia/Sydney')
      ) {
        return false;
      }

      if (!matchesMinRating(v.google_rating, minGoogleRating)) return false;
      if (!matchesPriceLevel(v.price_level, priceFilter)) return false;

      return true;
    });

    result.sort((a, b) => {
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
    openNowOnly,
    openLateOnly,
    happyHourNowOnly,
    kitchenOpenNowOnly,
    minGoogleRating,
    priceFilter,
    sortBy,
  ]);

  const mapVenues = useMemo(() => {
    return filtered.filter((v) => hasValidCoords(v.lat, v.lng));
  }, [filtered]);

  function clearFilters() {
    setSearchTerm('');
    setSuburb('ALL');
    setVenueType('ALL');
    setOpenNowOnly(false);
    setOpenLateOnly(false);
    setHappyHourNowOnly(false);
    setKitchenOpenNowOnly(false);
    setFilterSport(false);
    setFilterBYO(false);
    setFilterDog(false);
    setFilterKid(false);
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
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold">Venues</h1>
            <p className="mt-2 text-white/70">First Round — Inner West</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              {showFilters ? 'Collapse filters' : 'Show filters'}
            </button>

            <button
              type="button"
              onClick={() => setShowDesktopMap((prev) => !prev)}
              className="hidden rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 lg:block"
            >
              {showDesktopMap ? 'Hide map' : 'Show map'}
            </button>
          </div>
        </div>

        <div className="sticky top-0 z-50 mt-6 rounded-2xl border border-white/10 bg-black/90 p-3 backdrop-blur">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(110px,1fr))]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search venue, suburb or type"
              className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white placeholder:text-white/35"
            />

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
              value={venueType}
              onChange={(e) => setVenueType(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white"
            >
              {venueTypes.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>

            <select
              value={minGoogleRating}
              onChange={(e) => setMinGoogleRating(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white"
            >
              <option value="ALL">ALL RATINGS</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
              <option value="4.8">4.8+</option>
            </select>

            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white"
            >
              <option value="ALL">ALL PRICES</option>
              <option value="$">$</option>
              <option value="$$">$$</option>
              <option value="$$$">$$$</option>
              <option value="$$$$">$$$$</option>
            </select>

            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 text-sm text-white"
              >
                <option value="NAME">Name</option>
                <option value="RATING_DESC">Highest Rated</option>
                <option value="REVIEWS_DESC">Most Reviews</option>
                <option value="PRICE_ASC">Cheapest</option>
                <option value="PRICE_DESC">Most Expensive</option>
              </select>

              <button
                onClick={clearFilters}
                className="h-10 shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white hover:bg-white/10"
              >
                Clear
              </button>
            </div>
          </div>

          {showFilters ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CompactToggle label="🟢 OPEN NOW" checked={openNowOnly} onChange={setOpenNowOnly} />
                <CompactToggle label="🌙 OPEN LATE" checked={openLateOnly} onChange={setOpenLateOnly} />
                <CompactToggle label="🍸 HAPPY NOW" checked={happyHourNowOnly} onChange={setHappyHourNowOnly} />
                <CompactToggle label="🍽️ KITCHEN" checked={kitchenOpenNowOnly} onChange={setKitchenOpenNowOnly} />
                <CompactToggle label="🏉 SPORT" checked={filterSport} onChange={setFilterSport} />
                <CompactToggle label="🍷 BYO" checked={filterBYO} onChange={setFilterBYO} />
                <CompactToggle label="🐶 DOG" checked={filterDog} onChange={setFilterDog} />
                <CompactToggle label="👶 KID" checked={filterKid} onChange={setFilterKid} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="mr-1 text-[11px] font-medium uppercase tracking-wide text-white/45">
                  Happy Hour
                </div>
                <CompactToggle label="🍷 WINE" checked={hhWine} onChange={setHhWine} />
                <CompactToggle label="🍺 BEER" checked={hhBeer} onChange={setHhBeer} />
                <CompactToggle label="🥃 SPIRITS" checked={hhSpirits} onChange={setHhSpirits} />
                <CompactToggle label="🍸 COCKTAILS" checked={hhCocktails} onChange={setHhCocktails} />
                <CompactToggle label="🍔 FOOD" checked={hhFood} onChange={setHhFood} />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
                <select
                  value={beerMaxPrice}
                  onChange={(e) => setBeerMaxPrice(e.target.value)}
                  className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                >
                  <option value="ALL">Beer price</option>
                  <option value="7">Beer ≤ $7</option>
                  <option value="8">Beer ≤ $8</option>
                  <option value="10">Beer ≤ $10</option>
                  <option value="12">Beer ≤ $12</option>
                </select>

                <select
                  value={wineMaxPrice}
                  onChange={(e) => setWineMaxPrice(e.target.value)}
                  className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                >
                  <option value="ALL">Wine price</option>
                  <option value="8">Wine ≤ $8</option>
                  <option value="10">Wine ≤ $10</option>
                  <option value="12">Wine ≤ $12</option>
                  <option value="15">Wine ≤ $15</option>
                </select>

                <select
                  value={cocktailMaxPrice}
                  onChange={(e) => setCocktailMaxPrice(e.target.value)}
                  className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                >
                  <option value="ALL">Cocktail price</option>
                  <option value="10">Cocktails ≤ $10</option>
                  <option value="12">Cocktails ≤ $12</option>
                  <option value="15">Cocktails ≤ $15</option>
                  <option value="18">Cocktails ≤ $18</option>
                </select>

                <select
                  value={foodMaxPrice}
                  onChange={(e) => setFoodMaxPrice(e.target.value)}
                  className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                >
                  <option value="ALL">Food price</option>
                  <option value="8">Food ≤ $8</option>
                  <option value="10">Food ≤ $10</option>
                  <option value="15">Food ≤ $15</option>
                  <option value="20">Food ≤ $20</option>
                </select>

                <select
                  value={overallHhMaxPrice}
                  onChange={(e) => setOverallHhMaxPrice(e.target.value)}
                  className="h-9 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"
                >
                  <option value="ALL">Any HH price</option>
                  <option value="7">Any deal ≤ $7</option>
                  <option value="10">Any deal ≤ $10</option>
                  <option value="12">Any deal ≤ $12</option>
                  <option value="15">Any deal ≤ $15</option>
                </select>
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-8 lg:grid lg:grid-cols-12 lg:gap-6">
          <div className={showDesktopMap ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'}>
            {loading && <div className="text-white/70">Loading venues…</div>}

            {!loading && error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6">
                <div className="text-xl font-semibold">Couldn’t load venues</div>
                <div className="mt-2 text-white/70">{error}</div>
              </div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
                No venues match your filters.
              </div>
            )}

            {!loading && !error && filtered.length > 0 && (
              <>
                <div className="mb-4 text-sm text-white/60">
                  Showing {filtered.length} venue{filtered.length === 1 ? '' : 's'}
                  {searchTerm.trim() ? ` for "${searchTerm.trim()}"` : ''}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {filtered.map((v) => {
                    const timezone = v.timezone ?? 'Australia/Sydney';
                    const isExpanded = !!expandedVenueIds[v.id];
                    const venueTypeLabel = getVenueTypeLabel(v);
                    const normalizedOpeningHours = convertGoogleOpeningHours(v.opening_hours);
                    const happyHourRules = getPublishedHappyHourRules(v);
                    const todayHappyHourRules = getTodayHappyHourRules(happyHourRules, timezone);
                    const todayLabel = DAY_LABELS[getTodayDayOfWeek(timezone)];

                    const openNow = isVenueOpenNow(
                      normalizedOpeningHours,
                      timezone,
                      v.is_temporarily_closed ?? false
                    );

                    const closingSoonText = getClosingSoonText(
                      normalizedOpeningHours,
                      timezone,
                      v.is_temporarily_closed ?? false
                    );

                    const nextOpeningText = getNextOpeningText(
                      normalizedOpeningHours,
                      timezone,
                      v.is_temporarily_closed ?? false
                    );

                    const happyHourNow = isOpenNow(v.happy_hour_hours, timezone, false);
                    const kitchenOpenNow = isOpenNow(v.kitchen_hours, timezone, false);
                    const openLate = isOpenLate(normalizedOpeningHours, '02:00');

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
                                ⭐ {ratingText}
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
                                Open now
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
                                Happy hour now
                              </StatusPill>
                            ) : null}

                            {kitchenOpenNow ? (
                              <StatusPill className="border-orange-500/30 bg-orange-500/15 text-orange-200">
                                Kitchen open now
                              </StatusPill>
                            ) : null}

                            {openLate ? (
                              <StatusPill className="border-indigo-500/30 bg-indigo-500/15 text-indigo-200">
                                Open late
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
                            {v.shows_sport ? <Pill>🏉 SPORT</Pill> : null}
                            {v.byo_allowed ? <Pill>🍷 BYO</Pill> : null}
                            {v.dog_friendly ? <Pill>🐶 DOG</Pill> : null}
                            {v.kid_friendly ? <Pill>👶 KID</Pill> : null}
                          </div>
                        </div>

                        <div className="mt-4">
                          <TodayHoursSummary
                            openingHours={normalizedOpeningHours}
                            kitchenHours={v.kitchen_hours}
                            happyHourHours={v.happy_hour_hours}
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
                                <div
                                  key={rule.id}
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                                >
                                  <div className="text-xs uppercase tracking-wide text-white/45">
                                    {todayLabel} · {formatRuleTime(rule.start_time)}–{formatRuleTime(rule.end_time)}
                                  </div>

                                  {getHappyHourItems(rule.detail_json, 'beer').length > 0 ? (
                                    <div className="mt-2">
                                      <div className="text-xs uppercase tracking-wide text-white/45">Beer</div>
                                      {getHappyHourItems(rule.detail_json, 'beer').map((item, index) => (
                                        <div key={`beer-${index}`} className="mt-1 text-sm text-white/80">
                                          {item.item}{item.price != null ? ` — $${item.price}` : ''}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}

                                  {getHappyHourItems(rule.detail_json, 'wine').length > 0 ? (
                                    <div className="mt-2">
                                      <div className="text-xs uppercase tracking-wide text-white/45">Wine</div>
                                      {getHappyHourItems(rule.detail_json, 'wine').map((item, index) => (
                                        <div key={`wine-${index}`} className="mt-1 text-sm text-white/80">
                                          {item.item}{item.price != null ? ` — $${item.price}` : ''}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}

                                  {getHappyHourItems(rule.detail_json, 'spirits').length > 0 ? (
                                    <div className="mt-2">
                                      <div className="text-xs uppercase tracking-wide text-white/45">Spirits</div>
                                      {getHappyHourItems(rule.detail_json, 'spirits').map((item, index) => (
                                        <div key={`spirits-${index}`} className="mt-1 text-sm text-white/80">
                                          {item.item}{item.price != null ? ` — $${item.price}` : ''}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}

                                  {getHappyHourItems(rule.detail_json, 'cocktails').length > 0 ? (
                                    <div className="mt-2">
                                      <div className="text-xs uppercase tracking-wide text-white/45">Cocktails</div>
                                      {getHappyHourItems(rule.detail_json, 'cocktails').map((item, index) => (
                                        <div key={`cocktails-${index}`} className="mt-1 text-sm text-white/80">
                                          {item.item}{item.price != null ? ` — $${item.price}` : ''}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}

                                  {getHappyHourItems(rule.detail_json, 'food').length > 0 ? (
                                    <div className="mt-2">
                                      <div className="text-xs uppercase tracking-wide text-white/45">Food</div>
                                      {getHappyHourItems(rule.detail_json, 'food').map((item, index) => (
                                        <div key={`food-${index}`} className="mt-1 text-sm text-white/80">
                                          {item.item}{item.price != null ? ` — $${item.price}` : ''}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}

                                  {hasText(rule.detail_json?.notes) ? (
                                    <div className="mt-2 text-xs text-white/45">{rule.detail_json?.notes}</div>
                                  ) : null}
                                </div>
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
                            <a
                              href="#map-section"
                              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 lg:hidden"
                            >
                              View on map
                            </a>
                          ) : null}
                        </div>

                        {isExpanded ? (
                          <div className="mt-4 space-y-4">
                            <WeeklyTimelineChart
                              openingHours={normalizedOpeningHours}
                              kitchenHours={v.kitchen_hours}
                              happyHourHours={v.happy_hour_hours}
                              timezone={timezone}
                            />

                            {happyHourRules.length > 0 ? (
                              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                                <div className="text-sm font-semibold text-white/80">
                                  Weekly Happy Hour Details
                                </div>

                                <div className="mt-3 space-y-3">
                                  {DAY_ORDER.map((day) => {
                                    const dayRules = happyHourRules.filter(
                                      (rule) => rule.day_of_week === day
                                    );
                                    if (dayRules.length === 0) return null;

                                    return (
                                      <div key={day} className="grid grid-cols-[56px_1fr] gap-3">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-white/45">
                                          {DAY_LABELS[day]}
                                        </div>

                                        <div className="space-y-2">
                                          {dayRules.map((rule) => (
                                            <div
                                              key={rule.id}
                                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                                            >
                                              <div className="text-xs text-white/45">
                                                {formatRuleTime(rule.start_time)}–{formatRuleTime(rule.end_time)}
                                              </div>

                                              {getHappyHourItems(rule.detail_json, 'beer').length > 0 ? (
                                                <div className="mt-2">
                                                  <div className="text-xs uppercase tracking-wide text-white/45">Beer</div>
                                                  {getHappyHourItems(rule.detail_json, 'beer').map((item, index) => (
                                                    <div key={`beer-week-${index}`} className="mt-1 text-sm text-white/80">
                                                      {item.item}{item.price != null ? ` — $${item.price}` : ''}
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : null}

                                              {getHappyHourItems(rule.detail_json, 'wine').length > 0 ? (
                                                <div className="mt-2">
                                                  <div className="text-xs uppercase tracking-wide text-white/45">Wine</div>
                                                  {getHappyHourItems(rule.detail_json, 'wine').map((item, index) => (
                                                    <div key={`wine-week-${index}`} className="mt-1 text-sm text-white/80">
                                                      {item.item}{item.price != null ? ` — $${item.price}` : ''}
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : null}

                                              {getHappyHourItems(rule.detail_json, 'spirits').length > 0 ? (
                                                <div className="mt-2">
                                                  <div className="text-xs uppercase tracking-wide text-white/45">Spirits</div>
                                                  {getHappyHourItems(rule.detail_json, 'spirits').map((item, index) => (
                                                    <div key={`spirits-week-${index}`} className="mt-1 text-sm text-white/80">
                                                      {item.item}{item.price != null ? ` — $${item.price}` : ''}
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : null}

                                              {getHappyHourItems(rule.detail_json, 'cocktails').length > 0 ? (
                                                <div className="mt-2">
                                                  <div className="text-xs uppercase tracking-wide text-white/45">Cocktails</div>
                                                  {getHappyHourItems(rule.detail_json, 'cocktails').map((item, index) => (
                                                    <div key={`cocktails-week-${index}`} className="mt-1 text-sm text-white/80">
                                                      {item.item}{item.price != null ? ` — $${item.price}` : ''}
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : null}

                                              {getHappyHourItems(rule.detail_json, 'food').length > 0 ? (
                                                <div className="mt-2">
                                                  <div className="text-xs uppercase tracking-wide text-white/45">Food</div>
                                                  {getHappyHourItems(rule.detail_json, 'food').map((item, index) => (
                                                    <div key={`food-week-${index}`} className="mt-1 text-sm text-white/80">
                                                      {item.item}{item.price != null ? ` — $${item.price}` : ''}
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : null}

                                              {hasText(rule.detail_json?.notes) ? (
                                                <div className="mt-2 text-xs text-white/45">{rule.detail_json?.notes}</div>
                                              ) : null}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-3 text-sm">
                          {v.booking_url ? (
                            <a
                              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
                              href={v.booking_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Book
                            </a>
                          ) : null}

                          {v.website_url ? (
                            <a
                              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
                              href={v.website_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Website
                            </a>
                          ) : null}

                          {v.phone ? (
                            <a
                              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
                              href={`tel:${v.phone}`}
                            >
                              Call
                            </a>
                          ) : null}

                          {v.google_maps_uri ? (
                            <a
                              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
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

          {showDesktopMap ? (
            <div className="mt-8 hidden lg:col-span-5 lg:mt-0 lg:block xl:col-span-4">
              <div
                id="map-section"
                className="sticky top-[180px] rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white/80">Map</div>
                    <div className="text-xs text-white/50">
                      {mapVenues.length} mapped venue{mapVenues.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-white/10">
                  <GoogleMap venues={mapVenues} />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {!loading && !error && filtered.length > 0 ? (
          <div
            id="map-section"
            className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 lg:hidden"
          >
            <div className="mb-3 text-sm font-semibold text-white/80">Map</div>
            <div className="overflow-hidden rounded-xl border border-white/10">
              <GoogleMap venues={mapVenues} />
            </div>
          </div>
        ) : null}

        <div className="mt-10 text-xs text-white/40">
          Uses <code className="text-white">venue_types.label</code>, opening hours, kitchen
          hours, happy hour hours, happy hour schedule rules, Google rating, review count,
          price level and Maps link from Supabase.
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
        'inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs leading-none',
        checked
          ? 'border-white/30 bg-white/15'
          : 'border-white/10 bg-white/5 hover:bg-white/10',
      ].join(' ')}
      aria-pressed={checked}
    >
      <span
        className={[
          'inline-flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px]',
          checked ? 'border-white bg-white text-black' : 'border-white/30 bg-transparent',
        ].join(' ')}
      >
        {checked ? '✓' : ''}
      </span>
      <span className="whitespace-nowrap select-none">{label}</span>
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