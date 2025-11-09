'use client';
import PageBackground from '@/components/PageBackground';
import React from 'react';

export default function UploadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full">
      <PageBackground />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
