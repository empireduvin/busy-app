# First Round Database Migrations

These migrations capture launch-safe schema setup that had previously been handled
manually in the Supabase SQL editor.

Recommended apply order:

1. `20260413_001_lookup_and_enum_hardening.sql`
2. `20260413_002_admin_portal_support.sql`
3. `20260413_003_venue_and_schedule_support.sql`
4. `20260413_004_auth_rls_hardening.sql`

Notes:

- These migrations are additive and intended to be safe for an already-running app.
- They avoid destructive drops, renames, or forced data rewrites.
- Older files in `db/` are legacy one-off setup scripts; keep them for reference, but
  prefer the organized files in `db/migrations/` going forward.
