-- Run this in the Supabase SQL Editor for the busy-app project.
-- It enables Bottle Shop Hours in venue_schedule_rules by extending the enum.

alter type public.schedule_type_enum add value if not exists 'bottle_shop';
