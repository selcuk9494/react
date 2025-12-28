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
      {/* Fixed Header - Mobile Optimized with Safe Area */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
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
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            {/* Quick Periods */}
            {[
              { id: 'today', label: 'Bugün', icon: '📅' },
              { id: 'yesterday', label: 'Dün', icon: '⏪' },
              { id: 'week', label: 'Bu Hafta', icon: '📆' },
              { id: 'last7days', label: 'Son 7 Gün', icon: '🗓️' },
              { id: 'month', label: 'Bu Ay', icon: '📊' },
              { id: 'lastmonth', label: 'Geçen Ay', icon: '📁' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200",
                  period === p.id
                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
                )}
                type="button"
              >
                <span className="text-xs">{p.icon}</span>
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowCustomDateModal(true)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200",
                period === 'custom'
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
              )}
              type="button"
            >
              <Calendar className="w-4 h-4" aria-hidden="true" />
              Özel Tarih
            </button>
          </div>

          {/* Date Range Display */}
          <div className="text-xs text-gray-600 mt-2 px-1">
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
