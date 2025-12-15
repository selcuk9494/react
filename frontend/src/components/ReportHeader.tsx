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
  const { t } = useI18n();
  const router = useRouter();
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPeriod('custom');
    setShowCustomDateModal(false);
  };

  return (
    <>
      <div className="bg-white/80 backdrop-blur-md px-4 pt-4 pb-2 sticky top-0 z-10 shadow-sm border-b border-gray-100 transition-all duration-300">
        <div className="flex items-center space-x-2 mb-4">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">{title}</h1>
        </div>

        {/* Date Filter Row */}
        <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-2">
          {[
            { id: 'today', label: t('today') },
            { id: 'yesterday', label: t('yesterday') },
            { id: 'week', label: t('this_week') },
            { id: 'last7days', label: t('last_7_days') },
            { id: 'month', label: t('this_month') },
            { id: 'lastmonth', label: t('last_month') },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={clsx(
                "flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition",
                period === p.id
                  ? "border-indigo-600 text-indigo-700 bg-indigo-50"
                  : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
              )}
            >
              {p.id === 'today' && <Calendar className="w-4 h-4 mr-2" />}
              {p.label}
            </button>
          ))}

          <button
            onClick={() => setShowCustomDateModal(true)}
            className={clsx(
              "flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition",
              period === 'custom'
                ? "border-indigo-600 text-indigo-700 bg-indigo-50"
                : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
            )}
          >
            <Calendar className="w-4 h-4 mr-2" />
            {t('custom_date')}
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-1 pl-1">
          {period === 'custom' && customStartDate && customEndDate
            ? `${new Date(customStartDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} - ${new Date(customEndDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`
            : period === 'today'
              ? new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
              : ''
          }
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
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('end_date')}</label>
                <input
                  type="date"
                  required
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
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
