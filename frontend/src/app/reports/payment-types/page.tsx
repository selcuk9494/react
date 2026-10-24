'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { CreditCard as CreditCardIcon, AlertCircle, Wallet, Hash, PieChart as PieIcon, X } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import ReportShell from '@/components/ReportShell';
import StatTile from '@/components/StatTile';
import { useSharedReportFilters, getBranchKasaOptions } from '@/utils/reportFilters';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useReportData } from '@/utils/useReportData';
import { useRouter } from 'next/navigation';
import { exportRowsAsExcel, exportRowsAsPdf, ExportColumn } from '@/utils/reportExport';

const CHART_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export default function PaymentTypesPage() {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { period, setPeriod, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, kasaNo, setKasaNo } = useSharedReportFilters();
  const kasaOptions = getBranchKasaOptions(user);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [multiOnly, setMultiOnly] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  // Use optimized hook with SWR
  const { data, error, isLoading } = useReportData({
    endpoint: '/reports/payment-types',
    token,
    period,
    customStartDate,
    customEndDate,
    kasaNo,
  });

  const canDrilldown = useMemo(() => {
    if (!user) return false;
    if (user.is_admin) return true;
    if (user.allowed_reports === null || user.allowed_reports === undefined) return true;
    return Array.isArray(user.allowed_reports) && user.allowed_reports.includes('payment_types_detail');
  }, [user]);

  useEffect(() => {
    setSelectedPayment(null);
    setMultiOnly(false);
    setOrdersPage(1);
  }, [period, customStartDate, customEndDate]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const totalAmount = useMemo(() =>
    data ? data.reduce((acc: number, curr: any) => acc + curr.total, 0) : 0,
    [data]
  );

  const totalCount = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return 0;
    const overall = Number((data as any)[0]?.overall_count);
    if (Number.isFinite(overall)) return overall;
    return data.reduce((acc: number, curr: any) => acc + curr.count, 0);
  }, [data]);

  const getPercent = (value: number) => {
    if (!totalAmount) return 0;
    return Math.round((value / totalAmount) * 100);
  };

  const ordersParams = useMemo(() => {
    if (!selectedPayment) return {};
    const p: Record<string, any> = {
      page: String(ordersPage),
      limit: '20',
    };
    if (multiOnly) p.multi_only = '1';
    if (typeof selectedPayment?.otip !== 'undefined' && selectedPayment?.otip !== null && String(selectedPayment.otip) !== '') {
      p.otip = String(selectedPayment.otip);
    }
    return p;
  }, [selectedPayment, ordersPage, multiOnly]);

  const {
    data: ordersResponse,
    error: ordersError,
    isLoading: ordersLoading,
  } = useReportData({
    endpoint: '/reports/payment-types/orders',
    token,
    period,
    customStartDate,
    customEndDate,
    additionalParams: ordersParams,
    enabled: Boolean(token && canDrilldown && selectedPayment),
    kasaNo,
  });

  const orders = (ordersResponse as any)?.data || [];
  const ordersTotalPages = Number((ordersResponse as any)?.total_pages) || 1;
  const ordersTotal = Number((ordersResponse as any)?.total) || 0;
  const paymentColumns: ExportColumn[] = [
    { key: 'payment_name', label: 'Ödeme Tipi' },
    { key: 'count', label: 'Adisyon' },
    { key: 'total', label: 'Toplam', format: (value) => formatCurrency(Number(value || 0)) },
  ];
  const orderColumns: ExportColumn[] = [
    { key: 'adsno', label: 'Adisyon No' },
    { key: 'masa_no', label: 'Masa' },
    { key: 'garson_adi', label: 'Garson' },
    { key: 'item_count', label: 'Ürün' },
    { key: 'tarih', label: 'Tarih', format: (value) => (value ? new Date(value).toLocaleString('tr-TR') : '') },
    { key: 'order_total', label: 'Toplam', format: (_value, row) => formatCurrency(Number(row.order_total ?? row.tutar ?? 0)) },
    { key: 'iskonto', label: 'İndirim', format: (value) => formatCurrency(Number(value || 0)) },
  ];

  const pieData = Array.isArray(data)
    ? data.map((item: any, index: number) => ({
        name: item.payment_name,
        value: item.total,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
    : [];

  return (
    <div className="min-h-screen bg-slate-50 font-sans safe-bottom">
      <ReportHeader
        title={t('payments_title')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        actions={
          <>
            <button
              type="button"
              onClick={() => exportRowsAsExcel('Ödeme Tipleri', paymentColumns, Array.isArray(data) ? data : [])}
              className="px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
            >
              Excel
            </button>
            <button
              type="button"
              onClick={() => exportRowsAsPdf('Ödeme Tipleri', paymentColumns, Array.isArray(data) ? data : [])}
              className="px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap bg-white text-red-700 border border-red-200 hover:bg-red-50"
            >
              PDF
            </button>
          </>
        }
        kasaNo={kasaNo}
        setKasaNo={setKasaNo}
        kasaOptions={kasaOptions}
      />

      <ReportShell>
        {notice && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-4 py-3 text-sm font-semibold">
            {notice}
          </div>
        )}
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
              ))}
            </div>
            <div className="h-80 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          </div>
        ) : error || !data || data.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <AlertCircle className="w-14 h-14 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('period_no_sales_products')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatTile tone="dark" label={t('total_payment')} value={formatCurrency(totalAmount)} sub={`${data.length} ${t('payment_types_count')}`} icon={Wallet} />
              <StatTile accent="emerald" label={t('payment_types_count')} value={data.length} icon={CreditCardIcon} />
              <StatTile accent="indigo" label={t('transaction')} value={totalCount} icon={Hash} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Pie */}
              <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <PieIcon className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">{t('distribution')}</h3>
                </div>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((_, index: number) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, name: any) => [`${formatCurrency(Number(value))}`, name]}
                        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* List */}
              <section className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900">{t('detailed_info')}</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {data.map((item: any, index: number) => {
                    const color = CHART_COLORS[index % CHART_COLORS.length];
                    const active = selectedPayment?.otip === item.otip;
                    return (
                      <button
                        key={index}
                        type="button"
                        className={[
                          'w-full text-left px-4 py-3 flex items-center gap-4 transition',
                          canDrilldown ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-70 cursor-not-allowed',
                          active ? 'bg-emerald-50/60' : '',
                        ].join(' ')}
                        onClick={() => {
                          setNotice(null);
                          if (!canDrilldown) {
                            setNotice('Bu detay için yetkiniz yok. Admin panelden "Ödeme Tipleri (Detay)" yetkisini açın.');
                            return;
                          }
                          setSelectedPayment(item);
                          setMultiOnly(false);
                          setOrdersPage(1);
                        }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1f` }}>
                          <CreditCardIcon className="w-5 h-5" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900 truncate">{item.payment_name}</h4>
                            <span className="text-sm font-bold text-emerald-600 shrink-0">{formatCurrency(item.total)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-xs text-slate-500">{item.count} {t('transaction')}</p>
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">%{getPercent(item.total)}</span>
                          </div>
                          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${getPercent(item.total)}%`, backgroundColor: color }} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            {canDrilldown && selectedPayment && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-slate-900 truncate">
                      {selectedPayment.payment_name} • Adisyonlar
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Toplam: {ordersTotal} • Sayfa: {ordersPage}/{ordersTotalPages}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
                    onClick={() => setSelectedPayment(null)}
                    title="Kapat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={multiOnly}
                      onChange={(e) => {
                        setMultiOnly(e.target.checked);
                        setOrdersPage(1);
                      }}
                    />
                    Sadece çok ürünlü adisyonlar
                  </label>
                  <button
                    type="button"
                    className="ml-auto px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-sm font-bold text-emerald-700"
                    onClick={() => exportRowsAsExcel(`${selectedPayment.payment_name} Ödeme Detayı`, orderColumns, orders)}
                  >
                    Excel
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-sm font-bold text-red-700"
                    onClick={() => exportRowsAsPdf(`${selectedPayment.payment_name} Ödeme Detayı`, orderColumns, orders)}
                  >
                    PDF
                  </button>
                </div>

                <div className="mt-4">
                  {ordersLoading ? (
                    <div className="text-sm text-slate-500">Yükleniyor...</div>
                  ) : ordersError ? (
                    <div className="text-sm text-red-600">Adisyonlar alınamadı.</div>
                  ) : orders.length === 0 ? (
                    <div className="text-sm text-slate-500">Adisyon bulunamadı.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {orders.map((o: any, idx: number) => (
                        <button
                          key={`${o.adsno}-${o.adtur}-${idx}`}
                          type="button"
                          className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-3"
                          onClick={() => {
                            const id = o.adsno;
                            const adtur = typeof o.adtur !== 'undefined' && o.adtur !== null ? String(o.adtur) : '';
                            router.push(`/reports/orders/detail?id=${encodeURIComponent(String(id))}&type=closed${adtur ? `&adtur=${encodeURIComponent(adtur)}` : ''}`);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-black text-slate-900 truncate">
                                #{o.adsno}
                                {typeof o.masa_no !== 'undefined' && o.masa_no !== null ? ` • Masa ${o.masa_no}` : ''}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {o.tarih ? new Date(o.tarih).toLocaleString('tr-TR') : ''}
                                {o.garson_adi ? ` • ${o.garson_adi}` : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-black text-emerald-700">
                                {formatCurrency(Number(o.order_total ?? o.tutar ?? 0))}
                              </div>
                              {Number.isFinite(Number(o.item_count)) && (
                                <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md inline-block mt-1">
                                  {Number(o.item_count)} ürün
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-700 disabled:opacity-50"
                    disabled={ordersPage <= 1}
                    onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                  >
                    Önceki
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-700 disabled:opacity-50"
                    disabled={ordersPage >= ordersTotalPages}
                    onClick={() => setOrdersPage((p) => Math.min(ordersTotalPages, p + 1))}
                  >
                    Sonraki
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </ReportShell>
    </div>
  );
}
