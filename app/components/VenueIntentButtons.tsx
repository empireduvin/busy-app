'use client';

import {
  usePublicUser,
  type VenueIntentState,
  type VenueIntentType,
} from '@/app/components/PublicUserProvider';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type VenueIntentButtonsVariant = 'card' | 'detail';

const EMPTY_INTENT: VenueIntentState = {
  thinking_count: 0,
  going_count: 0,
  user_intent: null,
};

export default function VenueIntentButtons({
  venueId,
  variant = 'detail',
}: {
  venueId: string;
  variant?: VenueIntentButtonsVariant;
}) {
  const {
    authLoading,
    getVenueIntent,
    refreshVenueIntent,
    toggleVenueIntent,
    user,
  } = usePublicUser();
  const router = useRouter();
  const pathname = usePathname();
  const [submittingIntent, setSubmittingIntent] = useState<VenueIntentType | null>(null);
  const intent = getVenueIntent(venueId) ?? EMPTY_INTENT;

  useEffect(() => {
    void refreshVenueIntent(venueId).catch(() => undefined);
  }, [refreshVenueIntent, venueId]);

  async function handleToggle(intentType: VenueIntentType) {
    if (authLoading || submittingIntent) return;

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(pathname || `/venues/${venueId}`)}`);
      return;
    }

    setSubmittingIntent(intentType);
    try {
      await toggleVenueIntent(venueId, intentType);
    } finally {
      setSubmittingIntent(null);
    }
  }

  const buttonBase =
    variant === 'card'
      ? 'min-h-[30px] rounded-xl px-2.5 py-1 text-[11px]'
      : 'min-h-[38px] rounded-xl px-3.5 py-2 text-[13px] sm:text-sm';

  return (
    <div
      className={[
        'flex flex-wrap gap-2',
        variant === 'card' ? 'text-[11px]' : 'text-sm',
      ].join(' ')}
      onClick={(event) => event.stopPropagation()}
    >
      <IntentButton
        active={intent.user_intent === 'thinking'}
        count={intent.thinking_count}
        disabled={authLoading || Boolean(submittingIntent)}
        label="Thinking of going"
        loading={submittingIntent === 'thinking'}
        onClick={() => void handleToggle('thinking')}
        className={buttonBase}
      />
      <IntentButton
        active={intent.user_intent === 'going'}
        count={intent.going_count}
        disabled={authLoading || Boolean(submittingIntent)}
        label="Going tonight"
        loading={submittingIntent === 'going'}
        onClick={() => void handleToggle('going')}
        className={buttonBase}
      />
    </div>
  );
}

export function VenueIntentBadge({ venueId }: { venueId: string }) {
  const { getVenueIntent, refreshVenueIntent } = usePublicUser();
  const intent = getVenueIntent(venueId);

  useEffect(() => {
    void refreshVenueIntent(venueId).catch(() => undefined);
  }, [refreshVenueIntent, venueId]);

  const badge = useMemo(() => {
    if (!intent) return null;
    if (intent.going_count > 0) {
      return `🔥 ${intent.going_count} going tonight`;
    }
    if (intent.thinking_count > 0) {
      return `👀 ${intent.thinking_count} thinking of going`;
    }
    return null;
  }, [intent]);

  if (!badge) return null;

  return (
    <div className="mt-1.5 flex min-w-0">
      <span className="inline-flex max-w-full items-center rounded-full border border-white/8 bg-white/[0.035] px-2.5 py-1 text-[11px] font-medium leading-4 text-white/62 sm:text-xs">
        {badge}
      </span>
    </div>
  );
}

function IntentButton({
  active,
  className,
  count,
  disabled,
  label,
  loading,
  onClick,
}: {
  active: boolean;
  className: string;
  count: number;
  disabled: boolean;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center gap-1.5 border font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
        active
          ? 'border-orange-300/28 bg-orange-400/14 text-orange-100 hover:bg-orange-400/18'
          : 'border-white/10 bg-white/[0.035] text-white/72 hover:border-white/16 hover:bg-white/[0.07] hover:text-white',
        className,
      ].join(' ')}
    >
      <span>{loading ? 'Saving...' : label}</span>
      {count > 0 ? <span className="text-white/50">{count}</span> : null}
    </button>
  );
}
