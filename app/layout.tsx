import "./globals.css";
import Link from "next/link";
import FirstRoundLogo from "./components/FirstRoundLogo";
import PublicNavLinks from "./components/PublicNavLinks";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-white/10 bg-black text-white">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <Link href="/livenow" className="inline-flex items-center text-white transition hover:opacity-90">
                <FirstRoundLogo compact />
              </Link>
              <PublicNavLinks />
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
