# First Round Vercel Deployment Notes

## Current status

What is already in place:
- Vercel is the intended deployment target
- public site, admin, and portal ship from the same project
- browser and server env names are more consistent in code
- key public/auth paths now fail more clearly when required env vars are missing

What is still operationally risky:
- there is still no automated test suite protecting releases
- some Supabase setup is still manual unless the latest migrations are applied
- Google Maps behavior still depends on correct referrer setup in Google Cloud
- live confidence still depends on Vercel builds plus manual smoke tests

## Required environment variables

Required in Vercel Production:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NSW_API_KEY`
- `NSW_API_SECRET`
- `NSW_OAUTH_URL`
- `NSW_LIQUOR_BASE_URL`

Optional / compatibility only:
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `GOOGLE_MAPS_API_KEY`

Recommendations:
- prefer `NEXT_PUBLIC_SUPABASE_ANON_KEY` over the legacy publishable fallback
- keep Preview and Production envs aligned for Maps and Supabase where practical
- use `GOOGLE_MAPS_API_KEY` only for local/server scripts if needed

## Pre-deploy verification

Run locally before pushing:

```powershell
npm install
npm run typecheck
npm run verify
```

Notes:
- `npm run verify` runs TypeScript plus a Next production build
- if Windows local build issues return, use the Vercel build as the final build source of truth, but do not skip `typecheck`

Before deploy, confirm:
- branch and commit are the intended release
- Vercel env vars are correct
- Supabase target project is the intended live project
- recent migrations are applied or consciously deferred

## Supabase production readiness check

Before pointing production traffic at a Supabase project, confirm:
- core tables exist
- required lookup data exists
- admin and portal access rows exist
- RLS/policies are present
- at least one admin account works
- at least one portal account works if portal is in scope

Use:
- [docs/supabase-soft-launch-checks.md](/c:/Users/nickn/busy-app/docs/supabase-soft-launch-checks.md)

## Deployment risks to watch

### 1. Google Maps referrer restrictions
Maps will fail with `RefererNotAllowedMapError` unless Google Cloud allows the current domain.

Recommended allowed referrers:
- `https://firstroundapp.com/*`
- `https://www.firstroundapp.com/*`
- `https://*.vercel.app/*`
- `http://localhost:3000/*`
- `http://127.0.0.1:3000/*`

### 2. Missing or inconsistent Supabase env vars
- browser/public flows expect:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- server/admin/portal flows expect:
  - `SUPABASE_SERVICE_ROLE_KEY`

### 3. Domain / DNS drift
- confirm `firstroundapp.com` and `www.firstroundapp.com` are both connected in Vercel
- confirm GoDaddy/other DNS no longer points at old website-builder values
- if Vercel shows `DNS change recommended`, capture the desired root record and decide whether to update before launch

### 4. Manual Supabase drift
- if schema or RLS was configured manually, compare the live project against committed migrations before assuming safety

## Standard production deploy steps

1. In the repo root:

```powershell
git status
git add .
git commit -m "Your release message"
git push origin main
```

2. In Vercel:
- open `Deployments`
- wait for the newest production deployment from `main`
- confirm the deployment is `Ready`
- confirm the commit hash matches what you intended to ship

3. Verify the main domains:
- `https://firstroundapp.com`
- `https://www.firstroundapp.com`

4. Run the release smoke tests:
- [docs/release-smoke-tests.md](/c:/Users/nickn/busy-app/docs/release-smoke-tests.md)

## Auth verification after deploy

Minimum checks:
- public user cannot access `/admin` or protected portal flows
- admin user can log in and reach `/admin`
- venue user can log in and reach `/portal`
- venue user cannot access unrelated venue workspaces

Full checklist:
- [docs/release-smoke-tests.md](/c:/Users/nickn/busy-app/docs/release-smoke-tests.md)

## Rollback basics

If the latest production deploy is bad:
1. Stop testing on the broken deploy.
2. In Vercel, open the last known-good production deployment.
3. Re-promote or roll back to that deployment in Vercel.
4. Re-run:
   - public route smoke tests
   - auth checks
   - map checks
5. Record:
   - broken commit
   - rollback target
   - symptoms
   - any env or migration changes made around the release

## Live-domain setup

In Vercel:
- add `firstroundapp.com`
- add `www.firstroundapp.com`
- keep `firstroundapp.com` as primary if that is the intended root

In DNS:
- use the exact Vercel-provided values for root and `www`
- remove old GoDaddy website-builder A/CNAME values

In Google Maps key restrictions:
- keep production and preview refs aligned with what Vercel actually serves

## Recommended operator habits

- Record the deployed commit for every production release.
- Keep a short release note in `docs/project-status.md` when something changes in production-only config.
- Do not mix schema changes, env changes, and large UI changes in one untracked release if you can avoid it.
- Apply database migrations before broad public sharing when those migrations are required by the shipped code.
