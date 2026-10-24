'use client';

import React, { useState, useEffect, Suspense } from 'react';
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
  FileText,
  Tag,
} from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '@/utils/api';
import clsx from 'clsx';
import ReportExportButtons from '@/components/ReportExportButtons';

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
  const [scope, setScope] = useState<'today' | 'all'>('all');
  const [adturFilter, setAdturFilter] = useState<'all' | 0 | 1>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchOrders(1);
  }, []);

  useEffect(() => {
    fetchOrders(1);
  }, [scope]);

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

      // Scope: today or all
      let url = `${getApiUrl()}/reports/open-orders?period=${scope === 'today' ? 'today' : 'all'}&page=${page}&limit=100`;

      if (startDate && endDate) {
        url = `${getApiUrl()}/reports/open-orders?period=custom&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=100`;
      } else if (searchParams.get('start_date') && searchParams.get('end_date')) {
        const s = searchParams.get('start_date');
        const e = searchParams.get('end_date');
        url = `${getApiUrl()}/reports/open-orders?period=custom&start_date=${s}&end_date=${e}&page=${page}&limit=100`;
        if (s) setStartDate(s);
        if (e) setEndDate(e);
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
        o.adsno?.toString().includes(filterMasa) ||
        o.id?.toString().includes(filterMasa)
      );
    }
    const pickType = (o: any) => {
      if (typeof o.adtur !== 'undefined') return Number(o.adtur);
      if (typeof o.sipyer !== 'undefined') {
        const s = Number(o.sipyer);
        if (s === 2) return 1; // Paket
        return 0; // Adisyon varsayılan
      }
      return -1;
    };
    if (adturFilter !== 'all') {
      filtered = filtered.filter(o => {
        const a = pickType(o);
        if (adturFilter === 0) return a === 0;
        if (adturFilter === 1) return a === 1;
        return true;
      });
    } else {
      const adturParam = searchParams.get('adtur');
      if (adturParam !== null) {
        const tv = Number(adturParam);
        filtered = filtered.filter(o => {
          const a = pickType(o);
          if (tv === 0) return a === 0;
          if (tv === 1) return a === 1;
          if (tv === 3) return a === 3;
          return true;
        });
        if (filtered.length === 0) {
          filtered = [...allOrders];
        }
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
    setAdturFilter('all');
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

  const typeLabel = (order: any) =>
    typeof order.adtur !== 'undefined'
      ? (order.adtur === 0 ? t('order_type_adisyon') : order.adtur === 1 ? t('order_type_paket') : order.adtur === 3 ? t('order_type_hizli') : 'Diğer')
      : (order.type_label || (order.sipyer === 2 ? t('order_type_paket') : t('order_type_adisyon')));

  const exportColumns = [
    { key: 'adsno', label: 'Adisyon No' },
    { key: 'masa_no', label: 'Masa', format: (value: any, row: any) => value ?? row.masano ?? '' },
    { key: 'adtur', label: 'Tip', format: (value: any) => Number(value) === 1 ? 'Paket' : 'Adisyon' },
    { key: 'garson_adi', label: 'Garson', format: (value: any, row: any) => value || row.garson || '' },
    { key: 'customer_name', label: 'Müşteri' },
    { key: 'person_count', label: 'Kişi Sayısı' },
    { key: 'country_name', label: 'Milliyet', format: (value: any, row: any) => value || row.country_code || '' },
    { key: 'tarih', label: 'Tarih', format: (value: any) => value ? formatDate(String(value)) : '' },
    { key: 'acilis_saati', label: 'Açılış', format: (value: any) => value ? formatTime(String(value)) : '' },
    { key: 'tutar', label: 'Tutar', format: (value: any) => formatCurrency(Number(value || 0)) },
  ];

  const segBtn = (active: boolean, accent = 'bg-amber-500') =>
    `px-3 py-1.5 text-xs font-bold flex-1 transition ${active ? `${accent} text-white` : 'bg-white text-slate-700 hover:bg-slate-50'}`;

  if (loading && !allOrders.length) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10 font-sans safe-bottom">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-40 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900 truncate">{t('open_orders')}</h1>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md shrink-0">{orders.length}</span>
          </div>
          <ReportExportButtons title={t('open_orders')} columns={exportColumns} rows={orders} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        {/* Filters */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center">
            <Search className="w-4 h-4 mr-2 text-slate-500" />
            {t('filter_title')}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">{t('table_no_label')}</label>
              <input
                type="text"
                placeholder="Örn: 5"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                value={filterMasa}
                onChange={(e) => setFilterMasa(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Tip</label>
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden w-full">
                <button onClick={() => setAdturFilter('all')} className={segBtn(adturFilter === 'all', 'bg-slate-900')}>Tümü</button>
                <button onClick={() => setAdturFilter(0)} className={`border-l border-slate-200 ${segBtn(adturFilter === 0, 'bg-emerald-600')}`}>{t('order_type_adisyon')}</button>
                <button onClick={() => setAdturFilter(1)} className={`border-l border-slate-200 ${segBtn(adturFilter === 1)}`}>{t('order_type_paket')}</button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">{t('show')}:</label>
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden w-full">
                <button onClick={() => setScope('today')} className={segBtn(scope === 'today')}>Sadece bugün</button>
                <button onClick={() => setScope('all')} className={`border-l border-slate-200 ${segBtn(scope === 'all')}`}>Tümü</button>
              </div>
            </div>
          </div>

          {showDateFilter && (
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('start_date')}</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('end_date')}</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowDateFilter(false)} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition">{t('cancel')}</button>
                <button onClick={handleDateSubmit} className="px-3 py-1.5 text-xs font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition">{t('apply')}</button>
              </div>
            </div>
          )}

          {(filterMasa || (startDate && endDate) || adturFilter !== 'all') && (
            <button onClick={clearFilters} className="mt-3 flex items-center text-xs font-bold text-red-500 hover:text-red-700 transition">
              <X className="w-3 h-3 mr-1" />
              {t('clear_filters')}
            </button>
          )}
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((order, idx) => (
            <button
              key={idx}
              onClick={() => router.push(`/reports/orders/detail?id=${order.adsno}&type=open${typeof order.adtur !== 'undefined' ? `&adtur=${order.adtur}` : ''}`)}
              className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-200 border-l-4 border-l-amber-400 hover:shadow-md hover:border-l-amber-500 transition text-left group"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="bg-amber-500 p-2 rounded-xl shadow-sm shrink-0">
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-black text-slate-900">#{order.adsno || order.id}</h3>
                  {(typeof order.adtur !== 'undefined' || order.type_label || order.sipyer) && (
                    <span className="inline-block bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md">{typeLabel(order)}</span>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
              </div>

              <p className="text-2xl font-black text-amber-600 mb-3">{formatCurrency(order.tutar)}</p>

              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <div className="flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                  <span className="text-sm font-bold text-slate-900 truncate">Masa: {typeof order.masa_no !== 'undefined' ? order.masa_no : '-'}</span>
                </div>
                {(order.garson || order.garson_adi) && (
                  <div className="flex items-center">
                    <User className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-600 truncate">{t('waiter')}: {order.garson || order.garson_adi}</span>
                  </div>
                )}
                {order.customer_name && (
                  <div className="flex items-center">
                    <User className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-600 truncate">Müşteri: {order.customer_name}</span>
                  </div>
                )}
                {order.customer_phone && (
                  <div className="flex items-center">
                    <User className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-600 truncate">Telefon: {order.customer_phone}</span>
                  </div>
                )}
                {order.customer_address && (
                  <div className="flex items-start">
                    <MapPin className="w-3.5 h-3.5 mr-2 mt-0.5 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-600 line-clamp-2">Adres: {order.customer_address}</span>
                  </div>
                )}
                {typeof order.iskonto !== 'undefined' && order.iskonto > 0 && (
                  <div className="flex items-center">
                    <Tag className="w-3.5 h-3.5 mr-2 text-emerald-500 shrink-0" />
                    <span className="text-xs text-emerald-600 font-semibold">İndirim: {formatCurrency(order.iskonto)}</span>
                  </div>
                )}
                {Number(order.person_count || 0) > 0 && (
                  <div className="flex items-center">
                    <Users className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-600">Kişi: {order.person_count}</span>
                  </div>
                )}
                {(order.country_name || order.country_code) && (
                  <div className="flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-600">Milliyet: {order.country_name || order.country_code}</span>
                  </div>
                )}
                {order.acilis_saati && (
                  <div className="flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-600 font-medium">{t('opening')}: {formatTime(order.acilis_saati)}</span>
                  </div>
                )}
                {order.acilis_saati && (
                  <div className="flex items-center">
                    <Timer className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span className={clsx('text-xs font-medium', getElapsedMinutes(order.tarih, order.acilis_saati) > 60 ? 'text-red-600 font-bold' : 'text-slate-600')}>
                      {t('elapsed')}: {getElapsed(order.tarih, order.acilis_saati)}
                    </span>
                  </div>
                )}
                <div className="flex items-center pt-1 mt-1 border-t border-slate-50">
                  <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-400">{formatDate(order.tarih)}</span>
                </div>
              </div>
            </button>
          ))}

          {orders.length === 0 && !loading && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-16 bg-white rounded-2xl border border-slate-200">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-slate-900 font-bold mb-1">{t('not_found')}</h3>
              <p className="text-slate-500 text-sm">{t('try_changing_filters')}</p>
            </div>
          )}
        </div>

        {/* Load More */}
        {currentPage < totalPages && (
          <button
            onClick={() => fetchOrders(currentPage + 1, true)}
            disabled={loadingMore}
            className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold hover:bg-amber-600 transition disabled:opacity-70 flex items-center justify-center"
          >
            {loadingMore ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              t('load_more')
            )}
          </button>
        )}

        {total > 0 && (
          <div className="text-center space-y-1">
            <p className="text-xs text-slate-500">{orders.length} / {total} {t('showing')}</p>
            <p className="text-xs text-slate-400">{t('page')} {currentPage} / {totalPages}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OpenOrdersPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" /></div>}>
      <OpenOrdersContent />
    </Suspense>
  );
}
