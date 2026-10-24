'use client';

import React, { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { BarChart as BarChartIcon, TrendingUp, Wallet, CalendarDays } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReportHeader from '@/components/ReportHeader';
import ReportShell from '@/components/ReportShell';
import StatTile from '@/components/StatTile';
import { useSharedReportFilters, getBranchKasaOptions } from '@/utils/reportFilters';
import ReportExportButtons from '@/components/ReportExportButtons';
import { useReportData } from '@/utils/useReportData';

export default function SalesChartPage() {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const { period, setPeriod, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, kasaNo, setKasaNo } = useSharedReportFilters();
  const kasaOptions = getBranchKasaOptions(user);

  const { data, isLoading, error } = useReportData({
endpoint: '/reports/sales-chart',
    token,
    period,
    customStartDate,
    customEndDate,
    kasaNo,
    branchId: user?.selected_branch_id,
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };
  const formatCompact = (val: number) => new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(val);

  // Ensure data is array and map field names
  const chartData = Array.isArray(data)
    ? data.map((item: any) => ({
        date: item.date || item.tarih || '',
        total: Number(item.total || item.toplam || 0),
      }))
    : [];

  const totalSales = useMemo(() => chartData.reduce((s, d) => s + d.total, 0), [chartData]);
  const peak = useMemo(() => chartData.reduce((m, d) => (d.total > m ? d.total : m), 0), [chartData]);
  const avg = chartData.length ? totalSales / chartData.length : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans safe-bottom">
      <ReportHeader
        title={t('sales_chart_title')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        actions={
          <ReportExportButtons
            title={t('sales_chart_title')}
            rows={chartData}
            columns={[
              { key: 'date', label: 'Tarih' },
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
            <div className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <BarChartIcon className="w-14 h-14 text-red-300 mx-auto mb-4" />
            <p className="text-red-500">Error: {error.message}</p>
          </div>
        ) : !chartData || chartData.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <BarChartIcon className="w-14 h-14 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('no_data')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatTile tone="dark" label={t('total_sales')} value={formatCurrency(totalSales)} sub={`${chartData.length} gün`} icon={Wallet} />
              <StatTile accent="indigo" label="Günlük Ortalama" value={formatCurrency(avg)} icon={TrendingUp} />
              <StatTile accent="emerald" label="En Yüksek Gün" value={formatCurrency(peak)} icon={CalendarDays} />
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChartIcon className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">{t('daily_sales')}</h2>
              </div>
              <div style={{ width: '100%', height: 360 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tickFormatter={formatCompact} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip
                      formatter={(value) => {
                        const v = Array.isArray(value) ? value[0] : value;
                        const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
                        return [Number.isFinite(n) ? formatCurrency(n) : '', t('total_sales')];
                      }}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                      cursor={{ fill: 'rgba(79,70,229,0.08)' }}
                    />
                    <Bar dataKey="total" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}
      </ReportShell>
    </div>
  );
}
