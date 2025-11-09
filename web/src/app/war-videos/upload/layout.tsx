'use client';
import React from 'react';

export default function UploadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full">
      <div className="relative z-10">{children}</div>
    </div>
  );
}
