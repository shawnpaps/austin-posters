-- Public gallery reads with an explicit administrator allowlist for every write path.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

drop policy if exists "Administrators can read their allowlist entry" on public.admin_users;
create policy "Administrators can read their allowlist entry"
on public.admin_users
for select
to authenticated
using ((select auth.uid()) = user_id);

alter table public.posters enable row level security;

revoke all on table public.posters from anon, authenticated;
grant select on table public.posters to anon, authenticated;
grant insert, update, delete on table public.posters to authenticated;

drop policy if exists "Poster records are publicly readable" on public.posters;
create policy "Poster records are publicly readable"
on public.posters
for select
to anon, authenticated
using (true);

drop policy if exists "Administrators can insert poster records" on public.posters;
create policy "Administrators can insert poster records"
on public.posters
for insert
to authenticated
with check (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Administrators can update poster records" on public.posters;
create policy "Administrators can update poster records"
on public.posters
for update
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Administrators can delete poster records" on public.posters;
create policy "Administrators can delete poster records"
on public.posters
for delete
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'posters',
  'posters',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Administrators can inspect poster objects" on storage.objects;
create policy "Administrators can inspect poster objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'posters'
  and exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Administrators can upload poster objects" on storage.objects;
create policy "Administrators can upload poster objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'posters'
  and exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
);

-- The application never upserts, but an UPDATE policy is deliberately omitted so
-- a browser client cannot silently replace an existing object.

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
  )
);
