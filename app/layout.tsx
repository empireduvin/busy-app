import "./globals.css";
import Link from "next/link";
import FirstRoundLogo from "./components/FirstRoundLogo";
import PublicNavLinks from "./components/PublicNavLinks";
import PublicVenueInterestStrip from "./components/PublicVenueInterestStrip";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-50 border-b border-white/10 bg-black/95 text-white backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <Link href="/livenow" className="inline-flex items-center text-white transition hover:opacity-90">
                <FirstRoundLogo compact />
              </Link>
              <PublicNavLinks />
            </div>
          </header>

          <main className="flex-1">{children}</main>
          <PublicVenueInterestStrip />
        </div>
      </body>
    </html>
  );
}
