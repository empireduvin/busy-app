export function getGoogleWeekdayDescriptions(openingHours: any): string[] {
  if (!openingHours) return [];

  return (
    openingHours?.regularOpeningHours?.weekdayDescriptions ??
    openingHours?.currentOpeningHours?.weekdayDescriptions ??
    []
  );
}