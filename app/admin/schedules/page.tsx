'use client';

import { useEffect, useMemo, useState } from 'react';
import DealScheduleItemsEditor, {
  type DealScheduleItemDraft,
} from '@/app/components/DealScheduleItemsEditor';
import { GroupedScheduleTypeSelector } from '@/app/components/GroupedScheduleTypeSelector';
import { convertGoogleOpeningHours } from '@/lib/convert-google-hours';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { getVenueProductGuardrails } from '@/lib/venue-product-guardrails';
import {
  type HappyHourDetailItem,
  type HappyHourDetailJson,
  type HappyHourPrice,
  type ScheduleRuleDetailJson,
  getHappyHourItemPrices,
  normalizeHappyHourDetailCategory,
  normalizeHappyHourDetailJson,
  normalizeScheduleRuleDetailJson,
  normalizeVenueSuburb,
} from '@/lib/venue-data';
import {
  getEffectiveKitchenHours,
  isRestaurantOrCafeVenueType,
} from '@/lib/venue-type-rules';
import {
  DAY_OPTIONS,
  EVENT_SCHEDULE_TYPES,
  SCHEDULE_TYPE_OPTIONS,
  getScheduleTypeLabel,
  getScheduleTypePickerLabel,
  isDealScheduleType,
  isEventScheduleType,
  isVenueRuleScheduleType,
  type DayOfWeek,
  type ScheduleType,
  type VenueRuleKind,
} from '@/lib/schedule-rules';

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

type VenueScheduleRule = {
  id: string;
  venue_id: string;
  schedule_type: ScheduleType;
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

type Venue = {
  id: string;
  name: string | null;
  suburb: string | null;
  venue_type_id: string | null;
  status?: string | null;
  updated_at?: string | null;
  google_place_id?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  google_rating?: number | null;
  price_level?: string | null;
  shows_sport?: boolean | null;
  plays_with_sound?: boolean | null;
  sport_types?: string | null;
  sport_notes?: string | null;
  byo_allowed?: boolean | null;
  byo_notes?: string | null;
  dog_friendly?: boolean | null;
  dog_friendly_notes?: string | null;
  kid_friendly?: boolean | null;
  kid_friendly_notes?: string | null;
  opening_hours?: unknown | null;
  kitchen_hours?: OpeningHours | null;
  happy_hour_hours?: OpeningHours | null;
  bottle_shop_hours?: OpeningHours | null;
  venue_schedule_rules?: VenueScheduleRule[] | null;
};

type VenueType = {
  id: string;
  display_name: string;
  raw_value: string;
};

const DEFAULT_ADMIN_VENUE_TYPES: VenueType[] = [
  { id: 'cafe', display_name: 'cafe', raw_value: 'cafe' },
  { id: 'bottle_shop', display_name: 'bottle shop', raw_value: 'bottle_shop' },
];

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

type GoogleSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    rating?: number | null;
    priceLevel?: string | null;
    primaryType?: string | null;
    types?: string[] | null;
  }>;
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
  instagram_url: string;
  google_rating: string;
  price_level: string;
  shows_sport: boolean;
  plays_with_sound: boolean;
  sport_types: string;
  sport_notes: string;
  dog_friendly: boolean;
  dog_friendly_notes: string;
  kid_friendly: boolean;
  kid_friendly_notes: string;
  opening_hours: unknown | null;
};

type AdminActivityStatus = 'success' | 'failure' | 'info';

type AdminActivityEntry = {
  id: string;
  timestamp: string;
  area: 'venues' | 'schedules' | 'google' | 'data';
  action: string;
  status: AdminActivityStatus;
  target: string;
  details: string;
};

type AdminActivityRow = {
  id: string;
  created_at: string;
  area: AdminActivityEntry['area'];
  action: string;
  status: AdminActivityStatus;
  target: string;
  details: string;
};

type VenueAccessEntry = {
  user_id: string;
  venue_id: string;
  role: string | null;
  profiles?:
    | {
        email?: string | null;
        full_name?: string | null;
      }
    | null;
  venues?:
    | {
        name?: string | null;
      }
    | null;
};

type PortalAccessGroup = {
  user_id: string;
  email: string;
  full_name: string | null;
  assignments: VenueAccessEntry[];
};

type ExistingSchedulePreviewRow = {
  id: string;
  source: 'schedule_rule' | 'venue_hours';
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

type VenueDaySummary = {
  day: DayOfWeek;
  opening: string | null;
  kitchen: string | null;
  happyHour: string | null;
  bottleShop: string | null;
  happyHourDetails: string[];
  deals: string[];
  events: Array<{
    scheduleType: ScheduleType;
    summary: string;
  }>;
  venueRules: string[];
};

const CORE_SINGLE_VENUE_TYPES: ScheduleType[] = ['opening', 'kitchen', 'happy_hour', 'bottle_shop'];

const ADMIN_ACTIVITY_LOG_KEY = 'busy-app-admin-activity-log';
const ADMIN_UI_STATE_KEY = 'busy-app-admin-ui-state';
const ADMIN_ACTIVITY_LOG_TABLE = 'admin_activity_logs';

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

function formatVenueTypeId(value: string | null) {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function requiresTitle(type: ScheduleType) {
  return false;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[_-]/g, ' ').trim();
}

function mergeVenueTypeOptions(types: VenueType[]) {
  const merged = new Map<string, VenueType>();

  [...types, ...DEFAULT_ADMIN_VENUE_TYPES].forEach((type) => {
    const key =
      normalizeText(type.raw_value) ||
      normalizeText(type.display_name) ||
      normalizeText(type.id);
    if (!key) return;

    if (!merged.has(key)) {
      merged.set(key, type);
    }
  });

  return Array.from(merged.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name)
  );
}

function findVenueTypeIdByName(
  venueTypes: VenueType[],
  candidateNames: string[]
): string {
  const normalizedCandidates = candidateNames.map((name) => normalizeText(name)).filter(Boolean);

  for (const candidate of normalizedCandidates) {
    const exact = venueTypes.find(
      (type) =>
        normalizeText(type.display_name) === candidate ||
        normalizeText(type.raw_value) === candidate ||
        normalizeText(type.id) === candidate
    );
    if (exact) return exact.id;
  }

  for (const candidate of normalizedCandidates) {
    const partial = venueTypes.find((type) => {
      const haystack = [type.display_name, type.raw_value, type.id]
        .map((value) => normalizeText(value))
        .join(' ');
      return haystack.includes(candidate);
    });
    if (partial) return partial.id;
  }

  return '';
}

function isUuid(value: string | null | undefined) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    (value ?? '').trim()
  );
}

async function ensureVenueTypeExists(
  client: ReturnType<typeof getSupabaseBrowserClient>,
  selectedType: string
) {
  const normalizedType = normalizeText(selectedType);
  const displayName = formatVenueTypeId(selectedType);

  const insertAttempts: Array<Record<string, string>> = [
    { label: displayName },
    { name: normalizedType },
    { title: displayName },
    { venue_type: normalizedType },
    { slug: selectedType },
    { type_name: normalizedType },
    { display_name: displayName },
  ];

  for (const payload of insertAttempts) {
    const { data, error } = await client
      .from('venue_types')
      .insert(payload)
      .select('id')
      .single();

    if (!error && data?.id) {
      return String(data.id);
    }
  }

  return null;
}

function guessVenueTypeIdFromGoogle(
  venueTypes: VenueType[],
  googleTypes: string[] = [],
  venueName = ''
) {
  const normalizedGoogleTypes = googleTypes.map((type) => normalizeText(type));
  const normalizedName = normalizeText(venueName);

  if (
    normalizedGoogleTypes.some((type) =>
      ['liquor store', 'bottle shop', 'wine store', 'beer store'].some((candidate) =>
        type.includes(candidate)
      )
    ) ||
    ['liquorland', 'bws', 'dan murphy', 'bottle-o', 'cellarbration'].some((candidate) =>
      normalizedName.includes(candidate)
    )
  ) {
    const bottleShopId = findVenueTypeIdByName(venueTypes, ['bottle shop', 'bottle_shop']);
    if (bottleShopId) return bottleShopId;
  }

  if (
    normalizedGoogleTypes.some((type) =>
      ['cafe', 'coffee shop'].some((candidate) => type.includes(candidate))
    ) ||
    normalizedName.includes('cafe') ||
    normalizedName.includes('coffee')
  ) {
    const cafeId = findVenueTypeIdByName(venueTypes, ['cafe']);
    if (cafeId) return cafeId;
  }

  return '';
}

function normalizeComparisonText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function getMeaningfulEventTitle(
  scheduleType: ScheduleType,
  title: string | null | undefined
) {
  const trimmed = title?.trim() ?? '';
  if (!trimmed) return null;

  const typeLabel = getScheduleTypeLabel(scheduleType);
  return normalizeComparisonText(trimmed) === normalizeComparisonText(typeLabel)
    ? null
    : trimmed;
}

function getDayLabel(day: DayOfWeek) {
  return DAY_OPTIONS.find((option) => option.value === day)?.label ?? day;
}

function isLiveScheduleRule(row: VenueScheduleRule) {
  if (row.is_active === false) return false;

  const status = row.status?.trim().toLowerCase();
  if (!status) return true;

  return !['draft', 'archived', 'deleted'].includes(status);
}

function getNormalizedVenueHoursForScheduleType(
  venue: Venue,
  currentScheduleType: ScheduleType
): OpeningHours | null {
  if (currentScheduleType === 'opening') {
    return convertGoogleOpeningHours(venue.opening_hours);
  }

  if (currentScheduleType === 'kitchen') {
    return venue.kitchen_hours ?? null;
  }

  if (currentScheduleType === 'happy_hour') {
    return venue.happy_hour_hours ?? null;
  }

  if (currentScheduleType === 'bottle_shop') {
    const liveBottleShopRows = (venue.venue_schedule_rules ?? [])
      .filter(
        (row) => row.schedule_type === 'bottle_shop' && isLiveScheduleRule(row)
      )
      .map((row, index) => ({
        day_of_week: row.day_of_week,
        start_time: row.start_time?.slice(0, 5) ?? '',
        end_time: row.end_time?.slice(0, 5) ?? '',
        sort_order: row.sort_order ?? index,
      }))
      .filter((row) => row.start_time && row.end_time);

    return buildHoursJsonFromRows(liveBottleShopRows);
  }

  return null;
}

function buildExistingPreviewRowsFromHours(
  hours: OpeningHours | null | undefined
): ExistingSchedulePreviewRow[] {
  if (!hours) return [];

  return DAY_OPTIONS.flatMap((day, dayIndex) =>
    (hours[day.value] ?? []).map((period, periodIndex) => ({
      id: `hours-${day.value}-${periodIndex}-${period.open}-${period.close}`,
      source: 'venue_hours' as const,
      day_of_week: day.value,
      start_time: period.open,
      end_time: period.close,
      sort_order: dayIndex * 100 + periodIndex,
      title: null,
      description: null,
      deal_text: null,
      notes: null,
      detail_json: null,
    }))
  );
}

