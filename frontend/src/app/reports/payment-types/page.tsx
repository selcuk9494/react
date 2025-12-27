'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter } from 'next/navigation';
import { Wallet, Banknote, CreditCard as CreditCardIcon, CreditCard, AlertCircle } from 'lucide-react';
import axios from 'axios';
import ReportHeader from '@/components/ReportHeader';
import { getApiUrl } from '@/utils/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import useSWR from 'swr';

// Fetcher function for SWR
const fetcher = (url: string, token: string) =>
  axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).then((res) => res.data);

export default function PaymentTypesPage() {
  const { token } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Build API URL
  const apiUrl = useMemo(() => {
    if (!token) return null;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return null;
    
    let url = `${getApiUrl()}/reports/payment-types?period=${period}`;
    if (period === 'custom') {
      url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
    }
    return url;
  }, [token, period, customStartDate, customEndDate]);

  // Use SWR for caching and auto-revalidation
  const { data, error, isLoading } = useSWR(
    apiUrl ? [apiUrl, token] : null,
    ([url, tkn]) => fetcher(url, tkn as string),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000, // Prevent duplicate requests within 5 seconds
    }
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const totalAmount = useMemo(() => 
    data ? data.reduce((acc: number, curr: any) => acc + curr.total, 0) : 0,
    [data]
  );

  const totalCount = useMemo(() =>
    data ? data.reduce((acc: number, curr: any) => acc + curr.count, 0) : 0,
    [data]
  );

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

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <ReportHeader
        title={t('payments_title')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pt-[160px]">
        {isLoading ? (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
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
                        {data.map((item, index) => {
                            const color = getChartColors()[index % getChartColors().length];
                            
                            return (
                                <div 
                                    key={index} 
                                    className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-5 shadow-lg border-2 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                                    style={{ borderColor: `${color}40` }}
                                    onClick={() => {
                                        // Not implementing navigation yet as order details page needs to be ready
                                        // router.push(...)
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
            </>
        )}
      </main>
    </div>
  );
}
