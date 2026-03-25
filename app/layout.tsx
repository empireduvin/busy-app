import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-white/10 px-6 py-4 flex justify-between items-center">
            <div className="text-xl font-bold tracking-tight">First Round</div>
            <nav className="flex gap-6 text-sm text-white/70">
              <a href="/today" className="hover:text-white">
                Today
              </a>
              <a href="/venues" className="hover:text-white">
                Venues
              </a>
            </nav>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
