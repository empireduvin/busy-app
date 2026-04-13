-- First Round: auth and RLS hardening
-- Launch-safe policies for public, admin, and portal browser reads.

alter table if exists public.profiles enable row level security;
alter table if exists public.admin_users enable row level security;
alter table if exists public.venue_user_access enable row level security;
alter table if exists public.venues enable row level security;
alter table if exists public.venue_types enable row level security;
alter table if exists public.venue_schedule_rules enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles
      for select
      to authenticated
      using (auth.uid() = id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own
      on public.profiles
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_users'
      and policyname = 'admin_users_select_own'
  ) then
    create policy admin_users_select_own
      on public.admin_users
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
      and tablename = 'venue_user_access'
      and policyname = 'venue_user_access_select_self_or_admin'
  ) then
    create policy venue_user_access_select_self_or_admin
      on public.venue_user_access
      for select
      to authenticated
      using (
        auth.uid() = user_id
        or exists (
          select 1
          from public.admin_users au
          where au.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'venue_types'
      and policyname = 'venue_types_public_read'
  ) then
    create policy venue_types_public_read
      on public.venue_types
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'venues'
      and policyname = 'venues_public_or_member_read'
  ) then
    create policy venues_public_or_member_read
      on public.venues
      for select
      to anon, authenticated
      using (
        lower(coalesce(status, 'active')) in ('active', 'open', 'published')
        or exists (
          select 1
          from public.admin_users au
          where au.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.venue_user_access vua
          where vua.user_id = auth.uid()
            and vua.venue_id = venues.id
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'venue_schedule_rules'
      and policyname = 'venue_schedule_rules_public_or_member_read'
  ) then
    create policy venue_schedule_rules_public_or_member_read
      on public.venue_schedule_rules
      for select
      to anon, authenticated
      using (
        (
          is_active is true
          and lower(coalesce(status::text, 'published')) = 'published'
        )
        or exists (
          select 1
          from public.admin_users au
          where au.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.venue_user_access vua
          where vua.user_id = auth.uid()
            and vua.venue_id = venue_schedule_rules.venue_id
        )
      );
  end if;
end $$;
