# Austin Posters

React/Vite gallery backed by Supabase. Public visitors can read poster records and view images. The `#admin` screen supports authenticated, allowlisted administrators importing a folder or multiple image files.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's publishable key. A publishable key is safe in browser code; never use `SUPABASE_SECRET_KEY` or a legacy service-role key in a `VITE_` variable.
3. Run `npm install` and `npm run dev`.

The project URL is already shown in `.env.example`. Local `.env` files are ignored by Git.

## Supabase setup

The migration in `supabase/migrations/20261105234758_secure_poster_gallery_and_admin_import.sql` has been applied to project `ppltdobcwaunprldlerw`. For future migrations, use the current CLI v3 remote flags:

```sh
SUPABASE_TELEMETRY_DISABLED=1 npx supabase link --project-ref ppltdobcwaunprldlerw
SUPABASE_TELEMETRY_DISABLED=1 npx supabase db push --remote --yes
```

Create an email/password Auth user in the Supabase dashboard. Then explicitly allowlist that user's UUID with the SQL editor:

```sql
insert into public.admin_users (user_id)
values ('AUTH_USER_UUID');
```

Signing in alone grants no write access. The database and Storage policies require a matching `admin_users` row. Refresh the session or sign in again after adding the allowlist row.

## Import behavior

- Numeric filenames such as `01.jpg`, `46.jpg`, and `117.jpg` retain their poster numbers.
- Hidden and unsupported files are ignored; ambiguous names require correction.
- Existing and in-selection duplicate numbers are skipped by default.
- Object paths use `old/<number>.<extension>`, with at least two digits.
- Each import also creates a 1600px, quality-78 WebP at `web/old/<number>.webp`. The original remains untouched and `posters.image` continues to reference it; `posters.optimized_image` references the web copy.
- Files larger than 6 MB use resumable TUS uploads; smaller files use standard uploads. Imports run with concurrency 3 and never upsert.
- An uploaded object whose optimization or database insert fails remains visible in the preview. Retry resumes at the failed stage without uploading successful files again, or cleanup safely removes the unowned objects.
- Blank collection and creation date values are inserted as SQL `NULL`.

## Optimizing existing posters

Open **Admin → Manage posters** and choose **Optimize all missing** to generate web-sized copies for existing records. Processing is sequential to keep browser memory stable with large originals. You can also select specific rows and choose **Optimize selected**, or use the per-row **Optimize** action to retry a failure.

The public gallery automatically prefers `optimized_image` and falls back to the original until a derivative exists. Removing a poster deletes both its original and generated web copy, while Storage policy prevents deletion of either file as long as a poster record still references it.

For a trusted local backfill using the original source folder, load the non-browser `SUPABASE_SECRET_KEY` into your shell and run:

```sh
npm run optimize:existing -- "/absolute/path/to/numbered/posters"
```

This command never overwrites a Storage object. It reuses a deterministic unowned derivative after an interrupted run and only processes records whose `optimized_image` is still NULL. Never place the secret key in a `VITE_` variable.

The initial iCloud batch must be selected in the browser and reviewed before the administrator clicks **Start import**; the app never auto-uploads a filesystem path.
