'use client';

import DealScheduleItemsEditor, {
  type DealScheduleItemDraft,
} from '@/app/components/DealScheduleItemsEditor';
import { GroupedScheduleTypeSelector } from '@/app/components/GroupedScheduleTypeSelector';
import { convertGoogleOpeningHours } from '@/lib/convert-google-hours';
import { buildPublicVenueHref } from '@/lib/public-venue-discovery';
import {
  DAY_OPTIONS,
  EVENT_SCHEDULE_TYPES,
  getScheduleTypeLabel,
  getScheduleTypePickerLabel,
  isDealScheduleType,
  isEventScheduleType,
  isVenueRuleScheduleType,
  type DayOfWeek,
  type ScheduleType,
  type VenueRuleKind,
} from '@/lib/schedule-rules';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { normalizeInstagramUrl } from '@/lib/social-links';
import {
  type HappyHourDetailItem,
  type HappyHourDetailJson,
  type HappyHourPrice,
  type ScheduleRuleDetailJson,
  getHappyHourItemPrices,
  normalizeHappyHourDetailCategory,
  normalizeHappyHourDetailJson,
  normalizeScheduleRuleDetailJson,
} from '@/lib/venue-data';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

type EventScheduleType = (typeof EVENT_SCHEDULE_TYPES)[number];
type PortalScheduleType = ScheduleType;
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
  detail_json?: ScheduleRuleDetailJson | null;
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
  sport_notes?: string | null;
  dog_friendly?: boolean | null;
  dog_friendly_notes?: string | null;
  kid_friendly?: boolean | null;
  kid_friendly_notes?: string | null;
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
type PortalEditorMode = 'overview' | 'edit';
type PortalEditTarget = 'schedule' | 'venue';
type PortalOverviewCard = {
  title: string;
  description: string;
  lines: string[];
};
type PortalExistingSchedulePreviewRow = {
  id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  sort_order: number;
  title: string | null;
  description: string | null;
  deal_text: string | null;
  notes: string | null;
  detail_json: ScheduleRuleDetailJson | null;
};
type PortalVenueDaySummary = {
  day: DayOfWeek;
  opening: string;
  kitchen: string;
  happyHour: string;
  bottleShop: string;
  deals: string[];
  events: string[];
  venueRules: string[];
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
  sport_notes: string;
  dog_friendly: boolean;
  dog_friendly_notes: string;
  kid_friendly: boolean;
  kid_friendly_notes: string;
};
type PortalSelectOption<T extends string> = {
  value: T;
  label: string;
};
type PortalSelectGroup<T extends string> = {
  label: string;
  options: PortalSelectOption<T>[];
};

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
    sport_notes: '',
    dog_friendly: false,
    dog_friendly_notes: '',
    kid_friendly: false,
    kid_friendly_notes: '',
  };
}

function parseStructuredPriceInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/^\$/, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Special price must be a valid number.');
  }
  return Math.round(parsed * 100) / 100;
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

  return parts.length ? parts.join(' | ') : null;
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

function createBlankDealItem(): DealScheduleItemDraft {
  return {
    id: `deal-item-${Math.random().toString(36).slice(2, 10)}`,
    selectedDays: [],
    timeBlocks: [{ start_time: '', end_time: '' }],
    title: '',
    dealText: '',
    specialPrice: '',
    description: '',
    notes: '',
  };
}

function sortPortalExistingPreviewRows(rows: PortalExistingSchedulePreviewRow[]) {
  return [...rows].sort((a, b) => {
    const dayDiff =
      DAY_OPTIONS.findIndex((option) => option.value === a.day_of_week) -
      DAY_OPTIONS.findIndex((option) => option.value === b.day_of_week);
    if (dayDiff !== 0) return dayDiff;

    const startDiff = a.start_time.localeCompare(b.start_time);
    if (startDiff !== 0) return startDiff;

    return a.end_time.localeCompare(b.end_time);
  });
}

function getPortalExistingScheduleRowsForEdit(
  venue: PortalVenueDetail | null,
  scheduleType: PortalScheduleType,
  currentVenueRuleKind?: VenueRuleKind
): PortalExistingSchedulePreviewRow[] {
  if (!venue) return [];

  const liveRules = getLiveRules(venue, scheduleType)
    .map((rule, index) => ({
      id: rule.id ?? `rule-${scheduleType}-${rule.day_of_week}-${index}`,
      day_of_week: rule.day_of_week,
      start_time: rule.start_time?.slice(0, 5) ?? '',
      end_time: rule.end_time?.slice(0, 5) ?? '',
      sort_order: rule.sort_order ?? index,
      title: rule.title ?? null,
      description: rule.description ?? null,
      deal_text: rule.deal_text ?? null,
      notes: rule.notes ?? null,
      detail_json: normalizeScheduleRuleDetailJson(rule.detail_json),
    }))
    .filter((row) => row.start_time && row.end_time);

  if (liveRules.length > 0) {
    const filtered =
      scheduleType === 'venue_rule'
        ? liveRules.filter(
            (row) =>
              (normalizeScheduleRuleDetailJson(row.detail_json)?.rule_kind ?? 'kid') ===
              (currentVenueRuleKind ?? 'kid')
          )
        : liveRules;

    return sortPortalExistingPreviewRows(filtered);
  }

  const periods = getExistingHours(venue, scheduleType);
  if (!periods) return [];

  const rows = DAY_OPTIONS.flatMap((day) =>
    (periods[day.value] ?? []).map((period, index) => ({
      id: `${scheduleType}-${day.value}-${period.open}-${period.close}-${index}`,
      day_of_week: day.value,
      start_time: period.open,
      end_time: period.close,
      sort_order: index,
      title: null,
      description: null,
      deal_text: null,
      notes: null,
      detail_json: null,
    }))
  );

  return sortPortalExistingPreviewRows(rows);
}

