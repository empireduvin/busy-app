export type HappyHourPrice = {
  label: string | null;
  amount: number;
};

export type HappyHourDetailItem = {
  item: string | null;
  name: string | null;
  description: string | null;
  price: number | null;
  prices: HappyHourPrice[] | null;
};

export type HappyHourDetailCategory = HappyHourDetailItem[] | null;

export type HappyHourDetailJson = {
  beer?: HappyHourDetailCategory;
  wine?: HappyHourDetailCategory;
  spirits?: HappyHourDetailCategory;
  cocktails?: HappyHourDetailCategory;
  food?: HappyHourDetailCategory;
  notes?: string | null;
};

const VALID_SUBURBS = [
  'NEWTOWN',
  'ENMORE',
  'ERSKINEVILLE',
  'ALL',
];

export function normalizeVenueSuburb(value: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (VALID_SUBURBS.includes(normalized)) {
    return normalized;
  }
  return null;
}

export function normalizeHappyHourDetailCategory(
  category: HappyHourDetailCategory
): HappyHourDetailCategory {
  if (!Array.isArray(category)) return null;
  const filtered = category.filter((item) => {
    const name = item.name?.trim();
    return Boolean(name && name.length > 0);
  });
  return filtered.length > 0 ? filtered : null;
}

export function normalizeHappyHourDetailJson(
  value: HappyHourDetailJson | null | undefined
): HappyHourDetailJson | null {
  if (!value || typeof value !== 'object') return null;
  const normalized: HappyHourDetailJson = {};
  if (value.beer) {
    const cleaned = normalizeHappyHourDetailCategory(value.beer);
    if (cleaned) normalized.beer = cleaned;
  }
  if (value.wine) {
    const cleaned = normalizeHappyHourDetailCategory(value.wine);
    if (cleaned) normalized.wine = cleaned;
  }
  if (value.spirits) {
    const cleaned = normalizeHappyHourDetailCategory(value.spirits);
    if (cleaned) normalized.spirits = cleaned;
  }
  if (value.cocktails) {
    const cleaned = normalizeHappyHourDetailCategory(value.cocktails);
    if (cleaned) normalized.cocktails = cleaned;
  }
  if (value.food) {
    const cleaned = normalizeHappyHourDetailCategory(value.food);
    if (cleaned) normalized.food = cleaned;
  }
  if (value.notes && typeof value.notes === 'string') {
    const trimmed = value.notes.trim();
    if (trimmed) {
      normalized.notes = trimmed;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function getHappyHourItemPrices(
  item: HappyHourDetailItem
): HappyHourPrice[] {
  if (!item.prices || !Array.isArray(item.prices)) {
    if (item.price != null) {
      return [{ label: null, amount: item.price }];
    }
    return [];
  }
  return item.prices;
}
