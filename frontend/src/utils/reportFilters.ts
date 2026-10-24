'use client';

import { useCallback, useMemo, useState } from 'react';

const PERIOD_KEY = 'report_period';
const START_KEY = 'report_start_date';
const END_KEY = 'report_end_date';
const KASA_KEY = 'report_kasa_no';

const ALLOWED = [
  'today',
  'yesterday',
  'week',
  'last7days',
  'month',
  'lastmonth',
  'custom',
] as const;

export type ReportPeriod = (typeof ALLOWED)[number] | string;

function readLS(key: string) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLS(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

export function readStoredPeriod(): {
  period: string;
  startDate: string;
  endDate: string;
} {
  const saved = readLS(PERIOD_KEY) || readLS('dashboard_period') || 'today';
  const period = ALLOWED.includes(saved as any) ? saved : 'today';
  const startDate = readLS(START_KEY) || readLS('dashboard_start_date') || '';
  const endDate = readLS(END_KEY) || readLS('dashboard_end_date') || '';
  if (period === 'custom' && (!startDate || !endDate)) {
    return { period: 'today', startDate: '', endDate: '' };
  }
  return { period, startDate, endDate };
}

export function persistPeriod(
  period: string,
  startDate = '',
  endDate = '',
) {
  writeLS(PERIOD_KEY, period);
  writeLS('dashboard_period', period);
  if (period === 'custom') {
    writeLS(START_KEY, startDate);
    writeLS(END_KEY, endDate);
    writeLS('dashboard_start_date', startDate);
    writeLS('dashboard_end_date', endDate);
  }
}

export function readStoredKasaNo(): string {
  return readLS(KASA_KEY) || '';
}

export function persistKasaNo(kasaNo: string) {
  if (!kasaNo) {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(KASA_KEY);
      } catch {}
    }
    return;
  }
  writeLS(KASA_KEY, String(kasaNo));
}

export type KasaEntry = { kasa_no: number; name: string };

function parseBranchKasaList(branch: any): KasaEntry[] {
  if (!branch) return [];
  const map = new Map<number, string>();
  const put = (rawNo: any, rawName?: any) => {
    const n = Number(rawNo);
    if (!Number.isFinite(n) || n <= 0) return;
    const name =
      rawName != null && String(rawName).trim()
        ? String(rawName).trim()
        : '';
    if (!map.has(n) || name) map.set(n, name || map.get(n) || '');
  };

  put(branch.kasa_no);

  let list = branch.kasa_list;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  if (Array.isArray(list)) {
    for (const item of list) {
      if (item != null && typeof item === 'object') {
        put(item.kasa_no ?? item.no, item.name ?? item.kasa_name);
      } else {
        put(item);
      }
    }
  }

  const extras = Array.isArray(branch.kasalar) ? branch.kasalar : [];
  for (const k of extras) {
    if (k != null && typeof k === 'object') {
      put((k as any).kasa_no, (k as any).name ?? (k as any).kasa_name);
    } else {
      put(k);
    }
  }

  return Array.from(map.entries())
    .map(([kasa_no, name]) => ({ kasa_no, name }))
    .sort((a, b) => a.kasa_no - b.kasa_no);
}

/** Secili subenin kasa listesi (numara + isim). */
export function getBranchKasaEntries(user: any): KasaEntry[] {
  if (!user?.branches?.length) return [];
  const idx =
    typeof user.selected_branch === 'number' ? user.selected_branch : 0;
  const branch =
    (user.selected_branch_id &&
      user.branches.find(
        (b: any) => String(b?.id) === String(user.selected_branch_id),
      )) ||
    user.branches[idx] ||
    user.branches[0];
  return parseBranchKasaList(branch);
}

/** Secili subenin kasa numaralari. */
export function getBranchKasaOptions(user: any): number[] {
  return getBranchKasaEntries(user).map((e) => e.kasa_no);
}

export function formatKasaLabel(
  kasaNo: number | string,
  entries?: KasaEntry[] | null,
): string {
  const n = Number(kasaNo);
  if (!Number.isFinite(n) || n <= 0) return 'Kasa';
  const found = (entries || []).find((e) => e.kasa_no === n);
  if (found?.name) return found.name;
  return `Kasa ${n}`;
}

