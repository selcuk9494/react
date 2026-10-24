import useSWR from 'swr';
import axios from 'axios';
import { useMemo, useRef, useEffect, useState } from 'react';
import { getApiUrl } from './api';

const fetcher = (url: string, token: string) =>
  axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).then((res) => res.data);

interface UseReportDataOptions {
  endpoint: string;
  token: string | null;
  period: string;
  customStartDate?: string;
  customEndDate?: string;
  additionalParams?: Record<string, any>;
  enabled?: boolean;
  branchId?: string | number;
  /** Bos/undefined = tum kasalar */
  kasaNo?: string | number;
}

export function useReportData({
  endpoint,
  token,
  period,
  customStartDate,
  customEndDate,
  additionalParams = {},
  enabled = true,
  branchId,
  kasaNo,
}: UseReportDataOptions) {
  // Track previous values to detect changes
  const prevPeriodRef = useRef(period);
  const prevBranchRef = useRef(branchId);
  const prevKasaRef = useRef(kasaNo);
  const [isChanging, setIsChanging] = useState(false);

  const apiUrl = useMemo(() => {
    if (!token || !enabled) return null;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return null;

    const params = new URLSearchParams({
      period,
      ...(period === 'custom' && customStartDate && customEndDate
        ? { start_date: customStartDate, end_date: customEndDate }
        : {}),
      ...(kasaNo != null && String(kasaNo).trim() !== ''
        ? { kasa_no: String(kasaNo) }
        : {}),
      ...(branchId != null && String(branchId).trim() !== ''
        ? { branch_id: String(branchId) }
        : {}),
      ...additionalParams,
    });

    return `${getApiUrl()}${endpoint}?${params.toString()}`;
  }, [token, enabled, endpoint, period, customStartDate, customEndDate, additionalParams, kasaNo, branchId]);

  const { data, error, isLoading, mutate } = useSWR(
    apiUrl ? [apiUrl, token] : null,
    ([url, tkn]) => fetcher(url, tkn as string),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 3000,
      keepPreviousData: false, // Don't keep previous data - show loading state instead
    }
  );

  // Detect period or branch changes and trigger loading state
  useEffect(() => {
    const periodChanged = prevPeriodRef.current !== period;
    const branchChanged = prevBranchRef.current !== branchId;
    const kasaChanged = prevKasaRef.current !== kasaNo;
    
    if (periodChanged || branchChanged || kasaChanged) {
      setIsChanging(true);
      prevPeriodRef.current = period;
      prevBranchRef.current = branchId;
      prevKasaRef.current = kasaNo;
    }
  }, [period, branchId, kasaNo]);

  // Reset changing state when data arrives
  useEffect(() => {
    if (!isLoading && data !== undefined) {
      setIsChanging(false);
    }
  }, [isLoading, data]);

  return {
    data: isChanging ? undefined : data, // Return undefined while changing to show loading
    error,
    isLoading: isLoading || isChanging,
    mutate,
  };
}
