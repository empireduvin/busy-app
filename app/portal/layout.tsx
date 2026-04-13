'use client';

import { getSupabaseBrowserClientResult } from '@/lib/supabase-browser';
import { BROWSER_SUPABASE_ENV_ERROR } from '@/lib/public-env';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type GuardState = 'checking' | 'authorized' | 'unauthorized';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClientResult().client, []);
  const router = useRouter();
  const pathname = usePathname();
  const [guardState, setGuardState] = useState<GuardState>('checking');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!supabase) {
      setErrorMessage(BROWSER_SUPABASE_ENV_ERROR);
      setGuardState('unauthorized');
      return () => {
        mounted = false;
      };
    }

    async function checkAccess(showLoading = true) {
      if (showLoading) {
        setGuardState('checking');
      }
      setErrorMessage(null);
      if (!supabase) {
        setErrorMessage(BROWSER_SUPABASE_ENV_ERROR);
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
        setGuardState('unauthorized');
        return;
      }

      if (!session?.user) {
        router.replace(`/login?next=${encodeURIComponent(pathname || '/portal')}`);
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
        setGuardState('unauthorized');
        return;
      }

      if (venueError) {
        setErrorMessage(venueError.message);
        setGuardState('unauthorized');
        return;
      }

      if (adminRow?.user_id || (venueRows?.length ?? 0) > 0) {
        setGuardState('authorized');
        return;
      }

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

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        void checkAccess(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, router, supabase]);

  async function handleSignOut() {
    if (!supabase) {
      router.replace('/login');
      return;
    }
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (guardState === 'checking') {
    return (
      <div className="min-h-screen bg-neutral-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">Checking portal access</h1>
          <p className="mt-2 text-sm text-white/60">
            Verifying your Supabase session and venue access.
          </p>
        </div>
      </div>
    );
  }

  if (guardState === 'unauthorized') {
    return (
      <div className="min-h-screen bg-neutral-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-500/30 bg-red-500/5 p-6">
          <h1 className="text-xl font-semibold text-red-300">Portal access required</h1>
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
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-white/90"
            >
              Sign out
            </button>
            <Link
              href="/venues"
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
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
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/90 px-4 py-3 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold">Venue Portal</span>
            {userEmail ? <span className="text-white/50"> · {userEmail}</span> : null}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/portal"
              className="rounded-xl border border-white/10 px-3 py-2 text-sm font-medium hover:bg-white/5"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-white/10 px-3 py-2 text-sm font-medium hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
