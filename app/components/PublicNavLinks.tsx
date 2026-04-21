'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PUBLIC_LINKS = [
  { href: '/livenow', label: '\u{1F525} Live now', mobileLabel: '\u{1F525} Live' },
  { href: '/today', label: '\u{1F37B} Today', mobileLabel: '\u{1F37B} Today' },
  { href: '/week', label: '\u{1F4C5} This week', mobileLabel: '\u{1F4C5} Week' },
  { href: '/venues', label: 'Venues', mobileLabel: 'Venues' },
  { href: '/contact', label: 'Contact', mobileLabel: 'Contact' },
];

export default function PublicNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="grid w-full grid-cols-5 gap-1 overflow-hidden rounded-[0.9rem] bg-white/[0.015] p-0.5 sm:flex sm:w-auto sm:flex-wrap sm:justify-end sm:gap-1.5 sm:rounded-full sm:bg-transparent sm:p-0">
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
              'inline-flex min-h-[28px] min-w-0 items-center justify-center rounded-full border px-1 py-0.5 text-center text-[10px] font-medium transition sm:min-h-[38px] sm:px-3 sm:py-1.25 sm:text-sm',
              active
                ? 'border-orange-300/40 bg-orange-500/16 text-orange-50 shadow-[0_8px_18px_rgba(255,125,24,0.10)]'
                : 'border-white/7 bg-white/[0.015] text-white/60 hover:border-white/12 hover:bg-white/[0.05] hover:text-white sm:bg-white/[0.03]',
            ].join(' ')}
          >
            <span className="truncate sm:hidden">{link.mobileLabel}</span>
            <span className="hidden truncate sm:inline">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
