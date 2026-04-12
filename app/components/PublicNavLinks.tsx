'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PUBLIC_LINKS = [
  { href: '/livenow', label: 'Live Now' },
  { href: '/today', label: 'Today' },
  { href: '/venues', label: 'Venues' },
];

export default function PublicNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2 sm:justify-end">
      {PUBLIC_LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              'rounded-full border px-4 py-2 text-sm font-medium transition',
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
