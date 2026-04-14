'use client';

import { getSupabaseBrowserClientResult } from '@/lib/supabase-browser';
import { BROWSER_SUPABASE_ENV_ERROR } from '@/lib/public-env';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type GuardState = 'checking' | 'authorized' | 'unauthorized';

export default function AdminLayout({
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
  const [hasPortalAccess, setHasPortalAccess] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!supabase) {
      setErrorMessage(BROWSER_SUPABASE_ENV_ERROR);
      setGuardState('unauthorized');
      return () => {
        mounted = false;
      };
    }

    async function checkAccess() {
      setGuardState('checking');
      setErrorMessage(null);
      setHasPortalAccess(false);
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
        router.replace(`/login?next=${encodeURIComponent(pathname || '/admin')}`);
        return;
      }

      setUserEmail(session.user.email ?? null);

      const [
        { data: adminData, error: adminError },
        { data: venueAccessRows, error: venueAccessError },
      ] = await Promise.all([
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

      if (venueAccessError) {
        setErrorMessage(venueAccessError.message);
        setGuardState('unauthorized');
        return;
      }

      if (!adminData?.user_id) {
        const portalAccess = (venueAccessRows?.length ?? 0) > 0;
        setHasPortalAccess(portalAccess);

        if (portalAccess) {
          router.replace('/portal');
          return;
        }

        setGuardState('unauthorized');
        return;
      }

      setGuardState('authorized');
    }

    void checkAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (!session?.user) {
        router.replace('/login');
        return;
      }

      setUserEmail(session.user.email ?? null);
      void checkAccess();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, router, supabase]);

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
      <div className="admin-shell min-h-screen px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            First Round Admin
          </div>
          <h1 className="mt-3 text-xl font-semibold">Checking admin access</h1>
          <p className="mt-2 text-sm text-white/65">
            Verifying your Supabase session and admin permissions.
          </p>
        </div>
      </div>
    );
  }

  if (guardState === 'unauthorized') {
    return (
      <div className="admin-shell min-h-screen px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/30 bg-red-500/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-red-200/80">
            Access Check
          </div>
          <h1 className="mt-3 text-xl font-semibold text-red-100">Admin access required</h1>
          <p className="mt-2 text-sm text-white/75">
            This account is not allowed to use the admin area.
          </p>
          {userEmail ? (
            <p className="mt-2 text-sm text-white/55">Signed in as {userEmail}</p>
          ) : null}
          {errorMessage ? (
            <p className="mt-2 text-sm text-red-100">{errorMessage}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {hasPortalAccess ? (
              <Link
                href="/portal"
                className="inline-flex min-h-[44px] items-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400"
              >
                Open venue portal
              </Link>
            ) : null}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
            <Link
              href="/venues"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/5"
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
            <span className="font-semibold">Admin</span>
            {userEmail ? <span className="text-white/50"> | {userEmail}</span> : null}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-white/10 px-3 py-2 text-sm font-medium hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>
      {children}
    </>
  );
}
