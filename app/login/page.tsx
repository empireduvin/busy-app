'use client';

import { getSupabaseBrowserClientResult } from '@/lib/supabase-browser';
import { BROWSER_SUPABASE_ENV_ERROR } from '@/lib/public-env';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useMemo, useState } from 'react';

function LoginPageContent() {
  const supabase = useMemo(() => getSupabaseBrowserClientResult().client, []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeNextPath(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setErrorMessage(BROWSER_SUPABASE_ENV_ERROR);
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setErrorMessage(BROWSER_SUPABASE_ENV_ERROR);
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Enter your email address first so we know where to send the reset link.');
      return;
    }

    setSendingReset(true);
    setErrorMessage(null);
    setResetMessage(null);

    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo,
    });

    if (error) {
      setErrorMessage(error.message);
      setSendingReset(false);
      return;
    }

    setResetMessage(
      'Password reset email sent. Open the link in that email and you will land on the reset screen.'
    );
    setSendingReset(false);
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,128,32,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            First Round
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Admin Login</h1>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Sign in with the Supabase user you created for admin or venue access.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {!supabase ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {BROWSER_SUPABASE_ENV_ERROR}
            </div>
          ) : null}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-orange-300/40"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-orange-300/40"
            />
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {errorMessage}
            </div>
          ) : null}

          {resetMessage ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              {resetMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !supabase}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <form onSubmit={handlePasswordReset} className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-medium text-white/80">Forgot your password?</div>
          <p className="mt-1 text-sm leading-6 text-white/55">
            Enter your email above, then send yourself a secure password reset link.
          </p>
          <button
            type="submit"
            disabled={sendingReset || !supabase}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-semibold text-white/80 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendingReset ? 'Sending reset link...' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-4 text-sm text-white/50">
          Public site:{' '}
          <Link href="/venues" className="text-white underline underline-offset-4">
            /venues
          </Link>
        </div>
      </div>
    </div>
  );
}

function getSafeNextPath(nextPath: string | null) {
  const candidate = (nextPath ?? '').trim();
  if (!candidate) return '/admin';
  if (!candidate.startsWith('/')) return '/admin';
  if (candidate.startsWith('//')) return '/admin';
  return candidate;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-12">
          <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70 shadow-sm">
            <div className="text-sm">Loading login...</div>
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
