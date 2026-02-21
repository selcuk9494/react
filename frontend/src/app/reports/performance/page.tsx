'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Users } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import { useReportData } from '@/utils/useReportData';
import AutoFitText from '@/components/AutoFitText';

export default function PerformancePage() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const { data, isLoading, error } = useReportData({
    endpoint: '/reports/performance',
    token,
    period,
    customStartDate,
    customEndDate,
  });

  // Debug log
  useEffect(() => {
    console.log('Performance Data:', { data, isLoading, error, dataType: typeof data, isArray: Array.isArray(data) });
  }, [data, isLoading, error]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  // Safe data handling - backend returns object with waiters array
  const performanceData = Array.isArray(data) 
    ? data 
    : (data && typeof data === 'object' && data.waiters && Array.isArray(data.waiters))
      ? data.waiters 
      : [];
      
  const totalSales = Array.isArray(performanceData) && performanceData.length > 0
    ? performanceData.reduce((acc: number, curr: any) => acc + (curr.total || 0), 0) 
    : (data && data.totals && data.totals.total_sales) || 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 safe-bottom">
      <ReportHeader
        title={t('performance_title')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6" style={{ paddingTop: 'calc(120px + env(safe-area-inset-top))' }}>
        {isLoading ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl p-8 animate-pulse">
              <div className="h-4 bg-white/30 rounded w-32 mx-auto mb-3"></div>
              <div className="h-12 bg-white/40 rounded w-48 mx-auto"></div>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-3xl p-5 shadow-lg animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-20"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <p className="text-red-500">Error: {error.message}</p>
            <details className="mt-4 text-left max-w-md mx-auto bg-red-50 p-4 rounded-lg">
              <summary className="cursor-pointer text-red-700 font-medium">Debug Info</summary>
              <pre className="mt-2 text-xs text-red-600 overflow-auto">{JSON.stringify({ data, error }, null, 2)}</pre>
            </details>
          </div>
        ) : !performanceData || performanceData.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('no_data')}</p>
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl p-8 text-center text-white shadow-2xl">
              <p className="text-purple-100 text-sm font-bold mb-3">🎯 {t('total_performance')}</p>
              <AutoFitText
                text={formatCurrency(totalSales)}
                className="font-black tracking-tight drop-shadow-lg"
                maxPx={48}
                minPx={24}
              />
            </div>

            <div className="space-y-3">
              {performanceData.map((item: any, index: number) => (
                <div key={index} className="bg-white rounded-3xl p-5 shadow-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{item.waiter_name || item.name || item.personnel_name || 'N/A'}</h3>
                      <p className="text-sm text-gray-500">{item.order_count || item.count || 0} {t('orders')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(item.total || 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
