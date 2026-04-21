export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type ScheduleType =
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

export type VenueRuleKind = 'kid' | 'dog';

export const DAY_OPTIONS: Array<{ value: DayOfWeek; label: string }> = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

export const SCHEDULE_TYPE_OPTIONS: Array<{ value: ScheduleType; label: string }> = [
  { value: 'opening', label: 'Opening Hours' },
  { value: 'kitchen', label: 'Kitchen Hours' },
  { value: 'happy_hour', label: 'Happy Hour' },
  { value: 'bottle_shop', label: 'Bottle Shop Hours' },
  { value: 'daily_special', label: 'Daily Specials' },
  { value: 'lunch_special', label: 'Lunch Specials' },
  { value: 'venue_rule', label: 'Venue Rules' },
  { value: 'trivia', label: 'Trivia' },
  { value: 'live_music', label: 'Live Music' },
  { value: 'sport', label: 'Sport' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'dj', label: 'DJ' },
  { value: 'special_event', label: 'Special Event' },
];

export const HOURS_SCHEDULE_TYPES: ScheduleType[] = [
  'opening',
  'kitchen',
  'happy_hour',
  'bottle_shop',
];

export const DEAL_SCHEDULE_TYPES: ScheduleType[] = [
  'daily_special',
  'lunch_special',
];

export const EVENT_SCHEDULE_TYPES: ScheduleType[] = [
  'trivia',
  'live_music',
  'sport',
  'comedy',
  'karaoke',
  'dj',
  'special_event',
];

export const VENUE_RULE_SCHEDULE_TYPES: ScheduleType[] = ['venue_rule'];

export const VENUE_RULE_KIND_OPTIONS: Array<{ value: VenueRuleKind; label: string }> = [
  { value: 'kid', label: 'Kids Allowed' },
  { value: 'dog', label: 'Dog Friendly' },
];

export function isEventScheduleType(value: ScheduleType) {
  return EVENT_SCHEDULE_TYPES.includes(value);
}

export function isDealScheduleType(value: ScheduleType) {
  return DEAL_SCHEDULE_TYPES.includes(value);
}

export function isVenueRuleScheduleType(value: ScheduleType) {
  return value === 'venue_rule';
}

export function isHoursScheduleType(value: ScheduleType) {
  return HOURS_SCHEDULE_TYPES.includes(value);
}

export function getScheduleTypeLabel(value: ScheduleType) {
  return SCHEDULE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getVenueRuleKindLabel(value: VenueRuleKind) {
  return VENUE_RULE_KIND_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function isValidDayOfWeek(value: string): value is DayOfWeek {
  return DAY_OPTIONS.some((option) => option.value === value);
}

export function isValidScheduleType(value: string): value is ScheduleType {
  return SCHEDULE_TYPE_OPTIONS.some((option) => option.value === value);
}

export function isValidVenueRuleKind(value: string): value is VenueRuleKind {
  return VENUE_RULE_KIND_OPTIONS.some((option) => option.value === value);
}
