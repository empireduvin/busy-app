'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export default function PublicHeaderShell({ children }: { children: ReactNode }) {
  const [hiddenOnMobile, setHiddenOnMobile] = useState(false);
  const lastScrollYRef = useRef(0);
  const hiddenRef = useRef(false);
  const tickingRef = useRef(false);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    hiddenRef.current = false;

    const updateHeader = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollYRef.current;
      const scrollingDown = delta > 8;
      const scrollingUp = delta < -8;
      let nextHidden = hiddenRef.current;

      if (currentScrollY <= 12) {
        nextHidden = false;
      } else if (scrollingDown && currentScrollY > 80) {
        nextHidden = true;
      } else if (scrollingUp && currentScrollY + window.innerHeight < document.body.scrollHeight + 24) {
        nextHidden = false;
      }

      if (nextHidden !== hiddenRef.current) {
        hiddenRef.current = nextHidden;
        setHiddenOnMobile(nextHidden);
      }

      lastScrollYRef.current = currentScrollY;
      tickingRef.current = false;
    };

    const handleScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      window.requestAnimationFrame(updateHeader);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-50 border-b border-white/7 bg-[rgba(5,5,5,0.84)] text-white shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-transform duration-200 ease-out will-change-transform supports-[backdrop-filter]:bg-[rgba(5,5,5,0.68)] sm:sticky sm:border-white/8 sm:shadow-[0_12px_34px_rgba(0,0,0,0.32)] sm:translate-y-0',
        hiddenOnMobile ? '-translate-y-full' : 'translate-y-0',
      ].join(' ')}
    >
      {children}
    </header>
  );
}
