'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface TransitionContextType {
  active: boolean;
  show: () => void;
  hide: () => void;
}

const TransitionContext = createContext<TransitionContextType | undefined>(undefined);

export const TransitionProvider = ({ children }: { children: React.ReactNode }) => {
  const [active, setActive] = useState(false);
  const show = () => setActive(true);
  const hide = () => setActive(false);

  useEffect(() => {
    let safety: ReturnType<typeof setTimeout> | null = null;
    const onStart = () => {
      setActive(true);
      if (safety) clearTimeout(safety);
      // Overlay asla sonsuza kadar kalmasin (sube gecisi vs.)
      safety = setTimeout(() => setActive(false), 8000);
    };
    const onEnd = () => {
      setActive(false);
      if (safety) clearTimeout(safety);
    };
    window.addEventListener('app:transition:start', onStart as EventListener);
    window.addEventListener('app:transition:end', onEnd as EventListener);
    return () => {
      if (safety) clearTimeout(safety);
      window.removeEventListener('app:transition:start', onStart as EventListener);
      window.removeEventListener('app:transition:end', onEnd as EventListener);
    };
  }, []);

  return (
    <TransitionContext.Provider value={{ active, show, hide }}>
      {children}
      {active && (
        <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
        </div>
      )}
    </TransitionContext.Provider>
  );
};

export const useTransition = () => {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error('useTransition must be used within TransitionProvider');
  return ctx;
};
