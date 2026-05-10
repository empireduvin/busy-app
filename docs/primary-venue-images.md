# Primary Venue Images

First Round now supports one nullable primary image per venue:

- `primary_image_url`
- `primary_image_source`
- `primary_image_attribution`
- `primary_image_alt`

## Manual MVP Process

1. Open admin or portal venue details.
2. Find venues where the primary image URL is blank.
3. Use a venue exterior, interior, bar, or atmosphere image where possible.
4. Paste the image URL and add source, attribution, and alt text.
5. Save the venue.

## Google Places Photo Backfill Plan

Google Places photos are intentionally not auto-written yet. The existing Google sync fetches venue identity, contact, location, and opening-hour fields, but not photo media.

A safe backfill should:

1. Find venues where `primary_image_url is null`.
2. Use `google_place_id` where available.
3. Fetch only Places photo candidate fields with a narrow field mask.
4. Review 1-3 candidates per venue before publishing.
5. Store `primary_image_source = 'Google'`.
6. Store required attribution if returned.
7. Avoid overwriting manual images unless an explicit overwrite flag is used.

Do not download or rehost Google photos until terms and attribution requirements are confirmed. Do not store a permanent URL containing a server API key in public venue data.
