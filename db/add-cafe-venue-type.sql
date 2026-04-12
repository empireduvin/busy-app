-- Run this in the Supabase SQL Editor.
-- It adds a Cafe venue type so the admin can save venues using that type.
--
-- This script is written to work with the common venue_types table shapes used in this app.

do $$
declare
  inserted boolean := false;
begin
  begin
    insert into public.venue_types (label)
    select 'Cafe'
    where not exists (
      select 1 from public.venue_types
      where lower(coalesce(label, '')) = 'cafe'
    );
    inserted := true;
  exception when undefined_column then
    null;
  end;

  if not inserted then
    begin
      insert into public.venue_types (name)
      select 'cafe'
      where not exists (
        select 1 from public.venue_types
        where lower(coalesce(name, '')) = 'cafe'
      );
      inserted := true;
    exception when undefined_column then
      null;
    end;
  end if;

  if not inserted then
    begin
      insert into public.venue_types (title)
      select 'Cafe'
      where not exists (
        select 1 from public.venue_types
        where lower(coalesce(title, '')) = 'cafe'
      );
      inserted := true;
    exception when undefined_column then
      null;
    end;
  end if;

  if not inserted then
    begin
      insert into public.venue_types (venue_type)
      select 'cafe'
      where not exists (
        select 1 from public.venue_types
        where lower(coalesce(venue_type, '')) = 'cafe'
      );
      inserted := true;
    exception when undefined_column then
      null;
    end;
  end if;

  if not inserted then
    begin
      insert into public.venue_types (slug)
      select 'cafe'
      where not exists (
        select 1 from public.venue_types
        where lower(coalesce(slug, '')) = 'cafe'
      );
      inserted := true;
    exception when undefined_column then
      null;
    end;
  end if;

  if not inserted then
    begin
      insert into public.venue_types (type_name)
      select 'cafe'
      where not exists (
        select 1 from public.venue_types
        where lower(coalesce(type_name, '')) = 'cafe'
      );
      inserted := true;
    exception when undefined_column then
      null;
    end;
  end if;

  if not inserted then
    begin
      insert into public.venue_types (display_name)
      select 'Cafe'
      where not exists (
        select 1 from public.venue_types
        where lower(coalesce(display_name, '')) = 'cafe'
      );
      inserted := true;
    exception when undefined_column then
      null;
    end;
  end if;

  if not inserted then
    raise exception 'Could not insert Cafe into public.venue_types. Check the table schema and add the row manually.';
  end if;
end $$;
