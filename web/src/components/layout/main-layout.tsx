import React from 'react';
import Header from '@/components/Header';

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="">
        {children}
      </main>
    </div>
  );
}
