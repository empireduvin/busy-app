-- First Round: lookup and enum hardening
-- Safe, additive migration for launch-critical lookup data.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'schedule_type_enum'
  ) then
    create type public.schedule_type_enum as enum (
      'opening',
      'kitchen',
      'happy_hour',
      'bottle_shop',
      'trivia',
      'live_music',
      'sport',
      'comedy',
      'karaoke',
      'dj',
      'special_event'
    );
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'schedule_type_enum'
  ) then
    begin
      alter type public.schedule_type_enum add value if not exists 'opening';
      alter type public.schedule_type_enum add value if not exists 'kitchen';
      alter type public.schedule_type_enum add value if not exists 'happy_hour';
      alter type public.schedule_type_enum add value if not exists 'bottle_shop';
      alter type public.schedule_type_enum add value if not exists 'trivia';
      alter type public.schedule_type_enum add value if not exists 'live_music';
      alter type public.schedule_type_enum add value if not exists 'sport';
      alter type public.schedule_type_enum add value if not exists 'comedy';
      alter type public.schedule_type_enum add value if not exists 'karaoke';
      alter type public.schedule_type_enum add value if not exists 'dj';
      alter type public.schedule_type_enum add value if not exists 'special_event';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'schedule_status_enum'
  ) then
    create type public.schedule_status_enum as enum (
      'draft',
      'published',
      'archived',
      'deleted'
    );
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'schedule_status_enum'
  ) then
    begin
      alter type public.schedule_status_enum add value if not exists 'draft';
      alter type public.schedule_status_enum add value if not exists 'published';
      alter type public.schedule_status_enum add value if not exists 'archived';
      alter type public.schedule_status_enum add value if not exists 'deleted';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

alter table if exists public.venue_types
  add column if not exists label text;

alter table if exists public.venue_types
  add column if not exists slug text;

alter table if exists public.venue_types
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table if exists public.venue_types
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'venue_types'
  ) then
    create table public.venue_types (
      id uuid primary key default gen_random_uuid(),
      label text,
      slug text,
      created_at timestamptz not null default timezone('utc', now()),
      updated_at timestamptz not null default timezone('utc', now())
    );
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'venue_types'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'venue_types'
        and column_name = 'name'
    ) then
      execute '
        update public.venue_types
        set label = coalesce(nullif(trim(label), ''''), initcap(trim(name)))
        where name is not null
          and trim(name) <> ''''
          and (label is null or trim(label) = '''')
      ';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'venue_types'
        and column_name = 'title'
    ) then
      execute '
        update public.venue_types
        set label = coalesce(nullif(trim(label), ''''), trim(title))
        where title is not null
          and trim(title) <> ''''
          and (label is null or trim(label) = '''')
      ';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'venue_types'
        and column_name = 'venue_type'
    ) then
      execute '
        update public.venue_types
        set slug = coalesce(nullif(trim(slug), ''''), lower(trim(venue_type)))
        where venue_type is not null
          and trim(venue_type) <> ''''
          and (slug is null or trim(slug) = '''')
      ';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'venue_types'
        and column_name = 'type_name'
    ) then
      execute '
        update public.venue_types
        set slug = coalesce(nullif(trim(slug), ''''), lower(trim(type_name)))
        where type_name is not null
          and trim(type_name) <> ''''
          and (slug is null or trim(slug) = '''')
      ';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'venue_types'
        and column_name = 'display_name'
    ) then
      execute '
        update public.venue_types
        set label = coalesce(nullif(trim(label), ''''), trim(display_name))
        where display_name is not null
          and trim(display_name) <> ''''
          and (label is null or trim(label) = '''')
      ';
    end if;

    update public.venue_types
    set label = initcap(replace(trim(slug), '_', ' '))
    where (label is null or trim(label) = '')
      and slug is not null
      and trim(slug) <> '';

    update public.venue_types
    set slug = lower(regexp_replace(trim(label), '\s+', '_', 'g'))
    where (slug is null or trim(slug) = '')
      and label is not null
      and trim(label) <> '';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'venue_types'
  ) then
    create index if not exists idx_venue_types_label_lower
      on public.venue_types ((lower(label)));

    create index if not exists idx_venue_types_slug_lower
      on public.venue_types ((lower(slug)));
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'venue_types'
  ) then
    if not exists (
      select 1
      from public.venue_types
      where lower(coalesce(label, '')) = 'pub'
         or lower(coalesce(slug, '')) = 'pub'
    ) then
      insert into public.venue_types (label, slug) values ('Pub', 'pub');
    end if;

    if not exists (
      select 1
      from public.venue_types
      where lower(coalesce(label, '')) = 'bar'
         or lower(coalesce(slug, '')) = 'bar'
    ) then
      insert into public.venue_types (label, slug) values ('Bar', 'bar');
    end if;

    if not exists (
      select 1
      from public.venue_types
      where lower(coalesce(label, '')) = 'restaurant'
         or lower(coalesce(slug, '')) = 'restaurant'
    ) then
      insert into public.venue_types (label, slug) values ('Restaurant', 'restaurant');
    end if;

    if not exists (
      select 1
      from public.venue_types
      where lower(coalesce(label, '')) = 'cafe'
         or lower(coalesce(slug, '')) = 'cafe'
    ) then
      insert into public.venue_types (label, slug) values ('Cafe', 'cafe');
    end if;

    if not exists (
      select 1
      from public.venue_types
      where lower(coalesce(label, '')) = 'bottle shop'
         or lower(coalesce(slug, '')) = 'bottle_shop'
    ) then
      insert into public.venue_types (label, slug) values ('Bottle Shop', 'bottle_shop');
    end if;
  end if;
end $$;
