import { NextResponse } from 'next/server';
import { getErrorStatus } from '@/lib/authz';
import { requirePortalVenueRequest } from '@/lib/portal-server';

const BUCKET_NAME = 'venue-images';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const venueId = String(formData.get('venue_id') ?? '').trim();
    const file = formData.get('file');

    if (!venueId) {
      return NextResponse.json(
        { ok: false, error: 'Venue id is required.' },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: 'Image file is required.' },
        { status: 400 }
      );
    }

    const extension = ALLOWED_IMAGE_TYPES[file.type];
    if (!extension) {
      return NextResponse.json(
        { ok: false, error: 'Upload a JPEG, PNG, or WebP image.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'Image must be 5MB or smaller.' },
        { status: 400 }
      );
    }

    const { supabase } = await requirePortalVenueRequest(request, venueId);
    const safeVenueId = sanitizePathSegment(venueId);
    const storagePath = `venues/${safeVenueId}/primary-${Date.now()}.${extension}`;
    const imageBody = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, imageBody, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    return NextResponse.json({
      ok: true,
      bucket: BUCKET_NAME,
      path: storagePath,
      publicUrl: data.publicUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: getErrorStatus(error) }
    );
  }
}
