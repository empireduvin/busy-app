-- First Round: lightweight manual Instagram/social venue signals.

alter table if exists public.venues
  add column if not exists instagram_handle text,
  add column if not exists instagram_url text,
  add column if not exists featured_instagram_url text,
  add column if not exists social_freshness_label text,
  add column if not exists social_note text,
  add column if not exists social_last_updated_at timestamptz;
