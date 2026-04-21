alter table public.venues
  add column if not exists sport_notes text,
  add column if not exists dog_friendly_notes text,
  add column if not exists kid_friendly_notes text;
