'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function InstallAppPrompt({ compact = false }: { compact?: boolean }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!installEvent) return;

    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
  }

  const body = (
    <>
      <div className="min-w-0">
        <div className={compact ? 'text-[12px] font-semibold text-white/86' : 'text-sm font-semibold text-white'}>
          Add First Round to your phone
        </div>
        <div className={compact ? 'mt-0.5 text-[11px] leading-4 text-white/52' : 'mt-1 text-sm leading-5 text-white/62'}>
          Save it like an app for quick access tonight.
        </div>
      </div>
      {installEvent ? (
        <button
          type="button"
          onClick={handleInstall}
          className="shrink-0 rounded-full border border-orange-300/30 bg-orange-500/14 px-3 py-1.5 text-xs font-semibold text-orange-50 transition hover:bg-orange-500/20"
        >
          Install
        </button>
      ) : (
        <Link
          href="/install"
          className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/76 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
        >
          How to add
        </Link>
      )}
    </>
  );

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
        {body}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[1.3rem] border border-white/9 bg-[linear-gradient(180deg,rgba(255,111,36,0.09),rgba(255,255,255,0.025))] p-4 sm:flex-row sm:items-center sm:justify-between">
      {body}
    </div>
  );
}
