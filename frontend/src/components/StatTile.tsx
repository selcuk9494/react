'use client';

import React from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

export type StatAccent =
  | 'slate'
  | 'emerald'
  | 'indigo'
  | 'amber'
  | 'red'
  | 'violet'
  | 'sky'
  | 'purple';

const ACCENTS: Record<
  StatAccent,
  { value: string; icon: string; iconBg: string; bar: string }
> = {
  slate: { value: 'text-slate-900', icon: 'text-slate-600', iconBg: 'bg-slate-100', bar: 'bg-slate-500' },
  emerald: { value: 'text-emerald-700', icon: 'text-emerald-600', iconBg: 'bg-emerald-50', bar: 'bg-emerald-500' },
  indigo: { value: 'text-indigo-700', icon: 'text-indigo-600', iconBg: 'bg-indigo-50', bar: 'bg-indigo-500' },
  amber: { value: 'text-amber-600', icon: 'text-amber-600', iconBg: 'bg-amber-50', bar: 'bg-amber-500' },
  red: { value: 'text-red-600', icon: 'text-red-600', iconBg: 'bg-red-50', bar: 'bg-red-500' },
  violet: { value: 'text-violet-700', icon: 'text-violet-600', iconBg: 'bg-violet-50', bar: 'bg-violet-500' },
  sky: { value: 'text-sky-700', icon: 'text-sky-600', iconBg: 'bg-sky-50', bar: 'bg-sky-500' },
  purple: { value: 'text-purple-700', icon: 'text-purple-600', iconBg: 'bg-purple-50', bar: 'bg-purple-500' },
};

/**
 * Profesyonel KPI kutusu. `tone="dark"` manset ( one cikan) deger icin koyu kart,
 * `tone="light"` (varsayilan) beyaz kart + vurgu rengi.
 */
export default function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'slate',
  tone = 'light',
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  accent?: StatAccent;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  if (tone === 'dark') {
    return (
      <div
        className={clsx(
          'rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white shadow-lg',
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <p className="text-slate-300 text-[11px] font-semibold uppercase tracking-wide">
            {label}
          </p>
          {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        </div>
        <div className="mt-2 text-3xl font-black tracking-tight leading-none break-words">
          {value}
        </div>
        {sub != null && <p className="text-slate-400 text-sm mt-2 font-medium">{sub}</p>}
      </div>
    );
  }

  const a = ACCENTS[accent];
  return (
    <div
      className={clsx(
        'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </p>
        {Icon && (
          <span className={clsx('w-8 h-8 rounded-xl flex items-center justify-center', a.iconBg)}>
            <Icon className={clsx('w-4 h-4', a.icon)} />
          </span>
        )}
      </div>
      <div className={clsx('mt-2 text-2xl font-black tracking-tight leading-none break-words', a.value)}>
        {value}
      </div>
      {sub != null && <p className="text-slate-500 text-xs mt-2 font-medium">{sub}</p>}
    </div>
  );
}
