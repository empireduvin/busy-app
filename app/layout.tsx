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
          <header className="sticky top-0 z-50 border-b border-white/8 bg-[rgba(5,5,5,0.9)] text-white shadow-[0_12px_34px_rgba(0,0,0,0.32)] backdrop-blur-xl supports-[backdrop-filter]:bg-[rgba(5,5,5,0.78)]">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-1.5 px-3 py-2 pb-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-4">
              <Link href="/livenow" className="inline-flex max-w-full items-center text-white transition hover:opacity-90">
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
