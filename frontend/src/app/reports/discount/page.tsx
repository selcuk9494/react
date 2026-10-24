'use client';

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter } from 'next/navigation';
import { Tag, Percent, Receipt } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import ReportShell from '@/components/ReportShell';
import StatTile from '@/components/StatTile';
import { useSharedReportFilters, getBranchKasaOptions } from '@/utils/reportFilters';
import { useReportData } from '@/utils/useReportData';
import { exportRowsAsExcel, exportRowsAsPdf, ExportColumn } from '@/utils/reportExport';

const START_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
  const label = `${String(hour).padStart(2, '0')}:00`;
  return { label, value: label };
});

const END_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  label: `${String(hour).padStart(2, '0')}:59`,
  value: `${String(hour).padStart(2, '0')}:59`,
}));

export default function DiscountPage() {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { period, setPeriod, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, kasaNo, setKasaNo } = useSharedReportFilters();
  const kasaOptions = getBranchKasaOptions(user);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const additionalParams = useMemo(() => ({
    ...(startTime ? { start_time: startTime } : {}),
    ...(endTime ? { end_time: endTime } : {}),
  }), [startTime, endTime]);

  const { data, isLoading, error } = useReportData({
endpoint: '/reports/discount',
    token,
    period,
    customStartDate,
    customEndDate,
    additionalParams,
    kasaNo,
    branchId: user?.selected_branch_id,
  });

  const formatCurrency = (val: number) => {
    if (val === null || val === undefined) return '₺0,00';
    const n = Number(val) || 0;
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(n);
  };

  const rows = Array.isArray(data) ? data : [];
  const totalDiscount = rows.reduce((acc: number, curr: any) => acc + Number(curr.iskonto ?? 0), 0);
  const avgDiscount = rows.length ? totalDiscount / rows.length : 0;

  const exportColumns: ExportColumn[] = [
    { key: 'adsno', label: 'Adisyon No' },
    { key: 'customer_name', label: 'Müşteri' },
    { key: 'tarih', label: 'Tarih' },
    { key: 'acilis_saati', label: 'Açılış' },
    { key: 'kapanis_saati', label: 'Kapanış' },
    { key: 'tutar', label: 'Tutar', format: (value) => formatCurrency(Number(value || 0)) },
    { key: 'iskonto', label: 'İndirim', format: (value) => formatCurrency(Number(value || 0)) },
  ];

  const rowOf = (item: any, index: number) => {
    const iskonto = Number(item.iskonto ?? 0);
    const netTutar = Number(item.net_tutar ?? 0);
    const tutar = item.tutar !== undefined && item.tutar !== null ? Number(item.tutar) : netTutar + iskonto;
    const orderNo = item.adsno || item.order_no || index + 1;
    const customerName = item.customer_name || item.mustid || t('customer');
    const orderDate = item.tarih || item.date || '';
    return { iskonto, tutar, orderNo, customerName, orderDate };
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans safe-bottom">
      <ReportHeader
        title={t('discount_title')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        actions={
          <>
            <button
              type="button"
              onClick={() => exportRowsAsExcel(t('discount_title'), exportColumns, rows)}
              className="px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
            >
              Excel
            </button>
            <button
              type="button"
              onClick={() => exportRowsAsPdf(t('discount_title'), exportColumns, rows)}
              className="px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap bg-white text-red-700 border border-red-200 hover:bg-red-50"
            >
              PDF
            </button>
          </>
        }
        kasaNo={kasaNo}
        setKasaNo={setKasaNo}
        kasaOptions={kasaOptions}
      />

      <ReportShell>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold text-slate-600">
            Başlangıç Saati
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Tümü</option>
              {START_HOUR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Bitiş Saati
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Tümü</option>
              {END_HOUR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {(startTime || endTime) && (
            <button
              type="button"
              onClick={() => {
                setStartTime('');
                setEndTime('');
              }}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              Temizle
            </button>
          )}
        </div>

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
            <Tag className="w-14 h-14 text-red-300 mx-auto mb-4" />
            <p className="text-red-500">Error: {error.message}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <Tag className="w-14 h-14 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('no_discounts')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatTile tone="dark" label={t('total_discount')} value={formatCurrency(totalDiscount)} sub={`${rows.length} ${t('discount_records')}`} icon={Tag} />
              <StatTile accent="red" label={t('discount_records')} value={rows.length} icon={Receipt} />
              <StatTile accent="amber" label="Ortalama İndirim" value={formatCurrency(avgDiscount)} icon={Percent} />
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">{t('discount_title')}</h2>
                <span className="text-sm text-slate-500">{rows.length} kayıt</span>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-semibold">Adisyon</th>
                      <th className="px-4 py-3 font-semibold">{t('customer')}</th>
                      <th className="px-4 py-3 font-semibold">Tarih</th>
                      <th className="px-4 py-3 font-semibold text-right">{t('order_total')}</th>
                      <th className="px-4 py-3 font-semibold text-right">{t('discount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item: any, index: number) => {
                      const r = rowOf(item, index);
                      return (
                        <tr
                          key={index}
                          className="border-t border-slate-100 hover:bg-amber-50/40 cursor-pointer"
                          onClick={() => router.push(`/reports/orders/detail?id=${r.orderNo}&type=closed`)}
                        >
                          <td className="px-4 py-3 font-bold text-slate-900">#{r.orderNo}</td>
                          <td className="px-4 py-3 text-slate-700">{r.customerName}</td>
                          <td className="px-4 py-3 text-slate-600">{r.orderDate}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(r.tutar)}</td>
                          <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(r.iskonto)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-slate-100">
                {rows.map((item: any, index: number) => {
                  const r = rowOf(item, index);
                  return (
                    <button
                      key={index}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-slate-50"
                      onClick={() => router.push(`/reports/orders/detail?id=${r.orderNo}&type=closed`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{r.customerName}</div>
                          <div className="text-xs text-slate-500 mt-0.5">#{r.orderNo} · {r.orderDate}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{t('order_total')}: {formatCurrency(r.tutar)}</div>
                        </div>
                        <div className="font-bold text-red-600 shrink-0">{formatCurrency(r.iskonto)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 bg-amber-50/60 px-4 py-3">
                <span className="text-sm font-semibold text-amber-700">{t('total_discount')}</span>
                <span className="text-lg font-black text-red-600">{formatCurrency(totalDiscount)}</span>
              </div>
            </section>
          </>
        )}
      </ReportShell>
    </div>
  );
}
