'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import {
  Search,
  Calendar,
  CheckCircle,
  ChevronRight,
  User,
  Clock,
  MapPin,
  Users,
  FileText,
  Tag,
} from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '@/utils/api';
import ReportHeader from '@/components/ReportHeader';
import ReportShell from '@/components/ReportShell';
import { useSharedReportFilters, getBranchKasaOptions, readStoredPeriod, persistPeriod } from '@/utils/reportFilters';
import ReportExportButtons from '@/components/ReportExportButtons';

function ClosedOrdersContent() {
  const { token, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang } = useI18n();

  const [orders, setOrders] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filterMasa, setFilterMasa] = useState('');
  const shared = useSharedReportFilters();
  const kasaOptions = getBranchKasaOptions(user);
  const [period, setPeriod] = useState(() => {
    const p = searchParams.get('period');
    if (p) return p;
    if (searchParams.get('start_date') && searchParams.get('end_date')) return 'custom';
    return shared.period || readStoredPeriod().period || 'today';
  });
  const [customStartDate, setCustomStartDate] = useState(searchParams.get('start_date') || shared.customStartDate || '');
  const [customEndDate, setCustomEndDate] = useState(searchParams.get('end_date') || shared.customEndDate || '');
  const { kasaNo, setKasaNo } = shared;
  const [draftStartDate, setDraftStartDate] = useState(searchParams.get('start_date') || '');
  const [draftEndDate, setDraftEndDate] = useState(searchParams.get('end_date') || '');
  const [adturFilter, setAdturFilter] = useState<'all' | 0 | 1 | 3>('all');
  const [amountInput, setAmountInput] = useState(() => searchParams.get('amount') || '');
  const [amountDir, setAmountDir] = useState<'gte' | 'lte'>(
    searchParams.get('dir') === 'lte' ? 'lte' : 'gte',
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const isFetchingRef = useRef(false);

  useEffect(() => {
    persistPeriod(period, customStartDate, customEndDate);
  }, [period, customStartDate, customEndDate]);

  useEffect(() => {
    if (!token) return;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;
    fetchOrders(1);
  }, [token, period, customStartDate, customEndDate, kasaNo]);

  useEffect(() => {
    if (customStartDate) setDraftStartDate(customStartDate);
    if (customEndDate) setDraftEndDate(customEndDate);
  }, [customStartDate, customEndDate]);

  useEffect(() => {
    applyFilters();
  }, [filterMasa, allOrders, adturFilter, amountInput, amountDir]);

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
      if (kasaNo) url += `&kasa_no=${kasaNo}`;

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

  const parseAmountInput = (raw: string) => {
    const s = String(raw || '').trim();
    if (!s) return null;
    const normalized = s.includes(',')
      ? s.replace(/\./g, '').replace(',', '.')
      : s;
    const n = Number(normalized);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const netAmount = (order: any) =>
    Number(order.tutar || 0) - Number(order.iskonto || 0);

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
        const tv = Number(adturParam);
        filtered = filtered.filter(o => (o.adtur ?? -1) === tv);
      }
    }
    const amount = parseAmountInput(amountInput);
    if (amount !== null) {
      filtered = filtered.filter((o) => {
        const net = netAmount(o);
        return amountDir === 'gte' ? net >= amount : net <= amount;
      });
    }
    setOrders(filtered);
  };

  const clearFilters = () => {
    setFilterMasa('');
    setCustomStartDate('');
    setCustomEndDate('');
    setAmountInput('');
    setAmountDir('gte');
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

  const exportColumns = [
    { key: 'adsno', label: 'Adisyon No' },
    { key: 'masa_no', label: 'Masa' },
    { key: 'adtur', label: 'Tip', format: (value: any) => Number(value) === 1 ? 'Paket' : Number(value) === 3 ? 'Hızlı' : 'Adisyon' },
    { key: 'garson_adi', label: 'Garson' },
    { key: 'customer_name', label: 'Müşteri' },
    { key: 'person_count', label: 'Kişi Sayısı' },
    { key: 'country_name', label: 'Milliyet', format: (value: any, row: any) => value || row.country_code || '' },
    { key: 'tarih', label: 'Tarih', format: (value: any) => value ? formatDate(String(value)) : '' },
    { key: 'acilis_saati', label: 'Açılış', format: (value: any) => value ? formatTime(String(value)) : '' },
    { key: 'kapanis_saati', label: 'Kapanış', format: (value: any) => value ? formatTime(String(value)) : '' },
    { key: 'iskonto', label: 'İndirim', format: (value: any) => formatCurrency(Number(value || 0)) },
    { key: 'tutar', label: 'Net Tutar', format: (value: any, row: any) => formatCurrency(Number(value || 0) - Number(row.iskonto || 0)) },
  ];

  const segBtn = (active: boolean, accent = 'bg-emerald-600') =>
    `px-3 py-1.5 text-xs font-bold flex-1 transition ${active ? `${accent} text-white` : 'bg-white text-slate-700 hover:bg-slate-50'}`;

  if (loading && !allOrders.length) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10 font-sans safe-bottom">
      <ReportHeader
        title={t('closed_orders')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        actions={<ReportExportButtons title={t('closed_orders')} columns={exportColumns} rows={orders} />}
        kasaNo={kasaNo}
        setKasaNo={setKasaNo}
        kasaOptions={kasaOptions}
      />

      <ReportShell>
        {/* Filters */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center">
            <Search className="w-4 h-4 mr-2 text-slate-500" />
            {t('filter_title')}
          </h2>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="sm:w-40">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">{t('table_no_label')}</label>
              <input
                type="text"
                placeholder="Örn: 5"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                value={filterMasa}
                onChange={(e) => setFilterMasa(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Filtrele:</label>
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden w-full">
                <button onClick={() => setAdturFilter('all')} className={segBtn(adturFilter === 'all', 'bg-slate-900')}>Tümü</button>
                <button onClick={() => setAdturFilter(0)} className={`border-l border-slate-200 ${segBtn(adturFilter === 0)}`}>{t('order_type_adisyon')}</button>
                <button onClick={() => setAdturFilter(1)} className={`border-l border-slate-200 ${segBtn(adturFilter === 1, 'bg-amber-500')}`}>{t('order_type_paket')}</button>
                <button onClick={() => setAdturFilter(3)} className={`border-l border-slate-200 ${segBtn(adturFilter === 3, 'bg-pink-600')}`}>{t('order_type_hizli')}</button>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">{t('amount_filter')}</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder={t('amount_placeholder')}
                className="w-32 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
              />
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                <button type="button" onClick={() => setAmountDir('gte')} className={`px-3 py-1.5 text-xs font-bold ${amountDir === 'gte' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'}`}>{t('amount_above')}</button>
                <button type="button" onClick={() => setAmountDir('lte')} className={`px-3 py-1.5 text-xs font-bold border-l border-slate-200 ${amountDir === 'lte' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'}`}>{t('amount_below')}</button>
              </div>
              {amountInput && (
                <button type="button" onClick={() => setAmountInput('')} className="text-xs font-bold text-slate-500 hover:text-slate-800">{t('clear_filters')}</button>
              )}
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">{t('custom_date')}</label>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={draftStartDate} onChange={(e) => setDraftStartDate(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              <input type="date" value={draftEndDate} onChange={(e) => setDraftEndDate(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              <button
                type="button"
                onClick={() => {
                  if (!draftStartDate || !draftEndDate) return;
                  setCustomStartDate(draftStartDate);
                  setCustomEndDate(draftEndDate);
                  setPeriod('custom');
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {t('apply')}
              </button>
            </div>
          </div>
        </div>

        {/* Count / total */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-sm font-bold text-emerald-900">
            {orders.length} {t('matching_transactions')}
            {parseAmountInput(amountInput) !== null && (
              <span className="font-medium text-emerald-700">
                {' '}({formatCurrency(parseAmountInput(amountInput) || 0)} {amountDir === 'gte' ? t('amount_above').toLowerCase() : t('amount_below').toLowerCase()})
              </span>
            )}
          </p>
          <p className="text-sm font-black text-emerald-700">
            {t('matching_total')}: {formatCurrency(orders.reduce((sum, o) => sum + netAmount(o), 0))}
          </p>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((order, idx) => (
            <button
              key={idx}
              onClick={() => router.push(`/reports/orders/detail?id=${order.adsno}&type=closed${typeof order.adtur !== 'undefined' ? `&adtur=${order.adtur}` : ''}`)}
              className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-200 border-l-4 border-l-emerald-400 hover:shadow-md hover:border-l-emerald-500 transition text-left group"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="bg-emerald-500 p-2 rounded-xl shadow-sm shrink-0">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-black text-slate-900">#{order.adsno || order.id}</h3>
                  {(order.type_label || typeof order.adtur !== 'undefined') && (
                    <span className={`inline-block ${order.adtur === 1 ? 'bg-amber-100 text-amber-700' : (order.adtur === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-pink-100 text-pink-700')} text-[10px] font-bold px-2 py-0.5 rounded-md`}>
                      {order.type_label || (order.adtur === 0 ? t('order_type_adisyon') : (order.adtur === 1 ? t('order_type_paket') : (order.adtur === 3 ? t('order_type_hizli') : 'Diğer')))}
                    </span>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </div>

              <div className="mb-3">
                {Number(order.iskonto || 0) > 0 && (
                  <p className="text-xs text-slate-500">Brüt: <span className="font-semibold line-through">{formatCurrency(Number(order.tutar || 0))}</span></p>
                )}
                <p className="text-2xl font-black text-emerald-600">{formatCurrency(Number(order.tutar || 0) - Number(order.iskonto || 0))}</p>
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                {!(order.adtur === 1 || order.masa_no === 99999) && (
                  <div className="flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span className="text-sm font-bold text-slate-900 truncate">Masa: {typeof order.masa_no !== 'undefined' ? order.masa_no : '-'}</span>
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
                {order.garson_adi && (
                  <div className="flex items-center">
                    <User className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-600 truncate">{t('waiter')}: {order.garson_adi}</span>
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
                {order.acilis_saati && (
                  <div className="flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-600 font-medium">Açılış: {formatTime(order.acilis_saati)}</span>
                  </div>
                )}
                {order.kapanis_saati && (
                  <div className="flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-600 font-medium">Kapanış: {formatTime(order.kapanis_saati)}</span>
                  </div>
                )}
                <div className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                  <span className={`text-xs font-medium ${getElapsedMinutes(order.tarih, order.acilis_saati, order.kapanis_saati) > 60 ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                    Geçen Süre: {getElapsedText(order.tarih, order.acilis_saati, order.kapanis_saati)}
                  </span>
                </div>
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
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-70 flex items-center justify-center"
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
      </ReportShell>
    </div>
  );
}

export default function ClosedOrdersPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" /></div>}>
      <ClosedOrdersContent />
    </Suspense>
  );
}
