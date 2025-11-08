import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { Starfield } from "@/components/Starfield";

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
  description: "CereBro is the ultimate MCOC Discord bot, offering cutting-edge OCR for roster management, in-depth champion data, a comprehensive glossary, automated AQ scheduling, and prestige tracking for a tactical advantage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-slate-100 min-h-screen scroll-smooth bg-slate-950`}
      >
        <Starfield />
        <div className="relative z-0 min-h-screen">
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
