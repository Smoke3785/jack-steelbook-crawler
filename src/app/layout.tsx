import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Steelbook Search",
    template: "%s · Steelbook Search",
  },
  description:
    "Aggregated steelbook and premium home video releases across Manta Lab, Plain Archive, WeET and the resellers that stock them.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-zinc-800 bg-background">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 ">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight text-zinc-50">
                Steelbook Search
              </span>
              <span className="hidden text-xs text-zinc-400 sm:inline">
                jackhudsoncrawford.iliad.dev
              </span>
            </Link>

            <nav className="flex items-center gap-4 text-sm">
              <Link
                className="transition-colors text-zinc-400 hover:text-zinc-100"
                href="/status"
              >
                Status
              </Link>
            </nav>
          </div>
        </header>

        {children}

        <footer className="h-14 flex align border-t border-zinc-800 items-center">
          <p className="mx-auto h-min w-full max-w-7xl px-4 text-xs text-zinc-400 sm:px-6">
            <a target="_blank" href="https://iliad.dev/">
              website by iliad.dev
            </a>
          </p>
        </footer>

        <Script
          src="https://analytics.atlas-cms.rest/js/script.file-downloads.hash.outbound-links.pageview-props.revenue.tagged-events.js"
          data-domain="jackhudsoncrawford.iliad.dev"
          strategy="afterInteractive"
          defer
        />
        <Script id="plausible-queue-shim" strategy="afterInteractive">
          {`window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }`}
        </Script>
      </body>
    </html>
  );
}
