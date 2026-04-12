# First Round Codex Instructions

First Round is a venue discovery and admin platform focused on pubs, bars, restaurants, events, opening hours, specials, and venue attributes.

Core stack:
- Next.js
- TypeScript
- Supabase
- Vercel

Current priorities:
1. Stable admin page for venues and schedules
2. Clean venue data model
3. Easy food and drinks editing UX
4. Reliable Supabase integration and RLS
5. Production readiness for launch

## Working approach
- Inspect the current codebase before making changes.
- Prefer simple, maintainable solutions over clever or highly abstract ones.
- Preserve working functionality unless a change is explicitly required.
- Reuse existing patterns where they are already working.
- Keep admin, portal, website, and Supabase behavior aligned where practical.
- Treat data integrity, auth, and RLS changes carefully and explain tradeoffs.
- Clearly call out blockers, uncertainty, risky assumptions, and any missing schema or environment details.
- If something is only partially implemented, say so directly rather than implying it is complete.

## Project-specific guidance
- The app includes a public venue website, a master admin area, and a venue manager portal.
- Venue schedules, happy hour details, events, venue flags, and profile fields should stay consistent across:
  - public venue pages
  - master admin
  - venue portal
- Avoid introducing breaking schema assumptions without checking the existing Supabase structure first.
- For portal and admin work, favor stable UX over broad feature expansion.
- For food and drinks editing, prioritize clarity, low-friction editing, and readable public presentation.
- For Supabase work, prefer secure-by-default behavior and explicitly note any temporary broad-access policies.

## Change expectations
Before editing:
- Read the relevant files first.
- Understand the current behavior and likely side effects.

While editing:
- Keep solutions practical and easy to maintain.
- Avoid unnecessary refactors if a focused fix is enough.
- Preserve existing functionality that is already working.

After each task, always report:
1. Summary of what the feature/project currently does
2. Files changed
3. What was completed
4. What is still incomplete
5. Risks / blockers
6. Recommended next 5 tasks
7. Estimated project progress by area as percentages

Use these progress categories:
- Environment / setup
- Database / schema
- Supabase auth / RLS
- Admin panel
- Venue detail UX
- Filters / search
- Mobile responsiveness
- Deployment / production readiness
- Overall MVP

## Standard output template

### First Round Status Summary
- Overall MVP: X%
- Environment / setup: X%
- Database / schema: X%
- Supabase auth / RLS: X%
- Admin panel: X%
- Venue detail UX: X%
- Filters / search: X%
- Mobile responsiveness: X%
- Deployment / production readiness: X%

### What is working
- ...

### What changed recently
- ...

### Current blockers
- ...

### Next recommended tasks
1. ...
2. ...
3. ...
4. ...
5. ...

### Files most relevant
- ...
