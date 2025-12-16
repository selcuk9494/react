'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { 
  ArrowLeft, 
  Search, 
  Calendar, 
  X, 
  Receipt, 
  ChevronRight, 
  User, 
  Clock, 
  MapPin, 
  Users,
  Timer,
  FileText 
} from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '@/utils/api';
import clsx from 'clsx';

function OpenOrdersContent() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang } = useI18n();

  const [orders, setOrders] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [filterMasa, setFilterMasa] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchOrders(1);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filterMasa, allOrders]);

  const fetchOrders = async (page = 1, append = false) => {
    if (!token) return;
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      // Use 'today' as default period instead of 'month' to match dashboard behavior
      let url = `${getApiUrl()}/reports/orders?status=open&period=today&page=${page}&limit=100`;

      if (startDate && endDate) {
        url = `${getApiUrl()}/reports/orders?status=open&period=custom&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=100`;
      } else if (searchParams.get('start_date') && searchParams.get('end_date')) {
         const s = searchParams.get('start_date');
         const e = searchParams.get('end_date');
         url = `${getApiUrl()}/reports/orders?status=open&period=custom&start_date=${s}&end_date=${e}&page=${page}&limit=100`;
         if (s) setStartDate(s);
         if (e) setEndDate(e);
      } else {
         // Check for 'period' param or default to 'today'
         // If user clicked from dashboard "Today" view, they expect today's open orders.
         // Open orders are usually "current", so 'today' or 'all' makes sense. 
         // 'month' might filter out older open orders if any? 
         // Actually open orders should probably list ALL open orders regardless of date, or at least recent ones.
         // Let's try 'today' first as that's what the user sees on dashboard.
      }

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = res.data.data || res.data;
      
      if (append) {
        setAllOrders(prev => [...prev, ...data]);
      } else {
        setAllOrders(data);
      }

      setTotal(res.data.total || (res.data.data ? res.data.total : data.length));
      setTotalPages(res.data.total_pages || 1);
      setCurrentPage(page);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allOrders];
    if (filterMasa) {
      filtered = filtered.filter(o => 
        o.masa_no?.toString().includes(filterMasa) || 
        o.id?.toString().includes(filterMasa)
      );
    }
    const adturParam = searchParams.get('adtur');
    if (adturParam !== null) {
      const t = Number(adturParam);
      filtered = filtered.filter(o => (o.adtur ?? -1) === t);
    }
    setOrders(filtered);
  };

  const handleDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders(1);
    setShowDateFilter(false);
  };

  const clearFilters = () => {
    setFilterMasa('');
    setStartDate('');
    setEndDate('');
    fetchOrders(1);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-US', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getElapsed = (dateString?: string, timeString?: string) => {
    if (!dateString || !timeString) return '';
    const d = new Date(dateString);
    const parts = timeString.split(':');
    const hh = Number(parts[0] || 0);
    const mm = Number(parts[1] || 0);
    d.setHours(hh, mm, 0, 0);
    const diff = Date.now() - d.getTime();
    if (diff <= 0) return '0 dk';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours} sa ${minutes} dk`;
    return `${minutes} dk`;
  };

  const getElapsedMinutes = (dateString?: string, timeString?: string) => {
    if (!dateString || !timeString) return 0;
    const d = new Date(dateString);
    const parts = timeString.split(':');
    const hh = Number(parts[0] || 0);
    const mm = Number(parts[1] || 0);
    d.setHours(hh, mm, 0, 0);
    const diff = Date.now() - d.getTime();
    if (diff <= 0) return 0;
    return Math.floor(diff / 60000);
  };

  if (loading && !allOrders.length) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white px-4 py-4 sticky top-0 z-40 shadow-sm border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-4">
            <button 
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-full transition text-gray-700"
            >
                <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">{t('open_orders')}</h1>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto w-full">
        {/* Filter Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
            <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center">
                <Search className="w-4 h-4 mr-2 text-gray-500" />
                {t('filter_title')}
            </h2>
            
            <div className="flex space-x-3">
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('table_no_label')}</label>
                    <input 
                        type="text" 
                        placeholder="Örn: 5"
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                        value={filterMasa}
                        onChange={(e) => setFilterMasa(e.target.value)}
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('date')}:</label>
                    <button 
                        onClick={() => setShowDateFilter(!showDateFilter)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-left flex items-center text-gray-700 hover:bg-gray-100 transition"
                    >
                        <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                        <span className="truncate">
                            {startDate ? `${new Date(startDate).toLocaleDateString()}...` : t('select')}
                        </span>
                    </button>
                </div>
            </div>

            {/* Date Filter Dropdown */}
            {showDateFilter && (
                <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">{t('start_date')}</label>
                            <input 
                                type="date" 
                                className="w-full border-gray-300 rounded-lg text-sm"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">{t('end_date')}</label>
                            <input 
                                type="date" 
                                className="w-full border-gray-300 rounded-lg text-sm"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                        <button 
                            onClick={() => setShowDateFilter(false)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition"
                        >
                            {t('cancel')}
                        </button>
                        <button 
                            onClick={handleDateSubmit}
                            className="px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                        >
                            {t('apply')}
                        </button>
                    </div>
                </div>
            )}

            {(filterMasa || (startDate && endDate)) && (
                <button 
                    onClick={clearFilters}
                    className="mt-3 flex items-center text-xs font-bold text-red-500 hover:text-red-700 transition"
                >
                    <X className="w-3 h-3 mr-1" />
                    {t('clear_filters')}
                </button>
            )}
        </div>

        {/* Count */}
        <p className="text-sm text-gray-500 mb-4 px-1">{orders.length} {t('count_orders')}</p>

        {/* List */}
        <div className="space-y-3">
            {orders.map((order, idx) => (
                <button
                    key={idx}
                    onClick={() => router.push(`/reports/orders/detail?id=${order.id || order.adsno}&type=open`)}
                    className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition text-left group"
                >
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center space-x-3">
                            <Receipt className="w-6 h-6 text-amber-500" />
                            <div>
                                <h3 className="text-base font-bold text-gray-900">
                                    {order.masa_no ? `Masa ${order.masa_no}` : `Sipariş #${order.id}`}
                                </h3>
                                {typeof order.adtur !== 'undefined' && (
                                    <span className="inline-block bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5">
                                        {order.adtur===0 ? t('order_type_adisyon') : (order.adtur===1 ? t('order_type_paket') : (order.adtur===3 ? t('order_type_hizli') : 'Diğer'))}
                                    </span>
                                )}
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-amber-500 transition-colors" />
                    </div>

                    <div className="flex justify-between items-center mb-3">
                        <p className="text-xl font-bold text-amber-500">
                            {formatCurrency(order.tutar)}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 text-xs text-gray-500">
                        {order.garson_adi && (
                            <div className="flex items-center">
                                <User className="w-3 h-3 mr-1.5 text-gray-400" />
                                <span className="truncate">{t('waiter')}: {order.garson_adi}</span>
                            </div>
                        )}
                        {order.acilis_saati && (
                            <div className="flex items-center">
                                <Clock className="w-3 h-3 mr-1.5 text-gray-400" />
                                <span>{t('opening')}: {formatTime(order.acilis_saati)}</span>
                            </div>
                        )}
                        {order.sipyer && (
                            <div className="flex items-center">
                                <MapPin className="w-3 h-3 mr-1.5 text-gray-400" />
                                <span className="truncate">{t('order_place')} {order.sipyer}</span>
                            </div>
                        )}
                        {(order.adtur === 1 || order.masa_no === 0) && order.customer_name && (
                            <div className="flex items-center">
                                <Users className="w-3 h-3 mr-1.5 text-gray-400" />
                                <span className="truncate">{t('customer')}: {order.customer_name}</span>
                            </div>
                        )}
                        {order.acilis_saati && (
                            <div className="flex items-center col-span-2">
                                <Timer className="w-3 h-3 mr-1.5 text-gray-400" />
                                <span className={clsx(
                                    getElapsedMinutes(order.tarih, order.acilis_saati) > 60 ? "text-red-500 font-bold" : ""
                                )}>
                                    {t('elapsed')}: {getElapsed(order.tarih, order.acilis_saati)}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center col-span-2">
                            <Calendar className="w-3 h-3 mr-1.5 text-gray-400" />
                            <span>{formatDate(order.tarih)}</span>
                        </div>
                    </div>
                </button>
            ))}

            {orders.length === 0 && !loading && (
                <div className="text-center py-12">
                    <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-gray-900 font-medium mb-1">{t('not_found')}</h3>
                    <p className="text-gray-500 text-sm">{t('try_changing_filters')}</p>
                </div>
            )}
        </div>

        {/* Load More */}
        {currentPage < totalPages && (
            <button
                onClick={() => fetchOrders(currentPage + 1, true)}
                disabled={loadingMore}
                className="w-full mt-6 bg-amber-500 text-white py-3 rounded-xl font-bold hover:bg-amber-600 transition disabled:opacity-70 flex items-center justify-center"
            >
                {loadingMore ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                    t('load_more')
                )}
            </button>
        )}

        {/* Pagination Info */}
        {total > 0 && (
            <div className="text-center mt-4 space-y-1">
                <p className="text-xs text-gray-500">{orders.length} / {total} {t('showing')}</p>
                <p className="text-xs text-gray-400">{t('page')} {currentPage} / {totalPages}</p>
            </div>
        )}
      </div>
    </div>
  );
}

export default function OpenOrdersPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
      <OpenOrdersContent />
    </Suspense>
  );
}
