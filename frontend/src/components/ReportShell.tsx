'use client';

import React from 'react';
import clsx from 'clsx';

/**
 * Tum raporlar icin ortak icerik kabi.
 * Masaustunde genis (max-w-7xl), telefonda tam genislik; fixed ReportHeader'in
 * altindan baslar. Boylece her sayfa ayni profesyonel hizalamayi paylasir.
 */
export default function ReportShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={clsx(
        'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-5',
        className,
      )}
      style={{ paddingTop: 'calc(158px + env(safe-area-inset-top))' }}
    >
      {children}
    </main>
  );
}
