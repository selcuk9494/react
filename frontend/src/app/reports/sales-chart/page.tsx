'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { BarChart2 } from 'lucide-react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReportHeader from '@/components/ReportHeader';
import { getApiUrl } from '@/utils/api';

export default function SalesChartPage() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    if (!token) return;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        let url = `${getApiUrl()}/reports/sales-chart?period=${period}`;
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

  return (
    <div className="min-h-screen bg-gray-50">
      <ReportHeader
        title={t('sales_chart')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-[140px]">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 h-[550px] relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 z-0"></div>
             <div className="relative z-10 h-full flex flex-col">
                <div className="mb-8 flex items-center">
                    <div className="bg-indigo-100 p-2.5 rounded-xl mr-4">
                         <BarChart2 className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">{t('sales_chart_title')}</h3>
                        <p className="text-sm text-gray-500 font-medium">{t('sales_chart_subtitle')}</p>
                    </div>
                </div>
                
                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis 
                            dataKey="tarih" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }} 
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                            tickFormatter={(value) => `${value / 1000}k`}
                        />
                        <Tooltip 
                            cursor={{ fill: '#f9fafb' }}
                            formatter={(value: any) => [formatCurrency(Number(value)), t('total_sales')]}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                            itemStyle={{ color: '#4f46e5', fontWeight: 700 }}
                            labelStyle={{ color: '#6b7280', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}
                        />
                        <Bar 
                            dataKey="toplam" 
                            fill="url(#colorGradient)" 
                            radius={[8, 8, 0, 0]} 
                            barSize={50}
                        />
                         <defs>
                            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#818cf8" stopOpacity={0.8}/>
                            </linearGradient>
                        </defs>
                    </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
