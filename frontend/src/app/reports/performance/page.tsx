'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Users, Trophy, Receipt } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import ReportShell from '@/components/ReportShell';
import StatTile from '@/components/StatTile';
import { useSharedReportFilters, getBranchKasaOptions } from '@/utils/reportFilters';
import ReportExportButtons from '@/components/ReportExportButtons';
import { useReportData } from '@/utils/useReportData';

export default function PerformancePage() {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const { period, setPeriod, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, kasaNo, setKasaNo } = useSharedReportFilters();
  const kasaOptions = getBranchKasaOptions(user);

  const { data, isLoading, error } = useReportData({
    endpoint: '/reports/performance',
    token,
    period,
    customStartDate,
    customEndDate,
    kasaNo,
  });

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
  const totalOrders = performanceData.reduce(
    (acc: number, curr: any) => acc + (Number(curr.order_count ?? curr.count ?? 0) || 0),
    0,
  );
  const nameOf = (item: any) => item.waiter_name || item.name || item.personnel_name || 'N/A';

  return (
    <div className="min-h-screen bg-slate-50 font-sans safe-bottom">
      <ReportHeader
        title={t('performance_title')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        actions={
          <ReportExportButtons
            title={t('performance_title')}
            rows={performanceData}
            columns={[
              { key: 'waiter_name', label: 'Personel', format: (value, row) => value || row.name || row.personnel_name || 'N/A' },
              { key: 'order_count', label: 'Adisyon', format: (value, row) => value || row.count || 0 },
              { key: 'total', label: 'Toplam', format: (value) => formatCurrency(Number(value || 0)) },
            ]}
          />
        }
        kasaNo={kasaNo}
        setKasaNo={setKasaNo}
        kasaOptions={kasaOptions}
      />

      <ReportShell>
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
              ))}
            </div>
            <div className="h-80 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <Users className="w-14 h-14 text-red-300 mx-auto mb-4" />
            <p className="text-red-500">Error: {error.message}</p>
          </div>
        ) : !performanceData || performanceData.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <Users className="w-14 h-14 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('no_data')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatTile tone="dark" label={t('total_performance')} value={formatCurrency(totalSales)} sub={`${performanceData.length} personel`} icon={Trophy} />
              <StatTile accent="purple" label="Personel" value={performanceData.length} icon={Users} />
              <StatTile accent="indigo" label={t('orders')} value={totalOrders} icon={Receipt} />
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">{t('performance_title')}</h2>
                <span className="text-sm text-slate-500">{performanceData.length} personel</span>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-semibold w-12">#</th>
                      <th className="px-4 py-3 font-semibold">Personel</th>
                      <th className="px-4 py-3 font-semibold text-right">{t('orders')}</th>
                      <th className="px-4 py-3 font-semibold text-right">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.map((item: any, index: number) => (
                      <tr key={index} className="border-t border-slate-100 hover:bg-purple-50/40">
                        <td className="px-4 py-3 text-slate-400 font-medium">{index + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{nameOf(item)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{item.order_count || item.count || 0}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(item.total || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-slate-100">
                {performanceData.map((item: any, index: number) => (
                  <div key={index} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 truncate">{nameOf(item)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.order_count || item.count || 0} {t('orders')}</div>
                    </div>
                    <div className="font-bold text-slate-900 shrink-0">{formatCurrency(item.total || 0)}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 bg-purple-50/60 px-4 py-3">
                <span className="text-sm font-semibold text-purple-700">{t('total_performance')}</span>
                <span className="text-lg font-black text-purple-700">{formatCurrency(totalSales)}</span>
              </div>
            </section>
          </>
        )}
      </ReportShell>
    </div>
  );
}