/** Kasa numarasına göre tutarlı renk paleti (grup etiketleri / chip). */
export type KasaColor = {
  bg: string;
  border: string;
  text: string;
  solid: string;
  solidText: string;
  bar: string;
  tag: string;
};

const KASA_COLORS: KasaColor[] = [
  {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-900',
    solid: 'bg-emerald-600 border-emerald-600',
    solidText: 'text-white',
    bar: 'bg-emerald-500',
    tag: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    bg: 'bg-sky-50',
    border: 'border-sky-300',
    text: 'text-sky-900',
    solid: 'bg-sky-600 border-sky-600',
    solidText: 'text-white',
    bar: 'bg-sky-500',
    tag: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-950',
    solid: 'bg-amber-500 border-amber-500',
    solidText: 'text-white',
    bar: 'bg-amber-500',
    tag: 'bg-amber-100 text-amber-900 border-amber-200',
  },
  {
    bg: 'bg-violet-50',
    border: 'border-violet-300',
    text: 'text-violet-900',
    solid: 'bg-violet-600 border-violet-600',
    solidText: 'text-white',
    bar: 'bg-violet-500',
    tag: 'bg-violet-100 text-violet-800 border-violet-200',
  },
  {
    bg: 'bg-rose-50',
    border: 'border-rose-300',
    text: 'text-rose-900',
    solid: 'bg-rose-600 border-rose-600',
    solidText: 'text-white',
    bar: 'bg-rose-500',
    tag: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  {
    bg: 'bg-teal-50',
    border: 'border-teal-300',
    text: 'text-teal-900',
    solid: 'bg-teal-600 border-teal-600',
    solidText: 'text-white',
    bar: 'bg-teal-500',
    tag: 'bg-teal-100 text-teal-800 border-teal-200',
  },
  {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-950',
    solid: 'bg-orange-500 border-orange-500',
    solidText: 'text-white',
    bar: 'bg-orange-500',
    tag: 'bg-orange-100 text-orange-900 border-orange-200',
  },
  {
    bg: 'bg-indigo-50',
    border: 'border-indigo-300',
    text: 'text-indigo-900',
    solid: 'bg-indigo-600 border-indigo-600',
    solidText: 'text-white',
    bar: 'bg-indigo-500',
    tag: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
];

export function getKasaColor(kasaNo: number | string): KasaColor {
  const n = Number(kasaNo);
  const idx =
    Number.isFinite(n) && n > 0
      ? (Math.trunc(n) - 1) % KASA_COLORS.length
      : 0;
  return KASA_COLORS[idx < 0 ? 0 : idx];
}

/** Dashboard + tum raporlar icin ortak period/kasa state. */
export function useSharedReportFilters() {
  const initial = useMemo(() => readStoredPeriod(), []);
  const [period, setPeriodState] = useState(initial.period);
  const [customStartDate, setCustomStartDateState] = useState(
    initial.startDate,
  );
  const [customEndDate, setCustomEndDateState] = useState(initial.endDate);
  const [kasaNo, setKasaNoState] = useState(() => readStoredKasaNo());

  const setPeriod = useCallback((p: string) => {
    setPeriodState(p);
    persistPeriod(
      p,
      p === 'custom' ? customStartDate : '',
      p === 'custom' ? customEndDate : '',
    );
  }, [customStartDate, customEndDate]);

  const setCustomStartDate = useCallback(
    (d: string) => {
      setCustomStartDateState(d);
      if (period === 'custom') persistPeriod('custom', d, customEndDate);
    },
    [period, customEndDate],
  );

  const setCustomEndDate = useCallback(
    (d: string) => {
      setCustomEndDateState(d);
      if (period === 'custom') persistPeriod('custom', customStartDate, d);
    },
    [period, customStartDate],
  );

  const setKasaNo = useCallback((v: string) => {
    setKasaNoState(v);
    persistKasaNo(v);
  }, []);

  /** Custom tarih uygulandiginda period=custom yaz. */
  const applyCustomRange = useCallback(
    (start: string, end: string) => {
      setCustomStartDateState(start);
      setCustomEndDateState(end);
      setPeriodState('custom');
      persistPeriod('custom', start, end);
    },
    [],
  );

  return {
    period,
    setPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    kasaNo,
    setKasaNo,
    applyCustomRange,
  };
}
