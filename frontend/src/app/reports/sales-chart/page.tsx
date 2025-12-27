'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { BarChart as BarChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReportHeader from '@/components/ReportHeader';
import { useReportData } from '@/utils/useReportData';

export default function SalesChartPage() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [period, setPeriod] = useState('week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const { data, isLoading, error } = useReportData({
    endpoint: '/reports/sales-chart',
    token,
    period,
    customStartDate,
    customEndDate,
  });

  // Debug log
  useEffect(() => {
    console.log('Sales Chart Data:', { data, isLoading, error, dataType: typeof data, isArray: Array.isArray(data) });
  }, [data, isLoading, error]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  // Ensure data is array and map field names
  const chartData = Array.isArray(data) 
    ? data.map((item: any) => ({
        date: item.date || item.tarih || '',
        total: item.total || item.toplam || 0
      }))
    : [];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 safe-bottom">
      <ReportHeader
        title={t('sales_chart_title')}
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
            <div className="bg-white rounded-3xl p-6 shadow-lg animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
              <div className="h-64 bg-gray-100 rounded-2xl"></div>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <BarChartIcon className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <p className="text-red-500">Error: {error.message}</p>
            <details className="mt-4 text-left max-w-md mx-auto bg-red-50 p-4 rounded-lg">
              <summary className="cursor-pointer text-red-700 font-medium">Debug Info</summary>
              <pre className="mt-2 text-xs text-red-600 overflow-auto">{JSON.stringify({ data, error }, null, 2)}</pre>
            </details>
          </div>
        ) : !chartData || chartData.length === 0 ? (
          <div className="text-center py-12">
            <BarChartIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('no_data')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('daily_sales')}</h2>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number | undefined) => value ? formatCurrency(value) : ''} />
                  <Bar dataKey="total" fill="#4F46E5" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
