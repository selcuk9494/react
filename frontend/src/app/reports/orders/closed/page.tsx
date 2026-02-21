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
  CheckCircle, 
  ChevronRight, 
  User, 
  Clock, 
  MapPin, 
  FileText,
  Tag 
} from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '@/utils/api';
import clsx from 'clsx';
import ReportHeader from '@/components/ReportHeader';

function ClosedOrdersContent() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang } = useI18n();

  const [orders, setOrders] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]); // To store all fetched for local filtering if needed, but here we paginate
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [filterMasa, setFilterMasa] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [adturFilter, setAdturFilter] = useState<'all'|0|1|3>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const isFetchingRef = useRef(false);

  useEffect(() => {
    fetchOrders(1);
  }, []);

  useEffect(() => {
    fetchOrders(1);
  }, [period, customStartDate, customEndDate]);

  // Effect to apply local filters if we were doing local filtering, 
  // but the legacy code fetches from API for date, and local for table no.
  // Legacy: fetchOrders fetches from API. applyFilters filters locally by masa_no.
  useEffect(() => {
    applyFilters();
  }, [filterMasa, allOrders, adturFilter]);

  const fetchOrders = async (page = 1, append = false) => {
    if (!token) return;
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      let url = `${getApiUrl()}/reports/closed-orders?period=${period}&page=${page}&limit=100`;
      if (period === 'custom') {
        const s = customStartDate || searchParams.get('start_date') || '';
        const e = customEndDate || searchParams.get('end_date') || '';
        if (!s || !e) {
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        url = `${getApiUrl()}/reports/closed-orders?period=custom&start_date=${s}&end_date=${e}&page=${page}&limit=100`;
        setCustomStartDate(s);
        setCustomEndDate(e);
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
      // alert(t('error_loading_data'));
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
    if (adturFilter !== 'all') {
      filtered = filtered.filter(o => (o.adtur ?? -1) === adturFilter);
    } else {
      const adturParam = searchParams.get('adtur');
      if (adturParam !== null) {
        const t = Number(adturParam);
        filtered = filtered.filter(o => (o.adtur ?? -1) === t);
      }
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
  const getElapsedMinutes = (dateString?: string, start?: string, end?: string) => {
    if (!dateString || !start || !end) return 0;
    const d = new Date(dateString);
    const sParts = start.split(':');
    const eParts = end.split(':');
    const sh = Number(sParts[0] || 0);
    const sm = Number(sParts[1] || 0);
    const eh = Number(eParts[0] || 0);
    const em = Number(eParts[1] || 0);
    const ds = new Date(d); ds.setHours(sh, sm, 0, 0);
    const de = new Date(d); de.setHours(eh, em, 0, 0);
    let diff = de.getTime() - ds.getTime();
    if (diff < 0) diff += 24 * 3600000;
    return Math.floor(diff / 60000);
  };
  const getElapsedText = (dateString?: string, start?: string, end?: string) => {
    const mins = getElapsedMinutes(dateString, start, end);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h} sa ${m} dk`;
    return `${m} dk`;
  };

  if (loading && !allOrders.length) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <ReportHeader
        title={t('closed_orders')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <div className="p-4 max-w-3xl mx-auto w-full pt-[140px]">
        {/* Filter Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
            <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center">
                <Search className="w-4 h-4 mr-2 text-gray-500" />
                {t('filter_title')}
            </h2>
            
            <div className="flex space-x-3">
                <div className="w-40">
                    <label className="block text-[10px] font-medium text-gray-900 mb-1 font-bold">{t('table_no_label')}</label>
                    <input 
                        type="text" 
                        placeholder="Örn: 5"
                        className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-medium"
                        value={filterMasa}
                        onChange={(e) => setFilterMasa(e.target.value)}
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-900 mb-1 font-bold">Filtrele:</label>
                    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden w-full">
                        <button
                          onClick={() => setAdturFilter('all')}
                          className={`px-3 py-1.5 text-xs font-bold flex-1 ${adturFilter==='all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700'}`}
                        >
                          Tümü
                        </button>
                        <button
                          onClick={() => setAdturFilter(0)}
                          className={`px-3 py-1.5 text-xs font-bold border-l border-gray-200 flex-1 ${adturFilter===0 ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700'}`}
                        >
                          {t('order_type_adisyon')}
                        </button>
                        <button
                          onClick={() => setAdturFilter(1)}
                          className={`px-3 py-1.5 text-xs font-bold border-l border-gray-200 flex-1 ${adturFilter===1 ? 'bg-amber-500 text-white' : 'bg-white text-gray-700'}`}
                        >
                          {t('order_type_paket')}
                        </button>
                        <button
                          onClick={() => setAdturFilter(3)}
                          className={`px-3 py-1.5 text-xs font-bold border-l border-gray-200 flex-1 ${adturFilter===3 ? 'bg-pink-600 text-white' : 'bg-white text-gray-700'}`}
                        >
                          {t('order_type_hizli')}
                        </button>
                    </div>
                </div>
            </div>

            {/* tarih dropdown kaldırıldı; üst menüden tarih seçimi yapılır */}
            
            {/* scope buttons removed; using global ReportHeader period controls */}
        </div>

        {/* Count */}
        <p className="text-sm text-gray-500 mb-4 px-1">{orders.length} {t('count_orders')}</p>

        {/* Tip filtre çubuğu kaldırıldı */}

        {/* List */}
        <div className="space-y-3">
            {orders.map((order, idx) => (
                <button
                    key={idx}
                    onClick={() => router.push(`/reports/orders/detail?id=${order.adsno}&type=closed${typeof order.adtur !== 'undefined' ? `&adtur=${order.adtur}` : ''}`)}
                    className="w-full bg-gradient-to-br from-white to-emerald-50/30 rounded-3xl p-5 shadow-md border-2 border-emerald-100 hover:shadow-xl hover:border-emerald-300 transition-all duration-200 text-left group"
                >
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="bg-emerald-500 p-2 rounded-xl shadow-md">
                                <CheckCircle className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-lg font-black text-gray-900">
                                #{order.adsno || order.id}
                            </h3>
                            {(order.type_label || typeof order.adtur !== 'undefined') && (
                                <span
                                  className={`inline-block ${order.adtur===1 ? 'bg-amber-100 text-amber-700' : (order.adtur===0 ? 'bg-emerald-100 text-emerald-700' : 'bg-pink-100 text-pink-700')} text-sm font-bold px-3 py-1 rounded-md`}
                                >
                                  {order.type_label || (order.adtur===0 ? t('order_type_adisyon') : (order.adtur===1 ? t('order_type_paket') : (order.adtur===3 ? t('order_type_hizli') : 'Diğer')))}
                                </span>
                            )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                    </div>

                    <div className="flex flex-row justify-between items-center">
                        <div className="mr-4">
                            {Number(order.iskonto || 0) > 0 && (
                              <p className="text-xs text-gray-500 whitespace-nowrap">
                                Brüt: <span className="font-semibold line-through">{formatCurrency(Number(order.tutar || 0))}</span>
                              </p>
                            )}
                            <p className="text-2xl font-black text-emerald-600 whitespace-nowrap drop-shadow-sm">
                                {formatCurrency(Number(order.tutar || 0) - Number(order.iskonto || 0))}
                            </p>
                        </div>
                        
                        <div className="flex-1 space-y-1.5 border-l border-gray-100 pl-4">
                            {!(order.adtur === 1 || order.masa_no === 99999) && (
                              <div className="flex items-center">
                                  <MapPin className="w-3.5 h-3.5 mr-2 text-gray-400 flex-shrink-0" />
                                  <span className="text-base font-bold text-gray-900 truncate">Masa No: {typeof order.masa_no !== 'undefined' ? order.masa_no : '-'}</span>
                              </div>
                            )}
                            {order.garson_adi && (
                                <div className="flex items-center">
                                    <User className="w-3.5 h-3.5 mr-2 text-gray-400 flex-shrink-0" />
                                    <span className="text-xs text-gray-600 truncate">{t('waiter')}: {order.garson_adi}</span>
                                </div>
                            )}
                            {(order.customer_name || order.mustid) && (
                                <div className="flex items-center">
                                    <User className="w-3.5 h-3.5 mr-2 text-gray-400 flex-shrink-0" />
                                    <span className="text-xs text-gray-600 truncate">Müşteri: {order.customer_name || order.mustid}</span>
                                </div>
                            )}
                            {typeof order.iskonto !== 'undefined' && order.iskonto > 0 && (
                                <div className="flex items-center">
                                    <Tag className="w-3.5 h-3.5 mr-2 text-emerald-500 flex-shrink-0" />
                                    <span className="text-xs text-emerald-600 font-semibold">İndirim: {formatCurrency(order.iskonto)}</span>
                                </div>
                            )}
                            {order.acilis_saati && (
                                <div className="flex items-center">
                                    <Clock className="w-3.5 h-3.5 mr-2 text-gray-400 flex-shrink-0" />
                                    <span className="text-xs text-gray-600 font-medium">Açılış Saati: {formatTime(order.acilis_saati)}</span>
                                </div>
                            )}
                            {order.kapanis_saati && (
                                <div className="flex items-center">
                                    <Clock className="w-3.5 h-3.5 mr-2 text-gray-400 flex-shrink-0" />
                                    <span className="text-xs text-gray-600 font-medium">Kapanış Saati: {formatTime(order.kapanis_saati)}</span>
                                </div>
                            )}
                            <div className="flex items-center">
                                <Clock className="w-3.5 h-3.5 mr-2 text-gray-400 flex-shrink-0" />
                                <span className={`text-xs font-medium ${getElapsedMinutes(order.tarih, order.acilis_saati, order.kapanis_saati) > 60 ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                    Geçen Süre: {getElapsedText(order.tarih, order.acilis_saati, order.kapanis_saati)}
                                </span>
                            </div>
                            <div className="flex items-center pt-1 mt-1 border-t border-gray-50">
                                <Calendar className="w-3.5 h-3.5 mr-2 text-gray-400 flex-shrink-0" />
                                <span className="text-[10px] text-gray-400">{formatDate(order.tarih)}</span>
                            </div>
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
                className="w-full mt-6 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-70 flex items-center justify-center"
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

export default function ClosedOrdersPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
      <ClosedOrdersContent />
    </Suspense>
  );
}
