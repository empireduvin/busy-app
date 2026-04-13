-- First Round: venue + schedule support hardening
-- Safe, additive support for public discovery, admin, and portal flows.

alter table if exists public.venues
  add column if not exists booking_url text;

alter table if exists public.venues
  add column if not exists google_maps_uri text;

alter table if exists public.venues
  add column if not exists google_user_rating_count integer;

alter table if exists public.venues
  add column if not exists plays_with_sound boolean;

alter table if exists public.venues
  add column if not exists byo_allowed boolean;

alter table if exists public.venues
  add column if not exists byo_notes text;

alter table if exists public.venues
  add column if not exists bottle_shop_hours jsonb;

alter table if exists public.venues
  add column if not exists timezone text;

alter table if exists public.venues
  add column if not exists is_temporarily_closed boolean;

alter table if exists public.venues
  add column if not exists status text;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'venues'
  ) then
    update public.venues
    set timezone = 'Australia/Sydney'
    where timezone is null or trim(timezone) = '';

    update public.venues
    set is_temporarily_closed = false
    where is_temporarily_closed is null;

    create index if not exists idx_venues_suburb_upper
      on public.venues ((upper(suburb)));

    create index if not exists idx_venues_status_lower
      on public.venues ((lower(status)));

    create index if not exists idx_venues_venue_type_id
      on public.venues (venue_type_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'venue_schedule_rules'
  ) then
    create table public.venue_schedule_rules (
      id uuid primary key default gen_random_uuid(),
      venue_id uuid not null references public.venues(id) on delete cascade,
      schedule_type public.schedule_type_enum not null,
      day_of_week text not null,
      start_time time not null,
      end_time time not null,
      sort_order integer not null default 0,
      title text,
      description text,
      deal_text text,
      notes text,
      detail_json jsonb,
      is_active boolean not null default true,
      status public.schedule_status_enum not null default 'published',
      created_at timestamptz not null default timezone('utc', now()),
      updated_at timestamptz not null default timezone('utc', now())
    );
  end if;
end $$;

alter table if exists public.venue_schedule_rules
  add column if not exists sort_order integer;

alter table if exists public.venue_schedule_rules
  add column if not exists detail_json jsonb;

alter table if exists public.venue_schedule_rules
  add column if not exists is_active boolean;

alter table if exists public.venue_schedule_rules
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table if exists public.venue_schedule_rules
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'venue_schedule_rules'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'venue_schedule_rules'
      and column_name = 'status'
  )
  and exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'schedule_status_enum'
  ) then
    begin
      execute '
        alter table public.venue_schedule_rules
        alter column status type public.schedule_status_enum
        using case
          when status is null or trim(status) = '''' then null
          else lower(trim(status))::public.schedule_status_enum
        end
      ';
    exception
      when undefined_function or invalid_text_representation then null;
    end;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'venue_schedule_rules'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'venue_schedule_rules'
      and column_name = 'status'
  )
  and exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'schedule_status_enum'
  ) then
    alter table public.venue_schedule_rules
      add column status public.schedule_status_enum default 'published';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'venue_schedule_rules'
  ) then
    update public.venue_schedule_rules
    set sort_order = 0
    where sort_order is null;

    update public.venue_schedule_rules
    set is_active = true
    where is_active is null;

    alter table public.venue_schedule_rules
      alter column sort_order set default 0;

    alter table public.venue_schedule_rules
      alter column is_active set default true;

    create index if not exists idx_venue_schedule_rules_lookup
      on public.venue_schedule_rules (venue_id, schedule_type, day_of_week, sort_order);

    create index if not exists idx_venue_schedule_rules_live
      on public.venue_schedule_rules (venue_id, schedule_type, status, is_active);

    create index if not exists idx_venue_schedule_rules_day
      on public.venue_schedule_rules (day_of_week);
  end if;
end $$;