function buildPortalVenueDaySummaries(venue: PortalVenueDetail): PortalVenueDaySummary[] {
  const liveRules = (venue.venue_schedule_rules ?? [])
    .filter(
      (rule) =>
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

  const openingHours = getExistingHours(venue, 'opening');
  const kitchenHours = getExistingHours(venue, 'kitchen');
  const happyHourHours = getExistingHours(venue, 'happy_hour');
  const bottleShopHours = getExistingHours(venue, 'bottle_shop');

  return DAY_OPTIONS.map((day) => {
    const dayRules = liveRules.filter((rule) => rule.day_of_week === day.value);
    const deals = dayRules
      .filter(
        (rule) =>
          rule.schedule_type === 'daily_special' || rule.schedule_type === 'lunch_special'
      )
      .map((rule) => {
        const label = getScheduleTypeLabel(rule.schedule_type as PortalScheduleType);
        const time = `${rule.start_time.slice(0, 5)}-${rule.end_time.slice(0, 5)}`;
        const text =
          rule.deal_text?.trim() ||
          rule.title?.trim() ||
          rule.description?.trim() ||
          rule.notes?.trim() ||
          '';
        return text ? `${label}: ${time} ${text}` : `${label}: ${time}`;
      });
    const events = dayRules
      .filter((rule) => isEventScheduleType(rule.schedule_type as PortalScheduleType))
      .map((rule) => {
        const label = getScheduleTypeLabel(rule.schedule_type as PortalScheduleType);
        const time = `${rule.start_time.slice(0, 5)}-${rule.end_time.slice(0, 5)}`;
        const text =
          rule.title?.trim() ||
          rule.deal_text?.trim() ||
          rule.description?.trim() ||
          rule.notes?.trim() ||
          '';
        return text ? `${label}: ${time} ${text}` : `${label}: ${time}`;
      });
    const venueRules = dayRules
      .filter((rule) => rule.schedule_type === 'venue_rule')
      .map((rule) => {
        const detailJson = normalizeScheduleRuleDetailJson(rule.detail_json);
        const label = detailJson?.rule_kind === 'dog' ? 'Dog friendly' : 'Kids allowed';
        const time = `${rule.start_time.slice(0, 5)}-${rule.end_time.slice(0, 5)}`;
        const text =
          rule.deal_text?.trim() || rule.notes?.trim() || rule.description?.trim() || '';
        return text ? `${label}: ${time} ${text}` : `${label}: ${time}`;
      });

    return {
      day: day.value,
      opening: formatPeriods(openingHours?.[day.value] ?? []),
      kitchen: formatPeriods(kitchenHours?.[day.value] ?? []),
      happyHour: formatPeriods(happyHourHours?.[day.value] ?? []),
      bottleShop: formatPeriods(bottleShopHours?.[day.value] ?? []),
      deals,
      events,
      venueRules,
    };
  });
}

function takePortalOverviewPreviewLines(lines: string[], limit = 3) {
  if (!lines.length) return ['Nothing set up yet'];
  if (lines.length <= limit) return lines;
  return [...lines.slice(0, limit), `+${lines.length - limit} more`];
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
  const [portalMode, setPortalMode] = useState<PortalEditorMode>('overview');
  const [portalEditTarget, setPortalEditTarget] = useState<PortalEditTarget>('schedule');
  const [scheduleType, setScheduleType] = useState<PortalScheduleType>('opening');
  const [saveMode, setSaveMode] = useState<SaveMode>('append');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([{ start_time: '', end_time: '' }]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dealText, setDealText] = useState('');
  const [specialPrice, setSpecialPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [dealItems, setDealItems] = useState<DealScheduleItemDraft[]>([
    createBlankDealItem(),
  ]);
  const [loadedScheduleRowsSnapshot, setLoadedScheduleRowsSnapshot] = useState<
    PortalExistingSchedulePreviewRow[]
  >([]);
  const [venueRuleKind, setVenueRuleKind] = useState<VenueRuleKind>('kid');
  const [happyHourForm, setHappyHourForm] = useState<HappyHourFormState>(blankHappyHourForm());
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [clearingSchedule, setClearingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [activityEntries, setActivityEntries] = useState<PortalActivityEntry[]>([]);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const portalUiStorageKey = useMemo(
    () => (venueId ? `portal-ui-state-${venueId}` : null),
    [venueId]
  );
  const activePortalTask = savingSchedule
    ? 'Saving schedule changes'
    : clearingSchedule
    ? 'Deleting schedule rows'
    : savingVenue
    ? 'Saving venue details'
    : null;
  const isPortalEditMode = portalMode === 'edit';

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
        'id, name, suburb, venue_type_id, updated_at, address, phone, website_url, instagram_url, shows_sport, plays_with_sound, sport_types, sport_notes, dog_friendly, dog_friendly_notes, kid_friendly, kid_friendly_notes, opening_hours, kitchen_hours, happy_hour_hours, venue_types(label, slug), venue_schedule_rules(id, venue_id, schedule_type, day_of_week, start_time, end_time, sort_order, title, description, deal_text, notes, detail_json, is_active, status)'
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
      sport_notes: nextVenue.sport_notes ?? '',
      dog_friendly: normalizeBooleanFlag(nextVenue.dog_friendly),
      dog_friendly_notes: nextVenue.dog_friendly_notes ?? '',
      kid_friendly: normalizeBooleanFlag(nextVenue.kid_friendly),
      kid_friendly_notes: nextVenue.kid_friendly_notes ?? '',
    });
    if (!background) {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadVenue();
  }, [venueId, supabase]);

  useEffect(() => {
    if (!portalUiStorageKey) return;
    try {
      const stored = window.sessionStorage.getItem(portalUiStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<{
        scheduleType: PortalScheduleType;
        saveMode: SaveMode;
        showActivityLog: boolean;
      }>;
      if (typeof parsed.scheduleType === 'string') {
        setScheduleType(parsed.scheduleType);
      }
      if (parsed.saveMode === 'append' || parsed.saveMode === 'replace') {
        setSaveMode(parsed.saveMode);
      }
      if (typeof parsed.showActivityLog === 'boolean') {
        setShowActivityLog(parsed.showActivityLog);
      }
    } catch {
      // Ignore storage failures
    }
  }, [portalUiStorageKey]);

  useEffect(() => {
    if (!portalUiStorageKey) return;
    try {
      window.sessionStorage.setItem(
        portalUiStorageKey,
        JSON.stringify({
          scheduleType,
          saveMode,
          showActivityLog,
        })
      );
    } catch {
      // Ignore storage failures
    }
  }, [portalUiStorageKey, saveMode, scheduleType, showActivityLog]);

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

  function updateDealItemField(
    itemId: string,
    field: 'title' | 'dealText' | 'specialPrice' | 'description' | 'notes',
    value: string
  ) {
    setDealItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
    );
  }

  function toggleDealItemDay(itemId: string, day: DayOfWeek) {
    setDealItems((current) =>
      current.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              selectedDays: item.selectedDays.includes(day)
                ? item.selectedDays.filter((value) => value !== day)
                : [...item.selectedDays, day],
            }
      )
    );
  }

  function setDealItemDaysPreset(
    itemId: string,
    preset: 'weekdays' | 'weekend' | 'all' | 'clear'
  ) {
    const nextDays =
      preset === 'weekdays'
        ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        : preset === 'weekend'
        ? ['saturday', 'sunday']
        : preset === 'all'
        ? DAY_OPTIONS.map((day) => day.value)
        : [];

    setDealItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, selectedDays: nextDays as DayOfWeek[] } : item))
    );
  }

  function addDealItem() {
    setDealItems((current) => [...current, createBlankDealItem()]);
  }

  function removeDealItem(itemId: string) {
    setDealItems((current) =>
      current.length === 1 ? [createBlankDealItem()] : current.filter((item) => item.id !== itemId)
    );
  }

  function addDealItemTimeBlock(itemId: string) {
    setDealItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, timeBlocks: [...item.timeBlocks, { start_time: '', end_time: '' }] }
          : item
      )
    );
  }

  function removeDealItemTimeBlock(itemId: string, index: number) {
    setDealItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        if (item.timeBlocks.length === 1) return item;
        return {
          ...item,
          timeBlocks: item.timeBlocks.filter((_, blockIndex) => blockIndex !== index),
        };
      })
    );
  }

  function updateDealItemTimeBlock(
    itemId: string,
    index: number,
    field: keyof TimeBlock,
    value: string
  ) {
    setDealItems((current) =>
      current.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              timeBlocks: item.timeBlocks.map((block, blockIndex) =>
                blockIndex === index ? { ...block, [field]: value } : block
              ),
            }
      )
    );
  }

  function populateSharedScheduleFormFromRows(
    targetScheduleType: PortalScheduleType,
    rows: PortalExistingSchedulePreviewRow[],
    targetVenueRuleKind?: VenueRuleKind,
    options?: { preserveSelectedDays?: boolean }
  ) {
    const sortedRows = sortPortalExistingPreviewRows(rows);
    const uniqueDays = Array.from(
      new Set(sortedRows.map((row) => row.day_of_week))
    ) as DayOfWeek[];
    const uniqueTimeBlocks = Array.from(
      new Map(
        sortedRows.map((row) => [
          `${row.start_time}-${row.end_time}`,
          { start_time: row.start_time, end_time: row.end_time },
        ])
      ).values()
    );
    const firstRow = sortedRows[0];
    const mergedDetailJson = normalizeScheduleRuleDetailJson(
      sortedRows.find((row) => row.detail_json)?.detail_json ?? null
    );

    if (!options?.preserveSelectedDays) {
      setSelectedDays(uniqueDays);
    }
    setTimeBlocks(uniqueTimeBlocks);
    setTitle(firstRow?.title ?? '');
    setDescription(firstRow?.description ?? '');
    setDealText(firstRow?.deal_text ?? '');
    setSpecialPrice(
      mergedDetailJson?.special_price != null ? String(mergedDetailJson.special_price) : ''
    );
    setNotes(firstRow?.notes ?? mergedDetailJson?.notes ?? '');

    if (targetScheduleType === 'happy_hour') {
      setHappyHourForm({
        beer: parseDetailCategoryToItems(mergedDetailJson?.beer),
        wine: parseDetailCategoryToItems(mergedDetailJson?.wine),
        spirits: parseDetailCategoryToItems(mergedDetailJson?.spirits),
        cocktails: parseDetailCategoryToItems(mergedDetailJson?.cocktails),
        food: parseDetailCategoryToItems(mergedDetailJson?.food),
        notes: mergedDetailJson?.notes ?? firstRow?.notes ?? '',
      });
    }

    if (targetScheduleType === 'venue_rule') {
      setVenueRuleKind(
        targetVenueRuleKind ?? (mergedDetailJson?.rule_kind === 'dog' ? 'dog' : 'kid')
      );
    }
  }

  function populateDealItemsFromRows(rows: PortalExistingSchedulePreviewRow[]) {
    const sortedRows = sortPortalExistingPreviewRows(rows);
    if (!sortedRows.length) {
      setDealItems([createBlankDealItem()]);
      return;
    }

    setDealItems(
      sortedRows.map((row, index) => {
        const detailJson = normalizeScheduleRuleDetailJson(row.detail_json);
        return {
          id: row.id || `deal-item-loaded-${index}`,
          selectedDays: [row.day_of_week],
          timeBlocks: [{ start_time: row.start_time, end_time: row.end_time }],
          title: row.title ?? '',
          dealText: row.deal_text ?? '',
          specialPrice:
            detailJson?.special_price != null ? String(detailJson.special_price) : '',
          description: row.description ?? '',
          notes: row.notes ?? detailJson?.notes ?? '',
        };
      })
    );
  }

  function resetScheduleForm() {
    setSelectedDays([]);
    setTimeBlocks([{ start_time: '', end_time: '' }]);
    setSaveMode('append');
    setTitle('');
    setDescription('');
    setDealText('');
    setSpecialPrice('');
    setNotes('');
    setDealItems([createBlankDealItem()]);
    setLoadedScheduleRowsSnapshot([]);
    setVenueRuleKind('kid');
    setHappyHourForm(blankHappyHourForm());
    setScheduleMessage(null);
    setScheduleError(null);
  }

  function handleScheduleTypeSelection(
    nextScheduleType: PortalScheduleType,
    nextVenueRuleKind?: VenueRuleKind
  ) {
    resetScheduleForm();
    setScheduleType(nextScheduleType);
    const targetVenueRuleKind =
      nextScheduleType === 'venue_rule' ? nextVenueRuleKind ?? 'kid' : 'kid';
    setPortalEditTarget('schedule');
    setPortalMode('edit');
    if (nextScheduleType === 'venue_rule') {
      setVenueRuleKind(targetVenueRuleKind);
    }

    const rows = getPortalExistingScheduleRowsForEdit(
      venue,
      nextScheduleType,
      targetVenueRuleKind
    );

    if (rows.length > 0) {
      loadExistingRowsIntoScheduleForm(
        nextScheduleType,
        rows,
        `Loaded existing ${getScheduleTypePickerLabel(
          nextScheduleType,
          targetVenueRuleKind
        ).toLowerCase()} below. Review it, make changes, then save.`,
        targetVenueRuleKind
      );
      return;
    }

    setScheduleMessage(
      `No existing ${getScheduleTypePickerLabel(
        nextScheduleType,
        targetVenueRuleKind
      ).toLowerCase()} was found. Start with a fresh form below.`
    );
    setScheduleError(null);
  }

  function loadExistingRowsIntoScheduleForm(
    targetScheduleType: PortalScheduleType,
    rows: PortalExistingSchedulePreviewRow[],
    successMessage?: string,
    targetVenueRuleKind?: VenueRuleKind
  ) {
    if (!rows.length) {
      setScheduleError('No existing rows were found to load.');
      return;
    }

    setScheduleType(targetScheduleType);
    setLoadedScheduleRowsSnapshot(sortPortalExistingPreviewRows(rows));

    if (isDealScheduleType(targetScheduleType)) {
      populateDealItemsFromRows(rows);
      setSelectedDays(
        Array.from(new Set(rows.map((row) => row.day_of_week))) as DayOfWeek[]
      );
      setTimeBlocks([{ start_time: '', end_time: '' }]);
      setTitle('');
      setDescription('');
      setDealText('');
      setSpecialPrice('');
      setNotes('');
    } else {
      populateSharedScheduleFormFromRows(
        targetScheduleType,
        rows,
        targetVenueRuleKind
      );
    }

    setSaveMode('append');
    setScheduleMessage(
      successMessage ??
        `Loaded ${getScheduleTypeLabel(targetScheduleType)} for ${Array.from(
          new Set(rows.map((row) => row.day_of_week))
        ).join(', ')}.`
    );
    setScheduleError(null);
  }

  function loadDayIntoForm(day: DayOfWeek) {
    const rules = getPortalExistingScheduleRowsForEdit(venue, scheduleType, venueRuleKind).filter(
      (rule) => rule.day_of_week === day
    );
    const periods = getExistingHours(venue, scheduleType)?.[day] ?? [];
    setPortalEditTarget('schedule');
    setPortalMode('edit');
    setSelectedDays([day]);
    if (rules.length > 0) {
      setLoadedScheduleRowsSnapshot(sortPortalExistingPreviewRows(rules));
      if (isDealScheduleType(scheduleType)) {
        populateDealItemsFromRows(rules);
      } else {
        populateSharedScheduleFormFromRows(scheduleType, rules, venueRuleKind);
      }
      setSaveMode('append');
      setScheduleMessage(
        `Loaded ${getScheduleTypePickerLabel(scheduleType, venueRuleKind)} for ${DAY_OPTIONS.find((option) => option.value === day)?.label}.`
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
    setSpecialPrice('');
    setNotes('');
    setDealItems([createBlankDealItem()]);
    setLoadedScheduleRowsSnapshot([]);
    setVenueRuleKind('kid');
    setHappyHourForm(blankHappyHourForm());
    setSaveMode(periods.length ? 'replace' : 'append');
    setScheduleMessage(
      periods.length
        ? `Loaded ${getScheduleTypeLabel(scheduleType).toLowerCase()} for ${DAY_OPTIONS.find((option) => option.value === day)?.label}.`
        : `No saved ${getScheduleTypeLabel(scheduleType).toLowerCase()} found for ${DAY_OPTIONS.find((option) => option.value === day)?.label}.`
    );
    setScheduleError(null);
  }

  useEffect(() => {
    if (!isDealScheduleType(scheduleType)) return;

    const nextDays = Array.from(
      new Set(dealItems.flatMap((item) => item.selectedDays))
    ) as DayOfWeek[];

    setSelectedDays((current) => {
      if (
        current.length === nextDays.length &&
        current.every((day) => nextDays.includes(day))
      ) {
        return current;
      }
      return nextDays;
    });
  }, [dealItems, scheduleType]);

  useEffect(() => {
    if (isDealScheduleType(scheduleType)) return;
    if (!loadedScheduleRowsSnapshot.length) return;

    const scopedRows = loadedScheduleRowsSnapshot.filter((row) =>
      selectedDays.includes(row.day_of_week)
    );

    if (!selectedDays.length || !scopedRows.length) {
      setTimeBlocks([{ start_time: '', end_time: '' }]);
      setTitle('');
      setDescription('');
      setDealText('');
      setSpecialPrice('');
      setNotes('');
      if (scheduleType === 'happy_hour') {
        setHappyHourForm(blankHappyHourForm());
      }
      return;
    }

    populateSharedScheduleFormFromRows(scheduleType, scopedRows, venueRuleKind, {
      preserveSelectedDays: true,
    });
  }, [loadedScheduleRowsSnapshot, scheduleType, selectedDays, venueRuleKind]);

  function openPortalVenueEditor() {
    setVenueSaveMessage(null);
    setVenueSaveError(null);
    setPortalEditTarget('venue');
    setPortalMode('edit');
  }

  function backToPortalOverview() {
    setPortalMode('overview');
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
          sport_notes: String(result.venue?.sport_notes ?? current.sport_notes ?? ''),
          dog_friendly:
            result.venue?.dog_friendly != null
              ? normalizeBooleanFlag(result.venue.dog_friendly)
              : current.dog_friendly,
          dog_friendly_notes: String(
            result.venue?.dog_friendly_notes ?? current.dog_friendly_notes ?? ''
          ),
          kid_friendly:
            result.venue?.kid_friendly != null
              ? normalizeBooleanFlag(result.venue.kid_friendly)
              : current.kid_friendly,
          kid_friendly_notes: String(
            result.venue?.kid_friendly_notes ?? current.kid_friendly_notes ?? ''
          ),
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
    if (isDealScheduleType(scheduleType)) {
      const activeDealItems = dealItems.filter(
        (item) =>
          item.selectedDays.length > 0 ||
          item.timeBlocks.some((block) => block.start_time.trim() || block.end_time.trim()) ||
          item.title.trim() ||
          item.dealText.trim() ||
          item.description.trim() ||
          item.notes.trim() ||
          item.specialPrice.trim()
      );

      if (!activeDealItems.length) {
        setScheduleError('Please add at least one special item.');
        return;
      }

      const selectedDealDays = Array.from(
        new Set(activeDealItems.flatMap((item) => item.selectedDays))
      ) as DayOfWeek[];

      if (!selectedDealDays.length) {
        setScheduleError('Please select at least one day on a special item.');
        return;
      }

      const rows = [];

      for (const item of activeDealItems) {
        if (!item.selectedDays.length) {
          setScheduleError('Each special item needs at least one day selected.');
          return;
        }

        const cleanedItemTimeBlocks = item.timeBlocks
          .map((block) => ({
            start_time: block.start_time.trim(),
            end_time: block.end_time.trim(),
          }))
          .filter((block) => block.start_time && block.end_time);

        if (!cleanedItemTimeBlocks.length) {
          setScheduleError('Each special item needs at least one valid time block.');
          return;
        }

        if (cleanedItemTimeBlocks.some((block) => block.start_time === block.end_time)) {
          setScheduleError('Start and end time cannot be the same.');
          return;
        }

        if (!item.title.trim()) {
          setScheduleError('Please enter a title for each special item.');
          return;
        }

        let structuredItemPrice: number | null = null;
        try {
          structuredItemPrice = parseStructuredPriceInput(item.specialPrice);
        } catch (error) {
          setScheduleError(
            error instanceof Error ? error.message : 'Special price must be a valid number.'
          );
          return;
        }

        const detailJson = normalizeScheduleRuleDetailJson({
          special_price: structuredItemPrice,
        });

        for (const day of item.selectedDays) {
          for (const [index, block] of cleanedItemTimeBlocks.entries()) {
            rows.push({
              venue_id: venueId,
              schedule_type: scheduleType,
              day_of_week: day,
              start_time: block.start_time,
              end_time: block.end_time,
              sort_order: index + 1,
              title: item.title.trim() || null,
              description: item.description.trim() || null,
              deal_text: item.dealText.trim() || null,
              notes: item.notes.trim() || null,
              detail_json: detailJson,
              is_active: true,
              status: 'published',
            });
          }
        }
      }

      setSavingSchedule(true);
      try {
        await portalAuthedFetch(`/api/portal/venues/${venueId}/schedules`, {
          method: 'POST',
          body: JSON.stringify({
            action: 'save',
            rows,
            scheduleType,
            saveMode,
            selectedDays: selectedDealDays,
          }),
        });
        setScheduleMessage(`Saved ${getScheduleTypeLabel(scheduleType).toLowerCase()}.`);
        appendActivity(
          'Saved schedule',
          `${getScheduleTypePickerLabel(scheduleType, venueRuleKind)} for ${selectedDealDays.length} day${selectedDealDays.length === 1 ? '' : 's'} across ${activeDealItems.length} item${activeDealItems.length === 1 ? '' : 's'}.`
        );
        resetScheduleForm();
        await loadVenue(true);
      } catch (error) {
        setScheduleError(error instanceof Error ? error.message : 'Failed to save schedule.');
      } finally {
        setSavingSchedule(false);
      }
      return;
    }
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
    let structuredSpecialPrice: number | null = null;
    if (scheduleType === 'daily_special' || scheduleType === 'lunch_special') {
      try {
        structuredSpecialPrice = parseStructuredPriceInput(specialPrice);
      } catch (error) {
        setScheduleError(
          error instanceof Error ? error.message : 'Special price must be a valid number.'
        );
        return;
      }
    }
    const happyHourDetailJson =
      scheduleType === 'happy_hour' ? buildHappyHourDetailJson(happyHourForm) : null;
    const venueRuleDetailJson =
      scheduleType === 'venue_rule' ? normalizeScheduleRuleDetailJson({ rule_kind: venueRuleKind }) : null;
    const specialDetailJson =
      scheduleType === 'daily_special' || scheduleType === 'lunch_special'
        ? normalizeScheduleRuleDetailJson({ special_price: structuredSpecialPrice })
        : null;
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
        detail_json: happyHourDetailJson ?? venueRuleDetailJson ?? specialDetailJson,
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
        `${getScheduleTypePickerLabel(scheduleType, venueRuleKind)} for ${selectedDays.length} day${selectedDays.length === 1 ? '' : 's'} with ${cleanedTimeBlocks.length} block${cleanedTimeBlocks.length === 1 ? '' : 's'}.`
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
        `${getScheduleTypePickerLabel(scheduleType, venueRuleKind)} removed for ${selectedDays.length} selected day${selectedDays.length === 1 ? '' : 's'}.`
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
  const currentRules = useMemo(
    () =>
      getLiveRules(venue, scheduleType).filter((rule) => {
        if (scheduleType !== 'venue_rule') return true;
        return (
          (normalizeScheduleRuleDetailJson(rule.detail_json)?.rule_kind ?? 'kid') ===
          venueRuleKind
        );
      }),
    [venue, scheduleType, venueRuleKind]
  );
  const currentEditRows = useMemo(
    () =>
      getPortalExistingScheduleRowsForEdit(venue, scheduleType, venueRuleKind).filter(
        (row) => selectedDays.length === 0 || selectedDays.includes(row.day_of_week)
      ),
    [venue, scheduleType, selectedDays, venueRuleKind]
  );
  const effectiveSelectedDays = isDealScheduleType(scheduleType)
    ? (Array.from(new Set(dealItems.flatMap((item) => item.selectedDays))) as DayOfWeek[])
    : selectedDays;
  const effectiveTimeBlockCount = isDealScheduleType(scheduleType)
    ? dealItems.reduce(
        (count, item) =>
          count +
          item.timeBlocks.filter(
            (block) => block.start_time.trim() && block.end_time.trim()
          ).length,
        0
      )
    : timeBlocks.filter((block) => block.start_time.trim() && block.end_time.trim()).length;
  const scheduleImpactMessage =
    saveMode === 'replace'
      ? `You are replacing: ${getScheduleTypePickerLabel(scheduleType, venueRuleKind)}. Existing rows for the selected days will be removed and replaced when you save.`
      : `You are editing: ${getScheduleTypePickerLabel(scheduleType, venueRuleKind)}. Existing rows are loaded below, and any new rows you add will be saved alongside your updates.`;
  const liveEventCount = useMemo(
    () =>
      EVENT_SCHEDULE_TYPES.reduce(
        (count, scheduleType) => count + getLiveRules(venue, scheduleType).length,
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
  const portalOverviewDaySummaries = useMemo(
    () => (venue ? buildPortalVenueDaySummaries(venue) : []),
    [venue]
  );
  const portalOverviewCards = useMemo<PortalOverviewCard[]>(() => {
    if (!venue) return [];

    const hourLines = portalOverviewDaySummaries.flatMap((summary) =>
      [
        summary.opening !== 'None' ? `${summary.day.toUpperCase()}: Opening ${summary.opening}` : null,
        summary.kitchen !== 'None' ? `${summary.day.toUpperCase()}: Kitchen ${summary.kitchen}` : null,
        summary.happyHour !== 'None'
          ? `${summary.day.toUpperCase()}: Happy hour ${summary.happyHour}`
          : null,
        summary.bottleShop !== 'None'
          ? `${summary.day.toUpperCase()}: Bottle shop ${summary.bottleShop}`
          : null,
      ].filter((line): line is string => Boolean(line))
    );
    const dealLines = portalOverviewDaySummaries.flatMap((summary) => summary.deals);
    const eventLines = portalOverviewDaySummaries.flatMap((summary) => summary.events);
    const venueRuleLines = portalOverviewDaySummaries.flatMap((summary) => summary.venueRules);

    return [
      {
        title: 'Hours',
        description: 'Opening, kitchen, happy hour, and bottle shop coverage.',
        lines: takePortalOverviewPreviewLines(hourLines),
      },
      {
        title: 'Deals',
        description: 'Daily and lunch specials currently configured.',
        lines: takePortalOverviewPreviewLines(dealLines),
      },
      {
        title: 'Events',
        description: 'Live event rows set up across the week.',
        lines: takePortalOverviewPreviewLines(eventLines),
      },
      {
        title: 'Venue rules',
        description: 'Kid and dog access rules with public-facing summaries.',
        lines: takePortalOverviewPreviewLines(venueRuleLines),
      },
    ];
  }, [portalOverviewDaySummaries, venue]);
  const portalVenueSummaryLines = useMemo(
    () =>
      [
        venue?.address?.trim() ? venue.address.trim() : null,
        venue?.phone?.trim() ? `Phone: ${venue.phone.trim()}` : null,
        venue?.website_url?.trim() ? 'Website linked' : null,
        venue?.instagram_url?.trim() ? 'Instagram linked' : null,
        venue?.sport_types?.trim() ? `Sport: ${venue.sport_types.trim()}` : null,
        venue?.sport_notes?.trim() ? `Sport notes: ${venue.sport_notes.trim()}` : null,
        venue?.dog_friendly ? 'Dog friendly enabled' : null,
        venue?.dog_friendly_notes?.trim()
          ? `Dog notes: ${venue.dog_friendly_notes.trim()}`
          : null,
        venue?.kid_friendly ? 'Kid friendly enabled' : null,
        venue?.kid_friendly_notes?.trim()
          ? `Kid notes: ${venue.kid_friendly_notes.trim()}`
          : null,
      ].filter((line): line is string => Boolean(line)),
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
    return <div className="portal-shell min-h-screen bg-neutral-950 px-4 py-5 text-white sm:px-6 sm:py-8"><div className="portal-surface mx-auto max-w-6xl rounded-3xl border p-5 text-sm text-white/70 sm:p-6">Loading venue workspace...</div></div>;
  }

  if (errorMessage || !venue) {
    return <div className="portal-shell min-h-screen bg-neutral-950 px-4 py-5 text-white sm:px-6 sm:py-8"><div className="mx-auto max-w-6xl rounded-3xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100 sm:p-6">{errorMessage ?? 'Venue not found.'}</div></div>;
  }

  return (
    <div className="portal-shell min-h-screen bg-neutral-950 px-4 py-5 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
          <Link href="/portal" className="text-sm text-orange-200 hover:text-orange-100">Back to portal</Link>
          <Link href={venue ? buildPublicVenueHref(venue) : '/venues'} className="portal-ghost-button inline-flex min-h-[40px] items-center whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-semibold">View this venue on website</Link>
        </div>

        {activePortalTask ? (
          <div className="mb-6 rounded-2xl border border-orange-300/25 bg-orange-500/10 px-4 py-3 text-sm text-orange-50">
            <div className="font-semibold">Working on it</div>
            <div className="mt-1 text-orange-100/85">
              {activePortalTask}. Please wait for the confirmation message before moving on.
            </div>
          </div>
        ) : null}

        <section className="portal-surface rounded-[24px] border p-4 sm:rounded-[28px] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300/80">{getVenueTypeLabel(venue)}</div>
              <h1 className="mt-2 text-[1.6rem] font-semibold tracking-tight sm:text-3xl">{venue.name ?? 'Untitled venue'}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-white/58">
                {venue.suburb ? <span className="portal-surface-subtle rounded-full border px-3 py-1">{venue.suburb}</span> : null}
                <span className="portal-surface-subtle rounded-full border px-3 py-1">{role ?? 'manager'}</span>
              </div>
            </div>
            <div className="portal-surface-subtle rounded-2xl border px-3.5 py-3 text-sm text-white/78">
              <div>{venue.address ?? 'No address listed yet'}</div>
              {venue.phone ? <div className="mt-2">{venue.phone}</div> : null}
              {venue.website_url ? <a href={venue.website_url} target="_blank" rel="noreferrer" className="mt-2 block text-orange-200 hover:text-orange-100">Website</a> : null}
              {normalizeInstagramUrl(venue.instagram_url) ? <a href={normalizeInstagramUrl(venue.instagram_url) ?? undefined} target="_blank" rel="noreferrer" className="mt-2 block text-orange-200 hover:text-orange-100">Instagram</a> : null}
            </div>
          </div>
        </section>

        {!isPortalEditMode ? (
          <>
            <section className="mt-4 grid gap-2.5 sm:mt-5 sm:grid-cols-2 xl:grid-cols-4">
              <div className="portal-surface-subtle rounded-2xl border p-3.5">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Venue badges</div>
                <div className="mt-2 text-xl font-semibold">{venueBadgeCount}</div>
              </div>
              <div className="portal-surface-subtle rounded-2xl border p-3.5">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Live event rows</div>
                <div className="mt-2 text-xl font-semibold">{liveEventCount}</div>
              </div>
              <div className="portal-surface-subtle rounded-2xl border p-3.5">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Current focus</div>
                <div className="mt-2 text-sm font-semibold">Overview mode</div>
              </div>
              <div className="portal-surface-subtle rounded-2xl border p-3.5">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Last update</div>
                <div className="mt-2 text-sm font-semibold">
                  {venue.updated_at ? formatPortalTimestamp(venue.updated_at) : 'Not available'}
                </div>
              </div>
            </section>

            <section className="portal-surface mt-6 rounded-3xl border p-4 sm:mt-8 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300/75">
                    Current setup at a glance
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold">Overview mode</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/76">
                    Review what is already configured for this venue, then choose one thing to edit. Overview stays read-only so the workflow stays clear on both desktop and mobile.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => handleScheduleTypeSelection('opening')} className="portal-primary-button rounded-xl border px-4 py-2 text-sm font-semibold">Edit hours</button>
                  <button type="button" onClick={() => handleScheduleTypeSelection('daily_special')} className="portal-ghost-button rounded-xl border px-4 py-2 text-sm font-semibold">Edit deals</button>
                  <button type="button" onClick={() => handleScheduleTypeSelection('trivia')} className="portal-ghost-button rounded-xl border px-4 py-2 text-sm font-semibold">Edit events</button>
                  <button type="button" onClick={() => handleScheduleTypeSelection('venue_rule', 'kid')} className="portal-ghost-button rounded-xl border px-4 py-2 text-sm font-semibold">Edit venue rules</button>
                  <button type="button" onClick={openPortalVenueEditor} className="portal-ghost-button rounded-xl border px-4 py-2 text-sm font-semibold">Edit venue details</button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="portal-surface-subtle rounded-2xl border p-4">
                  <div className="text-sm font-semibold text-white">Venue details</div>
                  <div className="mt-1 text-sm text-white/64">
                    Public-facing details, tags, and rule notes already set on this venue.
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-white/78">
                    {takePortalOverviewPreviewLines(portalVenueSummaryLines, 6).map((line) => (
                      <div key={line} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {portalOverviewCards.map((card) => (
                    <div key={card.title} className="portal-surface-subtle rounded-2xl border p-4">
                      <div className="text-sm font-semibold text-white">{card.title}</div>
                      <div className="mt-1 text-sm text-white/60">{card.description}</div>
                      <div className="mt-4 space-y-2 text-sm text-white/78">
                        {card.lines.map((line) => (
                          <div key={`${card.title}-${line}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <div className="text-sm font-semibold text-white">Weekly snapshot</div>
                <div className="mt-1 text-sm text-white/60">
                  A light summary of what is configured this week, without dropping you into the editor yet.
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {portalOverviewDaySummaries.map((summary) => {
                    const lines = [
                      summary.opening !== 'None' ? `Opening: ${summary.opening}` : null,
                      summary.kitchen !== 'None' ? `Kitchen: ${summary.kitchen}` : null,
                      summary.happyHour !== 'None' ? `Happy hour: ${summary.happyHour}` : null,
                      summary.bottleShop !== 'None' ? `Bottle shop: ${summary.bottleShop}` : null,
                      summary.deals[0] ?? null,
                      summary.events[0] ?? null,
                      summary.venueRules[0] ?? null,
                    ].filter((line): line is string => Boolean(line));

                    return (
                      <div key={summary.day} className="portal-surface-subtle rounded-2xl border p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/75">
                          {DAY_OPTIONS.find((option) => option.value === summary.day)?.label}
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-white/78">
                          {lines.length > 0 ? (
                            lines.map((line) => (
                              <div key={`${summary.day}-${line}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                {line}
                              </div>
                            ))
                          ) : (
                            <div className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-white/48">
                              Nothing configured yet
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="portal-surface mt-6 rounded-3xl border p-4 sm:mt-8 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <button type="button" onClick={backToPortalOverview} className="portal-ghost-button rounded-xl border px-4 py-2 text-sm font-semibold">
                    Back to overview
                  </button>
                  <div className="mt-3 text-2xl font-semibold">{venue.name ?? 'Untitled venue'}</div>
                  <div className="mt-1 text-sm text-white/64">
                    Editing:{' '}
                    {portalEditTarget === 'venue'
                      ? 'Venue details'
                      : getScheduleTypePickerLabel(scheduleType, venueRuleKind)}
                  </div>
                </div>
                <div className="portal-surface-subtle rounded-2xl border px-4 py-3 text-sm text-white/68">
                  {portalEditTarget === 'venue'
                    ? 'Focused venue edit'
                    : 'Focused schedule edit'}
                </div>
              </div>
            </section>

            <section className="mt-6">
              {portalEditTarget === 'venue' ? (
                <div className="portal-surface rounded-3xl border p-4 sm:p-6">
                  <h2 className="text-xl font-semibold">Venue details</h2>
                  <p className="mt-2 text-sm leading-6 text-white/78">Update the public-facing details and venue tags for this venue.</p>
                  <div className="mt-5 space-y-4">
                    <div><label className="mb-1 block text-sm font-medium text-white/85">Venue name</label><input type="text" value={venueForm.name} onChange={(event) => updateVenueForm('name', event.target.value)} className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                    <div><label className="mb-1 block text-sm font-medium text-white/85">Suburb</label><input type="text" value={venueForm.suburb} onChange={(event) => updateVenueForm('suburb', event.target.value)} className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                    <div><label className="mb-1 block text-sm font-medium text-white/85">Address</label><input type="text" value={venueForm.address} onChange={(event) => updateVenueForm('address', event.target.value)} className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                    <div><label className="mb-1 block text-sm font-medium text-white/85">Phone</label><input type="text" value={venueForm.phone} onChange={(event) => updateVenueForm('phone', event.target.value)} className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                    <div><label className="mb-1 block text-sm font-medium text-white/85">Website</label><input type="text" value={venueForm.website_url} onChange={(event) => updateVenueForm('website_url', event.target.value)} className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                    <div><label className="mb-1 block text-sm font-medium text-white/85">Instagram</label><input type="text" value={venueForm.instagram_url} onChange={(event) => updateVenueForm('instagram_url', event.target.value)} placeholder="@venuehandle or https://instagram.com/..." className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                    <div><label className="mb-1 block text-sm font-medium text-white/85">Sport types</label><input type="text" value={venueForm.sport_types} onChange={(event) => updateVenueForm('sport_types', event.target.value)} placeholder="e.g. AFL, NRL, UFC" className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                    <div><label className="mb-1 block text-sm font-medium text-white/85">Sport notes</label><textarea value={venueForm.sport_notes} onChange={(event) => updateVenueForm('sport_notes', event.target.value)} rows={2} placeholder="Optional notes like Sound for marquee games" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-2">
                    <button type="button" onClick={() => updateVenueForm('shows_sport', !venueForm.shows_sport)} className={`rounded-xl border px-3 py-3 text-left ${venueForm.shows_sport ? 'border-orange-300/40 bg-orange-500/10' : 'border-white/10 bg-black/25 hover:bg-white/[0.04]'}`}><div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85">Shows live sport</div><div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/50">{venueForm.shows_sport ? 'Yes' : 'No'}</div></button>
                    <button type="button" onClick={() => updateVenueForm('plays_with_sound', !venueForm.plays_with_sound)} disabled={!venueForm.shows_sport && !venueForm.plays_with_sound} className={`rounded-xl border px-3 py-3 text-left ${venueForm.plays_with_sound ? 'border-orange-300/40 bg-orange-500/10' : venueForm.shows_sport ? 'border-white/10 bg-black/25 hover:bg-white/[0.04]' : 'border-white/10 bg-black/10 text-white/40'}`}><div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85">Sport with sound</div><div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/50">{!venueForm.shows_sport && !venueForm.plays_with_sound ? 'Enable sport first' : venueForm.plays_with_sound ? 'Yes' : 'No'}</div></button>
                    <button type="button" onClick={() => updateVenueForm('dog_friendly', !venueForm.dog_friendly)} className={`rounded-xl border px-3 py-3 text-left ${venueForm.dog_friendly ? 'border-orange-300/40 bg-orange-500/10' : 'border-white/10 bg-black/25 hover:bg-white/[0.04]'}`}><div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85">Dog friendly</div><div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/50">{venueForm.dog_friendly ? 'Yes' : 'No'}</div></button>
                    <button type="button" onClick={() => updateVenueForm('kid_friendly', !venueForm.kid_friendly)} className={`rounded-xl border px-3 py-3 text-left ${venueForm.kid_friendly ? 'border-orange-300/40 bg-orange-500/10' : 'border-white/10 bg-black/25 hover:bg-white/[0.04]'}`}><div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85">Kid friendly</div><div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/50">{venueForm.kid_friendly ? 'Yes' : 'No'}</div></button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div><label className="mb-1 block text-sm font-medium text-white/85">Dog-friendly notes</label><textarea value={venueForm.dog_friendly_notes} onChange={(event) => updateVenueForm('dog_friendly_notes', event.target.value)} rows={2} placeholder="Optional notes like Beer garden only" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                    <div><label className="mb-1 block text-sm font-medium text-white/85">Kid-friendly notes</label><textarea value={venueForm.kid_friendly_notes} onChange={(event) => updateVenueForm('kid_friendly_notes', event.target.value)} rows={2} placeholder="Optional notes like Kids until 8pm in dining room" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                  </div>
                  {venueSaveMessage ? <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{venueSaveMessage}</div> : null}
                  {venueSaveError ? <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{venueSaveError}</div> : null}
                  <div className="portal-focus-band mt-4 rounded-2xl border border-white/10 bg-[#0f1419]/92 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.28)] sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                    <div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/45 sm:hidden">Save venue</div>
                    <div className="flex flex-wrap gap-2.5">
                      <button type="button" onClick={handleSaveVenue} disabled={savingVenue} className="portal-primary-button min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">{savingVenue ? 'Saving...' : 'Save venue details'}</button>
                      <button type="button" onClick={backToPortalOverview} className="portal-ghost-button min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold">Back to overview</button>
                    </div>
                  </div>
                </div>
              ) : null}

              {portalEditTarget === 'schedule' ? (
                <div className="portal-surface rounded-3xl border p-4 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">Edit schedule</h2>
                      <p className="mt-2 text-sm leading-6 text-white/76">Choose one edit type, update only the relevant fields, then save and return to overview when you are done.</p>
                    </div>
                    <div className="portal-surface-subtle rounded-2xl border px-4 py-3 text-sm text-white/68">{getScheduleTypePickerLabel(scheduleType, venueRuleKind)}</div>
                  </div>

                  <div className="portal-surface-subtle mt-5 rounded-2xl border p-4">
                    <div className="text-sm font-semibold text-white">Ready to save</div>
                    <div className="mt-1 text-xs text-white/62">
                      Review the impact below before saving or deleting anything.
                    </div>
                    <div className="mt-3 grid gap-3 text-sm text-white/76 md:grid-cols-2">
                      <div><span className="font-medium text-white">Schedule type:</span> {getScheduleTypePickerLabel(scheduleType, venueRuleKind)}</div>
                      <div><span className="font-medium text-white">Existing rows:</span> {saveMode === 'replace' ? 'Replace all' : 'Edit existing'}</div>
                      <div><span className="font-medium text-white">Venue:</span> {venue.name ?? 'Untitled venue'}</div>
                      <div><span className="font-medium text-white">Days:</span> {effectiveSelectedDays.length ? effectiveSelectedDays.join(', ') : 'No days selected'}</div>
                      <div><span className="font-medium text-white">Time blocks entered:</span> {effectiveTimeBlockCount}</div>
                    </div>
                    <div
                      className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                        saveMode === 'replace'
                          ? 'border border-amber-300/30 bg-amber-400/10 text-amber-50'
                          : 'border border-sky-300/30 bg-sky-400/10 text-sky-50'
                      }`}
                    >
                      {scheduleImpactMessage}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-2 text-sm font-semibold text-white">What do you want to update?</div>
                      <div className="text-xs text-white/55">Choose one edit type, then work in the focused form below.</div>
                      <div className="mt-3">
                        <GroupedScheduleTypeSelector
                          scheduleType={scheduleType}
                          venueRuleKind={venueRuleKind}
                          onSelect={handleScheduleTypeSelection}
                          variant="portal"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-white/82">Mode</label>
                      <PortalSelect
                        value={saveMode}
                        options={[
                          { value: 'append', label: 'Edit existing' },
                          { value: 'replace', label: 'Replace all' },
                        ]}
                        onChange={setSaveMode}
                      />
                      <div className="mt-2 text-xs text-white/56">
                        {saveMode === 'replace'
                          ? 'Best when you want the selected days to exactly match the rows below and remove older matching rows.'
                          : 'Best when you want to load what already exists, adjust it safely, and add new rows if needed.'}
                      </div>
                    </div>
                  </div>

                  <div className="portal-surface-subtle mt-4 rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Existing data loaded</h3>
                        <p className="mt-1 text-xs text-white/62">
                          {currentEditRows.length
                            ? 'These current live rows are already loaded into the form as your starting point.'
                            : 'No live rows were found for this edit type yet, so you are starting with a fresh form.'}
                        </p>
                      </div>
                      <div className="portal-surface rounded-xl border px-3 py-2 text-xs text-white/66">
                        {getScheduleTypePickerLabel(scheduleType, venueRuleKind)}
                      </div>
                    </div>
                    {currentEditRows.length ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {currentEditRows.map((row) => {
                          const summary =
                            row.title?.trim() ||
                            row.deal_text?.trim() ||
                            row.description?.trim() ||
                            row.notes?.trim() ||
                            '';
                          return (
                            <div
                              key={`${row.id}-${row.day_of_week}-${row.start_time}-${row.end_time}`}
                              className="portal-surface rounded-xl border p-3 text-sm"
                            >
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/75">
                                {DAY_OPTIONS.find((option) => option.value === row.day_of_week)?.label ?? row.day_of_week}
                              </div>
                              <div className="mt-1 font-medium text-white">
                                {row.start_time}-{row.end_time}
                              </div>
                              {summary ? (
                                <div className="mt-1 text-xs text-white/62">{summary}</div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  {!isDealScheduleType(scheduleType) ? (
                  <>
                  <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
                    <button type="button" onClick={() => setDaysPreset('weekdays')} className="portal-ghost-button rounded-xl border px-3 py-2 text-sm">Mon-Fri</button>
                    <button type="button" onClick={() => setDaysPreset('weekend')} className="portal-ghost-button rounded-xl border px-3 py-2 text-sm">Weekend</button>
                    <button type="button" onClick={() => setDaysPreset('all')} className="portal-ghost-button rounded-xl border px-3 py-2 text-sm">All days</button>
                    <button type="button" onClick={() => setDaysPreset('clear')} className="portal-ghost-button rounded-xl border px-3 py-2 text-sm">Clear days</button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
                    {DAY_OPTIONS.map((day) => {
                      const active = selectedDays.includes(day.value);
                      return <button key={day.value} type="button" onClick={() => toggleDay(day.value)} className={`min-h-[42px] rounded-xl border px-3 py-2 text-sm font-semibold ${active ? 'border-orange-400 bg-orange-500 text-black shadow-[0_0_0_2px_rgba(251,146,60,0.22)]' : 'portal-ghost-button'}`} aria-pressed={active}>{active ? `Selected ${day.label}` : day.label}</button>;
                    })}
                  </div>
                  </>
                  ) : null}

                  <div className="portal-surface-subtle mt-4 rounded-2xl border p-4 sm:mt-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Current saved entries</h3>
                        <p className="mt-1 text-xs text-white/62">
                          Load a saved day straight into the editor before updating deals or times.
                        </p>
                      </div>
                      <div className="portal-surface rounded-xl border px-3 py-2 text-xs text-white/66">
                        {getScheduleTypePickerLabel(scheduleType, venueRuleKind)}
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      {DAY_OPTIONS.map((day) => {
                        const periods = existingHours?.[day.value] ?? [];
                        const dayRules = currentRules.filter((rule) => rule.day_of_week === day.value);
                        const selected = selectedDays.includes(day.value);
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
                            className={`portal-surface rounded-xl border p-3 text-left transition hover:border-orange-300/30 hover:bg-white/[0.02] ${
                              selected
                                ? 'border-orange-300/55 bg-orange-500/[0.12] shadow-[0_0_0_2px_rgba(251,146,60,0.18)]'
                                : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/75">
                                {day.label}
                              </div>
                              {selected ? (
                                <span className="rounded-full border border-orange-300/35 bg-orange-500/18 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-50">
                                  Selected
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-sm font-medium text-white">{summary}</div>
                            <div className="mt-2 text-[11px] text-white/55">
                              {dayRules.length || periods.length
                                ? 'Load this day into editor'
                                : 'Start a new entry for this day'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {!isDealScheduleType(scheduleType) ? (
                  <div className="mt-5 sm:mt-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white/85">Time blocks</div>
                        {isVenueRuleScheduleType(scheduleType) ? (
                          <div className="mt-1 text-xs text-white/56">
                            These times control when the rule is active publicly.
                          </div>
                        ) : null}
                      </div>
                      <button type="button" onClick={addTimeBlock} className="portal-ghost-button rounded-xl border px-3 py-2 text-sm">Add block</button>
                    </div>
                    <div className="space-y-3">
                      {timeBlocks.map((block, index) => (
                        <div key={`${index}-${block.start_time}-${block.end_time}`} className="portal-surface-subtle grid gap-2.5 rounded-2xl border p-3 md:grid-cols-[1fr_1fr_auto]">
                          <input type="time" value={block.start_time} onChange={(event) => updateTimeBlock(index, 'start_time', event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" />
                          <input type="time" value={block.end_time} onChange={(event) => updateTimeBlock(index, 'end_time', event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" />
                          <button type="button" onClick={() => removeTimeBlock(index)} className="portal-danger-button rounded-xl border px-3 py-2 text-sm">Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  ) : null}

                  {isEventScheduleType(scheduleType) ? (
                    <div className="mt-4 grid gap-3 md:mt-5 md:grid-cols-2">
                      <div><label className="mb-1 block text-sm font-medium text-white/82">Title</label><input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={scheduleType === 'daily_special' ? 'e.g. Steak Night' : scheduleType === 'lunch_special' ? 'e.g. Lunch Special' : 'Optional event title'} className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                      <div><label className="mb-1 block text-sm font-medium text-white/82">{isEventScheduleType(scheduleType) ? 'Summary' : 'Deal text / summary'}</label><input type="text" value={dealText} onChange={(event) => setDealText(event.target.value)} placeholder={scheduleType === 'daily_special' ? 'e.g. Parmi + chips $20' : scheduleType === 'lunch_special' ? 'e.g. Lunch special $15' : 'Short event summary for the public card'} className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                    </div>
                  ) : null}
                  {isVenueRuleScheduleType(scheduleType) ? (
                    <div className="mt-4"><label className="mb-1 block text-sm font-medium text-white/82">Public summary</label><input type="text" value={dealText} onChange={(event) => setDealText(event.target.value)} placeholder={venueRuleKind === 'kid' ? 'e.g. Kids until 8pm' : 'e.g. Dogs front bar only'} className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                  ) : null}
                  {scheduleType === 'happy_hour' ? (
                    <div className="mt-4"><label className="mb-1 block text-sm font-medium text-white/82">Deal text / summary</label><input type="text" value={dealText} onChange={(event) => setDealText(event.target.value)} placeholder="e.g. $7 schooners / $15 burgers" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                  ) : null}
                  {(scheduleType === 'daily_special' || scheduleType === 'lunch_special') ? (
                    <DealScheduleItemsEditor
                      items={dealItems}
                      scheduleType={scheduleType}
                      variant="portal"
                      onAddItem={addDealItem}
                      onRemoveItem={removeDealItem}
                      onToggleDay={toggleDealItemDay}
                      onSetDaysPreset={setDealItemDaysPreset}
                      onAddTimeBlock={addDealItemTimeBlock}
                      onRemoveTimeBlock={removeDealItemTimeBlock}
                      onUpdateTimeBlock={updateDealItemTimeBlock}
                      onUpdateField={updateDealItemField}
                    />
                  ) : null}
                  {(!isDealScheduleType(scheduleType) && (isEventScheduleType(scheduleType) || scheduleType === 'happy_hour')) ? (
                    <div className="mt-3.5"><label className="mb-1 block text-sm font-medium text-white/82">Description</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder={isDealScheduleType(scheduleType) ? 'Optional detail for this special or offer' : isEventScheduleType(scheduleType) ? 'Optional event detail for the public card or venue page' : 'Optional happy hour detail if you need more context'} className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                  ) : null}
                  {(!isDealScheduleType(scheduleType) && (isEventScheduleType(scheduleType) || isVenueRuleScheduleType(scheduleType) || scheduleType === 'happy_hour')) ? (
                    <div className="mt-3.5"><label className="mb-1 block text-sm font-medium text-white/82">Notes</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder={isVenueRuleScheduleType(scheduleType) ? 'Optional nuance such as Beer garden only or Front bar only' : 'Optional notes'} className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40" /></div>
                  ) : null}
                  {scheduleType === 'happy_hour' ? (
                    <div className="mt-5 space-y-4">
                      <div className="portal-surface-subtle rounded-2xl border border-orange-300/20 px-4 py-3 text-sm text-orange-50">
                        Add beer, wine, spirits, cocktails, and food items so the public venue page can show structured happy hour deals instead of a single summary line.
                      </div>
                      <div className="grid gap-3.5 xl:grid-cols-2">
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
                        <label className="mb-1 block text-sm font-medium text-white/82">
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

                  <div className="portal-focus-band mt-5 rounded-2xl border border-white/10 bg-[#0f1419]/92 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.28)] sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                    <div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/45 sm:hidden">Save schedule</div>
                    <div className="flex flex-wrap gap-2.5">
                      <button type="button" onClick={handleSaveSchedule} disabled={savingSchedule || clearingSchedule} className="portal-primary-button rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">{savingSchedule ? 'Saving...' : 'Save entry'}</button>
                      <button type="button" onClick={resetScheduleForm} disabled={savingSchedule || clearingSchedule} className="portal-ghost-button rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">Clear form</button>
                      <button type="button" onClick={backToPortalOverview} className="portal-ghost-button rounded-xl border px-4 py-2 text-sm font-semibold">Back to overview</button>
                      <button type="button" onClick={handleDeleteSelectedDays} disabled={savingSchedule || clearingSchedule} className="portal-danger-button rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">{clearingSchedule ? 'Working...' : 'Delete selected days'}</button>
                      <button type="button" onClick={handleDeleteAllForType} disabled={savingSchedule || clearingSchedule} className="portal-danger-button rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">Delete all {getScheduleTypePickerLabel(scheduleType, venueRuleKind)}</button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        )}

        <section className="portal-surface mt-6 rounded-3xl border p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Activity log</h2>
              <p className="mt-1 text-sm leading-6 text-white/68">
                Secondary session history for this venue.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowActivityLog((current) => !current)}
                className="portal-ghost-button min-h-[40px] rounded-xl border px-3 py-2 text-sm"
              >
                {showActivityLog ? 'Hide activity log' : 'Show activity log'}
              </button>
              {showActivityLog ? (
                <button
                  type="button"
                  onClick={() => setActivityEntries([])}
                  className="portal-ghost-button min-h-[40px] rounded-xl border px-3 py-2 text-sm"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div className={`grid transition-[grid-template-rows,opacity] duration-200 ${showActivityLog ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
              {activityEntries.length === 0 ? (
                <div className="portal-surface-subtle rounded-2xl border border-dashed px-4 py-4 text-sm text-white/62">
                  No portal activity recorded yet for this session.
                </div>
              ) : (
                <div className="portal-zebra divide-y divide-white/5 rounded-2xl border border-white/8">
                  {activityEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{entry.action}</div>
                        <div className="text-xs uppercase tracking-[0.18em] text-white/50">
                          {formatPortalTimestamp(entry.timestamp)}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-white/74">{entry.details}</div>
                    </div>
                  ))}
                </div>
              )}
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
    <div className="portal-surface-subtle rounded-2xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{label}</div>
        <button
          type="button"
          onClick={onAdd}
          className="portal-ghost-button rounded-xl border px-3 py-2 text-sm"
        >
          Add item
        </button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-white/58">
          No {label.toLowerCase()} items yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="portal-surface rounded-2xl border p-3">
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
                      className="portal-danger-button rounded-xl border px-3 py-2 text-sm"
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
                  className="portal-ghost-button rounded-xl border px-3 py-2 text-sm"
                >
                  Add price
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="portal-danger-button rounded-xl border px-3 py-2 text-sm"
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
            : 'portal-surface-subtle hover:bg-black/35'
        }`}
      >
        <span>{selectedLabel}</span>
        <span className={`text-xs text-white/60 transition ${open ? 'rotate-180' : ''}`}>
          v
        </span>
      </button>

      {open ? (
        <div className="portal-surface absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-2xl border shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
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




