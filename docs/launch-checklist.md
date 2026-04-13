# First Round Launch Checklist

## 1. Pre-launch setup
- [ ] Rotate any secrets that have been exposed in local tooling or chat history:
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] Google Maps API keys
  - [ ] NSW API credentials
- [ ] Confirm the production Supabase project is the intended long-term project.
- [ ] Confirm the production Supabase project has the required schema, RLS policies, users, and seeded values used by the app.
- [ ] Confirm `.env.example` matches the final environment-variable naming you want to keep.
- [ ] Review:
  - [ ] [docs/vercel-deployment.md](/c:/Users/nickn/busy-app/docs/vercel-deployment.md)
  - [ ] [docs/release-smoke-tests.md](/c:/Users/nickn/busy-app/docs/release-smoke-tests.md)
  - [ ] [docs/supabase-soft-launch-checks.md](/c:/Users/nickn/busy-app/docs/supabase-soft-launch-checks.md)

## 2. Vercel configuration
- [ ] Create a Vercel project from this repository.
- [ ] Add required environment variables in Vercel for Production:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
  - [ ] `NSW_API_KEY`
  - [ ] `NSW_API_SECRET`
  - [ ] `NSW_OAUTH_URL`
  - [ ] `NSW_LIQUOR_BASE_URL`
- [ ] Add optional compatibility variables only if still needed:
  - [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
  - [ ] `GOOGLE_MAPS_API_KEY`
- [ ] Trigger the first production deploy.
- [ ] Record the exact commit hash being deployed.

## 3. Production verification
- [ ] Check the public routes:
  - [ ] `/`
  - [ ] `/venues`
  - [ ] `/today`
- [ ] Check the protected routes:
  - [ ] `/login`
  - [ ] `/admin`
  - [ ] `/portal`
- [ ] Confirm Google Maps loads on venue pages.
- [ ] Confirm NSW liquor endpoints behave as expected if they are meant to be live in production.

## 4. Auth and permissions
- [ ] Confirm an admin user can log in and reach `/admin`.
- [ ] Confirm a non-admin venue manager is redirected away from `/admin` and into `/portal`.
- [ ] Confirm a venue manager can only open assigned venues.
- [ ] Confirm portal saves work for:
  - [ ] venue details
  - [ ] schedule updates
  - [ ] happy hour details
  - [ ] event entries

## 5. Core product checks
- [ ] Confirm public venue filtering works:
  - [ ] suburb
  - [ ] venue type
  - [ ] open now
  - [ ] open late
  - [ ] happy hour live
  - [ ] kitchen open
  - [ ] sport / sound / BYO / dog / kid
  - [ ] event filters
  - [ ] happy hour category filters
- [ ] Confirm venue cards show the expected hours and detail blocks.
- [ ] Confirm weekly timeline and map rendering work.
- [ ] Confirm admin Google venue search/import still works.
- [ ] Confirm venue access assignment/removal works in master admin.

## 6. Mobile QA
- [ ] Test `/venues` on a real phone width:
  - [ ] filter controls are usable
  - [ ] venue cards are readable
  - [ ] map section does not block the main flow
- [ ] Test `/admin` on a real phone width:
  - [ ] venue setup fields are usable
  - [ ] schedule editing remains navigable
  - [ ] horizontal overflow areas are still understandable
- [ ] Test `/portal` and a portal venue page on a real phone width:
  - [ ] venue cards are readable
  - [ ] schedule type and mode controls are usable
  - [ ] happy hour editing is workable without layout breakage

## 7. Friend testing order
- [ ] Enter only a small trusted set of venues first.
- [ ] Create one admin account and one or two venue-manager test accounts.
- [ ] Test portal permissions before inviting anyone external.
- [ ] Invite a small number of friends to test:
  - [ ] public browsing
  - [ ] search and filters
  - [ ] one manager portal flow
- [ ] Capture feedback before larger data entry or broader sharing.

## 8. After first live deploy
- [ ] Record any production-only issues in `docs/project-status.md`.
- [ ] Turn manual Supabase setup into committed migrations.
- [ ] Add smoke tests for the highest-risk flows.
- [ ] Continue mobile polish based on real-device testing.
- [ ] Record the deployed commit, smoke-test outcome, and any rollback action.
