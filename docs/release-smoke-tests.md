# First Round Release Smoke Tests

Use this after every production deploy and before sharing a preview or live link more broadly.

## 1. Build and deploy sanity
- Confirm the latest Vercel production deployment is `Ready`.
- Confirm the deployed commit matches the intended branch and commit message.
- Confirm required Production env vars are present in Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
  - `NSW_API_KEY`
  - `NSW_API_SECRET`
  - `NSW_OAUTH_URL`
  - `NSW_LIQUOR_BASE_URL`

## 2. Public smoke tests
Run these on `https://firstroundapp.com`:

### Core routes
- `/`
- `/livenow`
- `/today`
- `/venues`
- `/contact`

### What to verify
- page loads without crashing
- top nav renders correctly
- search and filters respond
- empty states are readable and recoverable
- venue cards open the correct public venue page
- contact CTA is visible in nav/footer

## 3. Public map checks
Run on:
- `/livenow`
- `/today`
- `/venues`

Verify:
- `Show map` reveals the map near the top of the page
- markers render
- zoom controls work
- map labels match page context
- changing filters/search while map is visible still gives sensible markers

If maps fail:
- check browser console for `RefererNotAllowedMapError`
- verify Google Maps key referrers include:
  - `https://firstroundapp.com/*`
  - `https://www.firstroundapp.com/*`
  - `https://*.vercel.app/*`
  - localhost refs if testing locally

## 4. Auth verification

### Public user
- open `/admin`
- open `/portal`
- confirm redirect or unauthorized state, not a blank/broken page

### Admin user
- sign in at `/login`
- confirm redirect to `/admin`
- confirm admin page loads
- save one safe venue edit
- save one safe schedule change

### Venue manager user
- sign in at `/login`
- confirm portal loads
- confirm only assigned venues appear
- open an assigned venue workspace
- confirm an unrelated venue URL is denied

## 5. Admin + portal write checks
- Admin:
  - venue save works
  - schedule save works
  - venue access assignment still works
- Portal:
  - venue details save works
  - schedule save works

## 6. Mobile spot check
On a real phone if possible:
- `/livenow`
- `/today`
- `/venues`
- `/login`
- one `/portal` page

Check:
- filter tap targets
- map height and zoom usability
- long text wrapping
- venue action buttons

## 7. Rollback basics
If the latest deployment is bad:
1. Stop testing on the broken deploy.
2. In Vercel, open the last known-good production deployment.
3. Use Vercel rollback/re-promote that deployment.
4. Re-run Sections 2 to 5 above.
5. Record the failed commit and observed symptoms in `docs/project-status.md`.

## 8. Release log
After each production deploy, record:
- date/time
- deployed commit
- env changes made
- smoke-test outcome
- rollback needed? yes/no
