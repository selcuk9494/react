import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getBranchKasaOptions,
  persistKasaNo,
  persistPeriod,
  readStoredKasaNo,
  readStoredPeriod,
} from '../utils/reportFilters';

function toYmd(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/**
 * Dashboard'dan gelen route params + AsyncStorage ile ortak period/kasa.
 */
export function useReportFilters(route) {
  const [period, setPeriodState] = useState('today');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [kasaNo, setKasaNoState] = useState('');
  const [kasaOptions, setKasaOptions] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readStoredPeriod();
      const storedKasa = await readStoredKasaNo();
      const params = route?.params || {};
      const nextPeriod = params.period || stored.period || 'today';
      const startStr = params.start_date || stored.startDate || '';
      const endStr = params.end_date || stored.endDate || '';
      if (!cancelled) {
        setPeriodState(nextPeriod);
        if (startStr) setStartDate(new Date(startStr));
        if (endStr) setEndDate(new Date(endStr));
        setKasaNoState(params.kasa_no != null ? String(params.kasa_no) : storedKasa);
      }
      try {
        const raw = await AsyncStorage.getItem('user');
        const user = raw ? JSON.parse(raw) : null;
        if (!cancelled) setKasaOptions(getBranchKasaOptions(user));
      } catch {}
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [route?.params?.period, route?.params?.start_date, route?.params?.end_date]);

  const setPeriod = useCallback((p) => {
    setPeriodState(p);
    if (p !== 'custom') {
      void persistPeriod(p);
    }
  }, []);

  const setKasaNo = useCallback((v) => {
    setKasaNoState(v);
    void persistKasaNo(v);
  }, []);

  const onApplyCustomDate = useCallback(() => {
    setPeriodState('custom');
    void persistPeriod('custom', toYmd(startDate), toYmd(endDate));
  }, [startDate, endDate]);

  const customStartStr = period === 'custom' ? toYmd(startDate) : '';
  const customEndStr = period === 'custom' ? toYmd(endDate) : '';

  return {
    ready,
    period,
    setPeriod,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    kasaNo,
    setKasaNo,
    kasaOptions,
    onApplyCustomDate,
    customStartStr,
    customEndStr,
  };
}
