import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Image from "next/image";
import Link from "next/link";
import { SmoothScrollLink } from "@/components/SmoothScrollLink";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CereBro - MCOC Discord Bot",
  description: "CereBro is an intelligent MCOC Discord Bot for alliances, war planning, AQ automation, and champion data lookup.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100 min-h-screen gradient-bg scroll-smooth`}
      >
        <header className="fixed top-0 inset-x-0 z-40 nav-blur border-b border-slate-800/70 bg-slate-950/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="#top" className="flex items-center gap-3">
                <Image src="/CereBro_logo_256.png" alt="CereBro Logo" width={36} height={36} className="rounded-2xl" />
                <div className="hidden sm:block">
                  <p className="font-semibold tracking-tight text-sm">CereBro</p>
                  <p className="text-[11px] text-slate-400 leading-none">MCOC Alliance Intelligence</p>
                </div>
              </Link>

              <nav className="hidden md:flex items-center gap-8 text-sm">
                <SmoothScrollLink href="#features" className="text-slate-300 hover:text-white transition-colors">Features</SmoothScrollLink>
                <SmoothScrollLink href="#commands" className="text-slate-300 hover:text-white transition-colors">Commands</SmoothScrollLink>
                <SmoothScrollLink href="#howitworks" className="text-slate-300 hover:text-white transition-colors">How it works</SmoothScrollLink>
                <SmoothScrollLink href="#faq" className="text-slate-300 hover:text-white transition-colors">FAQ</SmoothScrollLink>
              </nav>

              <div className="flex items-center gap-3">
                <Link href="https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_ID&permissions=8&scope=bot%20applications.commands" target="_blank" className="hidden sm:inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold btn-primary text-slate-50 shadow-lg shadow-cyan-500/40">
                  <span>Invite CereBro</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 10a1 1 0 0 1 1-1h6.586L9.293 5.707a1 1 0 0 1 1.414-1.414l5 5a1 1 0 0 1 .083.094l.007.01a1 1 0 0 1 .182.573v.06a1 1 0 0 1-.272.628l-5 5a1 1 0 0 1-1.414-1.414L12.586 11H6a1 1 0 0 1-1-1z"/>
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
