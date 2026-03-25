'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type AdminTab = 'schedules' | 'venues';

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

type HappyHourPrice = {
  label?: string | null;
  amount: number | null;
};

type HappyHourDetailItem = {
  name?: string | null;
  item?: string | null;
  description?: string | null;
  prices?: HappyHourPrice[] | null;
  price?: number | null;
};

type HappyHourDetailJson = {
  beer?: HappyHourDetailItem[] | string | null;
  wine?: HappyHourDetailItem[] | string | null;
  spirits?: HappyHourDetailItem[] | string | null;
  cocktails?: HappyHourDetailItem[] | string | null;
  food?: HappyHourDetailItem[] | string | null;
  notes?: string | null;
};

type HappyHourPriceForm = {
  id: string;
  label: string;
  amount: string;
};

type HappyHourItemForm = {
  id: string;
  name: string;
  description: string;
  prices: HappyHourPriceForm[];
};

type HappyHourFormState = {
  beer: HappyHourItemForm[];
  wine: HappyHourItemForm[];
  spirits: HappyHourItemForm[];
  cocktails: HappyHourItemForm[];
  food: HappyHourItemForm[];
  notes: string;
};

type HappyHourCategoryKey = keyof Omit<HappyHourFormState, 'notes'>;

type Venue = {
  id: string;
  name: string | null;
  suburb: string | null;
  venue_type_id: string | null;
  google_place_id?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  website_url?: string | null;
  google_rating?: number | null;
  price_level?: string | null;
  opening_hours?: OpeningHours | null;
  kitchen_hours?: OpeningHours | null;
  happy_hour_hours?: OpeningHours | null;
};

type VenueType = {
  id: string;
  display_name: string;
  raw_value: string;
};

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

type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

type SaveMode = 'append' | 'replace';

type TimeBlock = {
  start_time: string;
  end_time: string;
};

type GoogleSearchResult = {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number | null;
  price_level?: string | null;
  primary_type?: string | null;
  types?: string[] | null;
};

type GoogleOpeningHoursPeriodPoint = {
  day?: number;
  hour?: number;
  minute?: number;
};

type GooglePlaceDetailsResult = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  rating?: number | null;
  priceLevel?: string | null;
  nationalPhoneNumber?: string | null;
  websiteUri?: string | null;
  primaryType?: string | null;
  types?: string[] | null;
  regularOpeningHours?: {
    periods?: Array<{
      open?: GoogleOpeningHoursPeriodPoint;
      close?: GoogleOpeningHoursPeriodPoint;
    }>;
    weekdayDescriptions?: string[];
  } | null;
};

type VenueFormState = {
  id?: string | null;
  name: string;
  suburb: string;
  venue_type_id: string;
  google_place_id: string;
  address: string;
  lat: string;
  lng: string;
  phone: string;
  website_url: string;
  google_rating: string;
  price_level: string;
  opening_hours: OpeningHours | null;
};

const DAY_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const SCHEDULE_TYPE_OPTIONS: { value: ScheduleType; label: string }[] = [
  { value: 'opening', label: 'Opening Hours' },
  { value: 'kitchen', label: 'Kitchen Hours' },
  { value: 'happy_hour', label: 'Happy Hour' },
  { value: 'trivia', label: 'Trivia' },
  { value: 'live_music', label: 'Live Music' },
  { value: 'sport', label: 'Sport' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'dj', label: 'DJ' },
  { value: 'special_event', label: 'Special Event' },
];

const GOOGLE_DAY_KEYS: Array<
  'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
> = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const supabase = getSupabaseBrowserClient();

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatVenueTypeId(value: string | null) {
  if (!value) return '—';

  return value
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function requiresTitle(type: ScheduleType) {
  return [
    'trivia',
    'live_music',
    'sport',
    'comedy',
    'karaoke',
    'dj',
    'special_event',
  ].includes(type);
}

function canSyncToVenueHours(type: ScheduleType) {
  return ['opening', 'kitchen', 'happy_hour'].includes(type);
}

function getScheduleTypeLabel(type: ScheduleType) {
  return SCHEDULE_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function extractSuburbFromAddress(address: string) {
  if (!address) return '';

  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);

  if (parts.length < 2) return '';

  const middlePart = parts[1] ?? '';
  return middlePart.replace(/\s+NSW\s+\d{4}$/i, '').trim();
}

function blankVenueForm(): VenueFormState {
  return {
    id: null,
    name: '',
    suburb: '',
    venue_type_id: '',
    google_place_id: '',
    address: '',
    lat: '',
    lng: '',
    phone: '',
    website_url: '',
    google_rating: '',
    price_level: '',
    opening_hours: null,
  };
}

function blankPriceForm(): HappyHourPriceForm {
  return {
    id: makeId(),
    label: '',
    amount: '',
  };
}

function blankItemForm(): HappyHourItemForm {
  return {
    id: makeId(),
    name: '',
    description: '',
    prices: [blankPriceForm()],
  };
}

function blankHappyHourForm(): HappyHourFormState {
  return {
    beer: [],
    wine: [],
    spirits: [],
    cocktails: [],
    food: [],
    notes: '',
  };
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[_-]/g, ' ').trim();
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function findVenueTypeIdByName(
  venueTypes: VenueType[],
  candidateNames: string[]
): string {
  const normalizedCandidates = candidateNames
    .map((name) => normalizeText(name))
    .filter(Boolean);

  for (const candidate of normalizedCandidates) {
    const exact = venueTypes.find(
      (type) => normalizeText(type.display_name) === candidate
    );
    if (exact) return exact.id;
  }

  for (const candidate of normalizedCandidates) {
    const contains = venueTypes.find((type) => {
      const typeName = normalizeText(type.display_name);
      return typeName.includes(candidate) || candidate.includes(typeName);
    });
    if (contains) return contains.id;
  }

  return '';
}

function guessVenueTypeIdFromGoogle(
  venueTypes: VenueType[],
  googleTypes: string[] = [],
  venueName = ''
): string {
  const joinedGoogleTypes = googleTypes.map(normalizeText);
  const name = normalizeText(venueName);

  const categoryMap: Record<string, string[]> = {
    pub: ['pub', 'bar'],
    bar: ['bar'],
    cocktail_bar: ['cocktail bar', 'bar', 'night club'],
    wine_bar: ['wine bar', 'bar'],
    brewery: ['brewery', 'beer hall'],
    restaurant: [
      'restaurant',
      'meal takeaway',
      'meal delivery',
      'bistro',
      'brasserie',
    ],
    cafe: ['cafe', 'coffee shop'],
    deli: ['deli', 'delicatessen'],
    pizzeria: ['pizza restaurant', 'pizzeria'],
    burger: ['hamburger restaurant'],
    steakhouse: ['steak house'],
    seafood: ['seafood restaurant'],
    thai: ['thai restaurant'],
    italian: ['italian restaurant'],
    japanese: ['japanese restaurant'],
    chinese: ['chinese restaurant'],
    mexican: ['mexican restaurant'],
    indian: ['indian restaurant'],
    french: ['french restaurant'],
    mediterranean: ['mediterranean restaurant'],
    tapas: ['tapas bar', 'spanish restaurant'],
    sports_bar: ['sports bar', 'bar'],
    nightclub: ['night club'],
  };

  for (const [venueTypeName, googleMatches] of Object.entries(categoryMap)) {
    const matched = googleMatches.some((match) =>
      joinedGoogleTypes.some(
        (googleType) =>
          googleType === normalizeText(match) ||
          googleType.includes(normalizeText(match))
      )
    );

    if (matched) {
      const id = findVenueTypeIdByName(venueTypes, [venueTypeName]);
      if (id) return id;
    }
  }

  if (name.includes('deli')) {
    const deliId = findVenueTypeIdByName(venueTypes, ['deli', 'restaurant', 'cafe']);
    if (deliId) return deliId;
  }

  if (name.includes('hotel')) {
    const pubId = findVenueTypeIdByName(venueTypes, ['pub', 'bar']);
    if (pubId) return pubId;
  }

  if (name.includes('bar')) {
    const barId = findVenueTypeIdByName(venueTypes, [
      'cocktail bar',
      'wine bar',
      'bar',
    ]);
    if (barId) return barId;
  }

  if (name.includes('cafe') || name.includes('coffee')) {
    const cafeId = findVenueTypeIdByName(venueTypes, ['cafe']);
    if (cafeId) return cafeId;
  }

  if (name.includes('restaurant') || name.includes('bistro')) {
    const restaurantId = findVenueTypeIdByName(venueTypes, ['restaurant']);
    if (restaurantId) return restaurantId;
  }

  const fallbackId = findVenueTypeIdByName(venueTypes, ['restaurant', 'bar', 'cafe']);
  return fallbackId;
}

function toTimeString(hour?: number, minute?: number) {
  const safeHour = typeof hour === 'number' ? hour : 0;
  const safeMinute = typeof minute === 'number' ? minute : 0;
  return `${String(safeHour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}`;
}

function convertGoogleRegularOpeningHoursToOpeningHours(
  regularOpeningHours?: GooglePlaceDetailsResult['regularOpeningHours']
): OpeningHours | null {
  const periods = regularOpeningHours?.periods;

  if (!periods || !Array.isArray(periods) || periods.length === 0) {
    return null;
  }

  const output: OpeningHours = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };

  for (const period of periods) {
    const open = period.open;
    const close = period.close;

    if (typeof open?.day !== 'number') continue;

    const dayKey = GOOGLE_DAY_KEYS[open.day];
    if (!dayKey) continue;

    const openTime = toTimeString(open.hour, open.minute);

    let closeTime = '23:59';
    if (typeof close?.hour === 'number' && typeof close?.minute === 'number') {
      closeTime = toTimeString(close.hour, close.minute);
    }

    if (!output[dayKey]) {
      output[dayKey] = [];
    }

    output[dayKey]!.push({
      open: openTime,
      close: closeTime,
    });
  }

  (Object.keys(output) as Array<keyof OpeningHours>).forEach((key) => {
    if (!output[key] || output[key]!.length === 0) {
      delete output[key];
    }
  });

  return Object.keys(output).length > 0 ? output : null;
}

