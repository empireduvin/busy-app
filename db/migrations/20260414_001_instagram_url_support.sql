alter table public.venues
  add column if not exists instagram_url text;

comment on column public.venues.instagram_url is
  'Optional Instagram profile URL for public venue pages and admin/portal editing.';
