-- Run this in the Supabase SQL Editor.
-- It adds a Bottle Shop venue type so the admin can save venues using that type.
--
-- This script is written to work with the common venue_types table shapes used in this app.

do $$
declare
  inserted boolean := false;
begin
  begin
    insert into public.venue_types (label)
    select 'Bottle Shop'
    where not exists (
      select 1 from public.venue_types
      where lower(coalesce(label, '')) = 'bottle shop'
    );
    inserted := true;
  exception when undefined_column then
    null;
  end;

  if not inserted then
    begin
      insert into public.venue_types (name)
      select 'bottle shop'
      where not exists (
        select 1 from public.venue_types
        where lower(coalesce(name, '')) = 'bottle shop'
      );
      inserted := true;
    exception when undefined_column then
      null;
    end;
  end if;

  if not inserted then
    begin
      insert into public.venue_types (title)
      select 'Bottle Shop'
      where not exists (
        select 1 from public.venue_types
        where lower(coalesce(title, '')) = 'bottle shop'
      );
      inserted := true;
    exception when undefined_column then
      null;
    end;
  end if;

  if not inserted then
    begin
      insert into public.venue_types (venue_type)
      select 'bottle_shop'
      where not exists (
        select 1 from public.venue_types
        where lower(coalesce(venue_type, '')) in ('bottle shop', 'bottle_shop')
      );
      inserted := true;
    exception when undefined_column then
      null;
    end;
  end if;

  if not inserted then
    begin
      insert into public.venue_types (slug)
      select 'bottle_shop'
      where not exists (
        select 1 from public.venue_types
        where lower(coalesce(slug, '')) = 'bottle_shop'
      );
      inserted := true;
    exception when undefined_column then
      null;
    end;
  end if;

  if not inserted then
    begin
      insert into public.venue_types (type_name)
      select 'bottle shop'
      where not exists (
        select 1 from public.venue_types
        where lower(coalesce(type_name, '')) = 'bottle shop'
      );
      inserted := true;
    exception when undefined_column then
      null;
    end;
  end if;

  if not inserted then
    begin
      insert into public.venue_types (display_name)
      select 'Bottle Shop'
      where not exists (
        select 1 from public.venue_types
        where lower(coalesce(display_name, '')) = 'bottle shop'
      );
      inserted := true;
    exception when undefined_column then
      null;
    end;
  end if;

  if not inserted then
    raise exception 'Could not insert Bottle Shop into public.venue_types. Check the table schema and add the row manually.';
  end if;
end $$;
