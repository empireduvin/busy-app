'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type GuardState = 'checking' | 'authorized' | 'unauthorized';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const [guardState, setGuardState] = useState<GuardState>('checking');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasPortalAccess, setHasPortalAccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      setGuardState('checking');
      setErrorMessage(null);
      setHasPortalAccess(false);

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
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (guardState === 'checking') {
    return (
      <div className="min-h-screen bg-neutral-50 px-6 py-10 text-neutral-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Checking admin access</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Verifying your Supabase session and admin permissions.
          </p>
        </div>
      </div>
    );
  }

  if (guardState === 'unauthorized') {
    return (
      <div className="min-h-screen bg-neutral-50 px-6 py-10 text-neutral-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-red-700">Admin access required</h1>
          <p className="mt-2 text-sm text-neutral-700">
            This account is not allowed to use the admin area.
          </p>
          {userEmail ? (
            <p className="mt-2 text-sm text-neutral-500">Signed in as {userEmail}</p>
          ) : null}
          {errorMessage ? (
            <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {hasPortalAccess ? (
              <Link
                href="/portal"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Open venue portal
              </Link>
            ) : null}
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100"
            >
              Sign out
            </button>
            <Link
              href="/venues"
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100"
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
      <div className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 px-4 py-3 text-neutral-900 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold">Admin</span>
            {userEmail ? <span className="text-neutral-500"> · {userEmail}</span> : null}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            Sign out
          </button>
        </div>
      </div>
      {children}
    </>
  );
}
