-- First Round: lightweight same-day public venue intent.

create table if not exists public.venue_user_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  intent_type text not null check (intent_type in ('thinking', 'going')),
  created_at timestamptz not null default timezone('utc', now()),
  intent_date date not null default (timezone('Australia/Sydney', now())::date),
  unique (user_id, venue_id, intent_date)
);

create index if not exists idx_venue_user_intents_venue_date
  on public.venue_user_intents (venue_id, intent_date);

create index if not exists idx_venue_user_intents_user_id
  on public.venue_user_intents (user_id);

alter table if exists public.venue_user_intents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'venue_user_intents'
      and policyname = 'venue_user_intents_select_own'
  ) then
    create policy venue_user_intents_select_own
      on public.venue_user_intents
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
      and tablename = 'venue_user_intents'
      and policyname = 'venue_user_intents_insert_own'
  ) then
    create policy venue_user_intents_insert_own
      on public.venue_user_intents
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
      and tablename = 'venue_user_intents'
      and policyname = 'venue_user_intents_update_own'
  ) then
    create policy venue_user_intents_update_own
      on public.venue_user_intents
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'venue_user_intents'
      and policyname = 'venue_user_intents_delete_own'
  ) then
    create policy venue_user_intents_delete_own
      on public.venue_user_intents
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;
