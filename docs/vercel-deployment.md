# First Round Vercel Deployment

## Current status
- The app is structured as a standard Next.js project and is deployable to Vercel.
- Supabase is used in both browser and server contexts.
- Server-side admin and portal APIs require `SUPABASE_SERVICE_ROLE_KEY`.
- Public venue pages, admin, portal, Google Maps, and NSW liquor endpoints all depend on environment variables being present.

## Required environment variables

Set these in Vercel for Production, Preview, and Development as needed:

### Required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NSW_API_KEY`
- `NSW_API_SECRET`
- `NSW_OAUTH_URL`
- `NSW_LIQUOR_BASE_URL`

### Optional / legacy compatibility
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `GOOGLE_MAPS_API_KEY`

Use [.env.example](/c:/Users/nickn/busy-app/.env.example) as the source of truth for names.

## Supabase production readiness check

Verified from code:
- Browser-side Supabase clients use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in:
  - [lib/supabase-browser.ts](/c:/Users/nickn/busy-app/lib/supabase-browser.ts)
  - [lib/supabaseClient.ts](/c:/Users/nickn/busy-app/lib/supabaseClient.ts)
- Server-side protected routes use `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in:
  - [lib/supabaseServer.ts](/c:/Users/nickn/busy-app/lib/supabaseServer.ts)
  - [lib/admin-server.ts](/c:/Users/nickn/busy-app/lib/admin-server.ts)
  - [lib/portal-server.ts](/c:/Users/nickn/busy-app/lib/portal-server.ts)
- Public liquor lookup API now accepts the standard public Supabase key in:
  - [app/api/venues/route.ts](/c:/Users/nickn/busy-app/app/api/venues/route.ts)

Not fully verifiable from repo alone:
- Whether the target Supabase project has the exact schema, RLS policies, and seeded rows required in production
- Whether the configured Vercel env vars point to the intended production Supabase project

Use [docs/supabase-soft-launch-checks.md](/c:/Users/nickn/busy-app/docs/supabase-soft-launch-checks.md) for copy-paste SQL to verify the target Supabase project before soft launch.

## Deployment blockers

### High priority
- Full Supabase setup is not fully captured as versioned migrations in the repo.
  - This is the main blocker to repeatable production deploys.
- Secrets currently exist in local `.env.local`; they should be rotated if they have been shared outside secure tooling.

### Medium priority
- `next build` compiled successfully but failed in this local environment with `spawn EPERM`.
  - This appears to be an environment/tooling issue rather than an application compile issue.
  - It should still be verified in Vercel with a real production build.
- Some older/legacy env naming still exists in code for compatibility.
  - Standardize on `NEXT_PUBLIC_SUPABASE_ANON_KEY` going forward.
- There are visible mojibake/encoding issues in some UI text that should be cleaned before launch.

### Lower priority but important before launch
- CI is now present, but there are still no visible automated application tests
- Mobile responsiveness still needs focused QA across admin, portal, and venue pages

## Exact steps to go live

1. Rotate any exposed secrets before deployment.
   - Rotate:
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - Google Maps keys
     - NSW API credentials

2. In Supabase, confirm the production project has:
   - all required tables used by the app
   - admin and portal auth/access tables
   - correct RLS policies
   - required seeded data such as venue types and schedule enum values

3. In Vercel, create a new project from this repository.

4. In Vercel Project Settings -> Environment Variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - `NSW_API_KEY`
   - `NSW_API_SECRET`
   - `NSW_OAUTH_URL`
   - `NSW_LIQUOR_BASE_URL`

5. Optionally add compatibility vars if still needed:
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - `GOOGLE_MAPS_API_KEY`

6. Trigger a Vercel production build.

7. After deploy, verify these routes manually:
   - `/`
   - `/venues`
   - `/today`
   - `/login`
   - `/admin`
   - `/portal`

8. Verify server-backed workflows in production:
   - admin login
   - portal login
   - venue save
   - schedule save
   - portal venue save
   - portal schedule save
   - Google Maps rendering
   - NSW liquor API endpoints if they are intended to be live

9. Confirm browser/public behavior:
   - venue filters
   - venue cards
   - happy hour details
   - events
   - weekly hours

10. Confirm admin and portal permissions:
   - admin user can access `/admin`
   - non-admin venue manager is redirected to `/portal`
   - venue manager can only access assigned venues

## Add the live domain

Current live domain:
- `firstroundapp.com`

Recommended domain setup:
- primary production domain: `firstroundapp.com`
- optional redirect or alias: `www.firstroundapp.com`

### Steps in Vercel

1. Open the First Round project in Vercel.
2. Go to `Settings` -> `Domains`.
3. Add:
   - `firstroundapp.com`
   - optionally `www.firstroundapp.com`
4. Set `firstroundapp.com` as the primary domain.
5. If both root and `www` are added, configure one to redirect to the other.
   - simplest option: redirect `www.firstroundapp.com` -> `firstroundapp.com`

### DNS records

The exact DNS records depend on where the domain is managed, but Vercel will show the required values after you add the domain.

Common patterns are:
- apex/root domain (`firstroundapp.com`):
  - an `A` record pointing to Vercel's recommended IP, or
  - nameserver delegation to Vercel if you choose that path
- `www` subdomain:
  - a `CNAME` record pointing to Vercel's target

Important:
- use the DNS values shown in the Vercel Domains screen as the source of truth
- after updating DNS, wait for Vercel to verify the domain

### After domain verification

1. Open:
   - `https://firstroundapp.com`
   - `https://firstroundapp.com/venues`
   - `https://firstroundapp.com/login`
2. Confirm the site loads over HTTPS.
3. Confirm admin and portal login still work on the live domain.

### Supabase note for the live domain

The current login flow uses `signInWithPassword`, so there is no custom email magic-link callback flow that must be wired for basic login.

Still recommended in Supabase:
- set the project `Site URL` to:
  - `https://firstroundapp.com`
- if you later add magic links, email confirmations, or OAuth providers, also add the live domain to the allowed redirect URLs.

## Recommended final pre-launch tasks
- Add proper migrations for all Supabase schema/auth/RLS setup
- Clean visible text encoding issues
- Run mobile QA on public, admin, and portal experiences
- Add application smoke tests beyond lint/type/build validation
