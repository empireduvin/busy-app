import InstallAppPrompt from '@/app/components/InstallAppPrompt';
import Link from 'next/link';

export default function InstallPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-10">
        <section className="rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,128,32,0.16),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:rounded-3xl sm:p-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            First Round
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Add First Round to your phone
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
            Open First Round like an app and quickly check what&apos;s live tonight.
          </p>
          <div className="mt-5">
            <InstallAppPrompt compact />
          </div>
          <div className="mt-5">
            <Link
              href="/livenow"
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400"
            >
              Open Live Now
            </Link>
          </div>
        </section>

        <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2">
          <InstallSteps
            title="For iPhone"
            steps={[
              'Open First Round in Safari',
              'Tap the Share button',
              'Tap Add to Home Screen',
              'Tap Add',
            ]}
          />
          <InstallSteps
            title="For Android"
            steps={[
              'Open First Round in Chrome',
              'Tap the menu',
              'Tap Install app or Add to Home screen',
              'Confirm',
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function InstallSteps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4 sm:rounded-3xl sm:p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm leading-5 text-white/72">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange-300/25 bg-orange-500/12 text-xs font-semibold text-orange-100">
              {index + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
