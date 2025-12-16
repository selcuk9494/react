'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter } from 'next/navigation';
import { Wallet, Banknote, CreditCard as CreditCardIcon, CreditCard, AlertCircle } from 'lucide-react';
import axios from 'axios';
import ReportHeader from '@/components/ReportHeader';
import { getApiUrl } from '@/utils/api';

export default function PaymentTypesPage() {
  const { token } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    if (!token) return;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        let url = `${getApiUrl()}/reports/payment-types?period=${period}`;
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const totalAmount = data.reduce((acc, curr) => acc + curr.total, 0);
  const totalCount = data.reduce((acc, curr) => acc + curr.count, 0);

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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pt-[140px]">
        {loading ? (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        ) : data.length === 0 ? (
            <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{t('period_no_sales_products')}</p>
            </div>
        ) : (
            <>
                {/* Total Summary Card */}
                <div className="bg-[#10B981] rounded-2xl p-6 text-center text-white shadow-lg shadow-emerald-100">
                    <p className="text-emerald-100 text-sm font-medium mb-2">{t('total_payment')}</p>
                    <h2 className="text-4xl font-bold tracking-tight">{formatCurrency(totalAmount)}</h2>
                    <p className="text-emerald-200 text-sm mt-2 font-medium">{data.length} {t('payment_types_count')}</p>
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
                                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer active:scale-[0.99] transform duration-150"
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