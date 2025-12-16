'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { AlertCircle, XCircle, Search, Info, Clock, CheckCircle, Tag } from 'lucide-react';
import axios from 'axios';
import ReportHeader from '@/components/ReportHeader';
import { getApiUrl } from '@/utils/api';
import clsx from 'clsx';

export default function CancelledItemsPage() {
  const { token } = useAuth();
  const { t, lang } = useI18n();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all'|'iptal'|'iade'|'ikram'>('all');

  useEffect(() => {
    if (!token) return;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        let url = `${getApiUrl()}/reports/cancelled-items?period=${period}`;
        if (period === 'custom') {
            url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
        }
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, period, customStartDate, customEndDate]);

  // Helpers
  const getTotalCancelled = () => {
    return data.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getPercent = (q: number) => {
    const total = getTotalCancelled();
    if (!total) return 0;
    return Math.round((q / total) * 100);
  };

  const colorFromName = (name?: string) => {
    const base = (name && String(name)) || 'Ürün';
    const palette = ['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#14B8A6','#F97316'];
    let h = 0; for (let i=0;i<base.length;i++) h = (h*31 + base.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  };

  // Filtered Data
  const filteredData = data
    .filter(i => (i.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(i => filterType === 'all' ? true : i.type === filterType)
    .sort((a, b) => b.quantity - a.quantity);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <ReportHeader
        title={t('cancelled_report_title')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {/* Total Summary Card */}
            <div className="bg-red-500 rounded-2xl p-8 text-center text-white shadow-lg shadow-red-200">
                <XCircle className="w-12 h-12 mx-auto mb-3 text-white/90" />
                <h2 className="text-4xl font-bold tracking-tight">{getTotalCancelled().toFixed(2)}</h2>
                <p className="text-red-100 mt-1 font-medium">{t('total_cancelled_amount')}</p>
                <p className="text-red-200 text-sm mt-1">{data.length} {t('total_cancelled_count')}</p>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm transition"
                    placeholder={t('search_product')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Filter Chips */}
            <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
                {[
                    { id: 'all', label: t('all') },
                    { id: 'iptal', label: t('cancel') },
                    { id: 'iade', label: t('return') },
                    { id: 'ikram', label: t('compliment') }
                ].map((type) => (
                    <button
                        key={type.id}
                        onClick={() => setFilterType(type.id as any)}
                        className={clsx(
                            "px-4 py-2 rounded-full text-sm font-medium border transition whitespace-nowrap",
                            filterType === type.id
                                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                    >
                        {type.label}
                    </button>
                ))}
            </div>

            {/* List Section */}
            <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 px-1">{t('all_cancellations')}</h3>
                
                {filteredData.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                        <h4 className="text-lg font-bold text-gray-900">{t('no_cancellations_title')}</h4>
                        <p className="text-gray-500 mt-1">{t('no_cancellations_text')}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredData.map((item, index) => {
                            const itemColor = colorFromName(item.product_name);
                            return (
                                <div key={index} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-gray-100 hover:shadow-md transition relative overflow-hidden" style={{ borderLeftColor: item.type === 'iptal' ? '#EF4444' : item.type === 'iade' ? '#F59E0B' : '#10B981' }}>
                                    <div className="flex items-start">
                                        {/* Icon */}
                                        <div className="flex-shrink-0 mr-4">
                                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${itemColor}20` }}>
                                                <XCircle className="w-6 h-6" style={{ color: itemColor }} />
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h4 className="text-base font-bold text-gray-900 truncate pr-2">{item.product_name}</h4>
                                                <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-1 rounded-lg">
                                                    %{getPercent(item.quantity || 0)}
                                                </span>
                                            </div>
                                            
                                            <p className="text-sm text-gray-500 mt-0.5 mb-2">
                                                {t('quantity')}: <span className="font-medium text-gray-900">{item.quantity}</span>
                                            </p>

                                            <div className="flex flex-wrap gap-2 items-center mb-3">
                                                <span className={clsx(
                                                    "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                                    item.type === 'iptal' ? "bg-red-100 text-red-700" :
                                                    item.type === 'iade' ? "bg-amber-100 text-amber-700" :
                                                    "bg-emerald-100 text-emerald-700"
                                                )}>
                                                    {item.type}
                                                </span>
                                                
                                                {item.waiter_name && (
                                                    <span className="text-xs text-gray-500 flex items-center">
                                                        <span className="w-1 h-1 bg-gray-400 rounded-full mr-1.5"></span>
                                                        {item.waiter_name}
                                                    </span>
                                                )}

                                                {typeof item.adtur !== 'undefined' && (
                                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                                        {item.adtur === 0 ? t('order_type_adisyon') : 
                                                         item.adtur === 1 ? t('order_type_paket') : 
                                                         item.adtur === 3 ? t('order_type_hizli') : 'Diğer'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                                                <div 
                                                    className="h-1.5 rounded-full" 
                                                    style={{ width: `${getPercent(item.quantity || 0)}%`, backgroundColor: itemColor }}
                                                ></div>
                                            </div>

                                            {/* Reason */}
                                            {item.reason && (
                                                <div className="bg-gray-50 rounded-lg p-2 mb-2 flex items-start space-x-2">
                                                    <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                                    <p className="text-xs text-gray-600 leading-relaxed">{item.reason}</p>
                                                </div>
                                            )}

                                            {/* Date */}
                                            <div className="flex items-center text-xs text-gray-400">
                                                <Clock className="w-3.5 h-3.5 mr-1" />
                                                {new Date(item.date).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
