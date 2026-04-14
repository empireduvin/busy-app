'use client';

import { getSupabaseBrowserClientResult } from '@/lib/supabase-browser';
import { BROWSER_SUPABASE_ENV_ERROR } from '@/lib/public-env';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';

type RecoveryState = 'verifying' | 'ready' | 'invalid' | 'success';

function ResetPasswordPageContent() {
  const supabase = useMemo(() => getSupabaseBrowserClientResult().client, []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('verifying');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function verifyRecoveryLink() {
      if (!supabase) {
        if (!mounted) return;
        setRecoveryState('invalid');
        setErrorMessage(BROWSER_SUPABASE_ENV_ERROR);
        return;
      }

      const directError = getRecoveryErrorFromSearchParams(searchParams);
      if (directError) {
        if (!mounted) return;
        setRecoveryState('invalid');
        setErrorMessage(directError);
        return;
      }

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setRecoveryState('invalid');
        setErrorMessage(
          'This reset link could not be verified. Request a new password reset email and try again.'
        );
        return;
      }

      if (session?.user) {
        setRecoveryState('ready');
        setErrorMessage(null);
        return;
      }

      setRecoveryState('invalid');
      setErrorMessage(
        'This reset link is missing or has expired. Request a new password reset email and try again.'
      );
    }

    void verifyRecoveryLink();

    const {
      data: { subscription },
    } = supabase?.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          setRecoveryState('ready');
          setErrorMessage(null);
        }
      }

      if (event === 'SIGNED_OUT' && recoveryState !== 'success') {
        setRecoveryState('invalid');
      }
    }) ?? { data: { subscription: { unsubscribe() {} } } };

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [recoveryState, searchParams, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setRecoveryState('invalid');
      setErrorMessage(BROWSER_SUPABASE_ENV_ERROR);
      return;
    }

    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (!trimmedPassword || !trimmedConfirmPassword) {
      setErrorMessage('Enter your new password in both fields to continue.');
      return;
    }

    if (trimmedPassword.length < 8) {
      setErrorMessage('Choose a password with at least 8 characters.');
      return;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      setErrorMessage('Your passwords do not match yet.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { error } = await supabase.auth.updateUser({ password: trimmedPassword });

    if (error) {
      setSubmitting(false);
      setErrorMessage(
        'We could not update your password from this link. Request a new reset email and try again.'
      );
      return;
    }

    setSubmitting(false);
    setRecoveryState('success');
    setSuccessMessage('Your password has been updated. You can now sign in with your new password.');
    setPassword('');
    setConfirmPassword('');
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,128,32,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            First Round
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Reset your password
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Choose a new password to get back into your First Round account.
          </p>
        </div>

        {recoveryState === 'verifying' ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/70">
            Verifying your reset link...
          </div>
        ) : null}

        {recoveryState === 'invalid' ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              {errorMessage ?? 'This password reset link is not valid anymore.'}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400"
              >
                Back to login
              </Link>
            </div>
          </div>
        ) : null}

        {recoveryState === 'ready' ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
              Your link is verified. Set your new password below.
            </div>

            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-white/80">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                disabled={submitting}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-orange-300/40 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1.5 block text-sm font-medium text-white/80"
              >
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                disabled={submitting}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-orange-300/40 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>

            {errorMessage ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Updating password...' : 'Update password'}
            </button>
          </form>
        ) : null}

        {recoveryState === 'success' ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              {successMessage}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400"
              >
                Go to login
              </Link>
              <button
                type="button"
                onClick={() => {
                  router.replace('/login');
                  router.refresh();
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 text-sm text-white/50">
          <Link href="/login" className="text-white underline underline-offset-4">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

function getRecoveryErrorFromSearchParams(searchParams: ReturnType<typeof useSearchParams>) {
  const code = searchParams.get('error_code')?.trim();
  const description = searchParams.get('error_description')?.trim();
  const error = searchParams.get('error')?.trim();

  if (!code && !description && !error) return null;

  if (code === 'otp_expired') {
    return 'This reset link has expired. Request a new password reset email and try again.';
  }

  if (description) {
    return 'This reset link is not valid anymore. Request a new password reset email and try again.';
  }

  return 'This reset link could not be used. Request a new password reset email and try again.';
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-12">
          <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70 shadow-sm">
            <div className="text-sm">Loading reset page...</div>
          </div>
        </div>
      }
    >
      <ResetPasswordPageContent />
    </Suspense>
  );
}
