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

/** Secili subenin kasa listesi (Tumu + numaralar). */
export function getBranchKasaOptions(user: any): number[] {
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
  if (!branch) return [];
  const nos: number[] = [];
  const primary = Number(branch.kasa_no);
  if (Number.isFinite(primary) && primary > 0) nos.push(primary);
  const extras = Array.isArray(branch.kasalar) ? branch.kasalar : [];
  for (const k of extras) {
    const n = Number(k);
    if (Number.isFinite(n) && n > 0) nos.push(n);
  }
  return Array.from(new Set(nos)).sort((a, b) => a - b);
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
