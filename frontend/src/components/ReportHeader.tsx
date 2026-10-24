'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, X } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/utils/api';

interface ReportHeaderProps {
  title: string;
  period: string;
  setPeriod: (period: string) => void;
  customStartDate: string;
  setCustomStartDate: (date: string) => void;
  customEndDate: string;
  setCustomEndDate: (date: string) => void;
  actions?: React.ReactNode;
  /** Bos = tum kasalar */
  kasaNo?: string;
  setKasaNo?: (v: string) => void;
  kasaOptions?: number[];
}

export default function ReportHeader({
  title,
  period,
  setPeriod,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  actions,
  kasaNo = '',
  setKasaNo,
  kasaOptions = [],
}: ReportHeaderProps) {
  const { t, lang } = useI18n();
  const { token, user } = useAuth();
  const router = useRouter();
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [apiKasas, setApiKasas] = useState<number[]>([]);

  // branch_kasas tablosundan guncel kasa listesi (user.branches bazen sadece kasa_no tasir)
  useEffect(() => {
    if (!token || !setKasaNo) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${getApiUrl()}/reports/kasas`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const list = Array.isArray(res.data?.kasas)
          ? res.data.kasas.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
          : [];
        if (!cancelled) setApiKasas(list);
      } catch {
        if (!cancelled) setApiKasas([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, setKasaNo, user?.selected_branch, user?.selected_branch_id]);

  const resolvedKasaOptions = useMemo(() => {
    const merged = Array.from(new Set([...(kasaOptions || []), ...apiKasas]));
    return merged.sort((a, b) => a - b);
  }, [kasaOptions, apiKasas]);

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPeriod('custom');
    setShowCustomDateModal(false);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="w-full max-w-7xl mx-auto">
        {/* Title Row with Back Button */}
        <div className="flex items-center gap-2 px-4 sm:px-6 lg:px-8 py-3">
          <button 
            onClick={() => router.back()}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
            aria-label="Geri"
            type="button"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate flex-1">{title}</h1>
          {actions && (
            <div className="flex-shrink-0 flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>

        {/* Period Filter Buttons */}
        <div className="px-4 sm:px-6 lg:px-8 pb-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            {/* Quick Periods */}
            {[
              { id: 'today', label: 'Bugün' },
              { id: 'yesterday', label: 'Dün' },
              { id: 'week', label: 'Bu Hafta' },
              { id: 'last7days', label: 'Son 7 Gün' },
              { id: 'month', label: 'Bu Ay' },
              { id: 'lastmonth', label: 'Geçen Ay' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={clsx(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200",
                  period === p.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                )}
                type="button"
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowCustomDateModal(true)}
              className={clsx(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200",
                period === 'custom'
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-400 hover:bg-slate-50"
              )}
              type="button"
            >
              <Calendar className="w-4 h-4" aria-hidden="true" />
              Özel Tarih
            </button>
          </div>

          {/* Date Range Display + Kasa filter */}
          <div className="flex items-center justify-between gap-2 mt-2 px-1">
            <div className="text-xs text-gray-600">
              {(() => {
                const f = (d: Date) => d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                const now = new Date();
                if (period === 'today') return f(now);
                if (period === 'yesterday') { const y = new Date(); y.setDate(y.getDate() - 1); return f(y); }
                if (period === 'week') {
                  const end = new Date();
                  const start = new Date(end); const day = start.getDay(); const diff = (day === 0 ? 6 : day - 1);
                  start.setDate(end.getDate() - diff);
                  return `${f(start)} - ${f(end)}`;
                }
                if (period === 'last7days') {
                  const end = new Date();
                  const start = new Date(); start.setDate(end.getDate() - 6);
                  return `${f(start)} - ${f(end)}`;
                }
                if (period === 'month') {
                  const end = new Date();
                  const start = new Date(end.getFullYear(), end.getMonth(), 1);
                  return `${f(start)} - ${f(end)}`;
                }
                if (period === 'lastmonth') {
                  const ref = new Date(); ref.setMonth(ref.getMonth() - 1);
                  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
                  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
                  return `${f(start)} - ${f(end)}`;
                }
                if (period === 'custom' && customStartDate && customEndDate) {
                  const s = new Date(customStartDate); const e = new Date(customEndDate);
                  return `${f(s)} - ${f(e)}`;
                }
                return '';
              })()}
            </div>
            {setKasaNo && resolvedKasaOptions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-[60%]">
                <button
                  type="button"
                  onClick={() => setKasaNo('')}
                  className={clsx(
                    'text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition',
                    !kasaNo
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-slate-400',
                  )}
                >
                  {lang === 'tr' ? 'Tüm Kasalar' : 'All'}
                </button>
                {resolvedKasaOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setKasaNo(String(n))}
                    className={clsx(
                      'text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition',
                      String(kasaNo) === String(n)
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300',
                    )}
                  >
                    Kasa {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </header>

      {/* Custom Date Modal */}
      {showCustomDateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4" onClick={() => setShowCustomDateModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">{t('custom_date')}</h3>
              <button 
                onClick={() => setShowCustomDateModal(false)} 
                className="text-gray-400 hover:text-gray-600 p-1"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCustomDateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('start_date')}</label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('end_date')}</label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-indigo-700 active:bg-indigo-800 transition"
              >
                {t('apply')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
