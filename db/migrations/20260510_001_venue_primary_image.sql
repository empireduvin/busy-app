-- First Round: lightweight primary venue image support.

alter table if exists public.venues
  add column if not exists primary_image_url text,
  add column if not exists primary_image_source text,
  add column if not exists primary_image_attribution text,
  add column if not exists primary_image_alt text;
