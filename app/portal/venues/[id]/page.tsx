'use client';

import { convertGoogleOpeningHours } from '@/lib/convert-google-hours';
import { buildPublicVenueHref } from '@/lib/public-venue-discovery';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { normalizeInstagramUrl } from '@/lib/social-links';
import {
  type HappyHourDetailItem,
  type HappyHourDetailJson,
  type HappyHourPrice,
  getHappyHourItemPrices,
  normalizeHappyHourDetailCategory,
  normalizeHappyHourDetailJson,
} from '@/lib/venue-data';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type ScheduleType = 'opening' | 'kitchen' | 'happy_hour' | 'bottle_shop';
type EventScheduleType =
  | 'trivia'
  | 'live_music'
  | 'sport'
  | 'comedy'
  | 'karaoke'
  | 'dj'
  | 'special_event';
type PortalScheduleType = ScheduleType | EventScheduleType;
type SaveMode = 'append' | 'replace';
type OpeningPeriod = { open: string; close: string };
type OpeningHours = Partial<Record<DayOfWeek, OpeningPeriod[]>>;
type TimeBlock = { start_time: string; end_time: string };
type AccessRow = { role: string | null };
type VenueScheduleRule = {
  id: string;
  venue_id: string;
  schedule_type: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  sort_order?: number | null;
  title?: string | null;
  description?: string | null;
  deal_text?: string | null;
  notes?: string | null;
  detail_json?: HappyHourDetailJson | null;
  is_active?: boolean | null;
  status?: string | null;
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
type PortalVenueDetail = {
  id: string;
  name: string | null;
  suburb: string | null;
  venue_type_id: string | null;
  updated_at?: string | null;
  address?: string | null;
  phone?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  shows_sport?: boolean | null;
  plays_with_sound?: boolean | null;
  sport_types?: string | null;
  dog_friendly?: boolean | null;
  kid_friendly?: boolean | null;
  opening_hours?: unknown | null;
  kitchen_hours?: OpeningHours | null;
  happy_hour_hours?: OpeningHours | null;
  venue_schedule_rules?: VenueScheduleRule[] | null;
  venue_types?:
    | { label?: string | null; slug?: string | null }
    | Array<{ label?: string | null; slug?: string | null }>
    | null;
};
type PortalActivityEntry = {
  id: string;
  timestamp: string;
  action: string;
  details: string;
};
type VenueFormState = {
  name: string;
  suburb: string;
  address: string;
  phone: string;
  website_url: string;
  instagram_url: string;
  shows_sport: boolean;
  plays_with_sound: boolean;
  sport_types: string;
  dog_friendly: boolean;
  kid_friendly: boolean;
};
type PortalSelectOption<T extends string> = {
  value: T;
  label: string;
};
type PortalSelectGroup<T extends string> = {
  label: string;
  options: PortalSelectOption<T>[];
};

const DAY_OPTIONS: Array<{ value: DayOfWeek; label: string }> = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const SCHEDULE_TYPE_OPTIONS: Array<{ value: ScheduleType; label: string }> = [
  { value: 'opening', label: 'Opening Hours' },
  { value: 'kitchen', label: 'Kitchen Hours' },
  { value: 'happy_hour', label: 'Happy Hour' },
  { value: 'bottle_shop', label: 'Bottle Shop Hours' },
];

const EVENT_SCHEDULE_TYPE_OPTIONS: Array<{ value: EventScheduleType; label: string }> = [
  { value: 'trivia', label: 'Trivia' },
  { value: 'live_music', label: 'Live Music' },
  { value: 'sport', label: 'Sport Event' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'dj', label: 'DJ' },
  { value: 'special_event', label: 'Special Event' },
];

function blankVenueForm(): VenueFormState {
  return {
    name: '',
    suburb: '',
    address: '',
    phone: '',
    website_url: '',
    instagram_url: '',
    shows_sport: false,
    plays_with_sound: false,
    sport_types: '',
    dog_friendly: false,
    kid_friendly: false,
  };
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function blankPriceForm(): HappyHourPriceForm {
  return { id: makeId(), label: '', amount: '' };
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

function formatVenueType(value: string | null | undefined) {
  if (!value) return 'Venue';
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getVenueTypeLabel(venue: PortalVenueDetail | null) {
  const relation = venue?.venue_types;
  if (Array.isArray(relation)) return relation[0]?.label ?? formatVenueType(relation[0]?.slug) ?? 'Venue';
  return relation?.label ?? formatVenueType(relation?.slug) ?? 'Venue';
}

function getScheduleTypeLabel(scheduleType: PortalScheduleType) {
  return (
    SCHEDULE_TYPE_OPTIONS.find((option) => option.value === scheduleType)?.label ??
    EVENT_SCHEDULE_TYPE_OPTIONS.find((option) => option.value === scheduleType)?.label ??
    scheduleType
  );
}

function formatPortalTimestamp(value: string) {
  return new Date(value).toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function updateVenueFlags<K extends keyof VenueFormState>(
  current: VenueFormState,
  field: K,
  value: VenueFormState[K]
) {
  const next = {
    ...current,
    [field]: value,
  };

  if (field === 'shows_sport' && value === false) {
    next.plays_with_sound = false;
  }

  if (field === 'plays_with_sound' && value === true) {
    next.shows_sport = true;
  }

  return next;
}

function parseDetailCategoryToItems(
  value?: HappyHourDetailItem[] | string | null
): HappyHourItemForm[] {
  const normalized = normalizeHappyHourDetailCategory(
    Array.isArray(value) ? value : null
  );

  if (!normalized) return [];

  return normalized.map((entry) => {
    const prices = getHappyHourItemPrices(entry);

    return {
      id: makeId(),
      name: entry.name ?? entry.item ?? '',
      description: entry.description ?? '',
      prices:
        prices.length > 0
          ? prices.map((price) => ({
              id: makeId(),
              label: price.label ?? '',
              amount: String(price.amount),
            }))
          : [blankPriceForm()],
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

      if (!name && !description && prices.length === 0) return null;

      return {
        item: name || null,
        name: name || null,
        description: description || null,
        price: prices[0]?.amount ?? null,
        prices: prices.length ? prices : null,
      };
    })
    .filter(Boolean) as HappyHourDetailItem[];

  return output.length ? output : null;
}

function buildHappyHourDetailJson(form: HappyHourFormState): HappyHourDetailJson | null {
  return normalizeHappyHourDetailJson({
    beer: buildCategoryDetail(form.beer),
    wine: buildCategoryDetail(form.wine),
    spirits: buildCategoryDetail(form.spirits),
    cocktails: buildCategoryDetail(form.cocktails),
    food: buildCategoryDetail(form.food),
    notes: form.notes.trim() || null,
  });
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
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

function formatPeriods(periods: OpeningPeriod[] = []) {
  if (!periods.length) return 'None';
  return periods.map((period) => `${period.open}-${period.close}`).join(', ');
}

function getLiveRules(venue: PortalVenueDetail | null, scheduleType: PortalScheduleType) {
  return (venue?.venue_schedule_rules ?? [])
    .filter(
      (rule) =>
        rule.schedule_type === scheduleType &&
        rule.is_active !== false &&
        !['draft', 'archived', 'deleted'].includes((rule.status ?? '').trim().toLowerCase())
    )
    .sort((a, b) => {
      const dayDiff =
        DAY_OPTIONS.findIndex((option) => option.value === a.day_of_week) -
        DAY_OPTIONS.findIndex((option) => option.value === b.day_of_week);
      if (dayDiff !== 0) return dayDiff;
      const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (sortDiff !== 0) return sortDiff;
      return a.start_time.localeCompare(b.start_time);
    });
}

function buildHoursFromRules(rules: VenueScheduleRule[]): OpeningHours | null {
  const output: OpeningHours = {};
  DAY_OPTIONS.forEach((day) => {
    const matching = rules
      .filter((rule) => rule.day_of_week === day.value)
      .map((rule) => ({ open: rule.start_time.slice(0, 5), close: rule.end_time.slice(0, 5) }));
    if (matching.length) output[day.value] = matching;
  });
  return Object.keys(output).length ? output : null;
}

function getExistingHours(venue: PortalVenueDetail | null, scheduleType: PortalScheduleType) {
  const ruleHours = buildHoursFromRules(getLiveRules(venue, scheduleType));
  if (ruleHours) return ruleHours;
  if (scheduleType === 'opening') return convertGoogleOpeningHours(venue?.opening_hours) ?? null;
  if (scheduleType === 'kitchen') return venue?.kitchen_hours ?? null;
  if (scheduleType === 'happy_hour') return venue?.happy_hour_hours ?? null;
  if (scheduleType === 'bottle_shop') return ruleHours;
  return null;
}

export default function PortalVenueDetailPage() {
  const params = useParams<{ id: string }>();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const venueId = params?.id ?? '';
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [venue, setVenue] = useState<PortalVenueDetail | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [venueForm, setVenueForm] = useState<VenueFormState>(blankVenueForm());
  const [savingVenue, setSavingVenue] = useState(false);
  const [venueSaveMessage, setVenueSaveMessage] = useState<string | null>(null);
  const [venueSaveError, setVenueSaveError] = useState<string | null>(null);
  const [scheduleType, setScheduleType] = useState<PortalScheduleType>('opening');
  const [saveMode, setSaveMode] = useState<SaveMode>('append');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([{ start_time: '', end_time: '' }]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dealText, setDealText] = useState('');
  const [notes, setNotes] = useState('');
  const [happyHourForm, setHappyHourForm] = useState<HappyHourFormState>(blankHappyHourForm());
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [clearingSchedule, setClearingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [activityEntries, setActivityEntries] = useState<PortalActivityEntry[]>([]);
  const scheduleTypeStorageKey = useMemo(
    () => (venueId ? `portal-schedule-type-${venueId}` : null),
    [venueId]
  );
  const activePortalTask = savingSchedule
    ? 'Saving schedule changes'
    : clearingSchedule
    ? 'Deleting schedule rows'
    : savingVenue
    ? 'Saving venue details'
    : null;

  async function portalAuthedFetch<T extends Record<string, unknown>>(input: string, init?: RequestInit) {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session?.access_token) throw new Error('You must be signed in to manage this venue.');
    const response = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(init?.headers ?? {}),
      },
    });
    let json: ({ ok?: boolean; error?: string } & T) | null = null;
    try {
      json = (await response.json()) as { ok?: boolean; error?: string } & T;
    } catch {
      json = null;
    }
    if (!response.ok || json?.ok === false) {
      const fallback =
        response.status === 401
          ? 'Your venue portal session has expired. Sign in again and retry.'
          : response.status === 403
          ? 'This account is not allowed to manage this venue.'
          : `Request failed with status ${response.status}`;
      throw new Error(json?.error || fallback);
    }
    return (json ?? { ok: true }) as { ok?: boolean; error?: string } & T;
  }

  async function loadVenue(background = false) {
    if (!venueId) {
      setErrorMessage('Missing venue id.');
      setLoading(false);
      return;
    }
    if (!background) {
      setLoading(true);
    }
    setErrorMessage(null);
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) {
      setErrorMessage(sessionError.message);
      if (!background) {
        setLoading(false);
      }
      return;
    }
    if (!session?.user) {
      setErrorMessage('You must be signed in to view this venue.');
      if (!background) {
        setLoading(false);
      }
      return;
    }
    const { data: accessRow, error: accessError } = await supabase
      .from('venue_user_access')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('venue_id', venueId)
      .maybeSingle();
    if (accessError) {
      setErrorMessage(accessError.message);
      if (!background) {
        setLoading(false);
      }
      return;
    }
    const { data: adminRow, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (adminError) {
      setErrorMessage(adminError.message);
      if (!background) {
        setLoading(false);
      }
      return;
    }
    if (!adminRow?.user_id && !(accessRow as AccessRow | null)?.role) {
      setErrorMessage('This account is not allowed to view this venue.');
      if (!background) {
        setLoading(false);
      }
      return;
    }
    const { data: venueRow, error: venueError } = await supabase
      .from('venues')
      .select(
        'id, name, suburb, venue_type_id, updated_at, address, phone, website_url, instagram_url, shows_sport, plays_with_sound, sport_types, dog_friendly, kid_friendly, opening_hours, kitchen_hours, happy_hour_hours, venue_types(label, slug), venue_schedule_rules(id, venue_id, schedule_type, day_of_week, start_time, end_time, sort_order, title, description, deal_text, notes, detail_json, is_active, status)'
      )
      .eq('id', venueId)
      .maybeSingle();
    if (venueError) {
      setErrorMessage(venueError.message);
      if (!background) {
        setLoading(false);
      }
      return;
    }
    if (!venueRow) {
      setErrorMessage('Venue not found.');
      if (!background) {
        setLoading(false);
      }
      return;
    }
    const nextVenue = venueRow as PortalVenueDetail;
    setVenue(nextVenue);
    setRole((accessRow as AccessRow | null)?.role ?? 'admin');
    setVenueForm({
      name: nextVenue.name ?? '',
      suburb: nextVenue.suburb ?? '',
      address: nextVenue.address ?? '',
      phone: nextVenue.phone ?? '',
      website_url: nextVenue.website_url ?? '',
      instagram_url: nextVenue.instagram_url ?? '',
      shows_sport: normalizeBooleanFlag(nextVenue.shows_sport),
      plays_with_sound: normalizeBooleanFlag(nextVenue.plays_with_sound),
      sport_types: nextVenue.sport_types ?? '',
      dog_friendly: normalizeBooleanFlag(nextVenue.dog_friendly),
      kid_friendly: normalizeBooleanFlag(nextVenue.kid_friendly),
    });
    if (!background) {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadVenue();
  }, [venueId, supabase]);

  useEffect(() => {
    if (!scheduleTypeStorageKey) return;
    try {
      const stored = window.sessionStorage.getItem(scheduleTypeStorageKey);
      if (!stored) return;
      setScheduleType(stored as PortalScheduleType);
    } catch {
      // Ignore storage failures
    }
  }, [scheduleTypeStorageKey]);

  useEffect(() => {
    if (!scheduleTypeStorageKey) return;
    try {
      window.sessionStorage.setItem(scheduleTypeStorageKey, scheduleType);
    } catch {
      // Ignore storage failures
    }
  }, [scheduleType, scheduleTypeStorageKey]);

  useEffect(() => {
    if (!venueId) return;
    try {
      const stored = window.sessionStorage.getItem(`portal-activity-${venueId}`);
      if (!stored) return;
      const parsed = JSON.parse(stored) as PortalActivityEntry[];
      if (Array.isArray(parsed)) {
        setActivityEntries(parsed);
      }
    } catch {
      setActivityEntries([]);
    }
  }, [venueId]);

  useEffect(() => {
    if (!venueId) return;
    try {
      window.sessionStorage.setItem(
        `portal-activity-${venueId}`,
        JSON.stringify(activityEntries)
      );
    } catch {
      // Ignore storage failures
    }
  }, [activityEntries, venueId]);

  function updateVenueForm<K extends keyof VenueFormState>(field: K, value: VenueFormState[K]) {
    setVenueForm((current) => updateVenueFlags(current, field, value));
  }

  function appendActivity(action: string, details: string) {
    setActivityEntries((current) => [
      {
        id: makeId(),
        timestamp: new Date().toISOString(),
        action,
        details,
      },
      ...current,
    ].slice(0, 12));
  }

  function toggleDay(day: DayOfWeek) {
    setSelectedDays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day]));
  }

  function setDaysPreset(preset: 'weekdays' | 'weekend' | 'all' | 'clear') {
    if (preset === 'weekdays') return setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
    if (preset === 'weekend') return setSelectedDays(['saturday', 'sunday']);
    if (preset === 'all') return setSelectedDays(DAY_OPTIONS.map((day) => day.value));
    setSelectedDays([]);
  }

  function updateTimeBlock(index: number, field: keyof TimeBlock, value: string) {
    setTimeBlocks((current) => current.map((block, blockIndex) => (blockIndex === index ? { ...block, [field]: value } : block)));
  }

  function addTimeBlock() {
    setTimeBlocks((current) => [...current, { start_time: '', end_time: '' }]);
  }

  function removeTimeBlock(index: number) {
    setTimeBlocks((current) => (current.length === 1 ? current : current.filter((_, blockIndex) => blockIndex !== index)));
  }

  function resetScheduleForm() {
    setSelectedDays([]);
    setTimeBlocks([{ start_time: '', end_time: '' }]);
    setSaveMode('append');
    setTitle('');
    setDescription('');
    setDealText('');
    setNotes('');
    setHappyHourForm(blankHappyHourForm());
    setScheduleMessage(null);
    setScheduleError(null);
  }

  function loadDayIntoForm(day: DayOfWeek) {
    const rules = getLiveRules(venue, scheduleType).filter((rule) => rule.day_of_week === day);
    const periods = getExistingHours(venue, scheduleType)?.[day] ?? [];
    setSelectedDays([day]);
    if (rules.length > 0) {
      const first = rules[0];
      setTimeBlocks(
        rules.map((rule) => ({
          start_time: rule.start_time.slice(0, 5),
          end_time: rule.end_time.slice(0, 5),
        }))
      );
      setTitle(first.title ?? '');
      setDescription(first.description ?? '');
      setDealText(first.deal_text ?? '');
      setNotes(first.notes ?? '');
      const detailJson = normalizeHappyHourDetailJson(first.detail_json);
      if (scheduleType === 'happy_hour') {
        setHappyHourForm({
          beer: parseDetailCategoryToItems(detailJson?.beer),
          wine: parseDetailCategoryToItems(detailJson?.wine),
          spirits: parseDetailCategoryToItems(detailJson?.spirits),
          cocktails: parseDetailCategoryToItems(detailJson?.cocktails),
          food: parseDetailCategoryToItems(detailJson?.food),
          notes: detailJson?.notes ?? '',
        });
      }
      setSaveMode('replace');
      setScheduleMessage(
        `Loaded ${getScheduleTypeLabel(scheduleType)} for ${DAY_OPTIONS.find((option) => option.value === day)?.label}.`
      );
      setScheduleError(null);
      return;
    }

    setTimeBlocks(
      periods.length
        ? periods.map((period) => ({ start_time: period.open, end_time: period.close }))
        : [{ start_time: '', end_time: '' }]
    );
    setTitle('');
    setDescription('');
    setDealText('');
    setNotes('');
    setHappyHourForm(blankHappyHourForm());
    setSaveMode(periods.length ? 'replace' : 'append');
    setScheduleMessage(
      periods.length
        ? `Loaded ${getScheduleTypeLabel(scheduleType).toLowerCase()} for ${DAY_OPTIONS.find((option) => option.value === day)?.label}.`
        : `No saved ${getScheduleTypeLabel(scheduleType).toLowerCase()} found for ${DAY_OPTIONS.find((option) => option.value === day)?.label}.`
    );
    setScheduleError(null);
  }

  async function handleSaveVenue() {
    setVenueSaveMessage(null);
    setVenueSaveError(null);
    if (!venueForm.name.trim()) {
      setVenueSaveError('Venue name is required.');
      return;
    }
    setSavingVenue(true);
    try {
      const result = await portalAuthedFetch<{
        venue?: Partial<PortalVenueDetail>;
      }>(`/api/portal/venues/${venueId}`, {
        method: 'POST',
        body: JSON.stringify({ venue: venueForm }),
      });
      if (result.venue) {
        setVenue((current) => (current ? { ...current, ...result.venue } : current));
        setVenueForm((current) => ({
          ...current,
          name: String(result.venue?.name ?? current.name ?? ''),
          suburb: String(result.venue?.suburb ?? current.suburb ?? ''),
          address: String(result.venue?.address ?? current.address ?? ''),
          phone: String(result.venue?.phone ?? current.phone ?? ''),
          website_url: String(result.venue?.website_url ?? current.website_url ?? ''),
          instagram_url: String(
            result.venue?.instagram_url ?? current.instagram_url ?? ''
          ),
          shows_sport:
            result.venue?.shows_sport != null
              ? normalizeBooleanFlag(result.venue.shows_sport)
              : current.shows_sport,
          plays_with_sound:
            result.venue?.plays_with_sound != null
              ? normalizeBooleanFlag(result.venue.plays_with_sound)
              : current.plays_with_sound,
          sport_types: String(result.venue?.sport_types ?? current.sport_types ?? ''),
          dog_friendly:
            result.venue?.dog_friendly != null
              ? normalizeBooleanFlag(result.venue.dog_friendly)
              : current.dog_friendly,
          kid_friendly:
            result.venue?.kid_friendly != null
              ? normalizeBooleanFlag(result.venue.kid_friendly)
              : current.kid_friendly,
        }));
      }
      setVenueSaveMessage('Venue details saved.');
      appendActivity(
        'Saved venue profile',
        `Updated venue details for ${(result.venue?.name ?? venueForm.name) || 'this venue'}.`
      );
      window.setTimeout(() => {
        void loadVenue(true);
      }, 150);
    } catch (error) {
      setVenueSaveError(error instanceof Error ? error.message : 'Failed to save venue.');
    } finally {
      setSavingVenue(false);
    }
  }

  async function handleSaveSchedule() {
    setScheduleMessage(null);
    setScheduleError(null);
    if (!selectedDays.length) {
      setScheduleError('Please select at least one day.');
      return;
    }
    const cleanedTimeBlocks = timeBlocks
      .map((block) => ({ start_time: block.start_time.trim(), end_time: block.end_time.trim() }))
      .filter((block) => block.start_time && block.end_time);
    if (!cleanedTimeBlocks.length) {
      setScheduleError('Please add at least one valid time block.');
      return;
    }
    if (cleanedTimeBlocks.some((block) => block.start_time === block.end_time)) {
      setScheduleError('Start and end time cannot be the same.');
      return;
    }
    const happyHourDetailJson =
      scheduleType === 'happy_hour' ? buildHappyHourDetailJson(happyHourForm) : null;
    const generatedHappyHourSummary =
      scheduleType === 'happy_hour' ? buildHappyHourDealSummary(happyHourForm) : null;
    const rows = selectedDays.flatMap((day) =>
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
            ? ((generatedHappyHourSummary ?? dealText.trim()) || null)
            : dealText.trim() || null,
        notes:
          scheduleType === 'happy_hour'
            ? happyHourForm.notes.trim() || notes.trim() || null
            : notes.trim() || null,
        detail_json: happyHourDetailJson,
        is_active: true,
        status: 'published',
      }))
    );
    setSavingSchedule(true);
    try {
      await portalAuthedFetch(`/api/portal/venues/${venueId}/schedules`, {
        method: 'POST',
        body: JSON.stringify({ action: 'save', rows, scheduleType, saveMode, selectedDays }),
      });
      setScheduleMessage(`Saved ${getScheduleTypeLabel(scheduleType).toLowerCase()}.`);
      appendActivity(
        'Saved schedule',
        `${getScheduleTypeLabel(scheduleType)} for ${selectedDays.length} day${selectedDays.length === 1 ? '' : 's'} with ${cleanedTimeBlocks.length} block${cleanedTimeBlocks.length === 1 ? '' : 's'}.`
      );
      resetScheduleForm();
      await loadVenue(true);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Failed to save schedule.');
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleDeleteSelectedDays() {
    setScheduleMessage(null);
    setScheduleError(null);
    if (!selectedDays.length) {
      setScheduleError('Please select at least one day to delete.');
      return;
    }
    if (!window.confirm(`Delete ${getScheduleTypeLabel(scheduleType).toLowerCase()} for the selected days?`)) return;
    setClearingSchedule(true);
    try {
      await portalAuthedFetch(`/api/portal/venues/${venueId}/schedules`, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete-selected-days', scheduleType, selectedDays }),
      });
      setScheduleMessage(`Deleted selected ${getScheduleTypeLabel(scheduleType).toLowerCase()}.`);
      appendActivity(
        'Deleted selected days',
        `${getScheduleTypeLabel(scheduleType)} removed for ${selectedDays.length} selected day${selectedDays.length === 1 ? '' : 's'}.`
      );
      resetScheduleForm();
      await loadVenue(true);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Failed to delete selected days.');
    } finally {
      setClearingSchedule(false);
    }
  }

  async function handleDeleteAllForType() {
    setScheduleMessage(null);
    setScheduleError(null);
    if (!window.confirm(`Delete all ${getScheduleTypeLabel(scheduleType).toLowerCase()} for this venue?`)) return;
    setClearingSchedule(true);
    try {
      await portalAuthedFetch(`/api/portal/venues/${venueId}/schedules`, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete-all', scheduleType }),
      });
      setScheduleMessage(`Deleted all ${getScheduleTypeLabel(scheduleType).toLowerCase()}.`);
      appendActivity(
        'Deleted all rows',
        `Removed all ${getScheduleTypeLabel(scheduleType).toLowerCase()} rows for this venue.`
      );
      resetScheduleForm();
      await loadVenue(true);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Failed to delete all rows.');
    } finally {
      setClearingSchedule(false);
    }
  }

  const existingHours = useMemo(() => getExistingHours(venue, scheduleType), [venue, scheduleType]);
  const currentRules = useMemo(() => getLiveRules(venue, scheduleType), [venue, scheduleType]);
  const liveEventCount = useMemo(
    () =>
      EVENT_SCHEDULE_TYPE_OPTIONS.reduce(
        (count, option) => count + getLiveRules(venue, option.value).length,
        0
      ),
    [venue]
  );
  const venueBadgeCount = useMemo(
    () =>
      [
        normalizeBooleanFlag(venue?.shows_sport),
        normalizeBooleanFlag(venue?.plays_with_sound),
        normalizeBooleanFlag(venue?.dog_friendly),
        normalizeBooleanFlag(venue?.kid_friendly),
      ].filter(Boolean).length,
    [venue]
  );

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
        return { ...item, prices: nextPrices.length ? nextPrices : [blankPriceForm()] };
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

  if (loading) {
    return <div className="portal-shell min-h-screen bg-neutral-950 px-4 py-6 text-white sm:px-6 sm:py-8"><div className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/60 sm:p-6">Loading venue workspace...</div></div>;
  }

  if (errorMessage || !venue) {
    return <div className="portal-shell min-h-screen bg-neutral-950 px-4 py-6 text-white sm:px-6 sm:py-8"><div className="mx-auto max-w-6xl rounded-3xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100 sm:p-6">{errorMessage ?? 'Venue not found.'}</div></div>;
  }

  return (
    <div className="portal-shell min-h-screen bg-neutral-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/portal" className="text-sm text-orange-200 hover:text-orange-100">← Back to portal</Link>
          <Link href={venue ? buildPublicVenueHref(venue) : '/venues'} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5">View this venue on website</Link>
        </div>

        {activePortalTask ? (
          <div className="mb-6 rounded-2xl border border-orange-300/25 bg-orange-500/10 px-4 py-3 text-sm text-orange-50">
            <div className="font-semibold">Working on it</div>
            <div className="mt-1 text-orange-100/85">
              {activePortalTask}. Please wait for the confirmation message before moving on.
            </div>
          </div>
        ) : null}

        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300/80">{getVenueTypeLabel(venue)}</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{venue.name ?? 'Untitled venue'}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-white/50">
                {venue.suburb ? <span className="rounded-full border border-white/10 px-3 py-1">{venue.suburb}</span> : null}
                <span className="rounded-full border border-white/10 px-3 py-1">{role ?? 'manager'}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/65">
              <div>{venue.address ?? 'No address listed yet'}</div>
              {venue.phone ? <div className="mt-2">{venue.phone}</div> : null}
              {venue.website_url ? <a href={venue.website_url} target="_blank" rel="noreferrer" className="mt-2 block text-orange-200 hover:text-orange-100">Website</a> : null}
              {normalizeInstagramUrl(venue.instagram_url) ? <a href={normalizeInstagramUrl(venue.instagram_url) ?? undefined} target="_blank" rel="noreferrer" className="mt-2 block text-orange-200 hover:text-orange-100">Instagram</a> : null}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="self-start rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:sticky lg:top-24">
            <h2 className="text-xl font-semibold">Workspace snapshot</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              A quick read of the current venue setup before you make changes.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/45">Venue badges</div>
                <div className="mt-2 text-2xl font-semibold">{venueBadgeCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/45">Live event rows</div>
                <div className="mt-2 text-2xl font-semibold">{liveEventCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/45">Current schedule view</div>
                <div className="mt-2 text-sm font-semibold">{getScheduleTypeLabel(scheduleType)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/45">Last database update</div>
                <div className="mt-2 text-sm font-semibold">
                  {venue.updated_at ? formatPortalTimestamp(venue.updated_at) : 'Not available'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Recent activity</h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  A running log of changes made from this portal session for this venue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivityEntries([])}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
              >
                Clear
              </button>
            </div>

            {activityEntries.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-4 text-sm text-white/55">
                No portal activity recorded yet for this session.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {activityEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{entry.action}</div>
                      <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                        {formatPortalTimestamp(entry.timestamp)}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-white/70">{entry.details}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Venue profile</h2>
            <p className="mt-2 text-sm leading-6 text-white/72">Update the public-facing details and venue tags for this venue.</p>
            <div className="mt-5 space-y-4">
              <div><label className="mb-1 block text-sm font-medium text-white/85">Venue name</label><input type="text" value={venueForm.name} onChange={(event) => updateVenueForm('name', event.target.value)} className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
              <div><label className="mb-1 block text-sm font-medium text-white/85">Suburb</label><input type="text" value={venueForm.suburb} onChange={(event) => updateVenueForm('suburb', event.target.value)} className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
              <div><label className="mb-1 block text-sm font-medium text-white/85">Address</label><input type="text" value={venueForm.address} onChange={(event) => updateVenueForm('address', event.target.value)} className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
              <div><label className="mb-1 block text-sm font-medium text-white/85">Phone</label><input type="text" value={venueForm.phone} onChange={(event) => updateVenueForm('phone', event.target.value)} className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
              <div><label className="mb-1 block text-sm font-medium text-white/85">Website</label><input type="text" value={venueForm.website_url} onChange={(event) => updateVenueForm('website_url', event.target.value)} className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
              <div><label className="mb-1 block text-sm font-medium text-white/85">Instagram</label><input type="text" value={venueForm.instagram_url} onChange={(event) => updateVenueForm('instagram_url', event.target.value)} placeholder="@venuehandle or https://instagram.com/..." className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
              <div><label className="mb-1 block text-sm font-medium text-white/85">Sport types</label><input type="text" value={venueForm.sport_types} onChange={(event) => updateVenueForm('sport_types', event.target.value)} placeholder="e.g. AFL, NRL, UFC" className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => updateVenueForm('shows_sport', !venueForm.shows_sport)} className={`rounded-xl border px-3 py-3 text-left ${venueForm.shows_sport ? 'border-orange-300/40 bg-orange-500/10' : 'border-white/10 bg-black/25 hover:bg-white/[0.04]'}`}><div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85">Shows live sport</div><div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/50">{venueForm.shows_sport ? 'Yes' : 'No'}</div></button>
              <button type="button" onClick={() => updateVenueForm('plays_with_sound', !venueForm.plays_with_sound)} disabled={!venueForm.shows_sport && !venueForm.plays_with_sound} className={`rounded-xl border px-3 py-3 text-left ${venueForm.plays_with_sound ? 'border-orange-300/40 bg-orange-500/10' : venueForm.shows_sport ? 'border-white/10 bg-black/25 hover:bg-white/[0.04]' : 'border-white/10 bg-black/10 text-white/40'}`}><div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85">Sport with sound</div><div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/50">{!venueForm.shows_sport && !venueForm.plays_with_sound ? 'Enable sport first' : venueForm.plays_with_sound ? 'Yes' : 'No'}</div></button>
              <button type="button" onClick={() => updateVenueForm('dog_friendly', !venueForm.dog_friendly)} className={`rounded-xl border px-3 py-3 text-left ${venueForm.dog_friendly ? 'border-orange-300/40 bg-orange-500/10' : 'border-white/10 bg-black/25 hover:bg-white/[0.04]'}`}><div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85">Dog friendly</div><div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/50">{venueForm.dog_friendly ? 'Yes' : 'No'}</div></button>
              <button type="button" onClick={() => updateVenueForm('kid_friendly', !venueForm.kid_friendly)} className={`rounded-xl border px-3 py-3 text-left ${venueForm.kid_friendly ? 'border-orange-300/40 bg-orange-500/10' : 'border-white/10 bg-black/25 hover:bg-white/[0.04]'}`}><div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85">Kid friendly</div><div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/50">{venueForm.kid_friendly ? 'Yes' : 'No'}</div></button>
            </div>
            {venueSaveMessage ? <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{venueSaveMessage}</div> : null}
            {venueSaveError ? <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{venueSaveError}</div> : null}
            <div className="mt-5"><button type="button" onClick={handleSaveVenue} disabled={savingVenue} className="min-h-[44px] rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60">{savingVenue ? 'Saving...' : 'Save venue details'}</button></div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Hours, happy hour, and events</h2>
                <p className="mt-2 text-sm leading-6 text-white/60">Manage hours, happy hour copy, and event rows for this venue.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/60">{getScheduleTypeLabel(scheduleType)}</div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-white/75">Schedule type</label>
                <PortalSelect
                  value={scheduleType}
                  groups={[
                    { label: 'Hours', options: SCHEDULE_TYPE_OPTIONS },
                    { label: 'Events', options: EVENT_SCHEDULE_TYPE_OPTIONS },
                  ]}
                  onChange={(value) => {
                    setScheduleType(value);
                    resetScheduleForm();
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-white/75">Mode</label>
                <PortalSelect
                  value={saveMode}
                  options={[
                    { value: 'append', label: 'Add to existing' },
                    { value: 'replace', label: 'Overwrite selected days' },
                  ]}
                  onChange={setSaveMode}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => setDaysPreset('weekdays')} className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Mon-Fri</button>
              <button type="button" onClick={() => setDaysPreset('weekend')} className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Weekend</button>
              <button type="button" onClick={() => setDaysPreset('all')} className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5">All days</button>
              <button type="button" onClick={() => setDaysPreset('clear')} className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Clear days</button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {DAY_OPTIONS.map((day) => {
                const active = selectedDays.includes(day.value);
                return <button key={day.value} type="button" onClick={() => toggleDay(day.value)} className={`rounded-xl px-3 py-2 text-sm font-medium ${active ? 'bg-white text-black' : 'border border-white/10 hover:bg-white/5'}`}>{day.label}</button>;
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Current saved entries</h3>
                  <p className="mt-1 text-xs text-white/55">
                    Load a saved day straight into the editor before updating deals or times.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/60">
                  {getScheduleTypeLabel(scheduleType)}
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {DAY_OPTIONS.map((day) => {
                  const periods = existingHours?.[day.value] ?? [];
                  const dayRules = currentRules.filter((rule) => rule.day_of_week === day.value);
                  const summary = dayRules.length
                    ? dayRules
                        .map((rule) => {
                          const time = `${rule.start_time.slice(0, 5)}-${rule.end_time.slice(0, 5)}`;
                          const text =
                            rule.title?.trim() ||
                            rule.deal_text?.trim() ||
                            rule.description?.trim() ||
                            '';
                          return text ? `${time} ${text}` : time;
                        })
                        .join(' | ')
                    : formatPeriods(periods);

                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => loadDayIntoForm(day.value)}
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-orange-300/30 hover:bg-white/[0.04]"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/75">
                        {day.label}
                      </div>
                      <div className="mt-1 text-sm font-medium text-white">{summary}</div>
                      <div className="mt-2 text-[11px] text-white/45">
                        {dayRules.length || periods.length
                          ? 'Load this day into editor'
                          : 'Start a new entry for this day'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white/85">Time blocks</div>
                <button type="button" onClick={addTimeBlock} className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Add block</button>
              </div>
              <div className="space-y-3">
                {timeBlocks.map((block, index) => (
                  <div key={`${index}-${block.start_time}-${block.end_time}`} className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 md:grid-cols-[1fr_1fr_auto]">
                    <input type="time" value={block.start_time} onChange={(event) => updateTimeBlock(index, 'start_time', event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" />
                    <input type="time" value={block.end_time} onChange={(event) => updateTimeBlock(index, 'end_time', event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" />
                    <button type="button" onClick={() => removeTimeBlock(index)} className="rounded-xl border border-red-500/25 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10">Remove</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div><label className="mb-1 block text-sm font-medium text-white/75">Title</label><input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional title" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
              <div><label className="mb-1 block text-sm font-medium text-white/75">Deal text / summary</label><input type="text" value={dealText} onChange={(event) => setDealText(event.target.value)} placeholder={scheduleType === 'happy_hour' ? 'e.g. $7 schooners / $15 burgers' : 'Optional summary'} className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
            </div>
            <div className="mt-4"><label className="mb-1 block text-sm font-medium text-white/75">Description</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Optional description" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
            <div className="mt-4"><label className="mb-1 block text-sm font-medium text-white/75">Notes</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Optional notes" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
            {scheduleType === 'happy_hour' ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-orange-300/20 bg-orange-500/5 px-4 py-3 text-sm text-orange-50">
                  Add beer, wine, spirits, cocktails, and food items so the public venue page can show structured happy hour deals instead of a single summary line.
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
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
                </div>
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
                  <label className="mb-1 block text-sm font-medium text-white/75">
                    Happy hour notes
                  </label>
                  <textarea
                    value={happyHourForm.notes}
                    onChange={(event) =>
                      setHappyHourForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Optional notes shown with the deal details"
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40"
                  />
                </div>
              </div>
            ) : null}

            {scheduleMessage ? <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{scheduleMessage}</div> : null}
            {scheduleError ? <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{scheduleError}</div> : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={handleSaveSchedule} disabled={savingSchedule || clearingSchedule} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60">{savingSchedule ? 'Saving...' : 'Save entry'}</button>
              <button type="button" onClick={resetScheduleForm} disabled={savingSchedule || clearingSchedule} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60">Clear form</button>
              <button type="button" onClick={handleDeleteSelectedDays} disabled={savingSchedule || clearingSchedule} className="rounded-xl border border-red-500/25 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60">{clearingSchedule ? 'Working...' : 'Delete selected days'}</button>
              <button type="button" onClick={handleDeleteAllForType} disabled={savingSchedule || clearingSchedule} className="rounded-xl border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60">Delete all {getScheduleTypeLabel(scheduleType)}</button>
            </div>
          </div>
        </section>

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
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{label}</div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
        >
          Add item
        </button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-white/45">
          No {label.toLowerCase()} items yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(event) => onUpdateItem(item.id, 'name', event.target.value)}
                  placeholder={`${label} item name`}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40"
                />
                <input
                  type="text"
                  value={item.description}
                  onChange={(event) =>
                    onUpdateItem(item.id, 'description', event.target.value)
                  }
                  placeholder="Optional description"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40"
                />
              </div>
              <div className="mt-3 space-y-2">
                {item.prices.map((price) => (
                  <div key={price.id} className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
                    <input
                      type="text"
                      value={price.label}
                      onChange={(event) =>
                        onUpdatePrice(item.id, price.id, 'label', event.target.value)
                      }
                      placeholder="Price label, e.g. schooner"
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40"
                    />
                    <input
                      type="text"
                      value={price.amount}
                      onChange={(event) =>
                        onUpdatePrice(item.id, price.id, 'amount', event.target.value)
                      }
                      placeholder="Price"
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40"
                    />
                    <button
                      type="button"
                      onClick={() => onRemovePrice(item.id, price.id)}
                      className="rounded-xl border border-red-500/25 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onAddPrice(item.id)}
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                >
                  Add price
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="rounded-xl border border-red-500/25 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10"
                >
                  Delete item
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PortalSelect<T extends string>({
  value,
  options,
  groups,
  onChange,
}: {
  value: T;
  options?: PortalSelectOption<T>[];
  groups?: PortalSelectGroup<T>[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const flatOptions = useMemo(
    () => options ?? groups?.flatMap((group) => group.options) ?? [],
    [groups, options]
  );
  const selectedLabel =
    flatOptions.find((option) => option.value === value)?.label ?? value;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm text-white outline-none transition ${
          open
            ? 'border-orange-300/40 bg-black/55'
            : 'border-white/10 bg-black/25 hover:bg-black/35'
        }`}
      >
        <span>{selectedLabel}</span>
        <span className={`text-xs text-white/60 transition ${open ? 'rotate-180' : ''}`}>
          v
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          {groups?.length ? (
            <div className="max-h-80 overflow-y-auto py-2">
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="px-4 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/75">
                    {group.label}
                  </div>
                  <div className="space-y-1 px-2 pb-1">
                    {group.options.map((option) => {
                      const selected = option.value === value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            onChange(option.value);
                            setOpen(false);
                          }}
                          className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                            selected
                              ? 'bg-orange-500/20 text-white'
                              : 'text-white/85 hover:bg-white/8'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {flatOptions.map((option) => {
                const selected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                      selected
                        ? 'bg-orange-500/20 text-white'
                        : 'text-white/85 hover:bg-white/8'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
