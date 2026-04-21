-- First Round: public saved venues v1
-- Launch-safe table + policies for user-saved venues, plus profile sync for new auth users.

create or replace function public.handle_auth_user_profile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = timezone('utc', now());

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created_sync_profile'
  ) then
    create trigger on_auth_user_created_sync_profile
      after insert on auth.users
      for each row execute function public.handle_auth_user_profile_sync();
  end if;
end $$;

insert into public.profiles (id, email, full_name, created_at, updated_at)
select
  au.id,
  au.email,
  coalesce(
    au.raw_user_meta_data ->> 'full_name',
    au.raw_user_meta_data ->> 'name'
  ),
  timezone('utc', now()),
  timezone('utc', now())
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null
on conflict (id) do nothing;

create table if not exists public.saved_venues (
  user_id uuid not null references public.profiles(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, venue_id)
);

create index if not exists idx_saved_venues_user_id
  on public.saved_venues (user_id);

create index if not exists idx_saved_venues_venue_id
  on public.saved_venues (venue_id);

create index if not exists idx_saved_venues_created_at
  on public.saved_venues (created_at desc);

create or replace function public.set_saved_venues_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'saved_venues_set_updated_at'
  ) then
    create trigger saved_venues_set_updated_at
      before update on public.saved_venues
      for each row execute function public.set_saved_venues_updated_at();
  end if;
end $$;

alter table if exists public.saved_venues enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_venues'
      and policyname = 'saved_venues_select_own'
  ) then
    create policy saved_venues_select_own
      on public.saved_venues
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_venues'
      and policyname = 'saved_venues_insert_own'
  ) then
    create policy saved_venues_insert_own
      on public.saved_venues
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_venues'
      and policyname = 'saved_venues_delete_own'
  ) then
    create policy saved_venues_delete_own
      on public.saved_venues
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;