function buildHoursJsonFromRows(
  scheduleRows: Array<{
    day_of_week: DayOfWeek;
    start_time: string;
    end_time: string;
    sort_order?: number | null;
  }>
): OpeningHours | null {
  const output: OpeningHours = {};

  for (const day of DAY_OPTIONS.map((option) => option.value)) {
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

function sortExistingPreviewRows(rows: ExistingSchedulePreviewRow[]) {
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

function getExistingSchedulePreviewRows(
  venue: Venue | null | undefined,
  currentScheduleType: ScheduleType
): ExistingSchedulePreviewRow[] {
  if (!venue) return [];

  const liveRules = (venue.venue_schedule_rules ?? [])
    .filter(
      (row) => row.schedule_type === currentScheduleType && isLiveScheduleRule(row)
    )
    .map((row, index) => ({
      id: row.id ?? `rule-${currentScheduleType}-${row.day_of_week}-${index}`,
      source: 'schedule_rule' as const,
      day_of_week: row.day_of_week,
      start_time: row.start_time?.slice(0, 5) ?? '',
      end_time: row.end_time?.slice(0, 5) ?? '',
      sort_order: row.sort_order ?? index,
      title: row.title ?? null,
      description: row.description ?? null,
      deal_text: row.deal_text ?? null,
      notes: row.notes ?? null,
      detail_json: normalizeScheduleRuleDetailJson(row.detail_json),
    }))
    .filter((row) => row.start_time && row.end_time);

  if (liveRules.length > 0) {
    return sortExistingPreviewRows(liveRules);
  }

  return sortExistingPreviewRows(
    buildExistingPreviewRowsFromHours(
      getNormalizedVenueHoursForScheduleType(venue, currentScheduleType)
    )
  );
}

function getExistingScheduleRowsForEdit(
  venue: Venue | null | undefined,
  currentScheduleType: ScheduleType,
  currentVenueRuleKind?: VenueRuleKind
): ExistingSchedulePreviewRow[] {
  const rows = getExistingSchedulePreviewRows(venue, currentScheduleType);

  if (currentScheduleType !== 'venue_rule') {
    return rows;
  }

  const targetKind = currentVenueRuleKind ?? 'kid';

  return rows.filter((row) => {
    const detailJson = normalizeScheduleRuleDetailJson(row.detail_json);
    return (detailJson?.rule_kind ?? 'kid') === targetKind;
  });
}

function formatPeriodList(periods: OpeningPeriod[] = []): string | null {
  if (!periods.length) return null;
  return periods.map((period) => `${period.open}-${period.close}`).join(', ');
}

function formatHappyHourPriceLabel(price: HappyHourPrice | null | undefined) {
  if (typeof price?.amount !== 'number' || Number.isNaN(price.amount)) return null;
  const amount = `$${price.amount}`;
  return price.label?.trim() ? `${amount} ${price.label.trim()}` : amount;
}

function formatHappyHourRulePreview(rule: VenueScheduleRule) {
  const detailJson = normalizeHappyHourDetailJson(rule.detail_json);

  const detailParts = (
    [
      ['Beer', detailJson?.beer],
      ['Wine', detailJson?.wine],
      ['Spirits', detailJson?.spirits],
      ['Cocktails', detailJson?.cocktails],
      ['Food', detailJson?.food],
    ] as Array<[string, HappyHourDetailItem[] | string | null | undefined]>
  )
    .map(([label, value]) => {
      const entries = normalizeHappyHourDetailCategory(Array.isArray(value) ? value : null) ?? [];
      if (!entries.length) return null;

      const entrySummary = entries
        .map((entry) => {
          const name = entry.name?.trim() || entry.item?.trim() || '';
          const prices = getHappyHourItemPrices(entry)
            .map((price) => formatHappyHourPriceLabel(price))
            .filter((price): price is string => Boolean(price));
          const priceText = prices.length ? ` ${prices.join(', ')}` : '';
          return `${name}${priceText}`.trim();
        })
        .filter(Boolean)
        .join(', ');

      return entrySummary ? `${label}: ${entrySummary}` : null;
    })
    .filter((value): value is string => Boolean(value));

  const fallbackText =
    rule.deal_text?.trim() || rule.description?.trim() || rule.notes?.trim() || null;

  if (detailParts.length > 0) {
    return detailParts.join(' | ');
  }

  return fallbackText;
}

function buildVenueDaySummaries(venue: Venue): VenueDaySummary[] {
  const liveRules = (venue.venue_schedule_rules ?? []).filter(isLiveScheduleRule);
  const normalizedOpeningHours = convertGoogleOpeningHours(venue.opening_hours);

  return DAY_OPTIONS.map((day) => {
    const dayRules = liveRules.filter((rule) => rule.day_of_week === day.value);
    const happyHourDetails = dayRules
      .filter((rule) => rule.schedule_type === 'happy_hour')
      .map((rule) => {
        const time = `${rule.start_time?.slice(0, 5) ?? ''}-${rule.end_time?.slice(0, 5) ?? ''}`;
        const preview = formatHappyHourRulePreview(rule);
        return preview ? `${time} ${preview}` : time;
      })
      .filter(Boolean);
    const eventLines = dayRules
      .filter((rule) => isEventScheduleType(rule.schedule_type))
      .map((rule) => {
        const label = getScheduleTypeLabel(rule.schedule_type);
        const time = `${rule.start_time?.slice(0, 5) ?? ''}-${rule.end_time?.slice(0, 5) ?? ''}`;
        const title =
          getMeaningfulEventTitle(rule.schedule_type, rule.title) ??
          rule.deal_text?.trim() ??
          rule.description?.trim() ??
          '';
        return {
          scheduleType: rule.schedule_type,
          summary: title ? `${label}: ${time} ${title}` : `${label}: ${time}`,
        };
      });
    const dealLines = dayRules
      .filter(
        (rule) =>
          rule.schedule_type === 'daily_special' || rule.schedule_type === 'lunch_special'
      )
      .map((rule) => {
        const label = getScheduleTypeLabel(rule.schedule_type);
        const time = `${rule.start_time?.slice(0, 5) ?? ''}-${rule.end_time?.slice(0, 5) ?? ''}`;
        const text =
          rule.deal_text?.trim() ||
          rule.title?.trim() ||
          rule.description?.trim() ||
          rule.notes?.trim() ||
          '';
        return text ? `${label}: ${time} ${text}` : `${label}: ${time}`;
      });
    const venueRuleLines = dayRules
      .filter((rule) => rule.schedule_type === 'venue_rule')
      .map((rule) => {
        const detailJson = normalizeScheduleRuleDetailJson(rule.detail_json);
        const label = detailJson?.rule_kind === 'dog' ? 'Dog friendly' : 'Kids allowed';
        const time = `${rule.start_time?.slice(0, 5) ?? ''}-${rule.end_time?.slice(0, 5) ?? ''}`;
        const text =
          rule.deal_text?.trim() || rule.notes?.trim() || rule.description?.trim() || '';
        return text ? `${label}: ${time} ${text}` : `${label}: ${time}`;
      });

    return {
      day: day.value,
      opening: formatPeriodList(normalizedOpeningHours?.[day.value] ?? []),
      kitchen: formatPeriodList(venue.kitchen_hours?.[day.value] ?? []),
      happyHour: formatPeriodList(venue.happy_hour_hours?.[day.value] ?? []),
      bottleShop: formatPeriodList(
        getNormalizedVenueHoursForScheduleType(venue, 'bottle_shop')?.[day.value] ?? []
      ),
      happyHourDetails,
      deals: dealLines,
      events: eventLines,
      venueRules: venueRuleLines,
    };
  });
}

function takeOverviewPreviewLines(lines: string[], limit = 3) {
  if (!lines.length) return ['Nothing set up yet'];
  if (lines.length <= limit) return lines;
  return [...lines.slice(0, limit), `+${lines.length - limit} more`];
}

function formatAdminActivityTimestamp(value: string) {
  return new Date(value).toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatVenueUpdatedAt(value: string | null | undefined) {
  if (!value) return 'No recent update';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No recent update';
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });
}

function formatActivityDays(days: DayOfWeek[]) {
  if (!days.length) return 'No days';
  return days.map((day) => getDayLabel(day)).join(', ');
}

function formatActivityTimeBlocks(blocks: TimeBlock[]) {
  if (!blocks.length) return 'No time blocks';
  return blocks.map((block) => `${block.start_time}-${block.end_time}`).join(' | ');
}

function formatScheduleActivityDetails(params: {
  scheduleType: ScheduleType;
  venueIds: string[];
  venues: Venue[];
  selectedDays: DayOfWeek[];
  cleanedTimeBlocks: TimeBlock[];
  saveMode: SaveMode;
  rowsAffected?: number;
  title?: string;
  description?: string;
  dealText?: string;
  notes?: string;
  happyHourDetailJson?: HappyHourDetailJson | null;
}) {
  const venueNames = params.venueIds
    .map((venueId) => params.venues.find((venue) => venue.id === venueId)?.name ?? venueId)
    .join(', ');

  const detailFlags = [
    params.title?.trim() ? `Title: ${params.title.trim()}` : null,
    params.description?.trim() ? `Description: ${params.description.trim()}` : null,
    params.dealText?.trim() ? `Deal: ${params.dealText.trim()}` : null,
    params.notes?.trim() ? `Notes: ${params.notes.trim()}` : null,
    params.happyHourDetailJson ? `HH items captured: Yes` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' | ');

  return [
    `Type: ${getScheduleTypeLabel(params.scheduleType)}`,
    `Mode: ${params.saveMode === 'replace' ? 'Replace all' : 'Edit existing'}`,
    `Venues: ${venueNames || 'None'}`,
    `Days: ${formatActivityDays(params.selectedDays)}`,
    `Times: ${formatActivityTimeBlocks(params.cleanedTimeBlocks)}`,
    typeof params.rowsAffected === 'number'
      ? `Rows: ${params.rowsAffected}`
      : null,
    detailFlags || null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' | ');
}

function diffVenuePayload(
  originalVenue: Venue | null | undefined,
  payload: Record<string, string | number | boolean | OpeningHours | null>
) {
  const fieldLabels: Record<string, string> = {
    name: 'Name',
    suburb: 'Suburb',
    venue_type_id: 'Venue type',
    google_place_id: 'Google Place ID',
    address: 'Address',
    lat: 'Latitude',
    lng: 'Longitude',
    phone: 'Phone',
    website_url: 'Website',
    instagram_url: 'Instagram',
    google_rating: 'Google rating',
    price_level: 'Price level',
    shows_sport: 'Shows live sport',
    plays_with_sound: 'Sport with sound',
    sport_types: 'Sport types',
    sport_notes: 'Sport notes',
    dog_friendly: 'Dog friendly',
    dog_friendly_notes: 'Dog-friendly notes',
    kid_friendly: 'Kid friendly',
    kid_friendly_notes: 'Kid-friendly notes',
    opening_hours: 'Opening hours',
    kitchen_hours: 'Kitchen hours',
  };

  const originalValues: Record<string, unknown> = {
    name: originalVenue?.name ?? null,
    suburb: originalVenue?.suburb ?? null,
    venue_type_id: originalVenue?.venue_type_id ?? null,
    google_place_id: originalVenue?.google_place_id ?? null,
    address: originalVenue?.address ?? null,
    lat: originalVenue?.lat ?? null,
    lng: originalVenue?.lng ?? null,
    phone: originalVenue?.phone ?? null,
    website_url: originalVenue?.website_url ?? null,
    instagram_url: originalVenue?.instagram_url ?? null,
    google_rating: originalVenue?.google_rating ?? null,
    price_level: originalVenue?.price_level ?? null,
    shows_sport: originalVenue?.shows_sport ?? null,
    plays_with_sound: originalVenue?.plays_with_sound ?? null,
    sport_types: originalVenue?.sport_types ?? null,
    sport_notes: originalVenue?.sport_notes ?? null,
    dog_friendly: originalVenue?.dog_friendly ?? null,
    dog_friendly_notes: originalVenue?.dog_friendly_notes ?? null,
    kid_friendly: originalVenue?.kid_friendly ?? null,
    kid_friendly_notes: originalVenue?.kid_friendly_notes ?? null,
    opening_hours: convertGoogleOpeningHours(originalVenue?.opening_hours) ?? null,
    kitchen_hours: originalVenue?.kitchen_hours ?? null,
  };

  return Object.entries(payload)
    .filter(([key, nextValue]) => {
      const prevValue = originalValues[key];
      return JSON.stringify(prevValue) !== JSON.stringify(nextValue);
    })
    .map(([key, nextValue]) => {
      const label = fieldLabels[key] ?? key;
      if (
        key === 'opening_hours' ||
        key === 'kitchen_hours'
      ) {
        return `${label}: updated`;
      }
      return `${label}: ${String(nextValue ?? 'None')}`;
    });
}

async function syncVenueHoursColumn(
  client: ReturnType<typeof getSupabaseBrowserClient>,
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
    const { data, error } = await client
      .from('venue_schedule_rules')
      .select('day_of_week, start_time, end_time, sort_order, is_active, status')
      .eq('venue_id', venueId)
      .eq('schedule_type', currentScheduleType)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    const liveRows = ((data ?? []) as Array<{
      day_of_week: DayOfWeek;
      start_time: string;
      end_time: string;
      sort_order?: number | null;
      is_active?: boolean | null;
      status?: string | null;
    }>).filter((row) => {
      if (row.is_active === false) return false;

      const status = row.status?.trim().toLowerCase();
      if (!status) return true;

      return !['draft', 'archived', 'deleted'].includes(status);
    });

    const hoursJson = buildHoursJsonFromRows(liveRows);

    const { error: updateError } = await client
      .from('venues')
      .update({ [targetColumn]: hoursJson })
      .eq('id', venueId);

    if (updateError) throw updateError;
  }
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
    instagram_url: '',
    google_rating: '',
    price_level: '',
    shows_sport: false,
    plays_with_sound: false,
    sport_types: '',
    sport_notes: '',
    dog_friendly: false,
    dog_friendly_notes: '',
    kid_friendly: false,
    kid_friendly_notes: '',
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const maybeMessage =
      'message' in error && typeof error.message === 'string'
        ? error.message
        : null;
    const maybeDetails =
      'details' in error && typeof error.details === 'string'
        ? error.details
        : null;
    const maybeHint =
      'hint' in error && typeof error.hint === 'string' ? error.hint : null;
    const combined = [maybeMessage, maybeDetails, maybeHint]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(' | ');
    if (combined) return combined;
  }
  return fallback;
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

function getAdminFriendlyErrorMessage(error: unknown, fallback: string) {
  const rawMessage = getErrorMessage(error, fallback);
  const normalized = rawMessage.toLowerCase();
  if (
    normalized.includes('missing admin authorization token') ||
    normalized.includes('invalid or expired admin session')
  ) {
    return 'Your admin session has expired. Sign in again, then retry the action.';
  }
  if (
    normalized.includes('not allowed to perform admin actions') ||
    normalized.includes('status 403')
  ) {
    return 'This account does not have permission to complete that admin action.';
  }
  if (
    normalized.includes('is not a function') ||
    normalized.includes('__turbopack__')
  ) {
    return 'The admin page is using a stale browser bundle. Refresh the page and try again. If it still fails, restart the dev server.';
  }
  if (
    normalized.includes('missing supabase env vars') ||
    normalized.includes('next_public_supabase')
  ) {
    return 'Supabase environment variables are missing. Check `.env.local` and restart the app.';
  }
  if (normalized.includes('duplicate key value')) {
    return 'A matching record already exists. Switch to append or replace the existing rows instead of creating a duplicate.';
  }
  if (
    normalized.includes('invalid input syntax for type uuid') &&
    normalized.includes('bottle_shop')
  ) {
    return 'Bottle Shop is selected, but the `venue_types` table does not have a real Bottle Shop row yet. The admin now tries to create it automatically, but your table schema may need a matching Bottle Shop entry in Supabase.';
  }
  if (
    normalized.includes('invalid input value for enum schedule_type_enum') &&
    normalized.includes('bottle_shop')
  ) {
    return 'Bottle shop hours are enabled in the app, but your Supabase database enum does not include `bottle_shop` yet. Run the SQL in `db/add-bottle-shop-schedule-type.sql`, then try saving again.';
  }
  if (normalized.includes('permission denied') || normalized.includes('row-level security')) {
    return 'This action was blocked by Supabase permissions. Check the table policies for this admin action.';
  }
  return rawMessage;
}

function extractSuburbFromAddress(address: string) {
  if (!address) return '';
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return '';
  const middlePart = parts[1] ?? '';
  return normalizeVenueSuburb(middlePart.replace(/\s+NSW\s+\d{4}$/i, '').trim()) ?? '';
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
  const GOOGLE_DAY_KEYS: Array<DayOfWeek> = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
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

function parseDetailCategoryToItems(
  value?: HappyHourDetailItem[] | string | null
): HappyHourItemForm[] {
  const normalized = normalizeHappyHourDetailCategory(
    Array.isArray(value) ? value : null
  );

  if (!normalized) {
    return [];
  }

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
      if (!name && !description && prices.length === 0) {
        return null;
      }
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

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
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
  const data = (await response.json()) as GoogleSearchResponse;
  return (data.places ?? []).map((place) => ({
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
  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);
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
  const [saveMode, setSaveMode] = useState<SaveMode>('append');
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([
    { start_time: '', end_time: '' },
  ]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dealText, setDealText] = useState('');
  const [specialPrice, setSpecialPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [dealItems, setDealItems] = useState<DealScheduleItemDraft[]>([
    createBlankDealItem(),
  ]);
  const [loadedScheduleRowsSnapshot, setLoadedScheduleRowsSnapshot] = useState<
    ExistingSchedulePreviewRow[]
  >([]);
  const [venueRuleKind, setVenueRuleKind] = useState<VenueRuleKind>('kid');
  const [happyHourForm, setHappyHourForm] = useState<HappyHourFormState>(blankHappyHourForm());
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [clearingSchedule, setClearingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [scheduleErrorMessage, setScheduleErrorMessage] = useState<string | null>(null);
  const [googleQuery, setGoogleQuery] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleResults, setGoogleResults] = useState<GoogleSearchResult[]>([]);
  const [selectedGooglePlaceId, setSelectedGooglePlaceId] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<AdminActivityEntry[]>([]);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [remoteActivityLogEnabled, setRemoteActivityLogEnabled] = useState(false);
  const [venueForm, setVenueForm] = useState<VenueFormState>(blankVenueForm());
  const [savingVenue, setSavingVenue] = useState(false);
  const [venueMessage, setVenueMessage] = useState<string | null>(null);
  const [venueErrorMessage, setVenueErrorMessage] = useState<string | null>(null);
  const [venueAccessRows, setVenueAccessRows] = useState<VenueAccessEntry[]>([]);
  const [portalAccessOverview, setPortalAccessOverview] = useState<VenueAccessEntry[]>([]);
  const [loadingVenueAccess, setLoadingVenueAccess] = useState(false);
  const [venueAccessEmail, setVenueAccessEmail] = useState('');
  const [venueAccessMessage, setVenueAccessMessage] = useState<string | null>(null);
  const [venueAccessError, setVenueAccessError] = useState<string | null>(null);
  const [savingVenueAccess, setSavingVenueAccess] = useState(false);
  const [globalVenueAccessEmail, setGlobalVenueAccessEmail] = useState('');
  const [globalVenueAccessVenueIds, setGlobalVenueAccessVenueIds] = useState<string[]>([]);
  const [globalVenueAccessMessage, setGlobalVenueAccessMessage] = useState<string | null>(null);
  const [globalVenueAccessError, setGlobalVenueAccessError] = useState<string | null>(null);
  const [savingGlobalVenueAccess, setSavingGlobalVenueAccess] = useState(false);
  const [portalUserSearch, setPortalUserSearch] = useState('');
  const [portalUserCurrentVenueOnly, setPortalUserCurrentVenueOnly] = useState(false);
  const [showVenuePickerMobile, setShowVenuePickerMobile] = useState(true);
  const [scheduleWorkspaceArmed, setScheduleWorkspaceArmed] = useState(false);
  const [adminMode, setAdminMode] = useState<'overview' | 'edit'>('overview');

  function requireSupabaseClient() {
    if (!supabase) {
      throw new Error(
        'Missing Supabase env vars. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart npm run dev.'
      );
    }
    return supabase;
  }

  async function adminAuthedFetch<T extends Record<string, unknown>>(
    input: string,
    init?: RequestInit
  ) {
    const client = requireSupabaseClient();
    const {
      data: { session },
      error,
    } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session?.access_token) {
      throw new Error('You must be signed in as an admin to perform this action.');
    }

    const response = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(init?.headers ?? {}),
      },
    });

    const json = (await response.json()) as { ok?: boolean; error?: string } & T;

    if (!response.ok || json?.ok === false) {
      const fallback =
        response.status === 401
          ? 'Your admin session has expired. Sign in again and retry.'
          : response.status === 403
          ? 'This account is not allowed to perform that admin action.'
          : `Request failed with status ${response.status}`;
      throw new Error(json?.error || fallback);
    }

    return json;
  }

  useEffect(() => {
    if (!supabase) {
      setVenues([]);
      setVenueTypes([]);
      setLoadingVenues(false);
      setLoadingVenueTypes(false);
      setVenuesError(
        'Missing Supabase env vars. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart npm run dev.'
      );
      return;
    }
    void loadAdminBootstrap();
    void loadPortalAccessOverview();
    void loadRemoteActivityLog();
  }, [supabase]);

  async function loadAdminBootstrap() {
    setLoadingVenues(true);
    setLoadingVenueTypes(true);
    setVenuesError(null);
    if (!supabase) {
      setVenues([]);
      setVenueTypes([]);
      setLoadingVenues(false);
      setLoadingVenueTypes(false);
      return;
    }

    try {
      const result = await adminAuthedFetch<{
        venues?: Venue[];
        venueTypes?: VenueType[];
        venueTypeError?: string | null;
      }>('/api/admin/venues');

      setVenues(result.venues ?? []);
      setVenueTypes(mergeVenueTypeOptions(result.venueTypes ?? []));

      if (result.venueTypeError) {
        setVenuesError(`Failed to load venue types: ${result.venueTypeError}`);
      }

      appendActivityLog({
        area: 'data',
        action: 'Load venues',
        status: 'success',
        target: 'admin bootstrap',
        details: `Loaded ${(result.venues ?? []).length} venue record${(result.venues ?? []).length === 1 ? '' : 's'} and ${(
          result.venueTypes ?? []
        ).length} venue type${(result.venueTypes ?? []).length === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load admin data.';
      setVenues([]);
      setVenueTypes([]);
      setVenuesError(message);
      appendActivityLog({
        area: 'data',
        action: 'Load venues',
        status: 'failure',
        target: 'admin bootstrap',
        details: message,
      });
    }
    setLoadingVenues(false);
    setLoadingVenueTypes(false);
  }

  const venueTypeNameById = useMemo(() => {
    const map = new Map<string, string>();
    venueTypes.forEach((type) => map.set(type.id, type.display_name));
    return map;
  }, [venueTypes]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ADMIN_ACTIVITY_LOG_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as AdminActivityEntry[];
      if (Array.isArray(parsed)) {
        setActivityLog(parsed);
      }
    } catch {
      setActivityLog([]);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(ADMIN_UI_STATE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<{
        tab: AdminTab;
        search: string;
        selectedVenueIds: string[];
        scheduleType: ScheduleType;
        saveMode: SaveMode;
        showActivityLog: boolean;
      }>;

      if (parsed.tab === 'schedules' || parsed.tab === 'venues') setTab(parsed.tab);
      if (typeof parsed.search === 'string') setSearch(parsed.search);
      if (Array.isArray(parsed.selectedVenueIds)) {
        setSelectedVenueIds(parsed.selectedVenueIds.filter((value): value is string => typeof value === 'string'));
      }
      if (typeof parsed.scheduleType === 'string') {
        const validScheduleType = SCHEDULE_TYPE_OPTIONS.some((option) => option.value === parsed.scheduleType);
        if (validScheduleType) setScheduleType(parsed.scheduleType);
      }
      if (parsed.saveMode === 'append' || parsed.saveMode === 'replace') setSaveMode(parsed.saveMode);
      if (typeof parsed.showActivityLog === 'boolean') setShowActivityLog(parsed.showActivityLog);
    } catch {
      // Ignore storage failures
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(ADMIN_ACTIVITY_LOG_KEY, JSON.stringify(activityLog));
    } catch {
      // Ignore storage failures
    }
  }, [activityLog]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        ADMIN_UI_STATE_KEY,
        JSON.stringify({
          tab,
          search,
          selectedVenueIds,
          scheduleType,
          saveMode,
          showActivityLog,
        })
      );
    } catch {
      // Ignore storage failures
    }
  }, [saveMode, scheduleType, search, selectedVenueIds, showActivityLog, tab]);

  function appendActivityLog(
    entry: Omit<AdminActivityEntry, 'id' | 'timestamp'>
  ) {
    const nextEntry: AdminActivityEntry = {
      id: makeId(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    setActivityLog((current) => [nextEntry, ...current].slice(0, 200));
    if (supabase) {
      void persistActivityLogEntry(nextEntry);
    }
  }

  function clearActivityLog() {
    setActivityLog([]);
    try {
      window.localStorage.removeItem(ADMIN_ACTIVITY_LOG_KEY);
    } catch {
      // Ignore
    }
    if (supabase && remoteActivityLogEnabled) {
      void clearRemoteActivityLog();
    }
  }

  function mapActivityRowToEntry(row: AdminActivityRow): AdminActivityEntry {
    return {
      id: row.id,
      timestamp: row.created_at,
      area: row.area,
      action: row.action,
      status: row.status,
      target: row.target,
      details: row.details,
    };
  }

  async function loadRemoteActivityLog() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from(ADMIN_ACTIVITY_LOG_TABLE)
      .select('id, created_at, area, action, status, target, details')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      setRemoteActivityLogEnabled(false);
      return;
    }
    setRemoteActivityLogEnabled(true);
    const remoteEntries = ((data ?? []) as AdminActivityRow[]).map(mapActivityRowToEntry);
    setActivityLog((current) => {
      const merged = new Map<string, AdminActivityEntry>();
      [...current, ...remoteEntries].forEach((entry) => merged.set(entry.id, entry));
      return Array.from(merged.values())
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, 200);
    });
  }

  async function persistActivityLogEntry(entry: AdminActivityEntry) {
    if (!supabase) return;
    const { error } = await supabase.from(ADMIN_ACTIVITY_LOG_TABLE).insert({
      id: entry.id,
      created_at: entry.timestamp,
      area: entry.area,
      action: entry.action,
      status: entry.status,
      target: entry.target,
      details: entry.details,
    });
    if (!error) {
      setRemoteActivityLogEnabled(true);
    } else {
      setRemoteActivityLogEnabled(false);
    }
  }

  async function clearRemoteActivityLog() {
    if (!supabase) return;
    const { error } = await supabase
      .from(ADMIN_ACTIVITY_LOG_TABLE)
      .delete()
      .not('id', 'is', null);
    if (!error) {
      setRemoteActivityLogEnabled(true);
    } else {
      setRemoteActivityLogEnabled(false);
    }
  }

  function getVenueTargetLabel(venueIds: string[]) {
    if (!venueIds.length) return 'No venues selected';
    const names = venueIds
      .map((venueId) => venues.find((venue) => venue.id === venueId)?.name ?? venueId)
      .filter(Boolean);
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
  }

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

  const venueGuardrailsById = useMemo(
    () =>
      new Map(
        venues.map((venue) => [
          venue.id,
          getVenueProductGuardrails({
            ...venue,
            venue_types: venue.venue_type_id
              ? {
                  id: venue.venue_type_id,
                  label: venueTypeNameById.get(venue.venue_type_id) ?? venue.venue_type_id,
                }
              : null,
          }),
        ])
      ),
    [venueTypeNameById, venues]
  );

  const singleSelectedVenue = useMemo(() => {
    if (selectedVenueIds.length !== 1) return null;
    return venues.find((venue) => venue.id === selectedVenueIds[0]) ?? null;
  }, [selectedVenueIds, venues]);

  const selectedVenuesForSummary = useMemo(() => {
    if (!selectedVenueIds.length) return [];

    const selected = venues.filter((venue) => selectedVenueIds.includes(venue.id));
    return selected.slice(0, 5);
  }, [selectedVenueIds, venues]);

  useEffect(() => {
    if (selectedVenueIds.length === 0) {
      setScheduleWorkspaceArmed(false);
      setAdminMode('overview');
    }
  }, [selectedVenueIds]);

  function toggleVenue(id: string) {
    setScheduleWorkspaceArmed(false);
    setAdminMode('overview');
    setScheduleMessage(null);
    setScheduleErrorMessage(null);
    setSelectedVenueIds((current) =>
      current.includes(id) ? current : [...current, id]
    );
  }

  function toggleVenueCheckbox(id: string) {
    setScheduleWorkspaceArmed(false);
    setAdminMode('overview');
    setScheduleMessage(null);
    setScheduleErrorMessage(null);
    setSelectedVenueIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function selectAllFiltered() {
    const filteredIds = filteredVenues.map((venue) => venue.id);
    setScheduleWorkspaceArmed(false);
    setAdminMode('overview');
    setScheduleMessage(null);
    setScheduleErrorMessage(null);
    setSelectedVenueIds((current) => {
      const set = new Set([...current, ...filteredIds]);
      return Array.from(set);
    });
  }

  function clearFiltered() {
    const filteredIds = new Set(filteredVenues.map((venue) => venue.id));
    setScheduleWorkspaceArmed(false);
    setAdminMode('overview');
    setScheduleMessage(null);
    setScheduleErrorMessage(null);
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
    targetScheduleType: ScheduleType,
    rows: ExistingSchedulePreviewRow[],
    targetVenueRuleKind?: VenueRuleKind
  ) {
    const sortedRows = sortExistingPreviewRows(rows);
    const uniqueDays = Array.from(
      new Set(sortedRows.map((row) => row.day_of_week))
    ) as DayOfWeek[];
    const firstRow = sortedRows[0];
    const mergedDetailJson = normalizeScheduleRuleDetailJson(
      sortedRows.find((row) => row.detail_json)?.detail_json ?? null
    );

    setSelectedDays(uniqueDays);
    setTimeBlocks(
      sortedRows.map((row) => ({
        start_time: row.start_time,
        end_time: row.end_time,
      }))
    );
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

  function populateDealItemsFromRows(rows: ExistingSchedulePreviewRow[]) {
    const sortedRows = sortExistingPreviewRows(rows);
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
  }

  function handleScheduleTypeSelection(
    nextScheduleType: ScheduleType,
    nextVenueRuleKind?: VenueRuleKind
  ) {
    resetScheduleForm();
    setScheduleType(nextScheduleType);
    const targetVenueRuleKind = nextScheduleType === 'venue_rule' ? nextVenueRuleKind ?? 'kid' : 'kid';
    if (nextScheduleType === 'venue_rule') {
      setVenueRuleKind(targetVenueRuleKind);
    }
    setScheduleWorkspaceArmed(true);
    setAdminMode('edit');

    const sourceVenue =
      focusedOverviewVenue ??
      singleSelectedVenue ??
      selectedVenuesForSummary[0] ??
      null;

    const rows = getExistingScheduleRowsForEdit(
      sourceVenue,
      nextScheduleType,
      targetVenueRuleKind
    );

    if (rows.length > 0) {
      loadExistingRowsIntoScheduleForm(
        nextScheduleType,
        rows,
        selectedCount > 1
          ? `Loaded existing ${getScheduleTypePickerLabel(nextScheduleType, targetVenueRuleKind).toLowerCase()} from ${sourceVenue?.name ?? 'the focused venue'} as your edit starting point. Changes will still save to the selected venues.`
          : `Loaded existing ${getScheduleTypePickerLabel(nextScheduleType, targetVenueRuleKind).toLowerCase()} below. Review it, make changes, then save.`,
        targetVenueRuleKind
      );
      return;
    }

    setScheduleErrorMessage(null);
    setScheduleMessage(
      selectedCount > 1
        ? `No existing ${getScheduleTypePickerLabel(nextScheduleType, targetVenueRuleKind).toLowerCase()} was found on ${sourceVenue?.name ?? 'the focused venue'}. Start with a fresh form, then save to the selected venues.`
        : `No existing ${getScheduleTypePickerLabel(nextScheduleType, targetVenueRuleKind).toLowerCase()} was found. Start with a fresh form below.`
    );
  }

  function loadExistingRowsIntoScheduleForm(
    targetScheduleType: ScheduleType,
    rows: ExistingSchedulePreviewRow[],
    successMessage?: string,
    targetVenueRuleKind?: VenueRuleKind
  ) {
    if (!rows.length) {
      setScheduleErrorMessage('No existing rows were found to load.');
      return;
    }

    setScheduleType(targetScheduleType);
    setLoadedScheduleRowsSnapshot(sortExistingPreviewRows(rows));

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
    setScheduleErrorMessage(null);
    setScheduleMessage(
      successMessage ??
        `Loaded ${getScheduleTypeLabel(targetScheduleType)} for ${Array.from(
          new Set(rows.map((row) => row.day_of_week))
        )
          .map((day) => getDayLabel(day))
          .join(', ')}.`
    );
  }

  function handleEditVenueDayForType(
    venue: Venue,
    day: DayOfWeek,
    targetScheduleType: ScheduleType
  ) {
    setScheduleWorkspaceArmed(true);
    setAdminMode('edit');
    setSelectedVenueIds([venue.id]);
    const rows = getExistingSchedulePreviewRows(venue, targetScheduleType).filter(
      (row) => row.day_of_week === day
    );

    if (!rows.length) {
      setScheduleType(targetScheduleType);
      setSelectedDays([day]);
      setTimeBlocks([{ start_time: '', end_time: '' }]);
      setTitle('');
      setDescription('');
      setDealText('');
      setSpecialPrice('');
      setNotes('');
      setVenueRuleKind('kid');
      if (targetScheduleType === 'happy_hour') {
        setHappyHourForm(blankHappyHourForm());
      }
      setSaveMode('append');
      setScheduleErrorMessage(null);
      setScheduleMessage(
        `No existing ${getScheduleTypeLabel(targetScheduleType).toLowerCase()} found for ${venue.name ?? 'this venue'} on ${getDayLabel(day)}. Add it below.`
      );
      return;
    }

    loadExistingRowsIntoScheduleForm(
      targetScheduleType,
      rows,
      `Loaded ${venue.name ?? 'venue'} ${getScheduleTypeLabel(targetScheduleType).toLowerCase()} for ${getDayLabel(day)}. Amend it below, then save.`
    );
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

    populateSharedScheduleFormFromRows(scheduleType, scopedRows, venueRuleKind);
  }, [loadedScheduleRowsSnapshot, scheduleType, selectedDays, venueRuleKind]);


  function updateVenueForm<K extends keyof VenueFormState>(
    field: K,
    value: VenueFormState[K]
  ) {
    setVenueForm((current) => {
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
    });
  }

  function resetVenueForm() {
    setVenueForm(blankVenueForm());
    setSelectedGooglePlaceId(null);
    setGoogleResults([]);
    setGoogleQuery('');
    setVenueMessage(null);
    setVenueErrorMessage(null);
    setGoogleError(null);
    setVenueAccessRows([]);
    setVenueAccessEmail('');
    setVenueAccessMessage(null);
    setVenueAccessError(null);
  }

  async function loadVenueAccess(venueId: string) {
    setLoadingVenueAccess(true);
    setVenueAccessError(null);
    try {
      const result = await adminAuthedFetch<{ rows?: VenueAccessEntry[] }>(
        `/api/admin/venue-access?venueId=${encodeURIComponent(venueId)}`
      );
      setVenueAccessRows(result.rows ?? []);
    } catch (error) {
      setVenueAccessRows([]);
      setVenueAccessError(
        error instanceof Error ? error.message : 'Failed to load venue access.'
      );
    } finally {
      setLoadingVenueAccess(false);
    }
  }

  async function loadPortalAccessOverview() {
    try {
      const result = await adminAuthedFetch<{ rows?: VenueAccessEntry[] }>(
        '/api/admin/venue-access'
      );
      setPortalAccessOverview(result.rows ?? []);
    } catch {
      setPortalAccessOverview([]);
    }
  }

  const portalAccessGroups = useMemo<PortalAccessGroup[]>(() => {
    const grouped = new Map<string, PortalAccessGroup>();

    for (const row of portalAccessOverview) {
      const email = row.profiles?.email?.trim() || row.user_id;
      const key = row.user_id;
      const existing = grouped.get(key);

      if (existing) {
        existing.assignments.push(row);
        continue;
      }

      grouped.set(key, {
        user_id: row.user_id,
        email,
        full_name: row.profiles?.full_name?.trim() || null,
        assignments: [row],
      });
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.email.localeCompare(b.email)
    );
  }, [portalAccessOverview]);

  const filteredPortalAccessOverview = useMemo(() => {
    const searchTerm = portalUserSearch.trim().toLowerCase();

    return portalAccessOverview.filter((row) => {
      if (portalUserCurrentVenueOnly && venueForm.id && row.venue_id !== venueForm.id) {
        return false;
      }

      if (!searchTerm) return true;

      const haystack = [
        row.profiles?.email ?? '',
        row.profiles?.full_name ?? '',
        row.venues?.name ?? '',
        row.role ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchTerm);
    });
  }, [portalAccessOverview, portalUserSearch, portalUserCurrentVenueOnly, venueForm.id]);

  const filteredPortalAccessGroups = useMemo(() => {
    const searchTerm = portalUserSearch.trim().toLowerCase();

    return portalAccessGroups
      .map((group) => ({
        ...group,
        assignments: group.assignments.filter((assignment) => {
          if (
            portalUserCurrentVenueOnly &&
            venueForm.id &&
            assignment.venue_id !== venueForm.id
          ) {
            return false;
          }

          if (!searchTerm) return true;

          const haystack = [
            group.email,
            group.full_name ?? '',
            assignment.venues?.name ?? '',
            assignment.role ?? '',
          ]
            .join(' ')
            .toLowerCase();

          return haystack.includes(searchTerm);
        }),
      }))
      .filter((group) => group.assignments.length > 0);
  }, [portalAccessGroups, portalUserSearch, portalUserCurrentVenueOnly, venueForm.id]);

  function populateVenueFormFromExistingVenue(venue: Venue) {
    setScheduleWorkspaceArmed(false);
    setAdminMode('overview');
    setVenueForm({
      id: venue.id ?? null,
      name: venue.name ?? '',
      suburb: normalizeVenueSuburb(venue.suburb) ?? '',
      venue_type_id: venue.venue_type_id ?? '',
      google_place_id: venue.google_place_id ?? '',
      address: venue.address ?? '',
      lat: venue.lat != null ? String(venue.lat) : '',
      lng: venue.lng != null ? String(venue.lng) : '',
      phone: venue.phone ?? '',
      website_url: venue.website_url ?? '',
      instagram_url: venue.instagram_url ?? '',
      google_rating:
        venue.google_rating != null ? String(venue.google_rating) : '',
      price_level: venue.price_level ?? '',
      shows_sport: normalizeBooleanFlag(venue.shows_sport),
      plays_with_sound: normalizeBooleanFlag(venue.plays_with_sound),
      sport_types: venue.sport_types ?? '',
      sport_notes: venue.sport_notes ?? '',
      dog_friendly: normalizeBooleanFlag(venue.dog_friendly),
      dog_friendly_notes: venue.dog_friendly_notes ?? '',
      kid_friendly: normalizeBooleanFlag(venue.kid_friendly),
      kid_friendly_notes: venue.kid_friendly_notes ?? '',
      opening_hours: convertGoogleOpeningHours(venue.opening_hours) ?? null,
    });
    setTab('venues');
    setVenueMessage(null);
    setVenueErrorMessage(null);
    setVenueAccessMessage(null);
    setVenueAccessError(null);
    void loadVenueAccess(venue.id);
  }

  function focusVenueInScheduleEditor(venue: Venue) {
    setTab('schedules');
    setSelectedVenueIds([venue.id]);
    setScheduleWorkspaceArmed(true);
    setAdminMode('edit');
    setScheduleErrorMessage(null);
    setScheduleMessage(
      `Loaded ${venue.name ?? 'venue'} into the weekly editor. Review existing details below and amend directly.`
    );
  }

  async function handleGoogleSearch() {
    setGoogleError(null);
    setVenueMessage(null);
    setVenueErrorMessage(null);
    if (!googleQuery.trim()) {
      setGoogleError('Please enter a search term.');
      appendActivityLog({
        area: 'google',
        action: 'Search Google Places',
        status: 'failure',
        target: 'Google Places',
        details: 'Please enter a search term.',
      });
      return;
    }
    try {
      setGoogleLoading(true);
      const results = await searchPlacesNew(googleQuery.trim());
      setGoogleResults(results);
      appendActivityLog({
        area: 'google',
        action: 'Search Google Places',
        status: 'success',
        target: googleQuery.trim(),
        details: [
          `Returned ${results.length} result${results.length === 1 ? '' : 's'}.`,
          results.length
            ? `Top results: ${results
                .slice(0, 3)
                .map((result) => result.name)
                .join(', ')}`
            : 'No matches found.',
        ].join(' | '),
      });
    } catch (error: unknown) {
      const message = getAdminFriendlyErrorMessage(error, 'Google search failed.');
      setGoogleError(message);
      setGoogleResults([]);
      appendActivityLog({
        area: 'google',
        action: 'Search Google Places',
        status: 'failure',
        target: googleQuery.trim(),
        details: message,
      });
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
      setVenueForm({
        id: existingMatch?.id ?? null,
        name: place.displayName?.text ?? '',
        suburb: normalizeVenueSuburb(extractSuburbFromAddress(place.formattedAddress ?? '')) ?? '',
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
        instagram_url: existingMatch?.instagram_url ?? '',
        google_rating: place.rating != null ? String(place.rating) : '',
        price_level: place.priceLevel ?? '',
        shows_sport: normalizeBooleanFlag(existingMatch?.shows_sport),
        plays_with_sound: normalizeBooleanFlag(existingMatch?.plays_with_sound),
        sport_types: existingMatch?.sport_types ?? '',
        sport_notes: existingMatch?.sport_notes ?? '',
        dog_friendly: normalizeBooleanFlag(existingMatch?.dog_friendly),
        dog_friendly_notes: existingMatch?.dog_friendly_notes ?? '',
        kid_friendly: normalizeBooleanFlag(existingMatch?.kid_friendly),
        kid_friendly_notes: existingMatch?.kid_friendly_notes ?? '',
        opening_hours: convertGoogleRegularOpeningHoursToOpeningHours(
          place.regularOpeningHours
        ) ?? existingMatch?.opening_hours ?? null,
      });
      if (existingMatch) {
        setVenueMessage(
          `Matched an existing venue record: ${existingMatch.name ?? existingMatch.id}. Review and click save to update it.`
        );
      } else if (guessedVenueTypeId) {
        setVenueMessage(
          `Google place selected. Suggested venue type: ${formatVenueTypeId(guessedVenueTypeId)}. Review fields below, then save.`
        );
      } else {
        setVenueMessage('Google place selected. Review fields below, then save.');
      }
      appendActivityLog({
        area: 'google',
        action: 'Use Google result',
        status: 'success',
        target: place.displayName?.text ?? placeId,
        details: existingMatch
          ? `Matched existing venue ${existingMatch.name ?? existingMatch.id} and loaded latest Google fields into the form.`
          : `Loaded Google place into form. Address: ${place.formattedAddress ?? 'None'} | Phone: ${place.nationalPhoneNumber ?? 'None'} | Website: ${place.websiteUri ?? 'None'}`,
      });
    } catch (error: unknown) {
      const message = getAdminFriendlyErrorMessage(
        error,
        'Failed to load Google place details.'
      );
      setGoogleError(message);
      appendActivityLog({
        area: 'google',
        action: 'Use Google result',
        status: 'failure',
        target: placeId,
        details: message,
      });
    }
  }

  async function handleSaveVenue() {
    setVenueMessage(null);
    setVenueErrorMessage(null);
    if (!venueForm.name.trim()) {
      setVenueErrorMessage('Venue name is required.');
      appendActivityLog({
        area: 'venues',
        action: 'Save venue',
        status: 'failure',
        target: 'Venue form',
        details: 'Venue name required.',
      });
      return;
    }
    if (!venueForm.venue_type_id.trim()) {
      setVenueErrorMessage('Venue type is required.');
      appendActivityLog({
        area: 'venues',
        action: 'Save venue',
        status: 'failure',
        target: venueForm.name.trim(),
        details: 'Venue type required.',
      });
      return;
    }
    setSavingVenue(true);
    try {
      const originalVenue = venueForm.id
        ? venues.find((venue) => venue.id === venueForm.id) ?? null
        : null;
      const venueTypeName =
        venueTypeNameById.get(venueForm.venue_type_id.trim()) ??
        formatVenueTypeId(venueForm.venue_type_id.trim()) ??
        null;
      const openingHours = venueForm.opening_hours ?? null;
      const payloadPreview: Record<string, string | number | boolean | OpeningHours | null> = {
        name: venueForm.name.trim() || null,
        suburb: normalizeVenueSuburb(venueForm.suburb),
        venue_type_id: venueForm.venue_type_id.trim(),
        google_place_id: venueForm.google_place_id.trim() || null,
        address: venueForm.address.trim() || null,
        lat: venueForm.lat.trim() ? Number(venueForm.lat) : null,
        lng: venueForm.lng.trim() ? Number(venueForm.lng) : null,
        phone: venueForm.phone.trim() || null,
        website_url: venueForm.website_url.trim() || null,
        instagram_url: venueForm.instagram_url.trim() || null,
        google_rating: venueForm.google_rating.trim()
          ? Number(venueForm.google_rating)
          : null,
        price_level: venueForm.price_level.trim() || null,
        shows_sport: venueForm.shows_sport,
        plays_with_sound: venueForm.plays_with_sound,
        sport_types: venueForm.sport_types.trim() || null,
        sport_notes: venueForm.sport_notes.trim() || null,
        dog_friendly: venueForm.dog_friendly,
        dog_friendly_notes: venueForm.dog_friendly_notes.trim() || null,
        kid_friendly: venueForm.kid_friendly,
        kid_friendly_notes: venueForm.kid_friendly_notes.trim() || null,
        opening_hours: openingHours,
        kitchen_hours: getEffectiveKitchenHours(
          venueTypeName,
          openingHours,
          originalVenue?.kitchen_hours ?? null
        ),
      };

      const result = await adminAuthedFetch<{
        id?: string | null;
        mode?: 'insert' | 'update';
        venue?: Partial<Venue>;
      }>('/api/admin/venues', {
        method: 'POST',
        body: JSON.stringify({ venue: venueForm }),
      });

      if (result.venue) {
        setVenueForm((current) => ({
          ...current,
          id: String(result.venue?.id ?? result.id ?? current.id ?? ''),
          name: String(result.venue?.name ?? current.name ?? ''),
          suburb: String(result.venue?.suburb ?? current.suburb ?? ''),
          venue_type_id: String(result.venue?.venue_type_id ?? current.venue_type_id ?? ''),
          google_place_id: String(
            result.venue?.google_place_id ?? current.google_place_id ?? ''
          ),
          address: String(result.venue?.address ?? current.address ?? ''),
          lat:
            result.venue?.lat != null
              ? String(result.venue.lat)
              : current.lat,
          lng:
            result.venue?.lng != null
              ? String(result.venue.lng)
              : current.lng,
          phone: String(result.venue?.phone ?? current.phone ?? ''),
          website_url: String(result.venue?.website_url ?? current.website_url ?? ''),
          instagram_url: String(
            result.venue?.instagram_url ?? current.instagram_url ?? ''
          ),
          google_rating:
            result.venue?.google_rating != null
              ? String(result.venue.google_rating)
              : current.google_rating,
          price_level: String(result.venue?.price_level ?? current.price_level ?? ''),
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
          opening_hours:
            result.venue?.opening_hours != null
              ? result.venue.opening_hours
              : current.opening_hours,
        }));
      } else {
        setVenueForm((current) => ({
          ...current,
          id: String(result.id ?? current.id ?? ''),
        }));
      }

      setVenueMessage(
        result.mode === 'update' ? 'Venue updated successfully.' : 'New venue created successfully.'
      );
      appendActivityLog({
        area: 'venues',
        action: 'Save venue',
        status: 'success',
        target: venueForm.name.trim() || String(result.id ?? 'Venue'),
        details:
          result.mode === 'update'
            ? [
                'Updated venue.',
                ...diffVenuePayload(originalVenue, payloadPreview),
                `Kitchen sync: ${isRestaurantOrCafeVenueType(venueTypeName) ? 'Yes' : 'No'}`,
              ].join(' | ')
            : [
                'Created venue.',
                ...Object.entries(payloadPreview).map(([key, value]) =>
                  `${key}: ${key === 'opening_hours' || key === 'kitchen_hours' ? 'set' : String(value ?? 'None')}`
                ),
              ].join(' | '),
      });
      await loadAdminBootstrap();
      await loadPortalAccessOverview();
      if (result.id) {
        await loadVenueAccess(String(result.id));
      }
    } catch (error: unknown) {
      const message = getAdminFriendlyErrorMessage(error, 'Failed to save venue.');
      setVenueErrorMessage(message);
      appendActivityLog({
        area: 'venues',
        action: 'Save venue',
        status: 'failure',
        target: venueForm.name.trim(),
        details: [
          `Error: ${message}`,
          `Attempted name: ${venueForm.name.trim() || 'None'}`,
          `Attempted suburb: ${venueForm.suburb.trim() || 'None'}`,
          `Attempted venue type: ${venueForm.venue_type_id.trim() || 'None'}`,
        ].join(' | '),
      });
    } finally {
      setSavingVenue(false);
    }
  }

  async function handleSaveSchedule() {
    setScheduleMessage(null);
    setScheduleErrorMessage(null);
    if (!selectedVenueIds.length) {
      setScheduleErrorMessage('Please select at least one venue.');
      appendActivityLog({
        area: 'schedules',
        action: 'Save schedule',
        status: 'failure',
        target: 'No venues',
        details: 'Please select at least one venue.',
      });
      return;
    }
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
        setScheduleErrorMessage('Please add at least one special item.');
        return;
      }

      const selectedDealDays = Array.from(
        new Set(activeDealItems.flatMap((item) => item.selectedDays))
      ) as DayOfWeek[];

      if (!selectedDealDays.length) {
        setScheduleErrorMessage('Please select at least one day on a special item.');
        return;
      }

      const rows = [];

      for (const item of activeDealItems) {
        if (!item.selectedDays.length) {
          setScheduleErrorMessage('Each special item needs at least one day selected.');
          return;
        }

        const cleanedItemTimeBlocks = item.timeBlocks
          .map((block) => ({
            start_time: block.start_time.trim(),
            end_time: block.end_time.trim(),
          }))
          .filter((block) => block.start_time && block.end_time);

        if (!cleanedItemTimeBlocks.length) {
          setScheduleErrorMessage('Each special item needs at least one valid time block.');
          return;
        }

        if (cleanedItemTimeBlocks.some((block) => block.start_time === block.end_time)) {
          setScheduleErrorMessage('Start and end time cannot be the same.');
          return;
        }

        if (!item.title.trim()) {
          setScheduleErrorMessage('Please enter a title for each special item.');
          return;
        }

        let structuredItemPrice: number | null = null;
        try {
          structuredItemPrice = parseStructuredPriceInput(item.specialPrice);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Special price must be a valid number.';
          setScheduleErrorMessage(message);
          return;
        }

        const detailJson = normalizeScheduleRuleDetailJson({
          special_price: structuredItemPrice,
        });

        for (const venueId of selectedVenueIds) {
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
      }

      setSavingSchedule(true);
      try {
        await adminAuthedFetch('/api/admin/schedules', {
          method: 'POST',
          body: JSON.stringify({
            action: 'save',
            rows,
            venueIds: selectedVenueIds,
            scheduleType,
            saveMode,
            selectedDays: selectedDealDays,
          }),
        });
        await loadAdminBootstrap();
        setScheduleMessage(
          `Saved ${rows.length} schedule row${rows.length === 1 ? '' : 's'}.`
        );
        appendActivityLog({
          area: 'schedules',
          action: 'Save schedule',
          status: 'success',
          target: getVenueTargetLabel(selectedVenueIds),
          details: [
            `Mode: ${saveMode === 'replace' ? 'Replace all' : 'Edit existing'}`,
            `Days: ${formatActivityDays(selectedDealDays)}`,
            `Items: ${activeDealItems.length}`,
            `Rows affected: ${rows.length}`,
          ].join(' | '),
        });
        resetScheduleForm();
      } catch (error: unknown) {
        const message = getAdminFriendlyErrorMessage(error, 'Failed to save schedule.');
        setScheduleErrorMessage(message);
        appendActivityLog({
          area: 'schedules',
          action: 'Save schedule',
          status: 'failure',
          target: getVenueTargetLabel(selectedVenueIds),
          details: `Error: ${message} | Type: ${getScheduleTypeLabel(scheduleType)} | Days: ${formatActivityDays(selectedDealDays)}`,
        });
      } finally {
        setSavingSchedule(false);
      }
      return;
    }
    if (!selectedDays.length) {
      setScheduleErrorMessage('Please select at least one day.');
      appendActivityLog({
        area: 'schedules',
        action: 'Save schedule',
        status: 'failure',
        target: getVenueTargetLabel(selectedVenueIds),
        details: 'Validation: no days selected.',
      });
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
      appendActivityLog({
        area: 'schedules',
        action: 'Save schedule',
        status: 'failure',
        target: getVenueTargetLabel(selectedVenueIds),
        details: `Validation: no valid time blocks. Days: ${formatActivityDays(selectedDays)}`,
      });
      return;
    }
    for (const block of cleanedTimeBlocks) {
      if (block.start_time === block.end_time) {
        setScheduleErrorMessage('Start and end time cannot be the same.');
        appendActivityLog({
          area: 'schedules',
          action: 'Save schedule',
          status: 'failure',
          target: getVenueTargetLabel(selectedVenueIds),
          details: `Validation: identical start/end time for ${block.start_time}.`,
        });
        return;
      }
    }
    if (requiresTitle(scheduleType) && !title.trim()) {
      setScheduleErrorMessage(
        `Please enter a title for ${scheduleType.replace(/_/g, ' ')}.`
      );
      appendActivityLog({
        area: 'schedules',
        action: 'Save schedule',
        status: 'failure',
        target: getVenueTargetLabel(selectedVenueIds),
        details: `Validation: title required for ${getScheduleTypeLabel(scheduleType)}.`,
      });
      return;
    }
    let structuredSpecialPrice: number | null = null;
    if (scheduleType === 'daily_special' || scheduleType === 'lunch_special') {
      try {
        structuredSpecialPrice = parseStructuredPriceInput(specialPrice);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Special price must be a valid number.';
        setScheduleErrorMessage(message);
        appendActivityLog({
          area: 'schedules',
          action: 'Save schedule',
          status: 'failure',
          target: getVenueTargetLabel(selectedVenueIds),
          details: `Validation: ${message}`,
        });
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
    setSavingSchedule(true);
    try {
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
            detail_json: happyHourDetailJson ?? venueRuleDetailJson ?? specialDetailJson,
            is_active: true,
            status: 'published',
          }))
        )
      );
      await adminAuthedFetch('/api/admin/schedules', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save',
          rows,
          venueIds: selectedVenueIds,
          scheduleType,
          saveMode,
          selectedDays,
        }),
      });
      await loadAdminBootstrap();
      setScheduleMessage(
        `Saved ${rows.length} schedule row${rows.length === 1 ? '' : 's'}.`
      );
      appendActivityLog({
        area: 'schedules',
        action: 'Save schedule',
        status: 'success',
        target: getVenueTargetLabel(selectedVenueIds),
        details: formatScheduleActivityDetails({
          scheduleType,
          venueIds: selectedVenueIds,
          venues,
          selectedDays,
          cleanedTimeBlocks,
          saveMode,
          rowsAffected: rows.length,
          title,
          description,
          dealText:
            scheduleType === 'happy_hour'
              ? (generatedHappyHourSummary ?? dealText.trim())
              : dealText.trim(),
          notes:
            scheduleType === 'happy_hour'
              ? (notes.trim() || happyHourForm.notes.trim())
              : notes.trim(),
          happyHourDetailJson,
        }),
      });
      resetScheduleForm();
    } catch (error: unknown) {
      const message = getAdminFriendlyErrorMessage(error, 'Failed to save schedule.');
      setScheduleErrorMessage(message);
      appendActivityLog({
        area: 'schedules',
        action: 'Save schedule',
        status: 'failure',
        target: getVenueTargetLabel(selectedVenueIds),
        details: [
          `Error: ${message}`,
          formatScheduleActivityDetails({
            scheduleType,
            venueIds: selectedVenueIds,
            venues,
            selectedDays,
            cleanedTimeBlocks,
            saveMode,
            title,
            description,
            dealText:
              scheduleType === 'happy_hour'
                ? (generatedHappyHourSummary ?? dealText.trim())
                : dealText.trim(),
            notes:
              scheduleType === 'happy_hour'
                ? (notes.trim() || happyHourForm.notes.trim())
                : notes.trim(),
            happyHourDetailJson,
          }),
        ].join(' | '),
      });
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleAddVenueAccess() {
    setVenueAccessMessage(null);
    setVenueAccessError(null);

    if (!venueForm.id) {
      setVenueAccessError('Save the venue first before assigning portal access.');
      return;
    }

    if (!venueAccessEmail.trim()) {
      setVenueAccessError('Enter a user email to grant portal access.');
      return;
    }

    setSavingVenueAccess(true);
    try {
      await adminAuthedFetch('/api/admin/venue-access', {
        method: 'POST',
        body: JSON.stringify({
          venueId: venueForm.id,
          email: venueAccessEmail.trim().toLowerCase(),
          role: 'manager',
        }),
      });
      setVenueAccessMessage('Portal access added.');
      setVenueAccessEmail('');
      await loadVenueAccess(venueForm.id);
      await loadPortalAccessOverview();
    } catch (error) {
      setVenueAccessError(
        error instanceof Error ? error.message : 'Failed to add venue access.'
      );
    } finally {
      setSavingVenueAccess(false);
    }
  }

  async function handleRemoveVenueAccess(userId: string, venueIdOverride?: string) {
    const targetVenueId = venueIdOverride ?? venueForm.id ?? '';
    if (!targetVenueId) return;
    setVenueAccessMessage(null);
    setVenueAccessError(null);
    setSavingVenueAccess(true);
    try {
      await adminAuthedFetch('/api/admin/venue-access', {
        method: 'DELETE',
        body: JSON.stringify({
          venueId: targetVenueId,
          userId,
        }),
      });
      setVenueAccessMessage('Portal access removed.');
      if (venueForm.id) {
        await loadVenueAccess(venueForm.id);
      }
      await loadPortalAccessOverview();
    } catch (error) {
      setVenueAccessError(
        error instanceof Error ? error.message : 'Failed to remove venue access.'
      );
    } finally {
      setSavingVenueAccess(false);
    }
  }

  async function handleRemoveAllVenueAccessForUser(
    userId: string,
    venueIds: string[]
  ) {
    if (!venueIds.length) return;

    setVenueAccessMessage(null);
    setVenueAccessError(null);
    setSavingVenueAccess(true);
    try {
      for (const venueId of venueIds) {
        await adminAuthedFetch('/api/admin/venue-access', {
          method: 'DELETE',
          body: JSON.stringify({
            venueId,
            userId,
          }),
        });
      }

      setVenueAccessMessage(
        `Removed portal access from ${venueIds.length} venue${venueIds.length === 1 ? '' : 's'}.`
      );
      if (venueForm.id) {
        await loadVenueAccess(venueForm.id);
      }
      await loadPortalAccessOverview();
    } catch (error) {
      setVenueAccessError(
        error instanceof Error ? error.message : 'Failed to remove portal access.'
      );
    } finally {
      setSavingVenueAccess(false);
    }
  }

  function toggleGlobalVenueAccessVenue(venueId: string) {
    setGlobalVenueAccessVenueIds((current) =>
      current.includes(venueId)
        ? current.filter((item) => item !== venueId)
        : [...current, venueId]
    );
  }

  async function handleAddGlobalVenueAccess() {
    setGlobalVenueAccessMessage(null);
    setGlobalVenueAccessError(null);

    if (!globalVenueAccessEmail.trim()) {
      setGlobalVenueAccessError('Enter a user email first.');
      return;
    }

    if (!globalVenueAccessVenueIds.length) {
      setGlobalVenueAccessError('Select at least one venue to assign.');
      return;
    }

    setSavingGlobalVenueAccess(true);
    try {
      for (const venueId of globalVenueAccessVenueIds) {
        await adminAuthedFetch('/api/admin/venue-access', {
          method: 'POST',
          body: JSON.stringify({
            venueId,
            email: globalVenueAccessEmail.trim().toLowerCase(),
            role: 'manager',
          }),
        });
      }

      setGlobalVenueAccessMessage(
        `Portal access added for ${globalVenueAccessVenueIds.length} venue${globalVenueAccessVenueIds.length === 1 ? '' : 's'}.`
      );
      setGlobalVenueAccessEmail('');
      setGlobalVenueAccessVenueIds([]);
      if (venueForm.id) {
        await loadVenueAccess(venueForm.id);
      }
      await loadPortalAccessOverview();
    } catch (error) {
      setGlobalVenueAccessError(
        error instanceof Error ? error.message : 'Failed to add portal access.'
      );
    } finally {
      setSavingGlobalVenueAccess(false);
    }
  }

  async function handleDeleteSelectedDays() {
    setScheduleMessage(null);
    setScheduleErrorMessage(null);

    if (!selectedVenueIds.length) {
      setScheduleErrorMessage('Please select at least one venue.');
      appendActivityLog({
        area: 'schedules',
        action: 'Delete selected days',
        status: 'failure',
        target: 'No venues',
        details: 'Please select at least one venue.',
      });
      return;
    }

    if (!selectedDays.length) {
      setScheduleErrorMessage('Please select at least one day to delete.');
      appendActivityLog({
        area: 'schedules',
        action: 'Delete selected days',
        status: 'failure',
        target: getVenueTargetLabel(selectedVenueIds),
        details: 'Validation: no days selected for delete.',
      });
      return;
    }

    const confirmed = window.confirm(
      `Delete ${getScheduleTypeLabel(scheduleType).toLowerCase()} for ${formatActivityDays(selectedDays)} on ${selectedVenueIds.length} selected venue${selectedVenueIds.length === 1 ? '' : 's'}?`
    );

    if (!confirmed) {
      appendActivityLog({
        area: 'schedules',
        action: 'Delete selected days',
        status: 'info',
        target: getVenueTargetLabel(selectedVenueIds),
        details: `Cancelled by user. Type: ${getScheduleTypeLabel(scheduleType)} | Days: ${formatActivityDays(selectedDays)}`,
      });
      return;
    }

    setClearingSchedule(true);
    try {
      await adminAuthedFetch('/api/admin/schedules', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete-selected-days',
          venueIds: selectedVenueIds,
          scheduleType,
          selectedDays,
        }),
      });
      await loadAdminBootstrap();

      setScheduleMessage(
        `Deleted ${getScheduleTypeLabel(scheduleType).toLowerCase()} for ${formatActivityDays(selectedDays)}.`
      );
      appendActivityLog({
        area: 'schedules',
        action: 'Delete selected days',
        status: 'success',
        target: getVenueTargetLabel(selectedVenueIds),
        details: `Type: ${getScheduleTypeLabel(scheduleType)} | Days: ${formatActivityDays(selectedDays)} | Venues: ${getVenueTargetLabel(selectedVenueIds)}`,
      });
      resetScheduleForm();
    } catch (error: unknown) {
      const message = getAdminFriendlyErrorMessage(error, 'Failed to delete selected days.');
      setScheduleErrorMessage(message);
      appendActivityLog({
        area: 'schedules',
        action: 'Delete selected days',
        status: 'failure',
        target: getVenueTargetLabel(selectedVenueIds),
        details: `Error: ${message} | Type: ${getScheduleTypeLabel(scheduleType)} | Days: ${formatActivityDays(selectedDays)}`,
      });
    } finally {
      setClearingSchedule(false);
    }
  }

  async function handleDeleteAllForScheduleType() {
    setScheduleMessage(null);
    setScheduleErrorMessage(null);

    if (!selectedVenueIds.length) {
      setScheduleErrorMessage('Please select at least one venue.');
      appendActivityLog({
        area: 'schedules',
        action: 'Delete all for type',
        status: 'failure',
        target: 'No venues',
        details: 'Please select at least one venue.',
      });
      return;
    }

    const confirmed = window.confirm(
      `Delete all ${getScheduleTypeLabel(scheduleType).toLowerCase()} rows for ${selectedVenueIds.length} selected venue${selectedVenueIds.length === 1 ? '' : 's'}?`
    );

    if (!confirmed) {
      appendActivityLog({
        area: 'schedules',
        action: 'Delete all for type',
        status: 'info',
        target: getVenueTargetLabel(selectedVenueIds),
        details: `Cancelled by user. Type: ${getScheduleTypeLabel(scheduleType)}`,
      });
      return;
    }

    setClearingSchedule(true);
    try {
      await adminAuthedFetch('/api/admin/schedules', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete-all',
          venueIds: selectedVenueIds,
          scheduleType,
        }),
      });
      await loadAdminBootstrap();

      setScheduleMessage(
        `Deleted all ${getScheduleTypeLabel(scheduleType).toLowerCase()} rows for the selected venue${selectedVenueIds.length === 1 ? '' : 's'}.`
      );
      appendActivityLog({
        area: 'schedules',
        action: 'Delete all for type',
        status: 'success',
        target: getVenueTargetLabel(selectedVenueIds),
        details: `Type: ${getScheduleTypeLabel(scheduleType)} | Venues: ${getVenueTargetLabel(selectedVenueIds)}`,
      });
      resetScheduleForm();
    } catch (error: unknown) {
      const message = getAdminFriendlyErrorMessage(error, 'Failed to delete all rows for this type.');
      setScheduleErrorMessage(message);
      appendActivityLog({
        area: 'schedules',
        action: 'Delete all for type',
        status: 'failure',
        target: getVenueTargetLabel(selectedVenueIds),
        details: `Error: ${message} | Type: ${getScheduleTypeLabel(scheduleType)}`,
      });
    } finally {
      setClearingSchedule(false);
    }
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

  const selectedCount = selectedVenueIds.length;
  const isSingleVenueMode = selectedCount === 1;
  const isScheduleWorkspaceActive = selectedCount > 0 && adminMode === 'edit';
  const focusedOverviewVenue = selectedVenueIds.length
    ? venues.find((venue) => venue.id === selectedVenueIds[0]) ?? null
    : null;
  const focusedOverviewGuardrails = focusedOverviewVenue
    ? venueGuardrailsById.get(focusedOverviewVenue.id) ?? null
    : null;
  const selectedVenueSummary =
    selectedCount === 0
      ? 'No venues selected yet'
      : selectedCount === 1
      ? '1 venue selected'
      : `${selectedCount} venues selected`;
  const selectedDaySummary =
    (isDealScheduleType(scheduleType)
      ? Array.from(new Set(dealItems.flatMap((item) => item.selectedDays))).length
      : selectedDays.length) === 0
      ? 'No days selected yet'
      : (isDealScheduleType(scheduleType)
          ? Array.from(new Set(dealItems.flatMap((item) => item.selectedDays))).length
          : selectedDays.length) === 1
      ? '1 day selected'
      : `${
          isDealScheduleType(scheduleType)
            ? Array.from(new Set(dealItems.flatMap((item) => item.selectedDays))).length
            : selectedDays.length
        } days selected`;
  const enteredTimeBlockCount = isDealScheduleType(scheduleType)
    ? dealItems.reduce(
        (count, item) =>
          count +
          item.timeBlocks.filter(
            (block) => block.start_time.trim() && block.end_time.trim()
          ).length,
        0
      )
    : timeBlocks.filter((block) => block.start_time.trim() && block.end_time.trim()).length;
  const focusedVenueDaySummaries = useMemo(
    () => (focusedOverviewVenue ? buildVenueDaySummaries(focusedOverviewVenue) : []),
    [focusedOverviewVenue]
  );
  const focusedVenueOverviewCards = useMemo(() => {
    if (!focusedOverviewVenue) return [];

    const openingCount = focusedVenueDaySummaries.filter((summary) => summary.opening).length;
    const kitchenCount = focusedVenueDaySummaries.filter((summary) => summary.kitchen).length;
    const happyHourCount = focusedVenueDaySummaries.filter(
      (summary) => summary.happyHour || summary.happyHourDetails.length > 0
    ).length;
    const bottleShopCount = focusedVenueDaySummaries.filter(
      (summary) => summary.bottleShop
    ).length;

    return [
      {
        title: 'Hours',
        description: 'Opening, kitchen, happy hour, and bottle shop coverage.',
        lines: [
          `Opening hours: ${openingCount > 0 ? `${openingCount} day${openingCount === 1 ? '' : 's'} configured` : 'Not set'}`,
          `Kitchen hours: ${kitchenCount > 0 ? `${kitchenCount} day${kitchenCount === 1 ? '' : 's'} configured` : 'Not set'}`,
          `Happy hour: ${happyHourCount > 0 ? `${happyHourCount} day${happyHourCount === 1 ? '' : 's'} configured` : 'Not set'}`,
          `Bottle shop: ${bottleShopCount > 0 ? `${bottleShopCount} day${bottleShopCount === 1 ? '' : 's'} configured` : 'Not set'}`,
        ],
      },
      {
        title: 'Deals',
        description: 'Daily and lunch specials currently configured.',
        lines: takeOverviewPreviewLines(
          focusedVenueDaySummaries.flatMap((summary) =>
            summary.deals.map((deal) => `${getDayLabel(summary.day)} ${deal}`)
          )
        ),
      },
      {
        title: 'Events',
        description: 'Live events and weekly programming already in place.',
        lines: takeOverviewPreviewLines(
          focusedVenueDaySummaries.flatMap((summary) =>
            summary.events.map((eventItem) => `${getDayLabel(summary.day)} ${eventItem.summary}`)
          )
        ),
      },
      {
        title: 'Venue rules',
        description: 'Time-based kid and dog access settings.',
        lines: takeOverviewPreviewLines(
          focusedVenueDaySummaries.flatMap((summary) =>
            summary.venueRules.map((rule) => `${getDayLabel(summary.day)} ${rule}`)
          )
        ),
      },
    ];
  }, [focusedOverviewVenue, focusedVenueDaySummaries]);
  const activeAdminTask = savingSchedule
    ? 'Saving schedule changes'
    : clearingSchedule
    ? 'Deleting schedule rows'
    : savingVenue
    ? 'Saving venue details'
    : savingVenueAccess
    ? 'Updating venue access'
    : savingGlobalVenueAccess
    ? 'Assigning venues to a portal user'
    : googleLoading
    ? 'Searching Google places'
    : null;
  const scheduleReplaceWarning =
    saveMode === 'replace'
      ? `You are replacing: ${getScheduleTypePickerLabel(scheduleType, venueRuleKind)}. Existing rows for the selected days will be removed and replaced when you save.`
      : `You are editing: ${getScheduleTypePickerLabel(scheduleType, venueRuleKind)}. Existing rows are loaded below, and any new rows you add will be saved alongside your updates.`;
  const focusedExistingEditRows = useMemo(
    () =>
      getExistingScheduleRowsForEdit(
        focusedOverviewVenue,
        scheduleType,
        venueRuleKind
      ).filter((row) => selectedDays.length === 0 || selectedDays.includes(row.day_of_week)),
    [focusedOverviewVenue, scheduleType, selectedDays, venueRuleKind]
  );

  return (
    <div className="admin-shell min-h-screen bg-neutral-100 text-neutral-950">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-4 md:px-6">
        <div className="mb-3 sm:mb-4">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
            Master Admin
          </h1>
          <p className="mt-1 text-sm text-neutral-700">
            Search a venue, edit what matters, then save.
          </p>
        </div>

        <div className="mb-3 flex flex-wrap gap-2 sm:mb-4">
          <button
            type="button"
            onClick={() => setTab('schedules')}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
              tab === 'schedules'
                ? 'bg-neutral-900 text-white'
                : 'border border-neutral-300 bg-white hover:bg-neutral-100'
            }`}
          >
            Schedules
          </button>
          <button
            type="button"
            onClick={() => {
              setScheduleWorkspaceArmed(false);
              setTab('venues');
            }}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
              tab === 'venues'
                ? 'bg-neutral-900 text-white'
                : 'border border-neutral-300 bg-white hover:bg-neutral-100'
            }`}
          >
            Venues / Google
          </button>
        </div>

        <section className="admin-surface mb-3 rounded-2xl border p-3 sm:mb-4 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Activity log</h2>
              <p className="mt-1 text-sm text-neutral-700">
                Secondary session history for admin actions.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-2 py-1 font-medium ${
                    remoteActivityLogEnabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {remoteActivityLogEnabled ? 'Supabase synced' : 'Local-only fallback'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowActivityLog((current) => !current)}
                className="admin-ghost-button min-h-[40px] rounded-xl border px-3 py-2 text-sm font-medium"
              >
                {showActivityLog ? 'Hide activity log' : 'Show activity log'}
              </button>
              {showActivityLog ? (
                <button
                  type="button"
                  onClick={clearActivityLog}
                  className="admin-ghost-button min-h-[40px] rounded-xl border px-3 py-2 text-sm font-medium"
                >
                  Clear log
                </button>
              ) : null}
            </div>
          </div>
          <div className={`grid transition-[grid-template-rows,opacity] duration-200 ${showActivityLog ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="min-h-0 overflow-hidden">
              <div className="max-h-[420px] space-y-3 overflow-y-auto">
              {activityLog.length === 0 ? (
                <div className="text-sm text-neutral-500">No admin activity logged yet.</div>
              ) : (
                activityLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="admin-surface-subtle rounded-xl border px-3 py-3 text-neutral-900"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          entry.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : entry.status === 'failure'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {entry.status.toUpperCase()}
                      </span>
                      <span className="text-xs uppercase tracking-wide text-neutral-500">
                        {entry.area}
                      </span>
                      <span className="text-sm font-medium text-neutral-900">
                        {entry.action}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {formatAdminActivityTimestamp(entry.timestamp)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-neutral-600">{entry.details}</div>
                  </div>
                ))
              )}
              </div>
            </div>
          </div>
        </section>

        {venuesError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:mb-5">
            {venuesError}
          </div>
        ) : null}

        {activeAdminTask ? (
          <div className="mb-4 rounded-2xl border border-orange-300/25 bg-orange-500/10 px-4 py-3 text-sm text-orange-50 sm:mb-5">
            <div className="font-semibold">Working on it</div>
            <div className="mt-1 text-orange-100/85">{activeAdminTask}. Please wait for the confirmation message before moving on.</div>
          </div>
        ) : null}

        {tab === 'schedules' ? (
          <div className="grid gap-4 sm:gap-5 2xl:grid-cols-[340px_minmax(0,1fr)]">
            <section className="admin-surface self-start rounded-2xl border p-3 sm:p-4 2xl:sticky 2xl:top-20">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">
                    Select venues
                  </h2>
                  <p className="mt-1 text-sm text-neutral-700">
                    Search first, select venues, then choose Edit venue or Edit schedule explicitly.
                  </p>
                </div>
                <div className="admin-surface-subtle rounded-xl border px-3 py-2 text-xs font-medium text-neutral-700">
                  {selectedCount} selected
                </div>
              </div>
                  {selectedCount > 0 && !showVenuePickerMobile ? (
                    <div className="admin-surface-subtle rounded-2xl border p-3 sm:hidden">
                      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/45">
                        Selected venues
                      </div>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {selectedCount} venue selected
                        {selectedCount === 1 ? "" : "s"}
                      </p>
                      <p className="mt-1 text-xs text-white/60">
                        Selection stays separate from editing. Reopen the venue list anytime
                        to change or add venues.
                      </p>
                      <button
                        type="button"
                        className="mt-3 rounded-xl border border-white/15 px-3 py-2 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/5"
                        onClick={() => setShowVenuePickerMobile(true)}
                      >
                        Change venue
                      </button>
                    </div>
                  ) : null}

                  <div className={selectedCount > 0 && !showVenuePickerMobile ? "hidden sm:block" : ""}>
                    <div className="mt-4 space-y-3">
                      <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search venue, suburb, or type"
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/20 focus:bg-black/30"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-medium text-white/85 transition hover:border-white/20 hover:bg-white/5"
                          onClick={selectAllFiltered}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-medium text-white/85 transition hover:border-white/20 hover:bg-white/5"
                          onClick={clearFiltered}
                        >
                          {search.trim() ? "Clear filtered" : "Clear selection"}
                        </button>
                        {selectedCount > 0 ? (
                          <button
                            type="button"
                            className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-medium text-white/85 transition hover:border-white/20 hover:bg-white/5 sm:hidden"
                            onClick={() => setShowVenuePickerMobile(false)}
                          >
                            Back to edit
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 max-h-[34rem] space-y-2 overflow-y-auto rounded-2xl border border-white/8 bg-black/10 p-2">
                      {loadingVenues ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-white/60">
                          Loading...
                        </div>
                      ) : filteredVenues.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-white/60">
                          No venues match this search.
                        </div>
                      ) : (
                        filteredVenues.map((venue) => {
                          const isSelected = selectedVenueIds.includes(venue.id);
                          const guardrails = venueGuardrailsById.get(venue.id);
                          return (
                            <button
                              type="button"
                              key={venue.id}
                              onClick={() => toggleVenue(venue.id)}
                              className={`block w-full rounded-2xl border px-3 py-3 text-left transition ${
                                isSelected
                                  ? "border-orange-400/60 bg-orange-500/10 shadow-[0_0_0_1px_rgba(251,146,60,0.2)]"
                                  : "border-white/6 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-transparent text-orange-400 focus:ring-orange-400/30"
                                  checked={isSelected}
                                  onChange={() => toggleVenueCheckbox(venue.id)}
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="break-words text-base font-semibold leading-5 text-white">
                                    {venue.name}
                                  </div>
                                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                                    {venue.suburb}
                                  </div>
                                  <div className="mt-1 text-sm text-white/75">
                                    {venue.venue_type_id
                                      ? venueTypeNameById.get(venue.venue_type_id) ?? venue.venue_type_id
                                      : "-"}
                                  </div>
                                  {guardrails ? (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      <span
                                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                          guardrails.isPublishReady
                                            ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100'
                                            : 'border-amber-400/35 bg-amber-500/12 text-amber-100'
                                        }`}
                                      >
                                        {guardrails.isPublishReady ? 'Publish ready' : 'Incomplete'}
                                      </span>
                                      <span
                                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                          guardrails.hasReasonToGo
                                            ? 'border-sky-400/35 bg-sky-500/12 text-sky-100'
                                            : 'border-white/12 bg-white/[0.03] text-white/60'
                                        }`}
                                      >
                                        {guardrails.hasReasonToGo ? 'Reason to go' : 'No hook yet'}
                                      </span>
                                      {guardrails.isOffStrategy ? (
                                        <span className="rounded-full border border-rose-400/35 bg-rose-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-100">
                                          Off strategy
                                        </span>
                                      ) : null}
                                      {guardrails.supportiveSignals.slice(0, 2).map((signal) => (
                                        <span
                                          key={`${venue.id}-${signal}`}
                                          className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65"
                                        >
                                          {signal}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                  <div className="mt-2 text-[11px] text-white/45">
                                    {venue.status ? `Status: ${venue.status}` : 'Status: active'}
                                    {' | '}
                                    Updated {formatVenueUpdatedAt(venue.updated_at)}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 pl-7">
                                <button
                                  type="button"
                                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/85 transition hover:border-white/20 hover:bg-white/5"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    focusVenueInScheduleEditor(venue);
                                  }}
                                >
                                  Edit schedule
                                </button>
                                <button
                                  type="button"
                                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/85 transition hover:border-white/20 hover:bg-white/5"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    populateVenueFormFromExistingVenue(venue);
                                  }}
                                >
                                  Edit venue
                                </button>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
            </section>

            <section className="admin-surface rounded-2xl border p-3 sm:p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">
                    {isScheduleWorkspaceActive ? 'Edit schedule' : 'Overview'}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-700">
                    {isScheduleWorkspaceActive
                      ? 'Work on one edit type here, save it, then return to overview.'
                      : 'Review the current setup first, then choose exactly what you want to edit.'}
                  </p>
                </div>
                <div className="admin-surface-subtle rounded-xl border px-3 py-2 text-xs text-neutral-700">
                  {selectedVenueSummary}
                </div>
              </div>
              {selectedCount > 0 ? (
                <div className="admin-surface-subtle mb-4 rounded-2xl border p-3 sm:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                        {isScheduleWorkspaceActive ? 'Editing now' : 'Selected venues'}
                      </div>
                      <div className="mt-1 truncate text-base font-semibold text-neutral-900">
                        {selectedCount === 1
                          ? selectedVenuesForSummary[0]?.name ?? selectedVenueSummary
                          : selectedVenueSummary}
                      </div>
                      <div className="mt-1 text-xs text-neutral-600">
                        {selectedCount === 1
                          ? selectedVenuesForSummary[0]?.suburb ?? 'Venue selected'
                          : 'Choose an action to keep selection separate from editing'}
                        {selectedCount === 1 && selectedVenuesForSummary[0]?.venue_type_id
                          ? ` | ${venueTypeNameById.get(selectedVenuesForSummary[0]?.venue_type_id) ?? selectedVenuesForSummary[0]?.venue_type_id}`
                          : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowVenuePickerMobile(true)}
                      className="admin-ghost-button shrink-0 rounded-xl border px-3 py-2 text-xs font-medium"
                    >
                      Change venue
                    </button>
                  </div>
                </div>
              ) : null}
              {selectedCount > 0 && !isScheduleWorkspaceActive ? (
                <div className="admin-surface-subtle mb-4 rounded-2xl border p-3.5 sm:p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                        Current setup at a glance
                      </div>
                      <div className="mt-2 text-lg font-semibold text-neutral-900">
                        {focusedOverviewVenue?.name ?? 'Venue selected'}
                      </div>
                      <div className="mt-1 text-sm text-neutral-600">
                        {focusedOverviewVenue?.suburb ?? '-'}
                        {focusedOverviewVenue?.venue_type_id
                          ? ` | ${venueTypeNameById.get(focusedOverviewVenue.venue_type_id) ?? focusedOverviewVenue.venue_type_id}`
                          : ''}
                      </div>
                      <div className="mt-3 max-w-2xl text-sm text-neutral-700">
                        Overview mode is read-only. Choose one edit action to work on a single thing, save it, then come back here.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleScheduleTypeSelection('opening')}
                        className="admin-primary-button rounded-xl border px-3 py-2 text-sm font-semibold"
                      >
                        Edit hours
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScheduleTypeSelection('daily_special')}
                        className="admin-ghost-button rounded-xl border px-3 py-2 text-sm font-medium"
                      >
                        Edit deals
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScheduleTypeSelection('trivia')}
                        className="admin-ghost-button rounded-xl border px-3 py-2 text-sm font-medium"
                      >
                        Edit events
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScheduleTypeSelection('venue_rule', 'kid')}
                        className="admin-ghost-button rounded-xl border px-3 py-2 text-sm font-medium"
                      >
                        Edit venue rules
                      </button>
                      {focusedOverviewVenue ? (
                        <button
                          type="button"
                          onClick={() => populateVenueFormFromExistingVenue(focusedOverviewVenue)}
                          className="admin-ghost-button rounded-xl border px-3 py-2 text-sm font-medium"
                        >
                          Edit venue details
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {selectedCount > 1 ? (
                    <div className="mt-4 border-t border-black/5 pt-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                        Focus a venue for overview
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedVenuesForSummary.map((venue) => (
                          <button
                            key={venue.id}
                            type="button"
                            onClick={() =>
                              setSelectedVenueIds([
                                venue.id,
                                ...selectedVenueIds.filter((id) => id !== venue.id),
                              ])
                            }
                            className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                              venue.id === focusedOverviewVenue?.id
                                ? 'border-orange-400 bg-orange-500 text-black'
                                : 'admin-ghost-button'
                            }`}
                          >
                            {venue.name ?? 'Unnamed venue'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {focusedOverviewGuardrails ? (
                    <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="rounded-2xl border border-black/5 bg-white/50 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                          Publish readiness
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              focusedOverviewGuardrails.isPublishReady
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                : 'border-amber-300 bg-amber-50 text-amber-800'
                            }`}
                          >
                            {focusedOverviewGuardrails.isPublishReady
                              ? 'Publish ready'
                              : 'Not publish ready yet'}
                          </span>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              focusedOverviewGuardrails.hasReasonToGo
                                ? 'border-sky-300 bg-sky-50 text-sky-800'
                                : 'border-neutral-300 bg-neutral-50 text-neutral-700'
                            }`}
                          >
                            {focusedOverviewGuardrails.hasReasonToGo
                              ? 'Has reason to go'
                              : 'No reason to go yet'}
                          </span>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              focusedOverviewGuardrails.fitsFirstRound
                                ? 'border-neutral-300 bg-neutral-50 text-neutral-800'
                                : 'border-rose-300 bg-rose-50 text-rose-800'
                            }`}
                          >
                            {focusedOverviewGuardrails.fitsFirstRound
                              ? 'Fits First Round'
                              : 'Review product fit'}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                              Reasons to go
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {focusedOverviewGuardrails.reasonToGoSignals.length > 0 ? (
                                focusedOverviewGuardrails.reasonToGoSignals.map((signal) => (
                                  <span
                                    key={signal}
                                    className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800"
                                  >
                                    {signal}
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-neutral-500">
                                  Add a happy hour, special, sport, trivia, live music, or another real social hook.
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                              Supporting signals
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {focusedOverviewGuardrails.supportiveSignals.length > 0 ? (
                                focusedOverviewGuardrails.supportiveSignals.map((signal) => (
                                  <span
                                    key={signal}
                                    className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700"
                                  >
                                    {signal}
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-neutral-500">
                                  No supporting signals set yet.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-black/5 bg-white/50 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                          Product quality checks
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-neutral-700">
                          {focusedOverviewGuardrails.missingCriticalData.length > 0 ? (
                            focusedOverviewGuardrails.missingCriticalData.map((item) => (
                              <div
                                key={item}
                                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900"
                              >
                                {item}
                              </div>
                            ))
                          ) : (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                              Core publish checks are covered.
                            </div>
                          )}
                          {focusedOverviewGuardrails.warnings.map((warning) => (
                            <div
                              key={warning}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900"
                            >
                              {warning}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {focusedVenueOverviewCards.map((card) => (
                      <div key={card.title} className="rounded-2xl border border-black/5 bg-white/40 p-4">
                        <div className="text-sm font-semibold text-neutral-900">{card.title}</div>
                        <div className="mt-1 text-sm text-neutral-600">{card.description}</div>
                        <div className="mt-3 space-y-2 text-sm text-neutral-700">
                          {card.lines.map((line) => (
                            <div key={`${card.title}-${line}`} className="rounded-xl border border-black/5 bg-white px-3 py-2">
                              {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {focusedOverviewVenue ? (
                    <div className="mt-4">
                      <div className="text-sm font-semibold text-neutral-900">Weekly snapshot</div>
                      <div className="mt-1 text-sm text-neutral-600">
                        A concise view of what is already configured this week, without dropping straight into the editor.
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                        {focusedVenueDaySummaries.map((summary) => {
                          const summaryLines = [
                            summary.opening ? `Opening: ${summary.opening}` : null,
                            summary.kitchen ? `Kitchen: ${summary.kitchen}` : null,
                            summary.happyHour
                              ? `Happy hour: ${summary.happyHour}`
                              : summary.happyHourDetails[0] ?? null,
                            summary.bottleShop ? `Bottle shop: ${summary.bottleShop}` : null,
                            summary.deals[0] ?? null,
                            summary.events[0]?.summary ?? null,
                            summary.venueRules[0] ?? null,
                          ].filter((line): line is string => Boolean(line));

                          return (
                            <div key={summary.day} className="rounded-2xl border border-black/5 bg-white p-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                                {getDayLabel(summary.day)}
                              </div>
                              <div className="mt-3 space-y-2 text-sm text-neutral-700">
                                {summaryLines.length > 0 ? (
                                  summaryLines.map((line) => (
                                    <div key={`${summary.day}-${line}`} className="rounded-lg border border-black/5 bg-white/60 px-3 py-2">
                                      {line}
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-lg border border-dashed border-black/10 px-3 py-2 text-neutral-500">
                                    Nothing configured yet
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminMode('edit');
                        setScheduleErrorMessage(null);
                        setScheduleMessage(
                          selectedCount === 1
                            ? `Loaded ${selectedVenuesForSummary[0]?.name ?? 'the selected venue'} into focused edit mode.`
                            : `Loaded ${selectedVenueSummary.toLowerCase()} into focused edit mode.`
                        );
                      }}
                      className="admin-primary-button rounded-xl border px-3 py-2 text-sm font-semibold"
                    >
                      Start editing
                    </button>
                    {singleSelectedVenue ? (
                      <button
                        type="button"
                        onClick={() => populateVenueFormFromExistingVenue(singleSelectedVenue)}
                        className="admin-ghost-button rounded-xl border px-3 py-2 text-sm font-medium"
                      >
                        Edit venue details
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {selectedCount === 0 ? (
                <div className="admin-surface-subtle mb-4 rounded-2xl border border-dashed p-4 sm:p-5">
                  <div className="text-sm font-semibold text-neutral-900">
                    Select venue first
                  </div>
                  <div className="mt-1 text-sm text-neutral-600">
                    Choose one or more venues on the left to review the current setup, then move into a focused edit mode only when you are ready.
                  </div>
                </div>
              ) : null}
              <div className={isScheduleWorkspaceActive ? '' : 'hidden'}>
                {isScheduleWorkspaceActive ? (
                  <div className="admin-surface-subtle mb-4 rounded-2xl border p-3.5 sm:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setAdminMode('overview');
                            setScheduleWorkspaceArmed(false);
                          }}
                          className="admin-ghost-button rounded-xl border px-3 py-2 text-sm font-medium"
                        >
                          Back to overview
                        </button>
                        <div className="mt-3 text-lg font-semibold text-neutral-900">
                          {focusedOverviewVenue?.name ?? selectedVenueSummary}
                        </div>
                        <div className="mt-1 text-sm text-neutral-600">
                          Editing: {getScheduleTypePickerLabel(scheduleType, venueRuleKind)}
                        </div>
                      </div>
                      <div className="admin-surface rounded-xl border px-3 py-2 text-xs text-neutral-700">
                        {selectedCount === 1
                          ? 'Focused edit mode'
                          : `${selectedVenueSummary} in edit mode`}
                      </div>
                    </div>
                  </div>
                ) : null}

              <div className="admin-surface-subtle mb-4 rounded-2xl border p-3.5 sm:p-4">
                <div className="text-sm font-semibold text-neutral-900">Ready to save</div>
                <div className="mt-1 text-xs text-neutral-600">
                  Review the impact below before saving or deleting anything.
                </div>
                <div className="mt-2 grid gap-3 text-sm text-neutral-700 md:grid-cols-2">
                  <div>
                    <span className="font-medium">Schedule type:</span> {getScheduleTypePickerLabel(scheduleType, venueRuleKind)}
                  </div>
                  <div>
                    <span className="font-medium">Existing rows:</span>{' '}
                    {saveMode === 'replace' ? 'Replace all' : 'Edit existing'}
                  </div>
                  <div>
                    <span className="font-medium">Venues:</span> {selectedVenueSummary}
                  </div>
                  <div>
                    <span className="font-medium">Days:</span> {selectedDaySummary}
                  </div>
                  <div>
                    <span className="font-medium">Time blocks entered:</span> {enteredTimeBlockCount}
                  </div>
                </div>
                <div
                  className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                    saveMode === 'replace'
                      ? 'border border-amber-200 bg-amber-50 text-amber-900'
                      : 'border border-blue-200 bg-blue-50 text-blue-900'
                  }`}
                >
                  {scheduleReplaceWarning}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <GroupedScheduleTypeSelector
                    scheduleType={scheduleType}
                    venueRuleKind={venueRuleKind}
                    onSelect={handleScheduleTypeSelection}
                    variant="admin"
                  />
                  {isEventScheduleType(scheduleType) ? (
                    <div className="mt-2 text-xs text-neutral-500">
                      Event rows only appear on the website when published details exist for that venue and day.
                    </div>
                  ) : isVenueRuleScheduleType(scheduleType) ? (
                    <div className="mt-2 text-xs text-neutral-500">
                      Public signal: {getScheduleTypePickerLabel(scheduleType, venueRuleKind)}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-neutral-500">
                      Use opening, kitchen, happy hour, or bottle shop hours to keep the public venue view in sync.
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Mode</label>
                  <select
                    value={saveMode}
                    onChange={(e) => setSaveMode(e.target.value as SaveMode)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="append">Edit existing</option>
                    <option value="replace">Replace all</option>
                  </select>
                  <div className="mt-2 text-xs text-neutral-500">
                    {saveMode === 'replace'
                      ? 'Best when you want the selected days to exactly match the rows below and remove older matching rows.'
                      : 'Best when you want to load what already exists, adjust it safely, and add new rows if needed.'}
                  </div>
                </div>
              </div>
              <div className="admin-surface-subtle mt-4 rounded-2xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">Existing data loaded</div>
                    <div className="mt-1 text-xs text-neutral-600">
                      {focusedExistingEditRows.length
                        ? 'These are the current live rows loaded into the form as your starting point.'
                        : 'No live rows were found for this edit type yet, so you are starting with a fresh form.'}
                    </div>
                  </div>
                  <div className="admin-surface rounded-xl border px-3 py-2 text-xs text-neutral-700">
                    {getScheduleTypePickerLabel(scheduleType, venueRuleKind)}
                  </div>
                </div>
                {focusedExistingEditRows.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {focusedExistingEditRows.map((row) => {
                      const summary =
                        row.title?.trim() ||
                        row.deal_text?.trim() ||
                        row.description?.trim() ||
                        row.notes?.trim() ||
                        '';
                      return (
                        <div
                          key={`${row.id}-${row.day_of_week}-${row.start_time}-${row.end_time}`}
                          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                            {getDayLabel(row.day_of_week)}
                          </div>
                          <div className="mt-1 font-medium">
                            {row.start_time}-{row.end_time}
                          </div>
                          {summary ? (
                            <div className="mt-1 text-xs text-neutral-600">{summary}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              {!isDealScheduleType(scheduleType) ? (
              <>
              <div className="mt-3.5 sm:mt-4">
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDaysPreset('weekdays')}
                    className="admin-ghost-button rounded-xl border px-3 py-2 text-sm font-medium"
                  >
                    Mon-Fri
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaysPreset('weekend')}
                    className="admin-ghost-button rounded-xl border px-3 py-2 text-sm font-medium"
                  >
                    Weekend
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaysPreset('all')}
                    className="admin-ghost-button rounded-xl border px-3 py-2 text-sm font-medium"
                  >
                    All days
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaysPreset('clear')}
                    className="admin-ghost-button rounded-xl border px-3 py-2 text-sm font-medium"
                  >
                    Clear days
                  </button>
                </div>
                <label className="mb-2 block text-sm font-medium">Days</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((day) => {
                    const active = selectedDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`min-h-[42px] rounded-xl border px-3 py-2 text-sm font-semibold ${
                          active
                            ? 'border-orange-400 bg-orange-500 text-black shadow-[0_0_0_2px_rgba(251,146,60,0.22)]'
                            : 'admin-ghost-button border'
                        }`}
                        aria-pressed={active}
                      >
                        {active ? `Selected ${day.label}` : day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3.5 sm:mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium">Time Blocks</label>
                  <button
                    type="button"
                    onClick={addTimeBlock}
                    className="admin-ghost-button rounded-xl border px-3 py-2 text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-3">
                  {timeBlocks.map((block, index) => (
                    <div key={index} className="grid gap-2.5 md:grid-cols-[1fr_1fr_auto]">
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
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
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
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTimeBlock(index)}
                        disabled={timeBlocks.length === 1}
                        className="mt-6 rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              </>
              ) : null}
              {isEventScheduleType(scheduleType) && (
                <div className="mt-3.5 grid gap-3 md:mt-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={
                        scheduleType === 'daily_special'
                          ? 'e.g. Steak Night'
                          : scheduleType === 'lunch_special'
                            ? 'e.g. Lunch Special'
                            : 'Optional event title'
                      }
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {isEventScheduleType(scheduleType) ? 'Summary' : 'Deal text'}
                    </label>
                    <input
                      type="text"
                      value={dealText}
                      onChange={(e) => setDealText(e.target.value)}
                      placeholder={
                        scheduleType === 'daily_special'
                          ? 'e.g. Parmi + chips $20'
                          : scheduleType === 'lunch_special'
                            ? 'e.g. Lunch special $15'
                            : 'Short event summary for the public card'
                      }
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
              {isVenueRuleScheduleType(scheduleType) && (
                <div className="mt-3.5">
                  <label className="mb-1 block text-sm font-medium">Public summary</label>
                  <input
                    type="text"
                    value={dealText}
                    onChange={(e) => setDealText(e.target.value)}
                    placeholder={
                      venueRuleKind === 'kid'
                        ? 'e.g. Kids until 8pm'
                        : 'e.g. Dogs front bar only'
                    }
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
              {scheduleType === 'happy_hour' && (
                <div className="mt-3.5">
                  <label className="mb-1 block text-sm font-medium">Deal text</label>
                  <input
                    type="text"
                    value={dealText}
                    onChange={(e) => setDealText(e.target.value)}
                    placeholder="e.g. $7 schooners / $15 burgers"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
              {(scheduleType === 'daily_special' || scheduleType === 'lunch_special') && (
                <DealScheduleItemsEditor
                  items={dealItems}
                  scheduleType={scheduleType}
                  variant="admin"
                  onAddItem={addDealItem}
                  onRemoveItem={removeDealItem}
                  onToggleDay={toggleDealItemDay}
                  onSetDaysPreset={setDealItemDaysPreset}
                  onAddTimeBlock={addDealItemTimeBlock}
                  onRemoveTimeBlock={removeDealItemTimeBlock}
                  onUpdateTimeBlock={updateDealItemTimeBlock}
                  onUpdateField={updateDealItemField}
                />
              )}
              {(!isDealScheduleType(scheduleType) && (isEventScheduleType(scheduleType) || scheduleType === 'happy_hour')) && (
                <div className="mt-3">
                  <label className="mb-1 block text-sm font-medium">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      isDealScheduleType(scheduleType)
                        ? 'Public-facing detail or context for this offer'
                        : isEventScheduleType(scheduleType)
                          ? 'Optional event detail for the public card or venue page'
                          : 'Optional happy hour detail if you need more context'
                    }
                    rows={3}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
              {(!isDealScheduleType(scheduleType) && (isEventScheduleType(scheduleType) || isVenueRuleScheduleType(scheduleType) || scheduleType === 'happy_hour')) && (
                <div className="mt-3">
                  <label className="mb-1 block text-sm font-medium">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      isVenueRuleScheduleType(scheduleType)
                        ? 'Optional nuance such as Beer garden only or Front bar only'
                        : 'Operator notes, sourcing notes, or reminders'
                    }
                    rows={3}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
              {scheduleType === 'happy_hour' && (
                <div className="mt-4 rounded-2xl border border-pink-200 bg-pink-50 p-4">
                  <h3 className="mb-3 font-semibold">Happy Hour Items</h3>
                  <div className="mb-3 text-sm text-pink-900/80">
                    Add the items you want to surface publicly. Keep names clean, pricing short, and notes useful for guests.
                  </div>
                  <div className="space-y-3">
                    {(['beer', 'wine', 'spirits', 'cocktails', 'food'] as const).map((category) => (
                      <HappyHourCategoryEditor
                        key={category}
                        label={category.charAt(0).toUpperCase() + category.slice(1)}
                        items={happyHourForm[category]}
                        onAdd={() => addHappyHourItem(category)}
                        onRemove={(itemId) => removeHappyHourItem(category, itemId)}
                        onUpdateItem={(itemId, field, value) =>
                          updateHappyHourItem(category, itemId, field, value)
                        }
                        onAddPrice={(itemId) => addHappyHourPrice(category, itemId)}
                        onRemovePrice={(itemId, priceId) =>
                          removeHappyHourPrice(category, itemId, priceId)
                        }
                        onUpdatePrice={(itemId, priceId, field, value) =>
                          updateHappyHourPrice(category, itemId, priceId, field, value)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
              </div>
              {scheduleMessage && (
                <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  {scheduleMessage}
                </div>
              )}
              {scheduleErrorMessage && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {scheduleErrorMessage}
                </div>
              )}
              <div className="admin-focus-band mt-4 rounded-2xl border border-white/10 bg-[#0f1419]/92 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.28)] sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                <div className="mb-2 text-xs uppercase tracking-[0.16em] text-neutral-500 sm:hidden">
                  Save actions
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleSaveSchedule}
                    disabled={savingSchedule || clearingSchedule}
                    className="admin-primary-button rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {savingSchedule ? 'Saving…' : 'Save schedule'}
                  </button>
                  <button
                    type="button"
                    onClick={resetScheduleForm}
                    disabled={savingSchedule || clearingSchedule}
                    className="admin-ghost-button rounded-xl border px-4 py-2 text-sm font-semibold"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-500">
                  Delete hours
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleDeleteSelectedDays}
                    disabled={savingSchedule || clearingSchedule}
                    className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {clearingSchedule ? 'Deleting…' : 'Delete selected days'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAllForScheduleType}
                    disabled={savingSchedule || clearingSchedule}
                    className="rounded-xl border border-red-500 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60"
                  >
                    {clearingSchedule
                      ? 'Deleting…'
                      : `Delete all ${getScheduleTypeLabel(scheduleType)}`}
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <section className="admin-surface self-start rounded-2xl border p-3.5 sm:p-4 lg:sticky lg:top-20">
              <h2 className="mb-3 text-lg font-semibold">Google search</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={googleQuery}
                  onChange={(e) => setGoogleQuery(e.target.value)}
                  placeholder="Search venue"
                  className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleGoogleSearch}
                  disabled={googleLoading}
                  className="admin-primary-button rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {googleLoading ? 'Searching…' : 'Search'}
                </button>
              </div>
              {googleError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {googleError}
                </div>
              )}
              <div className="mt-4 max-h-[65vh] overflow-y-auto">
                {googleResults.map((result) => (
                  <div key={result.place_id} className="admin-surface-subtle mb-3 rounded-xl border p-3">
                    <div className="font-medium">{result.name}</div>
                    <div className="text-sm text-neutral-600">{result.formatted_address}</div>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => handleUseGoogleResult(result.place_id)}
                        className="admin-ghost-button rounded-xl border px-3 py-2 text-sm"
                      >
                        Use
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-surface rounded-2xl border p-3.5 sm:p-4">
              <h2 className="mb-3 text-lg font-semibold">Venue setup</h2>
              {venueMessage && (
                <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  {venueMessage}
                </div>
              )}
              {venueErrorMessage && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {venueErrorMessage}
                </div>
              )}
              <div className="admin-surface-subtle mb-4 rounded-2xl border p-4">
                <div className="text-sm font-semibold text-neutral-900">Venue save summary</div>
                <div className="mt-1 text-xs text-neutral-600">
                  Google results can prefill the form, but nothing changes live until you save.
                </div>
                <div className="mt-3 grid gap-3 text-sm text-neutral-700 md:grid-cols-2">
                  <div><span className="font-medium">Editing:</span> {venueForm.id ? 'Existing venue' : 'New venue draft'}</div>
                  <div><span className="font-medium">Venue type list:</span> {loadingVenueTypes ? 'Loading…' : `${venueTypes.length} available`}</div>
                  <div><span className="font-medium">Name:</span> {venueForm.name.trim() || 'Not entered yet'}</div>
                  <div><span className="font-medium">Suburb:</span> {venueForm.suburb.trim() || 'Not entered yet'}</div>
                </div>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium">Venue name</label>
                <input
                  type="text"
                  value={venueForm.name}
                  onChange={(e) => updateVenueForm('name', e.target.value)}
                  placeholder="Venue name"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="mb-3 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Suburb</label>
                  <input
                    type="text"
                    value={venueForm.suburb}
                    onChange={(e) => updateVenueForm('suburb', e.target.value)}
                    placeholder="Suburb"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Venue type</label>
                  <select
                    value={venueForm.venue_type_id}
                    onChange={(e) => updateVenueForm('venue_type_id', e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select type</option>
                    {venueTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium">Address</label>
                <input
                  type="text"
                  value={venueForm.address}
                  onChange={(e) => updateVenueForm('address', e.target.value)}
                  placeholder="Street address"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="mb-3 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Phone</label>
                  <input
                    type="text"
                    value={venueForm.phone}
                    onChange={(e) => updateVenueForm('phone', e.target.value)}
                    placeholder="Phone"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Website</label>
                  <input
                    type="text"
                    value={venueForm.website_url}
                    onChange={(e) => updateVenueForm('website_url', e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Instagram</label>
                  <input
                    type="text"
                    value={venueForm.instagram_url}
                    onChange={(e) => updateVenueForm('instagram_url', e.target.value)}
                    placeholder="@venuehandle or https://instagram.com/..."
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium">Sport types</label>
                <input
                  type="text"
                  value={venueForm.sport_types}
                  onChange={(e) => updateVenueForm('sport_types', e.target.value)}
                  placeholder="AFL, NRL, UFC"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
                <div className="mt-1 text-xs text-neutral-500">
                  Only fill this in if the venue actually promotes live sport.
                </div>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium">Sport notes</label>
                <textarea
                  value={venueForm.sport_notes}
                  onChange={(e) => updateVenueForm('sport_notes', e.target.value)}
                  rows={2}
                  placeholder="Optional notes like AFL only on main screen or Sound for marquee games"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => updateVenueForm('shows_sport', !venueForm.shows_sport)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm ${
                    venueForm.shows_sport
                      ? 'border-orange-300/30 bg-orange-500/12 text-white'
                      : 'admin-ghost-button'
                  }`}
                >
                  <div className="font-semibold">Shows live sport</div>
                  <div className="mt-1 text-xs uppercase tracking-wide opacity-70">
                    {venueForm.shows_sport ? 'Yes' : 'No'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => updateVenueForm('plays_with_sound', !venueForm.plays_with_sound)}
                  disabled={!venueForm.shows_sport && !venueForm.plays_with_sound}
                  className={`rounded-xl border px-3 py-3 text-left text-sm ${
                    venueForm.plays_with_sound
                      ? 'border-orange-300/30 bg-orange-500/12 text-white'
                      : venueForm.shows_sport
                      ? 'admin-ghost-button'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-400'
                  }`}
                >
                  <div className="font-semibold">Sport with sound</div>
                  <div className="mt-1 text-xs uppercase tracking-wide opacity-70">
                    {!venueForm.shows_sport && !venueForm.plays_with_sound
                      ? 'Enable sport first'
                      : venueForm.plays_with_sound
                      ? 'Yes'
                      : 'No'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => updateVenueForm('dog_friendly', !venueForm.dog_friendly)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm ${
                    venueForm.dog_friendly
                      ? 'border-orange-300/30 bg-orange-500/12 text-white'
                      : 'admin-ghost-button'
                  }`}
                >
                  <div className="font-semibold">Dog friendly</div>
                  <div className="mt-1 text-xs uppercase tracking-wide opacity-70">
                    {venueForm.dog_friendly ? 'Yes' : 'No'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => updateVenueForm('kid_friendly', !venueForm.kid_friendly)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm ${
                    venueForm.kid_friendly
                      ? 'border-orange-300/30 bg-orange-500/12 text-white'
                      : 'admin-ghost-button'
                  }`}
                >
                  <div className="font-semibold">Kid friendly</div>
                  <div className="mt-1 text-xs uppercase tracking-wide opacity-70">
                    {venueForm.kid_friendly ? 'Yes' : 'No'}
                  </div>
                </button>
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Dog-friendly notes</label>
                  <textarea
                    value={venueForm.dog_friendly_notes}
                    onChange={(e) => updateVenueForm('dog_friendly_notes', e.target.value)}
                    rows={2}
                    placeholder="Optional notes like Beer garden only"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Kid-friendly notes</label>
                  <textarea
                    value={venueForm.kid_friendly_notes}
                    onChange={(e) => updateVenueForm('kid_friendly_notes', e.target.value)}
                    rows={2}
                    placeholder="Optional notes like Family area only"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSaveVenue}
                  disabled={savingVenue}
                  className="admin-primary-button rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {savingVenue ? 'Saving…' : 'Save venue'}
                </button>
                <button
                  type="button"
                  onClick={resetVenueForm}
                  className="admin-ghost-button rounded-xl border px-4 py-2 text-sm font-semibold"
                >
                  Clear form
                </button>
              </div>

              <div className="admin-surface-subtle mt-6 rounded-2xl border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">
                      Venue portal access
                    </div>
                    <div className="mt-1 text-xs text-neutral-600">
                      Add or remove venue-manager access for this venue by email.
                    </div>
                  </div>
                  {venueForm.id ? (
                    <div className="admin-surface rounded-full border px-3 py-1 text-xs text-neutral-600">
                      {venueAccessRows.length} user{venueAccessRows.length === 1 ? '' : 's'}
                    </div>
                  ) : null}
                </div>

                {!venueForm.id ? (
                  <div className="admin-surface rounded-xl border border-dashed px-3 py-4 text-sm text-neutral-500">
                    Save the venue first, then assign portal users.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-3">
                      <input
                        type="email"
                        value={venueAccessEmail}
                        onChange={(e) => setVenueAccessEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="min-w-[260px] flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleAddVenueAccess}
                        disabled={savingVenueAccess}
                        className="admin-primary-button rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                      >
                        {savingVenueAccess ? 'Saving…' : 'Add portal access'}
                      </button>
                    </div>

                    {venueAccessMessage ? (
                      <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                        {venueAccessMessage}
                      </div>
                    ) : null}
                    {venueAccessError ? (
                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {venueAccessError}
                      </div>
                    ) : null}

                    <div className="mt-4">
                      {loadingVenueAccess ? (
                        <div className="text-sm text-neutral-500">Loading portal users…</div>
                      ) : venueAccessRows.length === 0 ? (
                        <div className="admin-surface rounded-xl border border-dashed px-3 py-4 text-sm text-neutral-500">
                          No portal users assigned yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {venueAccessRows.map((row) => (
                            <div
                              key={`${row.user_id}-${row.venue_id}`}
                              className="admin-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3"
                            >
                              <div>
                                <div className="text-sm font-semibold text-neutral-900">
                                  {row.profiles?.email ?? row.user_id}
                                </div>
                                <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                                  {row.role ?? 'manager'}
                                  {row.profiles?.full_name ? ` · ${row.profiles.full_name}` : ''}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveVenueAccess(row.user_id)}
                                disabled={savingVenueAccess}
                                className="admin-danger-button rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60"
                              >
                                Remove access
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">
                      Portal user overview
                    </div>
                    <div className="mt-1 text-xs text-neutral-600">
                      Current venue-manager assignments across all venues.
                    </div>
                  </div>
                  <div className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs text-neutral-600">
                    {filteredPortalAccessOverview.length} assignment{filteredPortalAccessOverview.length === 1 ? '' : 's'}
                  </div>
                </div>

                <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    type="text"
                    value={portalUserSearch}
                    onChange={(e) => setPortalUserSearch(e.target.value)}
                    placeholder="Search by email, name, venue, or role"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                  <button
                    type="button"
                    onClick={() => setPortalUserCurrentVenueOnly((current) => !current)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                      portalUserCurrentVenueOnly
                        ? 'border-orange-300 bg-orange-50 text-orange-900'
                        : 'border-neutral-300 hover:bg-neutral-100'
                    }`}
                  >
                    {portalUserCurrentVenueOnly ? 'Current venue only' : 'All venues'}
                  </button>
                </div>

                {filteredPortalAccessOverview.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-sm text-neutral-500">
                    No portal user assignments found yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredPortalAccessOverview.map((row) => (
                      <div
                        key={`overview-${row.user_id}-${row.venue_id}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3"
                      >
                        <div>
                          <div className="text-sm font-semibold text-neutral-900">
                            {row.profiles?.email ?? row.user_id}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                            {row.venues?.name ?? row.venue_id}
                            {' · '}
                            {row.role ?? 'manager'}
                          </div>
                        </div>
                        {venueForm.id && row.venue_id === venueForm.id ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveVenueAccess(row.user_id)}
                            disabled={savingVenueAccess}
                            className="rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Remove from this venue
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">
                      Portal users by account
                    </div>
                    <div className="mt-1 text-xs text-neutral-600">
                      Review each venue manager once, with all assigned venues grouped together.
                    </div>
                  </div>
                  <div className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs text-neutral-600">
                    {filteredPortalAccessGroups.length} user{filteredPortalAccessGroups.length === 1 ? '' : 's'}
                  </div>
                </div>

                {filteredPortalAccessGroups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-sm text-neutral-500">
                    No portal users found yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredPortalAccessGroups.map((group) => (
                      <div
                        key={`group-${group.user_id}`}
                        className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-neutral-900">
                              {group.email}
                            </div>
                            {group.full_name ? (
                              <div className="mt-1 text-xs text-neutral-500">
                                {group.full_name}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-600">
                              {group.assignments.length} venue
                              {group.assignments.length === 1 ? '' : 's'}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveAllVenueAccessForUser(
                                  group.user_id,
                                  group.assignments.map((assignment) => assignment.venue_id)
                                )
                              }
                              disabled={savingVenueAccess}
                              className="rounded-xl border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              Remove all access
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 space-y-2">
                          {group.assignments.map((assignment) => (
                            <div
                              key={`group-assignment-${assignment.user_id}-${assignment.venue_id}`}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3"
                            >
                              <div>
                                <div className="text-sm font-semibold text-neutral-900">
                                  {assignment.venues?.name ?? assignment.venue_id}
                                </div>
                                <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                                  {assignment.role ?? 'manager'}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveVenueAccess(assignment.user_id, assignment.venue_id)}
                                disabled={savingVenueAccess}
                                className="rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                              >
                                Remove access
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">
                      Assign venues to a portal user
                    </div>
                    <div className="mt-1 text-xs text-neutral-600">
                      Grant one user access to one or many venues from a single screen.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGlobalVenueAccessVenueIds(selectedVenueIds)}
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-neutral-100"
                  >
                    Use selected venues
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <input
                    type="email"
                    value={globalVenueAccessEmail}
                    onChange={(e) => setGlobalVenueAccessEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddGlobalVenueAccess}
                    disabled={savingGlobalVenueAccess}
                    className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
                  >
                    {savingGlobalVenueAccess ? 'Assigning…' : 'Assign venues'}
                  </button>
                </div>

                {globalVenueAccessMessage ? (
                  <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                    {globalVenueAccessMessage}
                  </div>
                ) : null}
                {globalVenueAccessError ? (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {globalVenueAccessError}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {globalVenueAccessVenueIds.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500">
                      No venues selected yet.
                    </div>
                  ) : (
                    globalVenueAccessVenueIds.map((venueId) => {
                      const venue = venues.find((row) => row.id === venueId);
                      return (
                        <button
                          key={`selected-portal-venue-${venueId}`}
                          type="button"
                          onClick={() => toggleGlobalVenueAccessVenue(venueId)}
                          className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                        >
                          {venue?.name ?? venueId} ×
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-neutral-200">
                  <div className="grid gap-2 p-3">
                    {filteredVenues.map((venue) => {
                      const active = globalVenueAccessVenueIds.includes(venue.id);
                      return (
                        <button
                          key={`portal-assign-${venue.id}`}
                          type="button"
                          onClick={() => toggleGlobalVenueAccessVenue(venue.id)}
                          className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                            active
                              ? 'border-orange-300 bg-orange-50 text-orange-900'
                              : 'border-neutral-200 bg-white hover:bg-neutral-50'
                          }`}
                        >
                          <div>
                            <div className="font-semibold">
                              {venue.name ?? 'Untitled venue'}
                            </div>
                            <div className="mt-1 text-xs uppercase tracking-wide opacity-70">
                              {venue.suburb ?? 'Unknown suburb'}
                            </div>
                          </div>
                          <div className="text-xs font-semibold uppercase tracking-wide">
                            {active ? 'Selected' : 'Select'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
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
  onUpdateItem: (itemId: string, field: 'name' | 'description', value: string) => void;
  onAddPrice: (itemId: string) => void;
  onRemovePrice: (itemId: string, priceId: string) => void;
  onUpdatePrice: (itemId: string, priceId: string, field: 'label' | 'amount', value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">{label}</div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
        >
          Add
        </button>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-neutral-500">No items</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-neutral-200 p-2">
              <input
                type="text"
                value={item.name}
                onChange={(e) => onUpdateItem(item.id, 'name', e.target.value)}
                placeholder="Item name"
                className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-xs mb-1"
              />
              <div className="space-y-1">
                {item.prices.map((price) => (
                  <div key={price.id} className="flex gap-1">
                    <input
                      type="text"
                      value={price.label}
                      onChange={(e) =>
                        onUpdatePrice(item.id, price.id, 'label', e.target.value)
                      }
                      placeholder="Label"
                      className="flex-1 rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      value={price.amount}
                      onChange={(e) =>
                        onUpdatePrice(item.id, price.id, 'amount', e.target.value)
                      }
                      placeholder="$"
                      className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => onRemovePrice(item.id, price.id)}
                      className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onAddPrice(item.id)}
                className="mt-1 rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
              >
                Add price
              </button>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="mt-1 ml-auto rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}






