-- First Round: public Supabase Storage bucket for primary venue images.
-- Uploads are handled by the app server with the service role key.

insert into storage.buckets (id, name, public)
values ('venue-images', 'venue-images', true)
on conflict (id) do update
set public = true;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'venue_images_public_read'
  ) then
    create policy venue_images_public_read
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'venue-images');
  end if;
end $$;
