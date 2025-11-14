'use client';
import React from 'react';
import FormPageBackground from '@/components/FormPageBackground';

export default function WarVideosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full h-full">
      <FormPageBackground />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
