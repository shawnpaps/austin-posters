alter table public.posters
add column if not exists optimized_image text;

comment on column public.posters.optimized_image is
'Optional web-sized derivative path in the posters Storage bucket. The image column remains the archival original.';

-- A derivative may only be removed after no poster references it as either an
-- original or an optimized image.
drop policy if exists "Administrators can clean up unowned poster objects" on storage.objects;
create policy "Administrators can clean up unowned poster objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'posters'
  and exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
  and not exists (
    select 1 from public.posters
    where image = storage.objects.name
       or optimized_image = storage.objects.name
  )
);