function buildHoursJsonFromRows(
  scheduleRows: Array<{
    day_of_week: DayOfWeek;
    start_time: string;
    end_time: string;
    sort_order?: number;
  }>
): OpeningHours | null {
  const output: OpeningHours = {};
  const orderedDays: DayOfWeek[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  for (const day of orderedDays) {
    const matching = scheduleRows
      .filter((row) => row.day_of_week === day)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((row) => ({
        open: row.start_time.slice(0, 5),
        close: row.end_time.slice(0, 5),
      }));

    if (matching.length > 0) {
      output[day] = matching;
    }
  }

  return Object.keys(output).length > 0 ? output : null;
}

function parseLegacyStringToItems(value: string): HappyHourItemForm[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  return [
    {
      id: makeId(),
      name: trimmed,
      description: '',
      prices: [blankPriceForm()],
    },
  ];
}

function parseDetailCategoryToItems(
  value?: HappyHourDetailItem[] | string | null
): HappyHourItemForm[] {
  if (!value) return [];
  if (typeof value === 'string') return parseLegacyStringToItems(value);
  if (!Array.isArray(value)) return [];

  return value.map((entry) => {
    const name =
      typeof entry?.name === 'string'
        ? entry.name
        : typeof entry?.item === 'string'
        ? entry.item
        : '';

    const prices =
      Array.isArray(entry?.prices) && entry.prices.length > 0
        ? entry.prices.map((price) => ({
            id: makeId(),
            label: typeof price?.label === 'string' ? price.label : '',
            amount:
              typeof price?.amount === 'number' && !Number.isNaN(price.amount)
                ? String(price.amount)
                : '',
          }))
        : typeof entry?.price === 'number' && !Number.isNaN(entry.price)
        ? [
            {
              id: makeId(),
              label: '',
              amount: String(entry.price),
            },
          ]
        : [blankPriceForm()];

    return {
      id: makeId(),
      name: name ?? '',
      description:
        typeof entry?.description === 'string' ? entry.description : '',
      prices,
    };
  });
}

function buildCategoryDetail(items: HappyHourItemForm[]): HappyHourDetailItem[] | null {
  const output = items
    .map((item) => {
      const name = item.name.trim();
      const description = item.description.trim();

      const prices = item.prices
        .map((price) => {
          const label = price.label.trim();
          const amountValue = price.amount.trim();

          if (!amountValue) return null;

          const parsed = Number(amountValue.replace(/\$/g, '').trim());
          if (Number.isNaN(parsed)) return null;

          return {
            label: label || null,
            amount: parsed,
          };
        })
        .filter(Boolean) as HappyHourPrice[];

      if (!name && !description && prices.length === 0) {
        return null;
      }

      return {
        name: name || null,
        description: description || null,
        prices: prices.length ? prices : null,
      };
    })
    .filter(Boolean) as HappyHourDetailItem[];

  return output.length ? output : null;
}

function buildHappyHourDetailJson(form: HappyHourFormState): HappyHourDetailJson | null {
  const beer = buildCategoryDetail(form.beer);
  const wine = buildCategoryDetail(form.wine);
  const spirits = buildCategoryDetail(form.spirits);
  const cocktails = buildCategoryDetail(form.cocktails);
  const food = buildCategoryDetail(form.food);
  const notes = form.notes.trim() || null;

  const hasAny =
    !!beer || !!wine || !!spirits || !!cocktails || !!food || hasText(notes);

  if (!hasAny) return null;

  return {
    beer,
    wine,
    spirits,
    cocktails,
    food,
    notes,
  };
}

function buildHappyHourDealSummary(form: HappyHourFormState): string | null {
  const buildSummary = (label: string, items: HappyHourItemForm[]) => {
    const values = items
      .map((item) => {
        const name = item.name.trim();
        const firstPrice = item.prices.find((price) => hasText(price.amount));

        if (!name) return '';

        if (firstPrice?.amount?.trim()) {
          return `${name} $${firstPrice.amount.trim()}`;
        }

        return name;
      })
      .filter(Boolean);

    if (!values.length) return '';
    return `${label}: ${values.join(', ')}`;
  };

  const parts = [
    buildSummary('Beer', form.beer),
    buildSummary('Wine', form.wine),
    buildSummary('Spirits', form.spirits),
    buildSummary('Cocktails', form.cocktails),
    buildSummary('Food', form.food),
  ].filter(Boolean);

  return parts.length ? parts.join(' • ') : null;
}

async function searchPlacesNew(query: string): Promise<GoogleSearchResult[]> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.primaryType,places.types',
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 10,
      languageCode: 'en',
      regionCode: 'AU',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google search failed: ${response.status} ${text}`);
  }

  const data = await response.json();

  return (data.places ?? []).map((place: any) => ({
    place_id: place.id ?? '',
    name: place.displayName?.text ?? '',
    formatted_address: place.formattedAddress ?? '',
    rating: place.rating ?? null,
    price_level: place.priceLevel ?? null,
    primary_type: place.primaryType ?? null,
    types: place.types ?? [],
  }));
}

async function getPlaceDetailsNew(placeId: string): Promise<GooglePlaceDetailsResult> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
  }

  const fieldMask = [
    'id',
    'displayName',
    'formattedAddress',
    'location',
    'rating',
    'priceLevel',
    'nationalPhoneNumber',
    'websiteUri',
    'primaryType',
    'types',
    'regularOpeningHours',
  ].join(',');

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google place details failed: ${response.status} ${text}`);
  }

  return response.json();
}

