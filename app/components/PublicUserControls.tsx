'use client';

import { usePublicUser } from '@/app/components/PublicUserProvider';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function PublicUserControls() {
  const { authLoading, user, signOut } = usePublicUser();
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const savedActive = pathname === '/saved';

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/venues');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  if (authLoading) {
    return (
      <div className="inline-flex min-h-[32px] items-center justify-center rounded-full border border-white/8 bg-white/[0.02] px-3 text-[11px] text-white/52 sm:min-h-[38px] sm:text-sm">
        Account
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/saved"
          className={[
            'inline-flex min-h-[28px] items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition sm:min-h-[38px] sm:px-3 sm:text-sm',
            savedActive
              ? 'border-orange-300/40 bg-orange-500/16 text-orange-50'
              : 'border-white/7 bg-white/[0.015] text-white/60 hover:border-white/12 hover:bg-white/[0.05] hover:text-white sm:bg-white/[0.03]',
          ].join(' ')}
        >
          Saved
        </Link>
        <Link
          href={`/login?next=${encodeURIComponent(pathname || '/saved')}`}
          className="inline-flex min-h-[28px] items-center justify-center rounded-full border border-white/8 bg-white/[0.015] px-2 py-0.5 text-[10px] font-medium text-white/68 transition hover:border-white/12 hover:bg-white/[0.05] hover:text-white sm:min-h-[38px] sm:px-3 sm:text-sm"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/saved"
        className={[
          'inline-flex min-h-[28px] items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition sm:min-h-[38px] sm:px-3 sm:text-sm',
          savedActive
            ? 'border-orange-300/40 bg-orange-500/16 text-orange-50'
            : 'border-white/7 bg-white/[0.015] text-white/60 hover:border-white/12 hover:bg-white/[0.05] hover:text-white sm:bg-white/[0.03]',
        ].join(' ')}
      >
        Saved
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="inline-flex min-h-[28px] items-center justify-center rounded-full border border-white/8 bg-white/[0.015] px-2 py-0.5 text-[10px] font-medium text-white/68 transition hover:border-white/12 hover:bg-white/[0.05] hover:text-white disabled:opacity-60 sm:min-h-[38px] sm:px-3 sm:text-sm"
      >
        {signingOut ? 'Signing out...' : 'Sign out'}
      </button>
    </div>
  );
}
