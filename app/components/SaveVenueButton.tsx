'use client';

import { usePublicUser } from '@/app/components/PublicUserProvider';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

type SaveVenueButtonVariant = 'card' | 'detail' | 'compact';

export default function SaveVenueButton({
  venueId,
  variant = 'card',
}: {
  venueId: string;
  variant?: SaveVenueButtonVariant;
}) {
  const { authLoading, isSavedVenue, saveVenue, unsaveVenue, user } = usePublicUser();
  const router = useRouter();
  const pathname = usePathname();
  const [submitting, setSubmitting] = useState(false);

  const saved = isSavedVenue(venueId);

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (authLoading || submitting) return;

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(pathname || '/saved')}`);
      return;
    }

    setSubmitting(true);
    try {
      if (saved) {
        await unsaveVenue(venueId);
      } else {
        await saveVenue(venueId);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const baseClasses =
    variant === 'detail'
      ? 'min-h-[36px] rounded-xl px-3.5 py-2 text-sm'
      : variant === 'compact'
        ? 'min-h-[28px] rounded-lg px-2.5 py-1 text-[11px]'
        : 'min-h-[32px] rounded-xl px-3 py-1.5 text-[12px]';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={authLoading || submitting}
      aria-pressed={saved}
      className={[
        'inline-flex items-center justify-center border font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
        saved
          ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/14'
          : 'border-white/10 bg-white/[0.03] text-white/72 hover:border-white/16 hover:bg-white/[0.06] hover:text-white',
        baseClasses,
      ].join(' ')}
    >
      {submitting ? 'Saving...' : saved ? 'Saved' : 'Save'}
    </button>
  );
}