export default function AdminMasterPage() {
  const [tab, setTab] = useState<AdminTab>('schedules');

  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueTypes, setVenueTypes] = useState<VenueType[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [loadingVenueTypes, setLoadingVenueTypes] = useState(true);
  const [venuesError, setVenuesError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
  const [scheduleType, setScheduleType] = useState<ScheduleType>('opening');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [saveMode, setSaveMode] = useState<SaveMode>('replace');
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([
    { start_time: '', end_time: '' },
  ]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dealText, setDealText] = useState('');
  const [notes, setNotes] = useState('');
  const [happyHourForm, setHappyHourForm] = useState<HappyHourFormState>(blankHappyHourForm());

  const [savingSchedule, setSavingSchedule] = useState(false);
  const [clearingSchedule, setClearingSchedule] = useState(false);
  const [savingDetailsOnly, setSavingDetailsOnly] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [scheduleErrorMessage, setScheduleErrorMessage] = useState<string | null>(null);

  const [googleQuery, setGoogleQuery] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleResults, setGoogleResults] = useState<GoogleSearchResult[]>([]);
  const [selectedGooglePlaceId, setSelectedGooglePlaceId] = useState<string | null>(null);

  const [venueForm, setVenueForm] = useState<VenueFormState>(blankVenueForm());
  const [savingVenue, setSavingVenue] = useState(false);
  const [venueMessage, setVenueMessage] = useState<string | null>(null);
  const [venueErrorMessage, setVenueErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadVenues();
    loadVenueTypes();
  }, []);

  async function loadVenues() {
    setLoadingVenues(true);
    setVenuesError(null);

    const { data, error } = await supabase
      .from('venues')
      .select(
        'id, name, suburb, venue_type_id, google_place_id, address, lat, lng, phone, website_url, google_rating, price_level, opening_hours, kitchen_hours, happy_hour_hours'
      )
      .order('name', { ascending: true });

    if (error) {
      setVenuesError(`Failed to load venues: ${error.message}`);
      setVenues([]);
    } else {
      setVenues((data ?? []) as Venue[]);
    }

    setLoadingVenues(false);
  }

  async function loadVenueTypes() {
    setLoadingVenueTypes(true);

    const attempts = [
      { select: 'id, name', field: 'name' },
      { select: 'id, label', field: 'label' },
      { select: 'id, title', field: 'title' },
      { select: 'id, venue_type', field: 'venue_type' },
      { select: 'id, slug', field: 'slug' },
      { select: 'id, type_name', field: 'type_name' },
      { select: 'id, display_name', field: 'display_name' },
    ] as const;

    let loaded = false;
    let lastError = '';

    for (const attempt of attempts) {
      const { data, error } = await supabase
        .from('venue_types')
        .select(attempt.select)
        .order(attempt.field, { ascending: true });

      if (!error && data) {
        const mapped = (data as any[])
          .map((row) => ({
            id: String(row.id),
            display_name: String(row[attempt.field]),
            raw_value: String(row[attempt.field]),
          }))
          .filter((row) => row.id && row.display_name);

        setVenueTypes(mapped);
        loaded = true;
        break;
      }

      if (error) {
        lastError = error.message;
      }
    }

    if (!loaded) {
      setVenueTypes([]);
      setVenuesError(
        `Failed to load venue types: ${lastError || 'Could not detect label column in venue_types table.'}`
      );
    }

    setLoadingVenueTypes(false);
  }

  const venueTypeNameById = useMemo(() => {
    const map = new Map<string, string>();
    venueTypes.forEach((type) => map.set(type.id, type.display_name));
    return map;
  }, [venueTypes]);

  const filteredVenues = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return venues;

    return venues.filter((venue) => {
      const venueTypeName = venue.venue_type_id
        ? venueTypeNameById.get(venue.venue_type_id) ?? ''
        : '';

      const haystack = [
        venue.name ?? '',
        venue.suburb ?? '',
        venue.address ?? '',
        venueTypeName,
        venue.venue_type_id ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [venues, search, venueTypeNameById]);

  async function syncVenueHoursColumn(
    venueIds: string[],
    currentScheduleType: ScheduleType
  ) {
    const columnMap: Partial<
      Record<ScheduleType, 'opening_hours' | 'kitchen_hours' | 'happy_hour_hours'>
    > = {
      opening: 'opening_hours',
      kitchen: 'kitchen_hours',
      happy_hour: 'happy_hour_hours',
    };

    const targetColumn = columnMap[currentScheduleType];
    if (!targetColumn) return;

    for (const venueId of venueIds) {
      const { data, error } = await supabase
        .from('venue_schedule_rules')
        .select('day_of_week, start_time, end_time, sort_order')
        .eq('venue_id', venueId)
        .eq('schedule_type', currentScheduleType)
        .eq('is_active', true)
        .eq('status', 'published')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const hoursJson = buildHoursJsonFromRows(
        (data ?? []) as Array<{
          day_of_week: DayOfWeek;
          start_time: string;
          end_time: string;
          sort_order?: number;
        }>
      );

      const { error: updateError } = await supabase
        .from('venues')
        .update({ [targetColumn]: hoursJson })
        .eq('id', venueId);

      if (updateError) throw updateError;
    }
  }

  function toggleVenue(id: string) {
    setSelectedVenueIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function selectAllFiltered() {
    const filteredIds = filteredVenues.map((venue) => venue.id);
    setSelectedVenueIds((current) => {
      const set = new Set([...current, ...filteredIds]);
      return Array.from(set);
    });
  }

  function clearFiltered() {
    const filteredIds = new Set(filteredVenues.map((venue) => venue.id));
    setSelectedVenueIds((current) =>
      current.filter((id) => !filteredIds.has(id))
    );
  }

  function toggleDay(day: DayOfWeek) {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day]
    );
  }

  function setDaysPreset(preset: 'weekdays' | 'weekend' | 'all' | 'clear') {
    if (preset === 'weekdays') {
      setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
      return;
    }

    if (preset === 'weekend') {
      setSelectedDays(['saturday', 'sunday']);
      return;
    }

    if (preset === 'all') {
      setSelectedDays([
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ]);
      return;
    }

    setSelectedDays([]);
  }

  function updateTimeBlock(
    index: number,
    field: keyof TimeBlock,
    value: string
  ) {
    setTimeBlocks((current) =>
      current.map((block, i) =>
        i === index ? { ...block, [field]: value } : block
      )
    );
  }

  function addTimeBlock() {
    setTimeBlocks((current) => [...current, { start_time: '', end_time: '' }]);
  }

  function removeTimeBlock(index: number) {
    setTimeBlocks((current) => {
      if (current.length === 1) return current;
      return current.filter((_, i) => i !== index);
    });
  }

  function resetScheduleForm() {
    setSelectedDays([]);
    setTimeBlocks([{ start_time: '', end_time: '' }]);
    setTitle('');
    setDescription('');
    setDealText('');
    setNotes('');
    setHappyHourForm(blankHappyHourForm());
  }

  function addHappyHourItem(category: HappyHourCategoryKey) {
    setHappyHourForm((current) => ({
      ...current,
      [category]: [...current[category], blankItemForm()],
    }));
  }

  function removeHappyHourItem(category: HappyHourCategoryKey, itemId: string) {
    setHappyHourForm((current) => ({
      ...current,
      [category]: current[category].filter((item) => item.id !== itemId),
    }));
  }

  function updateHappyHourItem(
    category: HappyHourCategoryKey,
    itemId: string,
    field: 'name' | 'description',
    value: string
  ) {
    setHappyHourForm((current) => ({
      ...current,
      [category]: current[category].map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addHappyHourPrice(category: HappyHourCategoryKey, itemId: string) {
    setHappyHourForm((current) => ({
      ...current,
      [category]: current[category].map((item) =>
        item.id === itemId
          ? { ...item, prices: [...item.prices, blankPriceForm()] }
          : item
      ),
    }));
  }

  function removeHappyHourPrice(
    category: HappyHourCategoryKey,
    itemId: string,
    priceId: string
  ) {
    setHappyHourForm((current) => ({
      ...current,
      [category]: current[category].map((item) => {
        if (item.id !== itemId) return item;
        const nextPrices = item.prices.filter((price) => price.id !== priceId);
        return {
          ...item,
          prices: nextPrices.length ? nextPrices : [blankPriceForm()],
        };
      }),
    }));
  }

  function updateHappyHourPrice(
    category: HappyHourCategoryKey,
    itemId: string,
    priceId: string,
    field: 'label' | 'amount',
    value: string
  ) {
    setHappyHourForm((current) => ({
      ...current,
      [category]: current[category].map((item) =>
        item.id === itemId
          ? {
              ...item,
              prices: item.prices.map((price) =>
                price.id === priceId ? { ...price, [field]: value } : price
              ),
            }
          : item
      ),
    }));
  }

  async function handleSaveSchedule() {
    setScheduleMessage(null);
    setScheduleErrorMessage(null);

    if (!selectedVenueIds.length) {
      setScheduleErrorMessage('Please select at least one venue.');
      return;
    }

    if (!selectedDays.length) {
      setScheduleErrorMessage('Please select at least one day.');
      return;
    }

    const cleanedTimeBlocks = timeBlocks
      .map((block) => ({
        start_time: block.start_time.trim(),
        end_time: block.end_time.trim(),
      }))
      .filter((block) => block.start_time && block.end_time);

    if (!cleanedTimeBlocks.length) {
      setScheduleErrorMessage('Please add at least one valid time block.');
      return;
    }

    for (const block of cleanedTimeBlocks) {
      if (block.start_time === block.end_time) {
        setScheduleErrorMessage('Start and end time cannot be the same.');
        return;
      }
    }

    if (requiresTitle(scheduleType) && !title.trim()) {
      setScheduleErrorMessage(
        `Please enter a title for ${scheduleType.replace(/_/g, ' ')}.`
      );
      return;
    }

    setSavingSchedule(true);

    try {
      const happyHourDetailJson =
        scheduleType === 'happy_hour' ? buildHappyHourDetailJson(happyHourForm) : null;

      const generatedHappyHourSummary =
        scheduleType === 'happy_hour' ? buildHappyHourDealSummary(happyHourForm) : null;

      const rows = selectedVenueIds.flatMap((venueId) =>
        selectedDays.flatMap((day) =>
          cleanedTimeBlocks.map((block, index) => ({
            venue_id: venueId,
            schedule_type: scheduleType,
            day_of_week: day,
            start_time: block.start_time,
            end_time: block.end_time,
            sort_order: index + 1,
            title: title.trim() || null,
            description: description.trim() || null,
            deal_text:
              scheduleType === 'happy_hour'
                ? (generatedHappyHourSummary ?? (dealText.trim() || null))
                : dealText.trim() || null,
            notes:
              scheduleType === 'happy_hour'
                ? (notes.trim() || happyHourForm.notes.trim() || null)
                : notes.trim() || null,
            detail_json: happyHourDetailJson,
            is_active: true,
            status: 'published',
          }))
        )
      );

      if (scheduleType === 'happy_hour') {
        if (saveMode === 'replace') {
          const { error: deleteError } = await supabase
            .from('venue_schedule_rules')
            .delete()
            .in('venue_id', selectedVenueIds)
            .eq('schedule_type', scheduleType)
            .in('day_of_week', selectedDays);

          if (deleteError) throw deleteError;
        }

        for (const row of rows) {
          const { error: upsertError } = await supabase
            .from('venue_schedule_rules')
            .upsert(row, {
              onConflict: 'venue_id,schedule_type,day_of_week,start_time,end_time',
            });

          if (upsertError) throw upsertError;
        }
      } else {
        if (saveMode === 'replace') {
          const { error: deleteError } = await supabase
            .from('venue_schedule_rules')
            .delete()
            .in('venue_id', selectedVenueIds)
            .eq('schedule_type', scheduleType)
            .in('day_of_week', selectedDays);

          if (deleteError) throw deleteError;
        }

        const { error: insertError } = await supabase
          .from('venue_schedule_rules')
          .insert(rows);

        if (insertError) throw insertError;
      }

      await syncVenueHoursColumn(selectedVenueIds, scheduleType);
      await loadVenues();

      setScheduleMessage(
        `Saved ${rows.length} schedule row${rows.length === 1 ? '' : 's'} successfully.`
      );
      resetScheduleForm();
    } catch (error: any) {
      setScheduleErrorMessage(error?.message ?? 'Failed to save schedule.');
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleSaveDetailsOnly() {
    setScheduleMessage(null);
    setScheduleErrorMessage(null);

    if (!selectedVenueIds.length) {
      setScheduleErrorMessage('Please select at least one venue.');
      return;
    }

    if (!selectedDays.length) {
      setScheduleErrorMessage('Please select at least one day.');
      return;
    }

    if (requiresTitle(scheduleType) && !title.trim()) {
      setScheduleErrorMessage(
        `Please enter a title for ${scheduleType.replace(/_/g, ' ')}.`
      );
      return;
    }

    setSavingDetailsOnly(true);

    try {
      const happyHourDetailJson =
        scheduleType === 'happy_hour' ? buildHappyHourDetailJson(happyHourForm) : null;

      const generatedHappyHourSummary =
        scheduleType === 'happy_hour' ? buildHappyHourDealSummary(happyHourForm) : null;

      const payload: Record<string, any> = {
        title: title.trim() || null,
        description: description.trim() || null,
        deal_text:
          scheduleType === 'happy_hour'
            ? (generatedHappyHourSummary ?? (dealText.trim() || null))
            : dealText.trim() || null,
        notes:
          scheduleType === 'happy_hour'
            ? (notes.trim() || happyHourForm.notes.trim() || null)
            : notes.trim() || null,
      };

      if (scheduleType === 'happy_hour') {
        payload.detail_json = happyHourDetailJson;
      }

      let updatedCount = 0;

      for (const venueId of selectedVenueIds) {
        for (const day of selectedDays) {
          const { data: existingRows, error: fetchError } = await supabase
            .from('venue_schedule_rules')
            .select('id')
            .eq('venue_id', venueId)
            .eq('schedule_type', scheduleType)
            .eq('day_of_week', day);

          if (fetchError) throw fetchError;

          if (!existingRows || existingRows.length === 0) {
            continue;
          }

          const rowIds = existingRows.map((row: any) => row.id);
          updatedCount += rowIds.length;

          const { error: updateError } = await supabase
            .from('venue_schedule_rules')
            .update(payload)
            .in('id', rowIds);

          if (updateError) throw updateError;
        }
      }

      if (updatedCount === 0) {
        setScheduleErrorMessage(
          `No existing ${getScheduleTypeLabel(scheduleType)} rows were found for the selected venue(s) and day(s). Save hours first, then use "Save details only".`
        );
        return;
      }

      await syncVenueHoursColumn(selectedVenueIds, scheduleType);
      await loadVenues();

      setScheduleMessage(
        `Updated details on ${updatedCount} ${getScheduleTypeLabel(scheduleType)} row${updatedCount === 1 ? '' : 's'} without changing hours.`
      );
    } catch (error: any) {
      setScheduleErrorMessage(error?.message ?? 'Failed to save details only.');
    } finally {
      setSavingDetailsOnly(false);
    }
  }

  async function handleClearSelectedDays() {
    setScheduleMessage(null);
    setScheduleErrorMessage(null);

    if (!selectedVenueIds.length) {
      setScheduleErrorMessage('Please select at least one venue.');
      return;
    }

    if (!selectedDays.length) {
      setScheduleErrorMessage('Please select at least one day to clear.');
      return;
    }

    setClearingSchedule(true);

    try {
      const { error: deleteError } = await supabase
        .from('venue_schedule_rules')
        .delete()
        .in('venue_id', selectedVenueIds)
        .eq('schedule_type', scheduleType)
        .in('day_of_week', selectedDays);

      if (deleteError) throw deleteError;

      if (canSyncToVenueHours(scheduleType)) {
        await syncVenueHoursColumn(selectedVenueIds, scheduleType);
      }

      await loadVenues();

      setScheduleMessage(
        `Cleared ${getScheduleTypeLabel(scheduleType)} for selected day(s): ${selectedDays.join(', ')}.`
      );
      resetScheduleForm();
    } catch (error: any) {
      setScheduleErrorMessage(error?.message ?? 'Failed to clear selected days.');
    } finally {
      setClearingSchedule(false);
    }
  }

  async function handleClearAllForScheduleType() {
    setScheduleMessage(null);
    setScheduleErrorMessage(null);

    if (!selectedVenueIds.length) {
      setScheduleErrorMessage('Please select at least one venue.');
      return;
    }

    setClearingSchedule(true);

    try {
      const { error: deleteError } = await supabase
        .from('venue_schedule_rules')
        .delete()
        .in('venue_id', selectedVenueIds)
        .eq('schedule_type', scheduleType);

      if (deleteError) throw deleteError;

      if (canSyncToVenueHours(scheduleType)) {
        await syncVenueHoursColumn(selectedVenueIds, scheduleType);
      }

      await loadVenues();

      setScheduleMessage(
        `Cleared all ${getScheduleTypeLabel(scheduleType)} rows for ${selectedVenueIds.length} selected venue${selectedVenueIds.length === 1 ? '' : 's'}.`
      );
      resetScheduleForm();
    } catch (error: any) {
      setScheduleErrorMessage(error?.message ?? 'Failed to clear schedule type.');
    } finally {
      setClearingSchedule(false);
    }
  }

  function updateVenueForm<K extends keyof VenueFormState>(
    field: K,
    value: VenueFormState[K]
  ) {
    setVenueForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetVenueForm() {
    setVenueForm(blankVenueForm());
    setSelectedGooglePlaceId(null);
    setGoogleResults([]);
    setGoogleQuery('');
    setVenueMessage(null);
    setVenueErrorMessage(null);
    setGoogleError(null);
  }

  function populateVenueFormFromExistingVenue(venue: Venue) {
    setVenueForm({
      id: venue.id ?? null,
      name: venue.name ?? '',
      suburb: venue.suburb ?? '',
      venue_type_id: venue.venue_type_id ?? '',
      google_place_id: venue.google_place_id ?? '',
      address: venue.address ?? '',
      lat: venue.lat != null ? String(venue.lat) : '',
      lng: venue.lng != null ? String(venue.lng) : '',
      phone: venue.phone ?? '',
      website_url: venue.website_url ?? '',
      google_rating:
        venue.google_rating != null ? String(venue.google_rating) : '',
      price_level: venue.price_level ?? '',
      opening_hours: venue.opening_hours ?? null,
    });
    setTab('venues');
    setVenueMessage(null);
    setVenueErrorMessage(null);
  }

  async function handleLoadExistingHappyHourDetails() {
    setScheduleMessage(null);
    setScheduleErrorMessage(null);

    if (!selectedVenueIds.length) {
      setScheduleErrorMessage('Please select at least one venue.');
      return;
    }

    if (selectedVenueIds.length > 1) {
      setScheduleErrorMessage('Please select only one venue when loading existing happy hour details.');
      return;
    }

    if (!selectedDays.length) {
      setScheduleErrorMessage('Please select at least one day.');
      return;
    }

    const venueId = selectedVenueIds[0];
    const day = selectedDays[0];

    const { data, error } = await supabase
      .from('venue_schedule_rules')
      .select('start_time, end_time, title, description, deal_text, notes, detail_json')
      .eq('venue_id', venueId)
      .eq('schedule_type', 'happy_hour')
      .eq('day_of_week', day)
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      setScheduleErrorMessage(error.message);
      return;
    }

    if (!data) {
      setScheduleErrorMessage('No existing happy hour row found for that venue/day.');
      return;
    }

    const detailJson = (data as any).detail_json as HappyHourDetailJson | null;

    setTimeBlocks([
      {
        start_time: (data as any).start_time?.slice(0, 5) ?? '',
        end_time: (data as any).end_time?.slice(0, 5) ?? '',
      },
    ]);

    setTitle((data as any).title ?? '');
    setDescription((data as any).description ?? '');
    setDealText((data as any).deal_text ?? '');
    setNotes((data as any).notes ?? '');

    setHappyHourForm({
      beer: parseDetailCategoryToItems(detailJson?.beer),
      wine: parseDetailCategoryToItems(detailJson?.wine),
      spirits: parseDetailCategoryToItems(detailJson?.spirits),
      cocktails: parseDetailCategoryToItems(detailJson?.cocktails),
      food: parseDetailCategoryToItems(detailJson?.food),
      notes: detailJson?.notes ?? '',
    });

    setScheduleMessage(`Loaded existing happy hour details for ${day}.`);
  }

  async function handleGoogleSearch() {
    setGoogleError(null);
    setVenueMessage(null);
    setVenueErrorMessage(null);

    if (!googleQuery.trim()) {
      setGoogleError('Please enter a search term.');
      return;
    }

    try {
      setGoogleLoading(true);
      const results = await searchPlacesNew(googleQuery.trim());
      setGoogleResults(results);
    } catch (error: any) {
      setGoogleError(error?.message ?? 'Google search failed.');
      setGoogleResults([]);
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleUseGoogleResult(placeId: string) {
    setGoogleError(null);
    setVenueErrorMessage(null);
    setVenueMessage(null);

    try {
      const place = await getPlaceDetailsNew(placeId);
      setSelectedGooglePlaceId(placeId);

      const existingMatch = venues.find(
        (venue) => venue.google_place_id && venue.google_place_id === place.id
      );

      const googleTypes = [
        ...(place.primaryType ? [place.primaryType] : []),
        ...((place.types ?? []) as string[]),
      ];

      const guessedVenueTypeId =
        existingMatch?.venue_type_id ??
        guessVenueTypeIdFromGoogle(
          venueTypes,
          googleTypes,
          place.displayName?.text ?? ''
        );

      const convertedOpeningHours = convertGoogleRegularOpeningHoursToOpeningHours(
        place.regularOpeningHours
      );

      setVenueForm({
        id: existingMatch?.id ?? null,
        name: place.displayName?.text ?? '',
        suburb: extractSuburbFromAddress(place.formattedAddress ?? ''),
        venue_type_id: guessedVenueTypeId ?? '',
        google_place_id: place.id ?? '',
        address: place.formattedAddress ?? '',
        lat: place.location?.latitude != null ? String(place.location.latitude) : '',
        lng:
          place.location?.longitude != null
            ? String(place.location.longitude)
            : '',
        phone: place.nationalPhoneNumber ?? existingMatch?.phone ?? '',
        website_url: place.websiteUri ?? existingMatch?.website_url ?? '',
        google_rating: place.rating != null ? String(place.rating) : '',
        price_level: place.priceLevel ?? '',
        opening_hours: convertedOpeningHours ?? existingMatch?.opening_hours ?? null,
      });

      if (existingMatch) {
        setVenueMessage(
          `Matched an existing venue record: ${existingMatch.name ?? existingMatch.id}. Review and click save to update it.`
        );
      } else if (guessedVenueTypeId) {
        const typeName = venueTypeNameById.get(guessedVenueTypeId);
        if (typeName) {
          setVenueMessage(`Suggested venue type: ${typeName}. Review and click save.`);
        }
      } else {
        setVenueMessage('Google place selected. Review fields below, then save.');
      }
    } catch (error: any) {
      setGoogleError(error?.message ?? 'Failed to load Google place details.');
    }
  }

  async function handleSaveVenue() {
    setVenueMessage(null);
    setVenueErrorMessage(null);

    if (!venueForm.name.trim()) {
      setVenueErrorMessage('Venue name is required.');
      return;
    }

    if (!venueForm.venue_type_id.trim()) {
      setVenueErrorMessage('Venue type is required.');
      return;
    }

    setSavingVenue(true);

    try {
      const payload: Record<string, any> = {
        name: venueForm.name.trim() || null,
        suburb: venueForm.suburb.trim() || null,
        venue_type_id: venueForm.venue_type_id.trim(),
        google_place_id: venueForm.google_place_id.trim() || null,
        address: venueForm.address.trim() || null,
        lat: venueForm.lat.trim() ? Number(venueForm.lat) : null,
        lng: venueForm.lng.trim() ? Number(venueForm.lng) : null,
        phone: venueForm.phone.trim() || null,
        website_url: venueForm.website_url.trim() || null,
        google_rating: venueForm.google_rating.trim()
          ? Number(venueForm.google_rating)
          : null,
        price_level: venueForm.price_level.trim() || null,
        opening_hours: venueForm.opening_hours ?? null,
      };

      let existingVenueId = venueForm.id || null;

      if (!existingVenueId && venueForm.google_place_id.trim()) {
        const { data: existingByPlaceId, error: lookupError } = await supabase
          .from('venues')
          .select('id')
          .eq('google_place_id', venueForm.google_place_id.trim())
          .maybeSingle();

        if (lookupError) throw lookupError;
        existingVenueId = existingByPlaceId?.id ?? null;
      }

      if (existingVenueId) {
        const { error: updateError } = await supabase
          .from('venues')
          .update(payload)
          .eq('id', existingVenueId);

        if (updateError) throw updateError;

        setVenueMessage('Venue updated successfully.');
      } else {
        const { error: insertError } = await supabase
          .from('venues')
          .insert(payload);

        if (insertError) throw insertError;

        setVenueMessage('New venue created successfully.');
      }

      await loadVenues();
    } catch (error: any) {
      setVenueErrorMessage(error?.message ?? 'Failed to save venue.');
    } finally {
      setSavingVenue(false);
    }
  }

  const selectedCount = selectedVenueIds.length;
  const isHappyHour = scheduleType === 'happy_hour';

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Master Admin
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Manage schedules, create venues, and pull Google venue data from one place.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('schedules')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === 'schedules'
                ? 'bg-neutral-900 text-white'
                : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            Schedules
          </button>

          <button
            type="button"
            onClick={() => setTab('venues')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === 'venues'
                ? 'bg-neutral-900 text-white'
                : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            New Venue / Google Search
          </button>
        </div>

        {venuesError ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {venuesError}
          </div>
        ) : null}

        {tab === 'schedules' ? (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-neutral-900">
                  1. Select Venues
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Search and select one or many venues.
                </p>
              </div>

              <div className="mb-3">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by venue, suburb, or type"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                >
                  Select all filtered
                </button>

                <button
                  type="button"
                  onClick={clearFiltered}
                  className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                >
                  Clear filtered
                </button>

                <div className="ml-auto rounded-xl bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700">
                  Selected: {selectedCount}
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-neutral-200">
                {loadingVenues ? (
                  <div className="p-4 text-sm text-neutral-600">Loading venues…</div>
                ) : filteredVenues.length === 0 ? (
                  <div className="p-4 text-sm text-neutral-600">No venues found.</div>
                ) : (
                  <div className="divide-y divide-neutral-200">
                    {filteredVenues.map((venue) => {
                      const checked = selectedVenueIds.includes(venue.id);
                      const venueTypeName = venue.venue_type_id
                        ? venueTypeNameById.get(venue.venue_type_id) ?? venue.venue_type_id
                        : '—';

                      return (
                        <div
                          key={venue.id}
                          className="flex items-start gap-3 p-3 hover:bg-neutral-50"
                        >
                          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleVenue(venue.id)}
                              className="mt-1 h-4 w-4"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-neutral-900">
                                {venue.name ?? 'Unnamed venue'}
                              </div>
                              <div className="mt-1 text-sm text-neutral-600">
                                {venue.suburb ?? '—'} • {venueTypeName}
                              </div>
                              <div className="mt-1 break-all text-xs text-neutral-400">
                                {venue.id}
                              </div>
                            </div>
                          </label>

                          <button
                            type="button"
                            onClick={() => populateVenueFormFromExistingVenue(venue)}
                            className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-100"
                          >
                            Edit venue
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-neutral-900">
                  2. Create Schedule Rules
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Apply the same schedule to multiple venues and days in one save.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Schedule Type
                  </label>
                  <select
                    value={scheduleType}
                    onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  >
                    {SCHEDULE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Save Mode
                  </label>
                  <select
                    value={saveMode}
                    onChange={(e) => setSaveMode(e.target.value as SaveMode)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  >
                    <option value="replace">Replace existing selected days</option>
                    <option value="append">Append to existing</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDaysPreset('weekdays')}
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                  >
                    Mon–Fri
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaysPreset('weekend')}
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                  >
                    Weekend
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaysPreset('all')}
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                  >
                    All days
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaysPreset('clear')}
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                  >
                    Clear days
                  </button>
                </div>

                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((day) => {
                    const active = selectedDays.includes(day.value);

                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                          active
                            ? 'bg-neutral-900 text-white'
                            : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-neutral-700">
                    Time Blocks
                  </label>
                  <button
                    type="button"
                    onClick={addTimeBlock}
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                  >
                    Add time block
                  </button>
                </div>

                <div className="space-y-3">
                  {timeBlocks.map((block, index) => (
                    <div
                      key={index}
                      className="grid gap-3 rounded-2xl border border-neutral-200 p-3 md:grid-cols-[1fr_1fr_auto]"
                    >
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                          Start
                        </label>
                        <input
                          type="time"
                          value={block.start_time}
                          onChange={(e) =>
                            updateTimeBlock(index, 'start_time', e.target.value)
                          }
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                          End
                        </label>
                        <input
                          type="time"
                          value={block.end_time}
                          onChange={(e) =>
                            updateTimeBlock(index, 'end_time', e.target.value)
                          }
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeTimeBlock(index)}
                          disabled={timeBlocks.length === 1}
                          className="rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {isHappyHour ? (
                <div className="mt-5 rounded-2xl border border-pink-200 bg-pink-50 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">
                        Happy Hour Details
                      </h3>
                      <p className="mt-1 text-sm text-neutral-600">
                        Add structured items with descriptions and one or more prices.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadExistingHappyHourDetails}
                      className="rounded-xl border border-pink-300 px-3 py-2 text-sm font-medium text-pink-700 hover:bg-pink-100"
                    >
                      Load existing day
                    </button>
                  </div>

                  <div className="space-y-5">
                    <HappyHourCategoryEditor
                      label="Beer"
                      items={happyHourForm.beer}
                      onAdd={() => addHappyHourItem('beer')}
                      onRemove={(itemId) => removeHappyHourItem('beer', itemId)}
                      onUpdateItem={(itemId, field, value) =>
                        updateHappyHourItem('beer', itemId, field, value)
                      }
                      onAddPrice={(itemId) => addHappyHourPrice('beer', itemId)}
                      onRemovePrice={(itemId, priceId) =>
                        removeHappyHourPrice('beer', itemId, priceId)
                      }
                      onUpdatePrice={(itemId, priceId, field, value) =>
                        updateHappyHourPrice('beer', itemId, priceId, field, value)
                      }
                    />

                    <HappyHourCategoryEditor
                      label="Wine"
                      items={happyHourForm.wine}
                      onAdd={() => addHappyHourItem('wine')}
                      onRemove={(itemId) => removeHappyHourItem('wine', itemId)}
                      onUpdateItem={(itemId, field, value) =>
                        updateHappyHourItem('wine', itemId, field, value)
                      }
                      onAddPrice={(itemId) => addHappyHourPrice('wine', itemId)}
                      onRemovePrice={(itemId, priceId) =>
                        removeHappyHourPrice('wine', itemId, priceId)
                      }
                      onUpdatePrice={(itemId, priceId, field, value) =>
                        updateHappyHourPrice('wine', itemId, priceId, field, value)
                      }
                    />

                    <HappyHourCategoryEditor
                      label="Spirits"
                      items={happyHourForm.spirits}
                      onAdd={() => addHappyHourItem('spirits')}
                      onRemove={(itemId) => removeHappyHourItem('spirits', itemId)}
                      onUpdateItem={(itemId, field, value) =>
                        updateHappyHourItem('spirits', itemId, field, value)
                      }
                      onAddPrice={(itemId) => addHappyHourPrice('spirits', itemId)}
                      onRemovePrice={(itemId, priceId) =>
                        removeHappyHourPrice('spirits', itemId, priceId)
                      }
                      onUpdatePrice={(itemId, priceId, field, value) =>
                        updateHappyHourPrice('spirits', itemId, priceId, field, value)
                      }
                    />

                    <HappyHourCategoryEditor
                      label="Cocktails"
                      items={happyHourForm.cocktails}
                      onAdd={() => addHappyHourItem('cocktails')}
                      onRemove={(itemId) => removeHappyHourItem('cocktails', itemId)}
                      onUpdateItem={(itemId, field, value) =>
                        updateHappyHourItem('cocktails', itemId, field, value)
                      }
                      onAddPrice={(itemId) => addHappyHourPrice('cocktails', itemId)}
                      onRemovePrice={(itemId, priceId) =>
                        removeHappyHourPrice('cocktails', itemId, priceId)
                      }
                      onUpdatePrice={(itemId, priceId, field, value) =>
                        updateHappyHourPrice('cocktails', itemId, priceId, field, value)
                      }
                    />

                    <HappyHourCategoryEditor
                      label="Food"
                      items={happyHourForm.food}
                      onAdd={() => addHappyHourItem('food')}
                      onRemove={(itemId) => removeHappyHourItem('food', itemId)}
                      onUpdateItem={(itemId, field, value) =>
                        updateHappyHourItem('food', itemId, field, value)
                      }
                      onAddPrice={(itemId) => addHappyHourPrice('food', itemId)}
                      onRemovePrice={(itemId, priceId) =>
                        removeHappyHourPrice('food', itemId, priceId)
                      }
                      onUpdatePrice={(itemId, priceId, field, value) =>
                        updateHappyHourPrice('food', itemId, priceId, field, value)
                      }
                    />

                    <div>
                      <label className="mb-1 block text-sm font-medium text-neutral-700">
                        Happy Hour Notes
                      </label>
                      <textarea
                        value={happyHourForm.notes}
                        onChange={(e) =>
                          setHappyHourForm((current) => ({
                            ...current,
                            notes: e.target.value,
                          }))
                        }
                        rows={3}
                        placeholder="Selected items only / bar area only / until sold out"
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      requiresTitle(scheduleType)
                        ? 'Required for event-style schedule types'
                        : 'Optional'
                    }
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Deal Text
                  </label>
                  <input
                    type="text"
                    value={dealText}
                    onChange={(e) => setDealText(e.target.value)}
                    placeholder={
                      isHappyHour
                        ? 'Optional override summary'
                        : 'e.g. $7 schooners / $12 cocktails'
                    }
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Optional description"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Internal notes or extra context"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </div>

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                Use <strong>Save details only</strong> to update structured happy hour items without re-entering hours. Add item cards, descriptions and prices directly below.
              </div>

              {scheduleMessage ? (
                <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  {scheduleMessage}
                </div>
              ) : null}

              {scheduleErrorMessage ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {scheduleErrorMessage}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule || clearingSchedule || savingDetailsOnly}
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSchedule ? 'Saving…' : 'Save schedule rules'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveDetailsOnly}
                  disabled={savingSchedule || clearingSchedule || savingDetailsOnly}
                  className="rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingDetailsOnly ? 'Saving details…' : 'Save details only'}
                </button>

                <button
                  type="button"
                  onClick={resetScheduleForm}
                  disabled={savingSchedule || clearingSchedule || savingDetailsOnly}
                  className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear form
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleClearSelectedDays}
                  disabled={savingSchedule || clearingSchedule || savingDetailsOnly}
                  className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {clearingSchedule ? 'Clearing…' : 'Delete selected days'}
                </button>

                <button
                  type="button"
                  onClick={handleClearAllForScheduleType}
                  disabled={savingSchedule || clearingSchedule || savingDetailsOnly}
                  className="rounded-xl border border-red-500 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {clearingSchedule
                    ? 'Clearing…'
                    : `Delete all ${getScheduleTypeLabel(scheduleType)}`}
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-neutral-900">
                  1. Search Google Places
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Find a venue, pull details, then save or update it in Supabase.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={googleQuery}
                  onChange={(e) => setGoogleQuery(e.target.value)}
                  placeholder="e.g. Courthouse Hotel Newtown NSW"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
                <button
                  type="button"
                  onClick={handleGoogleSearch}
                  disabled={googleLoading}
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {googleLoading ? 'Searching…' : 'Search'}
                </button>
              </div>

              {googleError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {googleError}
                </div>
              ) : null}

              <div className="mt-4 max-h-[65vh] overflow-y-auto rounded-xl border border-neutral-200">
                {googleResults.length === 0 ? (
                  <div className="p-4 text-sm text-neutral-600">
                    No Google results yet.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-200">
                    {googleResults.map((result) => (
                      <div key={result.place_id} className="p-3">
                        <div className="font-medium text-neutral-900">
                          {result.name}
                        </div>
                        <div className="mt-1 text-sm text-neutral-600">
                          {result.formatted_address}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          Place ID: {result.place_id}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600">
                          <span>
                            Rating: {result.rating != null ? result.rating : '—'}
                          </span>
                          <span>
                            Price: {result.price_level != null ? result.price_level : '—'}
                          </span>
                          <span>
                            Google type:{' '}
                            {result.primary_type
                              ? formatVenueTypeId(result.primary_type)
                              : '—'}
                          </span>
                        </div>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => handleUseGoogleResult(result.place_id)}
                            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                          >
                            Use this result
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">
                    2. Venue Setup
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    Create a new venue or update an existing one.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetVenueForm}
                  className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                >
                  New blank form
                </button>
              </div>

              {selectedGooglePlaceId ? (
                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  Google place selected. Review fields below, then save.
                </div>
              ) : null}

              {venueMessage ? (
                <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  {venueMessage}
                </div>
              ) : null}

              {venueErrorMessage ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {venueErrorMessage}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Venue Name
                  </label>
                  <input
                    type="text"
                    value={venueForm.name}
                    onChange={(e) => updateVenueForm('name', e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Suburb
                  </label>
                  <input
                    type="text"
                    value={venueForm.suburb}
                    onChange={(e) => updateVenueForm('suburb', e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Venue Type *
                  </label>
                  <select
                    value={venueForm.venue_type_id}
                    onChange={(e) => updateVenueForm('venue_type_id', e.target.value)}
                    disabled={loadingVenueTypes}
                    className={`w-full rounded-xl px-3 py-2 text-sm outline-none focus:border-neutral-500 ${
                      venueForm.venue_type_id.trim()
                        ? 'border border-neutral-300'
                        : 'border border-red-300'
                    }`}
                  >
                    <option value="">
                      {loadingVenueTypes
                        ? 'Loading venue types...'
                        : 'Select venue type'}
                    </option>
                    {venueTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Google Place ID
                  </label>
                  <input
                    type="text"
                    value={venueForm.google_place_id}
                    onChange={(e) =>
                      updateVenueForm('google_place_id', e.target.value)
                    }
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Address
                </label>
                <input
                  type="text"
                  value={venueForm.address}
                  onChange={(e) => updateVenueForm('address', e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Latitude
                  </label>
                  <input
                    type="text"
                    value={venueForm.lat}
                    onChange={(e) => updateVenueForm('lat', e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Longitude
                  </label>
                  <input
                    type="text"
                    value={venueForm.lng}
                    onChange={(e) => updateVenueForm('lng', e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={venueForm.phone}
                    onChange={(e) => updateVenueForm('phone', e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Website URL
                  </label>
                  <input
                    type="text"
                    value={venueForm.website_url}
                    onChange={(e) => updateVenueForm('website_url', e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Google Rating
                  </label>
                  <input
                    type="text"
                    value={venueForm.google_rating}
                    onChange={(e) => updateVenueForm('google_rating', e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Price Level
                  </label>
                  <input
                    type="text"
                    value={venueForm.price_level}
                    onChange={(e) => updateVenueForm('price_level', e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Imported Opening Hours JSON
                </label>
                <textarea
                  value={
                    venueForm.opening_hours
                      ? JSON.stringify(venueForm.opening_hours, null, 2)
                      : ''
                  }
                  readOnly
                  rows={10}
                  placeholder="Opening hours pulled from Google will appear here"
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs outline-none"
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSaveVenue}
                  disabled={savingVenue}
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingVenue
                    ? 'Saving…'
                    : venueForm.id
                    ? 'Update venue'
                    : 'Create venue'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    loadVenues();
                    loadVenueTypes();
                  }}
                  disabled={savingVenue || loadingVenues || loadingVenueTypes}
                  className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Refresh admin data
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function HappyHourCategoryEditor({
  label,
  items,
  onAdd,
  onRemove,
  onUpdateItem,
  onAddPrice,
  onRemovePrice,
  onUpdatePrice,
}: {
  label: string;
  items: HappyHourItemForm[];
  onAdd: () => void;
  onRemove: (itemId: string) => void;
  onUpdateItem: (
    itemId: string,
    field: 'name' | 'description',
    value: string
  ) => void;
  onAddPrice: (itemId: string) => void;
  onRemovePrice: (itemId: string, priceId: string) => void;
  onUpdatePrice: (
    itemId: string,
    priceId: string,
    field: 'label' | 'amount',
    value: string
  ) => void;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-neutral-900">{label}</div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
        >
          Add item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 px-3 py-4 text-sm text-neutral-500">
          No {label.toLowerCase()} items yet.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="rounded-2xl border border-neutral-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-neutral-800">
                  {label} item {index + 1}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Delete item
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => onUpdateItem(item.id, 'name', e.target.value)}
                    placeholder="e.g. Mister Grotto’s Oysters"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Description
                  </label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      onUpdateItem(item.id, 'description', e.target.value)
                    }
                    placeholder="Optional description"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-neutral-700">Prices</div>
                  <button
                    type="button"
                    onClick={() => onAddPrice(item.id)}
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                  >
                    Add price
                  </button>
                </div>

                <div className="space-y-3">
                  {item.prices.map((price, priceIndex) => (
                    <div
                      key={price.id}
                      className="grid gap-3 rounded-xl border border-neutral-200 p-3 md:grid-cols-[1fr_160px_auto]"
                    >
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                          Price label
                        </label>
                        <input
                          type="text"
                          value={price.label}
                          onChange={(e) =>
                            onUpdatePrice(item.id, price.id, 'label', e.target.value)
                          }
                          placeholder={priceIndex === 0 ? 'Optional, e.g. each / 1/2 doz' : 'Optional'}
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                          Price
                        </label>
                        <input
                          type="text"
                          value={price.amount}
                          onChange={(e) =>
                            onUpdatePrice(item.id, price.id, 'amount', e.target.value)
                          }
                          placeholder="e.g. 10"
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => onRemovePrice(item.id, price.id)}
                          className="rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}