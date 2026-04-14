'use client';

import Link from 'next/link';

export default function PublicVenueInterestStrip() {
  return (
    <footer className="border-t border-white/10 bg-black/95 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            Need a quick update?
          </div>
          <div className="mt-1 text-sm text-white/65">
            Fix a listing, get venue access, or feature your events and happy hours.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/contact"
            className="rounded-full border border-orange-400/30 bg-orange-500/12 px-4 py-2 text-sm font-medium text-orange-100 transition hover:bg-orange-500/18"
          >
            Contact us
          </Link>
          <a
            href="mailto:admin.firstround@gmail.com"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            admin.firstround@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}
