'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Venue } from '@/lib/public-venue-discovery';

type VenuePrimaryImageVariant = 'card' | 'compact-card' | 'detail' | 'preview';

function getSafeImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function getImageAlt(venue: Pick<Venue, 'name' | 'primary_image_alt'>) {
  return venue.primary_image_alt?.trim() || `${venue.name ?? 'Venue'} venue image`;
}

export default function VenuePrimaryImage({
  venue,
  variant = 'card',
  priority = false,
  className = '',
}: {
  venue: Pick<
    Venue,
    'name' | 'primary_image_url' | 'primary_image_alt' | 'primary_image_attribution'
  >;
  variant?: VenuePrimaryImageVariant;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const imageUrl = failed ? null : getSafeImageUrl(venue.primary_image_url);
  const isDetail = variant === 'detail';
  const isPreview = variant === 'preview';
  const aspectClass = isDetail
    ? 'aspect-[16/9] sm:aspect-[21/9]'
    : isPreview
      ? 'aspect-video'
      : variant === 'compact-card'
        ? 'aspect-[16/9]'
        : 'aspect-[4/3] sm:aspect-[16/10]';
  const roundedClass = isDetail
    ? 'rounded-[1.4rem] sm:rounded-[1.8rem]'
    : isPreview
      ? 'rounded-2xl'
      : 'rounded-[1.25rem]';

  return (
    <div
      className={[
        'relative isolate overflow-hidden border border-white/10 bg-[#17110d]',
        aspectClass,
        roundedClass,
        className,
      ].join(' ')}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={getImageAlt(venue)}
          fill
          priority={priority}
          sizes={
            isDetail
              ? '(min-width: 1024px) 1024px, 100vw'
              : '(min-width: 1024px) 360px, 100vw'
          }
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,111,36,0.24),rgba(255,255,255,0.055)_42%,rgba(0,0,0,0.55))]" />
      )}

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.34))]" />

      {!imageUrl ? (
        <div className="absolute inset-x-4 bottom-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-100/74">
            First Round
          </div>
          <div className="mt-1 text-sm font-medium text-white/82">
            Venue image coming soon
          </div>
        </div>
      ) : venue.primary_image_attribution?.trim() ? (
        <div className="absolute bottom-2 right-2 max-w-[82%] rounded-full bg-black/45 px-2 py-1 text-[10px] text-white/72 backdrop-blur">
          {venue.primary_image_attribution.trim()}
        </div>
      ) : null}
    </div>
  );
}
