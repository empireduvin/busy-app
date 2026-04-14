'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PUBLIC_LINKS = [
  { href: '/livenow', label: 'Live Now', mobileLabel: 'Live' },
  { href: '/today', label: 'Today', mobileLabel: 'Today' },
  { href: '/week', label: 'This Week', mobileLabel: 'Week' },
  { href: '/venues', label: 'Venues', mobileLabel: 'Venues' },
  { href: '/contact', label: 'Contact', mobileLabel: 'Contact' },
];

export default function PublicNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="grid w-full grid-cols-5 gap-1 rounded-[1.2rem] bg-white/[0.03] p-1 sm:flex sm:w-auto sm:flex-wrap sm:justify-end sm:gap-2 sm:rounded-full sm:bg-transparent sm:p-0">
      {PUBLIC_LINKS.map((link) => {
        const active =
          link.href === '/venues'
            ? pathname === '/venues' || pathname.startsWith('/venues/')
            : pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'inline-flex min-h-[34px] min-w-0 items-center justify-center rounded-full border px-2 py-1 text-center text-[11px] font-medium transition sm:min-h-[44px] sm:px-4 sm:py-2 sm:text-sm',
              active
                ? 'border-orange-300 bg-orange-500 text-black shadow-[0_10px_26px_rgba(255,125,24,0.36)] ring-1 ring-orange-200/20'
                : 'border-white/8 bg-white/[0.04] text-white/72 hover:border-white/15 hover:bg-white/[0.08] hover:text-white sm:bg-white/5',
            ].join(' ')}
          >
            <span className="sm:hidden">{link.mobileLabel}</span>
            <span className="hidden sm:inline">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
