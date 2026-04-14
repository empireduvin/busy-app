# First Round Supabase Soft Launch Checks

Use these checks in the Supabase SQL Editor against the project you plan to use for the soft launch.

Goal:
- confirm the live Supabase project matches what the codebase currently expects
- catch launch-breaking schema/auth/RLS issues before deploying to Vercel

## 1. Confirm core tables exist

These are the launch-critical tables currently referenced by the app code:
- `venues`
- `venue_types`
- `venue_schedule_rules`
- `admin_users`
- `profiles`
- `venue_user_access`
- `liquor_venues`
- `events`

Run:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename in (
  'venues',
  'venue_types',
  'venue_schedule_rules',
  'admin_users',
  'profiles',
  'venue_user_access',
  'liquor_venues',
  'events'
)
order by tablename;
```

What you want:
- all rows returned
- `admin_users`, `profiles`, and `venue_user_access` present
- `venues`, `venue_types`, and `venue_schedule_rules` present

## 2. Confirm schedule enum values exist

The code expects these schedule types:
- `opening`
- `kitchen`
- `happy_hour`
- `bottle_shop`
- `trivia`
- `live_music`
- `sport`
- `comedy`
- `karaoke`
- `dj`
- `special_event`

Run:

```sql
select
  t.typname as enum_name,
  e.enumsortorder,
  e.enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
and t.typname in ('schedule_type_enum', 'schedule_status_enum')
order by t.typname, e.enumsortorder;
```

What you want:
- `schedule_type_enum` exists
- it includes `bottle_shop`
- event types above are present

## 3. Confirm required venue types exist

The current app explicitly expects `Cafe` and `Bottle Shop` support.

Run:

```sql
select *
from public.venue_types
order by 1;
```

Then verify at minimum that your data includes rows representing:
- `Cafe`
- `Bottle Shop`
- your other active venue types such as `Pub`, `Restaurant`, `Bar`, etc.

If your table has `label` and `slug`, this narrower check is useful:

```sql
select label, slug
from public.venue_types
where lower(coalesce(label, '')) in ('cafe', 'bottle shop')
   or lower(coalesce(slug, '')) in ('cafe', 'bottle_shop')
order by label;
```

## 4. Confirm auth/access tables have data

Run:

```sql
select 'profiles' as table_name, count(*) as row_count from public.profiles
union all
select 'admin_users' as table_name, count(*) as row_count from public.admin_users
union all
select 'venue_user_access' as table_name, count(*) as row_count from public.venue_user_access;
```

What you want:
- at least 1 `admin_users` row
- at least 1 `profiles` row if you already created login users
- `venue_user_access` rows if portal users are part of the soft launch

## 5. Confirm admin users resolve correctly

Run:

```sql
select
  a.user_id,
  p.email,
  p.full_name,
  a.created_at
from public.admin_users a
left join public.profiles p on p.id = a.user_id
order by a.created_at desc;
```

What you want:
- your intended admin account is present
- email resolves correctly through `profiles`

## 6. Confirm venue-manager assignments resolve correctly

Run:

```sql
select
  p.email,
  p.full_name,
  v.name as venue_name,
  vua.role,
  vua.created_at
from public.venue_user_access vua
left join public.profiles p on p.id = vua.user_id
left join public.venues v on v.id = vua.venue_id
order by p.email, v.name;
```

What you want:
- each venue-manager account is linked to the correct venue(s)
- no missing venue names

## 7. Confirm venues and schedule data are populated

Run:

```sql
select 'venues' as table_name, count(*) as row_count from public.venues
union all
select 'venue_schedule_rules' as table_name, count(*) as row_count from public.venue_schedule_rules
union all
select 'liquor_venues' as table_name, count(*) as row_count from public.liquor_venues
union all
select 'events' as table_name, count(*) as row_count from public.events;
```

What you want:
- `venues` contains your soft-launch venue set
- `venue_schedule_rules` contains published rows for hours / happy hour / events as needed

## 8. Confirm launch-critical public RLS state

The repo does not fully prove the production project setup, so verify the public-facing tables manually.

Run:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename in (
  'venues',
  'venue_types',
  'venue_schedule_rules',
  'events',
  'liquor_venues'
)
order by tablename;
```

And:

```sql
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
and tablename in (
  'venues',
  'venue_types',
  'venue_schedule_rules',
  'admin_users',
  'profiles',
  'venue_user_access',
  'events',
  'liquor_venues'
)
order by tablename, policyname;
```

What you want:
- no obviously missing policies on tables that rely on RLS
- auth/access tables not accidentally wide open
- public website tables readable in the way your current app expects

## 9. Confirm one known venue looks correct

Use a real venue you plan to show in the soft launch.

Example pattern:

```sql
select
  id,
  name,
  suburb,
  venue_type_id,
  shows_sport,
  plays_with_sound,
  dog_friendly,
  kid_friendly,
  website_url
from public.venues
where lower(name) like '%bank%';
```

Then confirm related schedule rows:

```sql
select
  venue_id,
  schedule_type,
  day_of_week,
  start_time,
  end_time,
  title,
  deal_text,
  status,
  is_active
from public.venue_schedule_rules
where venue_id = 'PASTE_VENUE_UUID_HERE'
order by schedule_type, day_of_week, start_time;
```

What you want:
- the venue row matches what you expect publicly
- the schedule rows reflect the content you want friends to test

## 10. Soft launch go / no-go decision

Soft launch is generally safe if all of the below are true:
- required tables exist
- schedule enum values exist
- `Cafe` and `Bottle Shop` venue types exist if you plan to use them
- at least one admin account works
- venue-manager assignments are correct if portal users are included
- venue and schedule data exist for the venues you want to show
- RLS/policies are not obviously broken

Defer for later if needed:
- full migration formalization
- broader lint cleanup
- full production hardening
- wider mobile polish beyond launch-critical paths

## 11. Confirm password reset redirect setup

The app now expects password recovery emails to send users to:
- `/reset-password`

What to verify in Supabase Authentication settings:
- `Site URL` matches your real app origin for the current environment
- `Redirect URLs` includes your local and deployed reset URLs

Typical values:
- `http://localhost:3000/reset-password`
- `https://your-production-domain.com/reset-password`

Notes:
- the login screen now calls `supabase.auth.resetPasswordForEmail(...)` with an explicit `redirectTo`
- if Supabase does not allow that redirect URL, the email may still fall back to the main site or fail recovery
- if a reset link opens but no recovery session is present, request a fresh email and confirm the allowed redirect list is correct
