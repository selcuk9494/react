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
      {/* Fixed Header - Mobile Optimized */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        {/* Title Row with Back Button */}
        <div className="flex items-center gap-2 px-3 py-3">
          <button 
            onClick={() => router.back()}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
            aria-label="Geri"
            type="button"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900 truncate flex-1">{title}</h1>
        </div>

        {/* Period Filter Buttons */}
        <div className="px-3 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            
            {/* Quick Periods */}
            <button
              onClick={() => setPeriod('today')}
              className={clsx(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                period === 'today'
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
              )}
              type="button"
            >
              📅 {t('today')}
            </button>

            <button
              onClick={() => setPeriod('yesterday')}
              className={clsx(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                period === 'yesterday'
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
              )}
              type="button"
            >
              {t('yesterday')}
            </button>

            <button
              onClick={() => setPeriod('last7days')}
              className={clsx(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                period === 'last7days'
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
              )}
              type="button"
            >
              {t('last_7_days')}
            </button>

            <button
              onClick={() => setShowCustomDateModal(true)}
              className={clsx(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                period === 'custom'
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
              )}
              type="button"
            >
              <Calendar className="w-3 h-3 inline-block mr-1" />
              {t('custom_date')}
            </button>
          </div>

          {/* Date Range Display */}
          {period && (
            <div className="text-xs text-gray-600 mt-2 px-1">
              {(() => {
                const f = (d: Date) => d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                const now = new Date();
                if (period === 'today') return f(now);
                if (period === 'yesterday') { const y = new Date(); y.setDate(y.getDate() - 1); return f(y); }
                if (period === 'last7days') {
                  const end = new Date();
                  const start = new Date(); start.setDate(end.getDate() - 6);
                  return `${f(start)} - ${f(end)}`;
                }
                if (period === 'custom' && customStartDate && customEndDate) {
                  const s = new Date(customStartDate); const e = new Date(customEndDate);
                  return `${f(s)} - ${f(e)}`;
                }
                return '';
              })()}
            </div>
          )}
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
