'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const CONTACT_EMAIL = 'admin@firstroundapp.com';

const TOPIC_OPTIONS = [
  {
    value: 'correction',
    label: 'Fix a venue listing',
    helper: 'Update trading hours, happy hour details, event info, contact details, or venue features.',
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

function topicToSubject(topic: string) {
  if (topic === 'correction') return 'First Round listing correction';
  if (topic === 'partner') return 'First Round feature request';
  if (topic === 'access') return 'First Round venue access request';
  return 'First Round enquiry';
}

const inputClassName =
  'h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-orange-400/40 focus:bg-black/40';

export default function ContactPage() {
  const [topic, setTopic] = useState<(typeof TOPIC_OPTIONS)[number]['value']>('general');
  const [name, setName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const selectedTopic =
    TOPIC_OPTIONS.find((option) => option.value === topic) ?? TOPIC_OPTIONS[3];

  const mailtoHref = useMemo(() => {
    const lines = [
      `Topic: ${selectedTopic.label}`,
      name.trim() ? `Name: ${name.trim()}` : null,
      venueName.trim() ? `Venue: ${venueName.trim()}` : null,
      email.trim() ? `Reply email: ${email.trim()}` : null,
      '',
      message.trim() || 'Tell us what you need help with.',
    ].filter(Boolean);

    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      topicToSubject(topic)
    )}&body=${encodeURIComponent(lines.join('\n'))}`;
  }, [email, message, name, selectedTopic.label, topic, venueName]);

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
              <h2 className="text-xl font-semibold text-white">Start a quick email draft</h2>
              <p className="text-sm leading-6 text-white/58">
                Pick the reason, add a few details, and we&apos;ll open a ready-to-send email so
                you don&apos;t have to write it from scratch.
              </p>
            </div>

            <div className="mt-6 grid gap-5">
              <FieldBlock label="What do you need?" helper={selectedTopic.helper}>
                <select
                  value={topic}
                  onChange={(event) =>
                    setTopic(event.target.value as (typeof TOPIC_OPTIONS)[number]['value'])
                  }
                  className={inputClassName}
                >
                  {TOPIC_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <div className="grid gap-5 sm:grid-cols-2">
                <FieldBlock label="Your name" helper="Optional, but helpful if you want a personal reply.">
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    className={inputClassName}
                  />
                </FieldBlock>

                <FieldBlock label="Reply email" helper="Where should we send the follow-up?">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@venue.com"
                    className={inputClassName}
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
                />
              </FieldBlock>

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
                />
              </FieldBlock>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href={mailtoHref}
                  className="rounded-xl border border-orange-400/30 bg-orange-500/12 px-4 py-2.5 text-sm font-medium text-orange-100 transition hover:bg-orange-500/18"
                >
                  Open email draft
                </a>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  Email directly
                </a>
              </div>
            </div>
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
