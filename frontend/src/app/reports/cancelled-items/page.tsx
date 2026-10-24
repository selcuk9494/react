'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter } from 'next/navigation';
import { XCircle, Search, Info, Clock, CheckCircle, PieChart as PieIcon, Package } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import axios from 'axios';
import ReportHeader from '@/components/ReportHeader';
import ReportShell from '@/components/ReportShell';
import StatTile from '@/components/StatTile';
import { useSharedReportFilters, getBranchKasaOptions } from '@/utils/reportFilters';
import ReportExportButtons from '@/components/ReportExportButtons';
import { getApiUrl } from '@/utils/api';
import clsx from 'clsx';

export default function CancelledItemsPage() {
  const { token, user } = useAuth();
  const { t, lang } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { period, setPeriod, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, kasaNo, setKasaNo } = useSharedReportFilters();
  const kasaOptions = getBranchKasaOptions(user);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'iptal' | 'iade' | 'ikram'>('all');

  useEffect(() => {
    if (!token) return;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        let url = `${getApiUrl()}/reports/cancelled-items?period=${period}`;
        if (kasaNo) url += `&kasa_no=${kasaNo}`;
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
  }, [token, period, customStartDate, customEndDate, kasaNo]);

  const colorFromName = (name?: string) => {
    const base = (name && String(name)) || 'Ürün';
    const palette = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    let h = 0; for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  };

  // Filtered Data
  const filteredData = useMemo(() =>
    data
      .filter(i => (i.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
      .filter(i => filterType === 'all' ? true : i.type === filterType)
      .sort((a, b) => b.quantity - a.quantity),
    [data, searchQuery, filterType]);

  const filteredTotalQty = filteredData.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const getPercent = (q: number) => {
    if (!filteredTotalQty) return 0;
    return Math.round((q / filteredTotalQty) * 100);
  };

  const typeAgg: Record<string, number> = { iptal: 0, iade: 0, ikram: 0 };
  filteredData.forEach(i => {
    if (typeof i.quantity === 'number' && i.type && typeAgg[i.type] !== undefined) {
      typeAgg[i.type] += i.quantity;
    }
  });
  const typeData = [
    { name: t('cancel'), value: typeAgg.iptal, color: '#EF4444' },
    { name: t('return'), value: typeAgg.iade, color: '#F59E0B' },
    { name: t('compliment'), value: typeAgg.ikram, color: '#10B981' },
  ].filter(s => s.value > 0);

  const topProducts = filteredData.slice(0, 6).map((i: any) => ({
    name: i.product_name,
    value: i.quantity || 0,
    color: colorFromName(i.product_name)
  })).filter(p => p.value > 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans safe-bottom">
      <ReportHeader
        title={t('cancelled_report_title')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        actions={
          <ReportExportButtons
            title={t('cancelled_report_title')}
            rows={filteredData}
            columns={[
              { key: 'product_name', label: t('product') },
              { key: 'type', label: t('type') },
              { key: 'quantity', label: t('quantity') },
              { key: 'total', label: t('amount') },
              { key: 'order_id', label: t('order_no') },
              { key: 'date', label: t('date') },
            ]}
          />
        }
        kasaNo={kasaNo}
        setKasaNo={setKasaNo}
        kasaOptions={kasaOptions}
      />

      <ReportShell>
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
              ))}
            </div>
            <div className="h-72 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile tone="dark" label={t('total_cancelled_amount')} value={filteredTotalQty.toFixed(2)} sub={`${data.length} ${t('total_cancelled_count')}`} icon={XCircle} />
              <StatTile accent="red" label={t('cancel')} value={typeAgg.iptal} />
              <StatTile accent="amber" label={t('return')} value={typeAgg.iade} />
              <StatTile accent="emerald" label={t('compliment')} value={typeAgg.ikram} />
            </div>

            {(typeData.length > 0 || topProducts.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <PieIcon className="w-5 h-5 text-red-600" />
                    <h3 className="text-base font-bold text-slate-900">{t('all')}</h3>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} paddingAngle={2} stroke="none">
                          {typeData.map((entry, index) => (
                            <Cell key={`cell-type-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-5 h-5 text-amber-600" />
                    <h3 className="text-base font-bold text-slate-900">{t('products')}</h3>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={topProducts} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} paddingAngle={2} stroke="none">
                          {topProducts.map((entry, index) => (
                            <Cell key={`cell-prod-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>
            )}

            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                  placeholder={t('search_product')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
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
                      'px-4 py-2 rounded-lg text-sm font-semibold border transition whitespace-nowrap',
                      filterType === type.id
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            {filteredData.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-slate-900">{t('no_cancellations_title')}</h4>
                <p className="text-slate-500 mt-1">{t('no_cancellations_text')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {filteredData.map((item, index) => {
                  const itemColor = colorFromName(item.product_name);
                  return (
                    <button
                      key={index}
                      onClick={() => router.push(`/reports/orders/detail?id=${item.order_id}&type=${item.status}${typeof item.adtur !== 'undefined' ? `&adtur=${item.adtur}` : ''}`)}
                      className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-slate-200 border-l-4 hover:shadow-md transition"
                      style={{ borderLeftColor: item.type === 'iptal' ? '#EF4444' : item.type === 'iade' ? '#F59E0B' : '#10B981' }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${itemColor}1f` }}>
                          <XCircle className="w-5 h-5" style={{ color: itemColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="text-sm font-bold text-slate-900 truncate pr-2">{item.product_name}</h4>
                            <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-md shrink-0">
                              %{getPercent(item.quantity || 0)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5 mb-2">
                            {t('quantity')}: <span className="font-semibold text-slate-900">{item.quantity}</span>
                          </p>
                          <div className="flex flex-wrap gap-2 items-center mb-2">
                            <span className={clsx(
                              'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider',
                              item.type === 'iptal' ? 'bg-red-100 text-red-700' :
                                item.type === 'iade' ? 'bg-amber-100 text-amber-700' :
                                  'bg-emerald-100 text-emerald-700'
                            )}>
                              {item.type}
                            </span>
                            {item.waiter_name && (
                              <span className="text-xs text-slate-500">{item.waiter_name}</span>
                            )}
                            {typeof item.adtur !== 'undefined' && (
                              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                {item.adtur === 0 ? t('order_type_adisyon') :
                                  item.adtur === 1 ? t('order_type_paket') :
                                    item.adtur === 3 ? t('order_type_hizli') : 'Diğer'}
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                            <div className="h-1.5 rounded-full" style={{ width: `${getPercent(item.quantity || 0)}%`, backgroundColor: itemColor }} />
                          </div>
                          {item.reason && (
                            <div className="bg-slate-50 rounded-lg p-2 mb-2 flex items-start gap-2">
                              <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                              <p className="text-xs text-slate-600 leading-relaxed">{item.reason}</p>
                            </div>
                          )}
                          <div className="flex items-center text-xs text-slate-400">
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            {item.date ? new Date(item.date).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </ReportShell>
    </div>
  );
}
