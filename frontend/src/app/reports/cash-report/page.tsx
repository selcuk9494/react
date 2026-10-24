'use client';

import React, { useMemo } from 'react';
import { AlertCircle, Banknote, Database, Hash, Wallet } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import ReportShell from '@/components/ReportShell';
import StatTile from '@/components/StatTile';
import { useSharedReportFilters, getBranchKasaOptions } from '@/utils/reportFilters';
import ReportExportButtons from '@/components/ReportExportButtons';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useReportData } from '@/utils/useReportData';

export default function CashReportPage() {
  const { token, user } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const { period, setPeriod, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, kasaNo, setKasaNo } = useSharedReportFilters();
  const kasaOptions = getBranchKasaOptions(user);

  const { data, isLoading, error } = useReportData({
endpoint: '/reports/cash-report',
    token,
    period,
    customStartDate,
    customEndDate,
    kasaNo,
    branchId: user?.selected_branch_id,
  });

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const totalAmount = useMemo(() => Number(data?.totals?.toplam ?? 0), [data]);
  const totalTx = useMemo(() => rows.reduce((s: number, r: any) => s + Number(r.tc ?? 0), 0), [rows]);

  const displayDate = (date: string) => {
    if (!date) return '';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return String(date).split('T')[0];
    return formatDate(parsed);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans safe-bottom">
      <ReportHeader
        title={t('cash_report')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        actions={
          <ReportExportButtons
            title={t('cash_report')}
            rows={rows}
            columns={[
              { key: 'tarih', label: t('date') },
              { key: 'kasa', label: t('cash_no') },
              { key: 'tc', label: t('transaction_count') },
              { key: 'tutar', label: t('amount'), format: (value) => formatCurrency(Number(value || 0)) },
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
            <AlertCircle className="w-14 h-14 text-red-300 mx-auto mb-4" />
            <p className="text-red-500">{t('operation_failed')}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <Banknote className="w-14 h-14 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('not_found')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatTile
                tone="dark"
                label={t('total_sales')}
                value={formatCurrency(totalAmount)}
                sub={data?.period?.start && data?.period?.end ? `${displayDate(data.period.start)} - ${displayDate(data.period.end)}` : undefined}
                icon={Wallet}
              />
              <StatTile accent="emerald" label={t('transaction_count')} value={totalTx} icon={Hash} />
              <StatTile accent="sky" label="Kayıt" value={rows.length} icon={Database} />
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">{t('cash_report')}</h2>
                <span className="text-sm text-slate-500">{rows.length} kayıt</span>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-semibold">{t('date')}</th>
                      <th className="px-4 py-3 font-semibold">{t('cash_no')}</th>
                      <th className="px-4 py-3 font-semibold text-right">{t('transaction_count')}</th>
                      <th className="px-4 py-3 font-semibold text-right">{t('amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row: any, index: number) => (
                      <tr key={`${row.tarih ?? index}-${row.kasa ?? index}`} className="border-t border-slate-100 hover:bg-emerald-50/40">
                        <td className="px-4 py-3 font-semibold text-slate-900">{displayDate(row.tarih)}</td>
                        <td className="px-4 py-3 text-slate-600">{row.kasa ?? '-'}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{row.tc ?? 0}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(Number(row.tutar ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-slate-100">
                {rows.map((row: any, index: number) => (
                  <div key={`${row.tarih ?? index}-${row.kasa ?? index}`} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                      <Database className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900">{displayDate(row.tarih)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {t('cash_no')}: {row.kasa ?? '-'} · {t('transaction_count')}: {row.tc ?? 0}
                      </div>
                    </div>
                    <div className="font-black text-emerald-600 shrink-0">{formatCurrency(Number(row.tutar ?? 0))}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 bg-emerald-50/60 px-4 py-3">
                <span className="text-sm font-semibold text-emerald-700">Toplam</span>
                <span className="text-lg font-black text-emerald-700">{formatCurrency(totalAmount)}</span>
              </div>
            </section>
          </>
        )}
      </ReportShell>
    </div>
  );
}
