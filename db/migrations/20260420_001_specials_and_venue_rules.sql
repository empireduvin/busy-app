-- First Round: extend schedule rules for specials and time-based venue rules.
-- Safe additive enum changes only. Existing rows and save flows stay intact.

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'schedule_type_enum'
  ) then
    alter type public.schedule_type_enum add value if not exists 'daily_special';
    alter type public.schedule_type_enum add value if not exists 'lunch_special';
    alter type public.schedule_type_enum add value if not exists 'venue_rule';
  end if;
end $$;
