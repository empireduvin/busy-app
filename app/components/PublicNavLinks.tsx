'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PUBLIC_LINKS = [
  { href: '/livenow', label: 'Live Now' },
  { href: '/today', label: 'Today' },
  { href: '/week', label: 'This Week' },
  { href: '/venues', label: 'Venues' },
  { href: '/contact', label: 'Contact' },
];

export default function PublicNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0">
      {PUBLIC_LINKS.map((link) => {
        const active =
          link.href === '/venues'
            ? pathname === '/venues' || pathname.startsWith('/venues/')
            : pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              'inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition',
              active
                ? 'border-orange-400 bg-orange-500 text-black'
                : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
