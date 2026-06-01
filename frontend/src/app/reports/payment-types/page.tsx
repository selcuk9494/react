'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { CreditCard as CreditCardIcon, AlertCircle } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useReportData } from '@/utils/useReportData';
import { useRouter } from 'next/navigation';

export default function PaymentTypesPage() {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
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

  const getChartColors = () => {
    return ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
  };

  const getIconForPayment = (name: string, index: number) => {
      const color = getChartColors()[index % getChartColors().length];
      return <CreditCardIcon className="w-6 h-6" style={{ color }} />;
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
  });

  const orders = (ordersResponse as any)?.data || [];
  const ordersTotalPages = Number((ordersResponse as any)?.total_pages) || 1;
  const ordersTotal = Number((ordersResponse as any)?.total) || 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans safe-bottom">
      <ReportHeader
        title={t('payments_title')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6" style={{ paddingTop: 'calc(120px + env(safe-area-inset-top))' }}>
        {notice && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-4 py-3 text-sm font-semibold">
            {notice}
          </div>
        )}
        {isLoading ? (
            <div className="space-y-4">
              {/* Shimmer Summary Card */}
              <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl p-8 animate-pulse">
                <div className="h-4 bg-white/30 rounded w-32 mx-auto mb-3"></div>
                <div className="h-12 bg-white/40 rounded w-48 mx-auto mb-4"></div>
                <div className="h-3 bg-white/20 rounded w-24 mx-auto"></div>
              </div>

              {/* Chart Skeleton */}
              <div className="bg-white rounded-3xl p-6 shadow-lg">
                <div className="h-48 bg-gray-100 rounded-2xl animate-pulse"></div>
              </div>

              {/* List Skeletons */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-3xl p-5 shadow-lg animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-20"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-24"></div>
                  </div>
                </div>
              ))}
            </div>
        ) : error || !data || data.length === 0 ? (
            <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{t('period_no_sales_products')}</p>
            </div>
        ) : (
            <>
                {/* Total Summary Card */}
                <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-3xl p-8 text-center text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-40 h-40 bg-teal-400 opacity-20 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                        <p className="text-emerald-100 text-sm font-bold mb-3 uppercase tracking-wide">💰 {t('total_payment')}</p>
                        <h2 className="text-5xl font-black tracking-tight drop-shadow-lg">{formatCurrency(totalAmount)}</h2>
                        <p className="text-emerald-200 text-base mt-4 font-semibold">{data.length} {t('payment_types_count')}</p>
                    </div>
                </div>

                {/* Pie Chart Section */}
                <div className="bg-gradient-to-br from-white to-indigo-50 rounded-3xl p-6 shadow-xl border-2 border-indigo-100">
                    <h3 className="text-xl font-black text-indigo-900 mb-4 px-1 flex items-center gap-2">
                        📊 {t('distribution')}
                    </h3>
                    <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.map((item: any, index: number) => ({
                                        name: item.payment_name,
                                        value: item.total,
                                        color: getChartColors()[index % getChartColors().length],
                                    }))}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {data.map((item: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={getChartColors()[index % getChartColors().length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: any, name: any) => [`${formatCurrency(Number(value))}`, name]} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* List Section */}
                <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4 px-1">{t('detailed_info')}</h3>
                    
                    <div className="space-y-3">
                        {data.map((item: any, index: number) => {
                            const color = getChartColors()[index % getChartColors().length];
                            
                            return (
                                <div 
                                    key={index} 
                                    className={[
                                      "bg-gradient-to-br from-white to-gray-50 rounded-3xl p-5 shadow-lg border-2 transition-all duration-200",
                                      canDrilldown ? "hover:shadow-xl hover:scale-[1.02] cursor-pointer" : "opacity-60 cursor-not-allowed",
                                      selectedPayment?.otip === item.otip ? "ring-2 ring-emerald-400/60" : "",
                                    ].join(' ')}
                                    style={{ borderColor: `${color}40` }}
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
                                    <div className="flex items-center">
                                        {/* Icon */}
                                        <div 
                                            className="w-12 h-12 rounded-xl flex items-center justify-center mr-4"
                                            style={{ backgroundColor: `${color}20` }}
                                        >
                                            <CreditCardIcon className="w-6 h-6" style={{ color }} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-base font-bold text-gray-900 truncate">{item.payment_name}</h4>
                                            <p className="text-sm text-gray-500 mt-0.5">{item.count} {t('transaction')}</p>
                                            
                                            {/* Progress Bar Container */}
                                            <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full rounded-full" 
                                                    style={{ width: `${getPercent(item.total)}%`, backgroundColor: color }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Amount & Percent */}
                                        <div className="ml-4 text-right">
                                            <p className="text-base font-bold text-emerald-600">{formatCurrency(item.total)}</p>
                                            <div className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-1 rounded-lg inline-block mt-1">
                                                %{getPercent(item.total)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {canDrilldown && selectedPayment && (
                  <div className="bg-white rounded-3xl p-5 shadow-lg border-2 border-gray-100">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-gray-900 truncate">
                          {selectedPayment.payment_name} • Adisyonlar
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Toplam: {ordersTotal} • Sayfa: {ordersPage}/{ordersTotalPages}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-700"
                        onClick={() => setSelectedPayment(null)}
                      >
                        Kapat
                      </button>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
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
                    </div>

                    <div className="mt-4">
                      {ordersLoading ? (
                        <div className="text-sm text-gray-500">Yükleniyor...</div>
                      ) : ordersError ? (
                        <div className="text-sm text-red-600">
                          Adisyonlar alınamadı.
                        </div>
                      ) : orders.length === 0 ? (
                        <div className="text-sm text-gray-500">Adisyon bulunamadı.</div>
                      ) : (
                        <div className="space-y-2">
                          {orders.map((o: any, idx: number) => (
                            <button
                              key={`${o.adsno}-${o.adtur}-${idx}`}
                              type="button"
                              className="w-full text-left bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3"
                              onClick={() => {
                                const id = o.adsno;
                                const adtur = typeof o.adtur !== 'undefined' && o.adtur !== null ? String(o.adtur) : '';
                                router.push(`/reports/orders/detail?id=${encodeURIComponent(String(id))}&type=closed${adtur ? `&adtur=${encodeURIComponent(adtur)}` : ''}`);
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-black text-gray-900 truncate">
                                    #{o.adsno}
                                    {typeof o.masa_no !== 'undefined' && o.masa_no !== null ? ` • Masa ${o.masa_no}` : ''}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {o.tarih ? new Date(o.tarih).toLocaleString('tr-TR') : ''}
                                    {o.garson_adi ? ` • ${o.garson_adi}` : ''}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-black text-emerald-700">
                                    {formatCurrency(Number(o.order_total ?? o.tutar ?? 0))}
                                  </div>
                                  {Number.isFinite(Number(o.item_count)) && (
                                    <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg inline-block mt-1">
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
                        className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-700 disabled:opacity-50"
                        disabled={ordersPage <= 1}
                        onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                      >
                        Önceki
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-700 disabled:opacity-50"
                        disabled={ordersPage >= ordersTotalPages}
                        onClick={() => setOrdersPage((p) => Math.min(ordersTotalPages, p + 1))}
                      >
                        Sonraki
                      </button>
                    </div>
                  </div>
                )}
            </>
        )}
      </main>
    </div>
  );
}
