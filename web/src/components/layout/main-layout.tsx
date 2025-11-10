import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}
