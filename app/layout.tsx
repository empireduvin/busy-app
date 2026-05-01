import "./globals.css";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import FirstRoundLogo from "./components/FirstRoundLogo";
import PublicHeaderShell from "./components/PublicHeaderShell";
import PublicNavLinks from "./components/PublicNavLinks";
import { PublicUserProvider } from "./components/PublicUserProvider";
import PublicUserControls from "./components/PublicUserControls";
import PublicVenueInterestStrip from "./components/PublicVenueInterestStrip";

export const metadata: Metadata = {
  title: "First Round",
  description: "Find what's live now at pubs, bars, specials and events near you",
  applicationName: "First Round",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "First Round",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ff6f24",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <PublicUserProvider>
          <div className="min-h-screen flex flex-col">
            <PublicHeaderShell>
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 py-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-4">
                <Link href="/livenow" className="inline-flex max-w-full items-center text-white transition hover:opacity-90">
                  <FirstRoundLogo compact />
                </Link>
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                  <PublicNavLinks />
                  <div className="flex justify-end">
                    <PublicUserControls />
                  </div>
                </div>
              </div>
            </PublicHeaderShell>

            <main className="flex-1 pt-[68px] sm:pt-0">{children}</main>
            <PublicVenueInterestStrip />
          </div>
        </PublicUserProvider>
      </body>
    </html>
  );
}
