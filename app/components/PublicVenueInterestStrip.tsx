'use client';

import Link from 'next/link';

export default function PublicVenueInterestStrip() {
  return (
    <footer className="border-t border-white/10 bg-black/95 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            Need an update?
          </div>
          <div className="mt-1 text-[13px] leading-5 text-white/62 sm:text-sm">
            Submit a correction or request access to update your venue.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/contact"
            className="rounded-full border border-orange-400/25 bg-orange-500/10 px-3.5 py-1.5 text-[13px] font-medium text-orange-100 transition hover:bg-orange-500/16"
          >
            Contact us
          </Link>
          <a
            href="mailto:admin.firstround@gmail.com"
            className="rounded-full border border-white/15 bg-transparent px-3.5 py-1.5 text-[13px] font-medium text-white/74 transition hover:bg-white/8 hover:text-white"
          >
            admin.firstround@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}
