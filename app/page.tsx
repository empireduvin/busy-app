export default function Home() {
  return (
    <main className="min-h-screen w-full bg-black flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-5xl font-bold tracking-tight">First Round</h1>

      <p className="text-white mt-4 text-lg opacity-70">What’s on. Right now.</p>

      <div className="mt-10 flex gap-4">
        <a
          href="/today"
          className="px-6 py-3 rounded-2xl bg-orange-500 text-black font-semibold hover:bg-orange-400 transition"
        >
          Today
        </a>

        <a
          href="/venues"
          className="px-6 py-3 rounded-2xl border border-white/20 hover:border-white/40 transition"
        >
          Venues
        </a>
      </div>
    </main>
  );
}
