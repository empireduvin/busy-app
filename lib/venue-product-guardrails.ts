import { convertGoogleOpeningHours } from '@/lib/convert-google-hours';
import { normalizeScheduleRuleDetailJson, type ScheduleRuleDetailJson } from '@/lib/venue-data';
import { isBottleShopVenueType } from '@/lib/venue-type-rules';

type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

type OpeningHours = Partial<Record<DayOfWeek, Array<{ open: string; close: string }>>>;

type GuardrailVenueTypeLookup = {
  id?: string | null;
  label?: string | null;
  slug?: string | null;
};

type GuardrailRule = {
  schedule_type?: string | null;
  title?: string | null;
  description?: string | null;
  deal_text?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
  status?: string | null;
  detail_json?: ScheduleRuleDetailJson | null;
};

type GuardrailVenue = {
  name?: string | null;
  suburb?: string | null;
  venue_type_id?: string | null;
  venue_types?: GuardrailVenueTypeLookup | GuardrailVenueTypeLookup[] | null;
  status?: string | null;
  shows_sport?: boolean | null;
  byo_allowed?: boolean | null;
  dog_friendly?: boolean | null;
  kid_friendly?: boolean | null;
  opening_hours?: unknown | null;
  bottle_shop_hours?: OpeningHours | null;
  happy_hour_hours?: OpeningHours | null;
  venue_schedule_rules?: GuardrailRule[] | null;
};

export type VenueProductGuardrails = {
  venueTypeLabel: string | null;
  hasCoreFields: boolean;
  hasOperatingVisibility: boolean;
  hasReasonToGo: boolean;
  isPublishReady: boolean;
  fitsFirstRound: boolean;
  isOffStrategy: boolean;
  coreDiscoveryEligible: boolean;
  isBottleShop: boolean;
  missingCriticalData: string[];
  reasonToGoSignals: string[];
  supportiveSignals: string[];
  warnings: string[];
};

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

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function formatVenueTypeValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getVenueTypeLabel(venue: GuardrailVenue): string | null {
  const fallback = formatVenueTypeValue(venue.venue_type_id);

  if (!venue.venue_types) return fallback;

  if (Array.isArray(venue.venue_types)) {
    const first = venue.venue_types[0];
    return first?.label ?? formatVenueTypeValue(first?.slug) ?? fallback;
  }

  return venue.venue_types.label ?? formatVenueTypeValue(venue.venue_types.slug) ?? fallback;
}

function hasAnyHours(hours: OpeningHours | null | undefined) {
  if (!hours || typeof hours !== 'object') return false;
  return Object.values(hours).some(
    (periods) =>
      Array.isArray(periods) &&
      periods.some((period) => hasText(period?.open) && hasText(period?.close))
  );
}

function isVisibleRule(rule: GuardrailRule) {
  if (rule.is_active === false) return false;
  const status = (rule.status ?? '').trim().toLowerCase();
  return !['draft', 'archived', 'deleted'].includes(status);
}

function isExplicitlyOffStrategy(venueTypeLabel: string | null) {
  const value = (venueTypeLabel ?? '').trim().toLowerCase();
  if (!value) return false;

  return (
    value.includes('cafe') ||
    value.includes('coffee') ||
    value.includes('brunch') ||
    value.includes('takeaway') ||
    value.includes('fine dining') ||
    value.includes('fine-dining')
  );
}

export function getVenueProductGuardrails(venue: GuardrailVenue): VenueProductGuardrails {
  const venueTypeLabel = getVenueTypeLabel(venue);
  const normalizedOpeningHours = convertGoogleOpeningHours(venue.opening_hours);
  const visibleRules = (venue.venue_schedule_rules ?? []).filter(isVisibleRule);
  const isBottleShop = isBottleShopVenueType(venueTypeLabel ?? venue.venue_type_id ?? null);
  const hasOperatingVisibility =
    hasAnyHours(normalizedOpeningHours) ||
    hasAnyHours(venue.bottle_shop_hours) ||
    visibleRules.some(
      (rule) =>
        rule.schedule_type === 'opening' || rule.schedule_type === 'bottle_shop'
    );

  const reasonToGoSignals: string[] = [];

  if (
    visibleRules.some((rule) => rule.schedule_type === 'happy_hour') ||
    hasAnyHours(venue.happy_hour_hours)
  ) {
    reasonToGoSignals.push('Happy hour');
  }

  if (visibleRules.some((rule) => rule.schedule_type === 'daily_special')) {
    reasonToGoSignals.push('Daily special');
  }

  if (visibleRules.some((rule) => rule.schedule_type === 'lunch_special')) {
    reasonToGoSignals.push('Lunch special');
  }

  if (normalizeBooleanFlag(venue.shows_sport)) {
    reasonToGoSignals.push('Sport');
  }

  if (visibleRules.some((rule) => rule.schedule_type === 'trivia')) {
    reasonToGoSignals.push('Trivia');
  }

  if (visibleRules.some((rule) => rule.schedule_type === 'live_music')) {
    reasonToGoSignals.push('Live music');
  }

  if (
    visibleRules.some((rule) =>
      ['comedy', 'karaoke', 'dj', 'special_event', 'sport'].includes(
        rule.schedule_type ?? ''
      )
    )
  ) {
    reasonToGoSignals.push('Event');
  }

  const supportiveSignals: string[] = [];

  if (normalizeBooleanFlag(venue.byo_allowed)) supportiveSignals.push('BYO');
  if (isBottleShop) supportiveSignals.push('Bottle shop');
  if (normalizeBooleanFlag(venue.dog_friendly)) supportiveSignals.push('Dog friendly');
  if (normalizeBooleanFlag(venue.kid_friendly)) supportiveSignals.push('Kid friendly');

  const hasCoreFields =
    hasText(venue.name) && hasText(venue.suburb) && hasText(venueTypeLabel ?? venue.venue_type_id);
  const hasReasonToGo = reasonToGoSignals.length > 0;
  const isOffStrategy = isExplicitlyOffStrategy(venueTypeLabel);
  const fitsFirstRound = !isOffStrategy;
  const isPublishReady = hasCoreFields && hasOperatingVisibility && hasReasonToGo;
  const coreDiscoveryEligible = fitsFirstRound && hasReasonToGo;

  const missingCriticalData: string[] = [];
  if (!hasText(venue.name)) missingCriticalData.push('Missing venue name');
  if (!hasText(venue.suburb)) missingCriticalData.push('Missing suburb');
  if (!hasText(venueTypeLabel ?? venue.venue_type_id)) missingCriticalData.push('Missing venue type');
  if (!hasOperatingVisibility) missingCriticalData.push('Missing opening visibility');
  if (!hasReasonToGo) missingCriticalData.push('Missing reason to go');

  const warnings: string[] = [];
  if (isOffStrategy) {
    warnings.push('This venue looks off-strategy for the current drink-led First Round focus.');
  }
  if (isBottleShop && !hasReasonToGo) {
    warnings.push('Bottle shop is supportive, but it should not drive core discovery without a tasting, event, or another real reason to go.');
  }
  if (!hasReasonToGo) {
    warnings.push('Supportive signals like BYO, bottle shop, dog friendly, and kid friendly do not count as a core reason to go on their own.');
  }

  return {
    venueTypeLabel,
    hasCoreFields,
    hasOperatingVisibility,
    hasReasonToGo,
    isPublishReady,
    fitsFirstRound,
    isOffStrategy,
    coreDiscoveryEligible,
    isBottleShop,
    missingCriticalData,
    reasonToGoSignals: Array.from(new Set(reasonToGoSignals)),
    supportiveSignals,
    warnings,
  };
}
