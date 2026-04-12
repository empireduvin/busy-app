export type OpeningHours = {
  monday?: Array<{ open: string; close: string }>;
  tuesday?: Array<{ open: string; close: string }>;
  wednesday?: Array<{ open: string; close: string }>;
  thursday?: Array<{ open: string; close: string }>;
  friday?: Array<{ open: string; close: string }>;
  saturday?: Array<{ open: string; close: string }>;
  sunday?: Array<{ open: string; close: string }>;
};

export function isRestaurantOrCafeVenueType(venueTypeName: string | null): boolean {
  if (!venueTypeName || typeof venueTypeName !== 'string') return false;
  const lower = venueTypeName.toLowerCase();
  return (
    lower.includes('restaurant') ||
    lower.includes('cafe') ||
    lower.includes('café') ||
    lower.includes('coffee')
  );
}

export function isBottleShopVenueType(venueTypeName: string | null): boolean {
  if (!venueTypeName || typeof venueTypeName !== 'string') return false;
  const lower = venueTypeName.toLowerCase();
  return (
    lower.includes('bottle shop') ||
    lower.includes('bottle_shop') ||
    lower.includes('liquor')
  );
}

export function getEffectiveKitchenHours(
  venueTypeName: string | null,
  openingHours: OpeningHours | null,
  fallback: OpeningHours | null
): OpeningHours | null {
  // Restaurants and cafes default kitchen hours to opening hours
  if (isRestaurantOrCafeVenueType(venueTypeName) && openingHours) {
    return openingHours;
  }
  // Bottle shops should not inherit kitchen hours by default.
  if (isBottleShopVenueType(venueTypeName)) {
    return null;
  }
  // Otherwise, preserve any explicit kitchen hours that were already set.
  return fallback;
}
