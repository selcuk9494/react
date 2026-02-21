import useSWR from 'swr';
import axios from 'axios';
import { useMemo } from 'react';
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
}

export function useReportData({
  endpoint,
  token,
  period,
  customStartDate,
  customEndDate,
  additionalParams = {},
  enabled = true,
}: UseReportDataOptions) {
  const apiUrl = useMemo(() => {
    if (!token || !enabled) return null;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return null;

    const params = new URLSearchParams({
      period,
      ...(period === 'custom' && customStartDate && customEndDate
        ? { start_date: customStartDate, end_date: customEndDate }
        : {}),
      ...additionalParams,
    });

    return `${getApiUrl()}${endpoint}?${params.toString()}`;
  }, [token, enabled, endpoint, period, customStartDate, customEndDate, additionalParams]);

  const { data, error, isLoading, mutate } = useSWR(
    apiUrl ? [apiUrl, token] : null,
    ([url, tkn]) => fetcher(url, tkn as string),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 3000, // 3 seconds deduplication
      keepPreviousData: true, // Show previous data while loading new data
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}
