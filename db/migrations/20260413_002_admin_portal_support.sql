-- First Round: admin + portal support tables and indexes
-- Safe, additive support for auth-linked access control.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.profiles
  add column if not exists email text;

alter table if exists public.profiles
  add column if not exists full_name text;

alter table if exists public.profiles
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table if exists public.profiles
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists idx_profiles_email_lower
  on public.profiles ((lower(email)));

create table if not exists public.admin_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.admin_users
  add column if not exists created_at timestamptz not null default timezone('utc', now());

create index if not exists idx_admin_users_created_at
  on public.admin_users (created_at desc);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'admin_users'
  )
  and not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_admin_users_user_id_unique'
  )
  and not exists (
    select user_id
    from public.admin_users
    group by user_id
    having count(*) > 1
  ) then
    create unique index idx_admin_users_user_id_unique
      on public.admin_users (user_id);
  end if;
end $$;

create table if not exists public.venue_user_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  role text not null default 'manager',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, venue_id)
);

alter table if exists public.venue_user_access
  add column if not exists role text;

alter table if exists public.venue_user_access
  add column if not exists created_at timestamptz not null default timezone('utc', now());

update public.venue_user_access
set role = 'manager'
where role is null or trim(role) = '';

alter table if exists public.venue_user_access
  alter column role set default 'manager';

create index if not exists idx_venue_user_access_user_id
  on public.venue_user_access (user_id);

create index if not exists idx_venue_user_access_venue_id
  on public.venue_user_access (venue_id);

create index if not exists idx_venue_user_access_role
  on public.venue_user_access (role);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'venue_user_access'
  )
  and not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_venue_user_access_user_venue_unique'
  )
  and not exists (
    select user_id, venue_id
    from public.venue_user_access
    group by user_id, venue_id
    having count(*) > 1
  ) then
    create unique index idx_venue_user_access_user_venue_unique
      on public.venue_user_access (user_id, venue_id);
  end if;
end $$;
