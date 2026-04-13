# First Round

First Round is a venue discovery and admin platform focused on pubs, bars, restaurants, events, opening hours, specials, and venue attributes.

The repo currently contains three main product surfaces:
- Public venue discovery website
- Master admin for venue and schedule management
- Venue manager portal for scoped venue updates

## Tech stack
- Next.js
- TypeScript
- Supabase
- Vercel

## Main routes
- `/` - landing page
- `/venues` - public venue discovery and filtering
- `/today` - public today view
- `/login` - Supabase login for admin and venue portal users
- `/admin` - master admin
- `/portal` - venue manager portal

## Local development

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Type-check:

```bash
npm run typecheck
```

Pre-deploy verification:

```bash
npm run verify
```

Open:

```text
http://localhost:3000
```

## Environment variables

Use `.env.local` for local development. A sanitized example is in [.env.example](/c:/Users/nickn/busy-app/.env.example).

Required app variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NSW_API_KEY`
- `NSW_API_SECRET`
- `NSW_OAUTH_URL`
- `NSW_LIQUOR_BASE_URL`

Optional / compatibility:
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `GOOGLE_MAPS_API_KEY`

Notes:
- Browser-side Supabase standardizes on `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` is now legacy compatibility only and should not be the primary production value.
- Protected admin and portal routes use the service role key on the server.
- Google Maps in the web app uses `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- Local scripts can use `GOOGLE_MAPS_API_KEY`, with a fallback to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- NSW liquor endpoints rely on the NSW API credentials.

## Supabase overview

The codebase expects Supabase to provide:
- venue data
- venue schedule rules
- venue types
- auth users
- admin access mapping
- venue manager access mapping

Key auth/access concepts in code:
- `admin_users` identifies full admins
- `venue_user_access` maps venue managers to one or more venues
- browser auth is used for login/session handling
- protected admin/portal writes are routed through server endpoints

Important:
- Not all schema and RLS setup is currently captured as committed migrations in this repo.
- Some Supabase setup has been performed manually and should be formalized before launch.

## Important files

Core product areas:
- [app/venues/page.tsx](/c:/Users/nickn/busy-app/app/venues/page.tsx)
- [app/admin/schedules/page.tsx](/c:/Users/nickn/busy-app/app/admin/schedules/page.tsx)
- [app/portal/page.tsx](/c:/Users/nickn/busy-app/app/portal/page.tsx)
- [app/portal/venues/[id]/page.tsx](/c:/Users/nickn/busy-app/app/portal/venues/[id]/page.tsx)

Auth and protected server routes:
- [app/login/page.tsx](/c:/Users/nickn/busy-app/app/login/page.tsx)
- [app/admin/layout.tsx](/c:/Users/nickn/busy-app/app/admin/layout.tsx)
- [app/portal/layout.tsx](/c:/Users/nickn/busy-app/app/portal/layout.tsx)
- [lib/admin-server.ts](/c:/Users/nickn/busy-app/lib/admin-server.ts)
- [lib/portal-server.ts](/c:/Users/nickn/busy-app/lib/portal-server.ts)
- [lib/supabaseServer.ts](/c:/Users/nickn/busy-app/lib/supabaseServer.ts)

Supporting docs:
- [AGENTS.md](/c:/Users/nickn/busy-app/AGENTS.md)
- [docs/project-status.md](/c:/Users/nickn/busy-app/docs/project-status.md)
- [docs/vercel-deployment.md](/c:/Users/nickn/busy-app/docs/vercel-deployment.md)

## Deployment

Deployment target:
- Vercel

Before going live:
- set all required Vercel environment variables
- confirm Supabase schema, seeded data, and RLS in the target project
- verify admin login, portal login, venue editing, schedule editing, and public venue browsing

Deployment checklist and blockers are documented in:
- [docs/vercel-deployment.md](/c:/Users/nickn/busy-app/docs/vercel-deployment.md)
- [docs/release-smoke-tests.md](/c:/Users/nickn/busy-app/docs/release-smoke-tests.md)
- [docs/launch-checklist.md](/c:/Users/nickn/busy-app/docs/launch-checklist.md)

## Current project notes

What is already in place:
- public venue discovery UI
- admin venue and schedule management
- venue manager portal
- server-protected admin and portal writes

What still needs attention:
- formal Supabase migrations and setup docs
- mobile responsiveness pass
- text encoding cleanup
- production hardening and automated checks

## Working style for this repo

Project-specific coding guidance lives in:
- [AGENTS.md](/c:/Users/nickn/busy-app/AGENTS.md)

That file should be treated as the project brief for future work.
