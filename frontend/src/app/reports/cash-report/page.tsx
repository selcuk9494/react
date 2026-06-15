'use client';

import React, { useMemo, useState } from 'react';
import { AlertCircle, Banknote, Database } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useReportData } from '@/utils/useReportData';

export default function CashReportPage() {
  const { token } = useAuth();
  const { t, formatCurrency, formatDate } = useI18n();
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const { data, isLoading, error } = useReportData({
    endpoint: '/reports/cash-report',
    token,
    period,
    customStartDate,
    customEndDate,
  });

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const totalAmount = useMemo(() => Number(data?.totals?.toplam ?? 0), [data]);

  const displayDate = (date: string) => {
    if (!date) return '';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return String(date).split('T')[0];
    return formatDate(parsed);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 safe-bottom">
      <ReportHeader
        title={t('cash_report')}
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
            <div className="bg-gradient-to-br from-emerald-500 to-sky-600 rounded-3xl p-8 animate-pulse">
              <div className="h-4 bg-white/30 rounded w-32 mx-auto mb-3"></div>
              <div className="h-12 bg-white/40 rounded w-48 mx-auto"></div>
            </div>
            {[1, 2, 3].map((item) => (
              <div key={item} className="bg-white rounded-3xl p-5 shadow-lg animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-24"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <p className="text-red-500">{t('operation_failed')}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <Banknote className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('not_found')}</p>
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-emerald-500 via-teal-600 to-sky-600 rounded-3xl p-8 text-center text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-40 h-40 bg-sky-300 opacity-20 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <p className="text-emerald-100 text-sm font-bold mb-3 uppercase tracking-wide">{t('total_sales')}</p>
                <h2 className="text-5xl font-black tracking-tight drop-shadow-lg">{formatCurrency(totalAmount)}</h2>
                {data?.period?.start && data?.period?.end && (
                  <p className="text-emerald-100 text-sm mt-4 font-semibold">
                    {displayDate(data.period.start)} - {displayDate(data.period.end)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {rows.map((row: any, index: number) => (
                <div key={`${row.tarih ?? index}-${row.kasa ?? index}`} className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <Database className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900">{displayDate(row.tarih)}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {t('cash_no')}: {row.kasa ?? '-'} · {t('transaction_count')}: {row.tc ?? 0}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">{t('amount')}</p>
                      <p className="text-lg font-black text-emerald-600">{formatCurrency(Number(row.tutar ?? 0))}</p>
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
