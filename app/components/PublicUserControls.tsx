'use client';

import { usePublicUser } from '@/app/components/PublicUserProvider';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PublicUserControls() {
  const { authLoading, user, signOut } = usePublicUser();
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const savedActive = pathname === '/saved';

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
      <>
        <div className="relative sm:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="inline-flex min-h-[28px] items-center justify-center rounded-full border border-white/8 bg-white/[0.015] px-2.5 py-0.5 text-[10px] font-medium text-white/68 transition hover:border-white/12 hover:bg-white/[0.05] hover:text-white"
          >
            Account
          </button>
          {menuOpen ? (
            <div className="absolute right-0 mt-2 w-40 rounded-2xl border border-white/10 bg-[rgba(10,10,10,0.96)] p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.35)] backdrop-blur">
              <Link
                href="/saved"
                className="block rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white"
              >
                Saved
              </Link>
              <Link
                href={`/login?next=${encodeURIComponent(pathname || '/saved')}`}
                className="mt-1 block rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/install"
                className="mt-1 block rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white"
              >
                Add to phone
              </Link>
            </div>
          ) : null}
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          <Link
            href="/saved"
            className={[
              'inline-flex min-h-[38px] items-center justify-center rounded-full border px-3 text-sm font-medium transition',
              savedActive
                ? 'border-orange-300/40 bg-orange-500/16 text-orange-50'
                : 'border-white/7 bg-white/[0.03] text-white/60 hover:border-white/12 hover:bg-white/[0.05] hover:text-white',
            ].join(' ')}
          >
            Saved
          </Link>
          <Link
            href={`/login?next=${encodeURIComponent(pathname || '/saved')}`}
            className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-white/8 bg-white/[0.015] px-3 text-sm font-medium text-white/68 transition hover:border-white/12 hover:bg-white/[0.05] hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/install"
            className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-white/7 bg-white/[0.015] px-3 text-sm font-medium text-white/56 transition hover:border-white/12 hover:bg-white/[0.05] hover:text-white"
          >
            Install
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          className="inline-flex min-h-[28px] items-center justify-center rounded-full border border-white/8 bg-white/[0.015] px-2.5 py-0.5 text-[10px] font-medium text-white/68 transition hover:border-white/12 hover:bg-white/[0.05] hover:text-white"
        >
          Account
        </button>
        {menuOpen ? (
          <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-white/10 bg-[rgba(10,10,10,0.96)] p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.35)] backdrop-blur">
            <Link
              href="/saved"
              className="block rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white"
            >
              Saved
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-white/80 hover:bg-white/[0.06] hover:text-white disabled:opacity-60"
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
            <Link
              href="/install"
              className="mt-1 block rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white"
            >
              Add to phone
            </Link>
          </div>
        ) : null}
      </div>
      <div className="hidden items-center gap-1.5 sm:flex">
        <Link
          href="/saved"
          className={[
            'inline-flex min-h-[38px] items-center justify-center rounded-full border px-3 text-sm font-medium transition',
            savedActive
              ? 'border-orange-300/40 bg-orange-500/16 text-orange-50'
              : 'border-white/7 bg-white/[0.03] text-white/60 hover:border-white/12 hover:bg-white/[0.05] hover:text-white',
          ].join(' ')}
        >
          Saved
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-white/8 bg-white/[0.015] px-3 text-sm font-medium text-white/68 transition hover:border-white/12 hover:bg-white/[0.05] hover:text-white disabled:opacity-60"
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
        <Link
          href="/install"
          className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-white/7 bg-white/[0.015] px-3 text-sm font-medium text-white/56 transition hover:border-white/12 hover:bg-white/[0.05] hover:text-white"
        >
          Install
        </Link>
      </div>
    </>
  );
}
