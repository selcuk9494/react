'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter } from 'next/navigation';
import { Wallet, Banknote, CreditCard as CreditCardIcon, CreditCard } from 'lucide-react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import ReportHeader from '@/components/ReportHeader';
import { getApiUrl } from '@/utils/api';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function PaymentTypesPage() {
  const { token } = useAuth();
  const { t } = useI18n();
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

  const getIconForPayment = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes('nakit')) return <Banknote className="w-5 h-5 text-green-600" />;
      if (lower.includes('kredi')) return <CreditCardIcon className="w-5 h-5 text-purple-600" />;
      return <Wallet className="w-5 h-5 text-blue-600" />;
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

      <main className="px-4 py-4 space-y-6">
        {loading ? (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        ) : data.length === 0 ? (
            <div className="text-center py-12">
                <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{t('not_found')}</p>
            </div>
        ) : (
            <>
                {/* Total Card */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
                    
                    <div className="relative z-10 flex justify-between items-end">
                        <div>
                            <p className="text-indigo-100 text-sm font-medium mb-1">{t('total_payment')}</p>
                            <h2 className="text-3xl font-bold">{formatCurrency(totalAmount)}</h2>
                        </div>
                        <div className="text-right">
                             <p className="text-3xl font-bold">{totalCount}</p>
                             <p className="text-indigo-200 text-xs">{t('transaction')}</p>
                        </div>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 z-0"></div>
                    <h3 className="font-bold text-gray-900 mb-6 text-lg relative z-10 flex items-center">
                        <span className="w-1 h-6 bg-indigo-600 rounded-full mr-3"></span>
                        {t('distribution_chart')}
                    </h3>
                    <div className="h-[350px] w-full relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="total"
                                    nameKey="payment_name"
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="drop-shadow-sm" />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(value: any) => formatCurrency(Number(value))}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                    itemStyle={{ color: '#1f2937', fontWeight: 600 }}
                                />
                                <Legend 
                                    verticalAlign="bottom" 
                                    height={36} 
                                    iconType="circle"
                                    formatter={(value, entry: any) => <span className="text-sm font-medium text-gray-600 ml-1">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* List Section */}
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center">
                        <span className="w-1 h-6 bg-indigo-600 rounded-full mr-3"></span>
                        <h3 className="font-bold text-gray-900 text-lg">{t('detailed_info')}</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {data.map((item, idx) => (
                            <div key={idx} className="p-5 flex items-center justify-between hover:bg-gray-50 transition duration-200 group">
                                <div className="flex items-center space-x-4">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gray-50 border border-gray-100 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                                        {getIconForPayment(item.payment_name)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-lg">{item.payment_name}</h4>
                                        <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                                            <span className="font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">
                                                {((item.total / totalAmount) * 100).toFixed(1)}%
                                            </span>
                                            <span>•</span>
                                            <span className="font-medium">{item.count} {t('transaction')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-gray-900 text-xl tracking-tight">{formatCurrency(item.total)}</p>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 w-24 ml-auto overflow-hidden">
                                        <div 
                                            className="bg-indigo-600 h-1.5 rounded-full" 
                                            style={{ width: `${(item.total / totalAmount) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        )}
      </main>
    </div>
  );
}