'use client';

import { getSupabaseBrowserClientResult } from '@/lib/supabase-browser';
import { BROWSER_SUPABASE_ENV_ERROR } from '@/lib/public-env';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

type GuardState = 'checking' | 'authorized' | 'unauthorized';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClientResult().client, []);
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const authorizedRef = useRef(false);
  const [guardState, setGuardState] = useState<GuardState>('checking');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let mounted = true;
    if (!supabase) {
      setErrorMessage(BROWSER_SUPABASE_ENV_ERROR);
      setGuardState('unauthorized');
      return () => {
        mounted = false;
      };
    }

    async function checkAccess(showLoading = !authorizedRef.current) {
      if (showLoading) {
        setGuardState('checking');
        setErrorMessage(null);
      }
      if (!supabase) {
        setErrorMessage(BROWSER_SUPABASE_ENV_ERROR);
        authorizedRef.current = false;
        setGuardState('unauthorized');
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError) {
        setErrorMessage(sessionError.message);
        authorizedRef.current = false;
        setGuardState('unauthorized');
        return;
      }

      if (!session?.user) {
        router.replace(
          `/login?next=${encodeURIComponent(pathnameRef.current || '/portal')}`
        );
        return;
      }

      setUserEmail(session.user.email ?? null);

      const [{ data: adminRow, error: adminError }, { data: venueRows, error: venueError }] =
        await Promise.all([
          supabase
            .from('admin_users')
            .select('user_id')
            .eq('user_id', session.user.id)
            .maybeSingle(),
          supabase
            .from('venue_user_access')
            .select('venue_id')
            .eq('user_id', session.user.id)
            .limit(1),
        ]);

      if (!mounted) return;

      if (adminError) {
        setErrorMessage(adminError.message);
        authorizedRef.current = false;
        setGuardState('unauthorized');
        return;
      }

      if (venueError) {
        setErrorMessage(venueError.message);
        authorizedRef.current = false;
        setGuardState('unauthorized');
        return;
      }

      if (adminRow?.user_id || (venueRows?.length ?? 0) > 0) {
        authorizedRef.current = true;
        setGuardState('authorized');
        return;
      }

      authorizedRef.current = false;
      setGuardState('unauthorized');
    }

    void checkAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !session?.user) {
        router.replace('/login');
        return;
      }

      setUserEmail(session.user.email ?? null);

      if (
        event === 'SIGNED_IN' ||
        event === 'USER_UPDATED'
      ) {
        void checkAccess(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  async function handleSignOut() {
    setSigningOut(true);
    if (!supabase) {
      router.replace('/login');
      return;
    }
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (guardState === 'checking') {
    return (
      <div className="portal-shell min-h-screen px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            Venue Portal
          </div>
          <h1 className="mt-3 text-xl font-semibold">Checking portal access</h1>
          <p className="mt-2 text-sm text-white/60">
            Verifying your Supabase session and venue access.
          </p>
        </div>
      </div>
    );
  }

  if (guardState === 'unauthorized') {
    return (
      <div className="portal-shell min-h-screen px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-500/30 bg-red-500/5 p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-red-200/80">
            Access Check
          </div>
          <h1 className="mt-3 text-xl font-semibold text-red-300">Portal access required</h1>
          <p className="mt-2 text-sm text-white/80">
            This account is not assigned to any venues yet.
          </p>
          {userEmail ? (
            <p className="mt-2 text-sm text-white/50">Signed in as {userEmail}</p>
          ) : null}
          {errorMessage ? (
            <p className="mt-2 text-sm text-red-200">{errorMessage}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
            <Link
              href="/venues"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
            >
              Go to website
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/90 px-3 py-2 text-white backdrop-blur sm:px-4 sm:py-2.5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 text-sm leading-tight">
            <span className="font-semibold">Venue Portal</span>
            {userEmail ? <span className="truncate text-white/50"> | {userEmail}</span> : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/portal"
              className="inline-flex min-h-[38px] items-center whitespace-nowrap rounded-xl border border-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/5"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex min-h-[38px] items-center whitespace-nowrap rounded-xl border border-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
