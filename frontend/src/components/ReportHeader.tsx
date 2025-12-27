'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, X } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/contexts/I18nContext';

interface ReportHeaderProps {
  title: string;
  period: string;
  setPeriod: (period: string) => void;
  customStartDate: string;
  setCustomStartDate: (date: string) => void;
  customEndDate: string;
  setCustomEndDate: (date: string) => void;
}

export default function ReportHeader({
  title,
  period,
  setPeriod,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
}: ReportHeaderProps) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPeriod('custom');
    setShowCustomDateModal(false);
  };

  return (
    <>
      <div className="bg-white/95 backdrop-blur-md fixed top-0 left-0 right-0 z-40 shadow-sm border-b border-gray-100">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 mb-3">
            <button 
              onClick={() => router.back()} 
              className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors touch-manipulation"
              aria-label="Geri"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
          </div>

          {/* Date Filter Row - Scrollable */}
          <div className="relative -mx-4 px-4">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
              {[
                { id: 'today', label: t('today'), icon: true },
                { id: 'yesterday', label: t('yesterday') },
                { id: 'week', label: t('this_week') },
                { id: 'last7days', label: t('last_7_days') },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={clsx(
                    "flex-shrink-0 snap-start flex items-center px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all touch-manipulation",
                    period === p.id
                      ? "border-indigo-600 text-indigo-700 bg-indigo-50 shadow-sm"
                      : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50 active:scale-95"
                  )}
                >
                  {p.icon && <Calendar className="w-4 h-4 mr-1.5" />}
                  {p.label}
                </button>
              ))}

              <button
                onClick={() => setShowCustomDateModal(true)}
                className={clsx(
                  "flex-shrink-0 snap-start flex items-center px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all touch-manipulation",
                  period === 'custom'
                    ? "border-indigo-600 text-indigo-700 bg-indigo-50 shadow-sm"
                    : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50 active:scale-95"
                )}
              >
                <Calendar className="w-4 h-4 mr-1.5" />
                {t('custom_date')}
              </button>
            </div>
          </div>
          
          {/* Date Range Display */}
          <div className="text-xs text-gray-600 font-medium mt-2 px-1">
            {(() => {
            const f = (d: Date) => d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
            const now = new Date();
            if (period === 'today') return f(now);
            if (period === 'yesterday') { const y = new Date(); y.setDate(y.getDate() - 1); return f(y); }
            if (period === 'week') {
              const d = new Date();
              const day = d.getDay();
              const diff = (day + 6) % 7; // Monday start
              const start = new Date(d); start.setDate(d.getDate() - diff);
              const end = new Date(start); end.setDate(start.getDate() + 6);
              return `${f(start)} - ${f(end)}`;
            }
            if (period === 'last7days') {
              const end = new Date();
              const start = new Date(); start.setDate(end.getDate() - 6);
              return `${f(start)} - ${f(end)}`;
            }
            if (period === 'month') {
              const d = new Date();
              const start = new Date(d.getFullYear(), d.getMonth(), 1);
              const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
              return `${f(start)} - ${f(end)}`;
            }
            if (period === 'lastmonth') {
              const d = new Date();
              const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
              const end = new Date(d.getFullYear(), d.getMonth(), 0);
              return `${f(start)} - ${f(end)}`;
            }
            if (period === 'custom' && customStartDate && customEndDate) {
              const s = new Date(customStartDate); const e = new Date(customEndDate);
              return `${f(s)} - ${f(e)}`;
            }
            return '';
          })()}
        </div>
      </div>

      {/* Custom Date Modal */}
      {showCustomDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">{t('custom_date')}</h3>
              <button onClick={() => setShowCustomDateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCustomDateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('start_date')}</label>
                <input
                  type="date"
                  required
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('end_date')}</label>
                <input
                  type="date"
                  required
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 transition"
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
