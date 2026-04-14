'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

const CONTACT_EMAIL = 'admin.firstround@gmail.com';

const TOPIC_OPTIONS = [
  {
    value: 'correction',
    label: 'Fix a venue listing',
    helper:
      'Update trading hours, happy hour details, event info, contact details, or venue features.',
  },
  {
    value: 'partner',
    label: 'Feature my venue',
    helper: 'Get your venue, events, or happy hours in front of more local people.',
  },
  {
    value: 'access',
    label: 'Get venue access',
    helper: 'Request your own login to manage your venue page, happy hours, and events.',
  },
  {
    value: 'general',
    label: 'General enquiry',
    helper: 'Anything else you want to ask the First Round team.',
  },
] as const;

const inputClassName =
  'h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-orange-400/40 focus:bg-black/40';

export default function ContactPage() {
  const [topic, setTopic] = useState<(typeof TOPIC_OPTIONS)[number]['value']>('general');
  const [name, setName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [replyToUsed, setReplyToUsed] = useState<string | null>(null);

  const selectedTopic =
    TOPIC_OPTIONS.find((option) => option.value === topic) ?? TOPIC_OPTIONS[3];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) return;

    if (!message.trim()) {
      setSubmitError('Add a message so we know what you need help with.');
      setSubmitSuccess(null);
      setDeliveryId(null);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    setDeliveryId(null);
    setSentTo(null);
    setReplyToUsed(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          name,
          venueName,
          email,
          message,
          website,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            message?: string;
            deliveryId?: string | null;
            sentTo?: string | null;
            replyTo?: string | null;
          }
        | null;

      if (!response.ok || !payload?.ok) {
        setSubmitError(
          payload?.error ??
            'We could not send your message right now. Please try again or use email directly.'
        );
        return;
      }

      setSubmitSuccess(
        payload.message ?? 'Your message has been sent. We will get back to you soon.'
      );
      setDeliveryId(payload.deliveryId ?? null);
      setSentTo(payload.sentTo ?? null);
      setReplyToUsed(payload.replyTo ?? null);
      setName('');
      setVenueName('');
      setEmail('');
      setMessage('');
      setWebsite('');
      setTopic('general');
    } catch {
      setSubmitError(
        'We could not send your message right now. Please try again or use email directly.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-orange-500/18 via-[#120805] to-black p-5 sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            Contact
          </div>

          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Fix a listing, get venue access, or feature what&apos;s on
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68 sm:text-base">
                Use this page if something on First Round needs updating, if your venue wants its
                own login, or if you want more visibility for your events, happy hours, and venue
                page.
              </p>
            </div>

            <div className="flex flex-col gap-2 lg:items-end">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/12 px-4 py-2 text-sm font-medium text-orange-100 transition hover:bg-orange-500/18"
              >
                Email First Round
              </a>
              <div className="text-xs text-white/45">{CONTACT_EMAIL}</div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="flex flex-col gap-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                Send a note
              </div>
              <h2 className="text-xl font-semibold text-white">Send a message to First Round</h2>
              <p className="text-sm leading-6 text-white/58">
                Pick the reason, add a few details, and send it straight from the site. If sending
                is not available, you can still open your email app instead.
              </p>
            </div>

            <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
              <FieldBlock label="What do you need?" helper={selectedTopic.helper}>
                <div
                  className="grid gap-3 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label="What do you need?"
                >
                  {TOPIC_OPTIONS.map((option) => {
                    const active = option.value === topic;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setTopic(option.value)}
                        className={[
                          'rounded-2xl border p-4 text-left transition',
                          active
                            ? 'border-orange-400/40 bg-orange-500/12 text-white'
                            : 'border-white/10 bg-black/25 text-white/80 hover:bg-white/[0.06]',
                        ].join(' ')}
                      >
                        <div className="text-sm font-semibold">{option.label}</div>
                        <div className="mt-2 text-xs leading-5 text-white/50">{option.helper}</div>
                      </button>
                    );
                  })}
                </div>
              </FieldBlock>

              <div className="grid gap-5 sm:grid-cols-2">
                <FieldBlock
                  label="Your name"
                  helper="Optional, but helpful if you want a personal reply."
                >
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    className={inputClassName}
                    maxLength={100}
                    disabled={submitting}
                  />
                </FieldBlock>

                <FieldBlock label="Reply email" helper="Where should we send the follow-up?">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@venue.com"
                    className={inputClassName}
                    maxLength={160}
                    disabled={submitting}
                  />
                </FieldBlock>
              </div>

              <FieldBlock
                label="Venue name"
                helper="Add this if your request is about a specific listing or venue account."
              >
                <input
                  type="text"
                  value={venueName}
                  onChange={(event) => setVenueName(event.target.value)}
                  placeholder="Venue name"
                  className={inputClassName}
                  maxLength={120}
                  disabled={submitting}
                />
              </FieldBlock>

              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                className="hidden"
                aria-hidden="true"
              />

              <FieldBlock
                label="Message"
                helper="Tell us what needs fixing, what access you need, or what you want us to feature."
              >
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={8}
                  placeholder="Example: We need our Thursday happy hour updated. Or: We'd like access to manage our venue page and publish weekly events."
                  className={`${inputClassName} min-h-[180px] resize-y py-3`}
                  maxLength={3000}
                  disabled={submitting}
                  required
                />
              </FieldBlock>

              {submitError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {submitError}
                </div>
              ) : null}

              {submitSuccess ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  <div>{submitSuccess}</div>
                  {sentTo ? (
                    <div className="mt-2 text-xs leading-5 text-emerald-100/80">
                      Sent to: {sentTo}
                    </div>
                  ) : null}
                  {replyToUsed ? (
                    <div className="mt-1 text-xs leading-5 text-emerald-100/80">
                      Reply-to: {replyToUsed}
                    </div>
                  ) : null}
                  {deliveryId ? (
                    <div className="mt-1 text-xs leading-5 text-emerald-100/80">
                      Delivery reference: {deliveryId}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl border border-orange-400/30 bg-orange-500/12 px-4 py-2.5 text-sm font-medium text-orange-100 transition hover:bg-orange-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Sending message...' : 'Send message'}
                </button>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  Open email
                </a>
              </div>

              <div className="text-xs leading-5 text-white/42">
                A green success message means First Round accepted the send request. If no email
                arrives, check spam or confirm the live email sender settings are configured.
              </div>
            </form>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/70">
              Common reasons to reach out
            </div>

            <div className="mt-4 space-y-3">
              <InfoBlock
                title="Fix a venue page"
                text="Report wrong hours, out-of-date happy hours, missing events, contact details, or venue features."
              />
              <InfoBlock
                title="Get your own venue login"
                text="Request access so your team can update your page, publish happy hours, and keep events current."
              />
              <InfoBlock
                title="Promote your venue, events, or specials"
                text="Want more visibility on First Round? Reach out if you want your venue, happy hours, or upcoming events featured."
              />
            </div>

            <div className="mt-6 rounded-2xl bg-black/25 p-4 text-sm text-white/58">
              Want to look around first? Head back to{' '}
              <Link href="/today" className="text-white underline underline-offset-4">
                Today
              </Link>{' '}
              or{' '}
              <Link href="/venues" className="text-white underline underline-offset-4">
                Venues
              </Link>
              .
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function FieldBlock({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/78">{label}</label>
      {children}
      {helper ? <div className="mt-2 text-xs leading-5 text-white/42">{helper}</div> : null}
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-black/25 p-4">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-white/58">{text}</div>
    </div>
  );
}
