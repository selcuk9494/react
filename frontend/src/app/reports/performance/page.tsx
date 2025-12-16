'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Gauge, User, ShoppingBag, Layers, AlertCircle } from 'lucide-react';
import axios from 'axios';
import ReportHeader from '@/components/ReportHeader';
import { getApiUrl } from '@/utils/api';

export default function PerformancePage() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
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
        let url = `${getApiUrl()}/reports/performance?period=${period}`;
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

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ReportHeader
        title={t('performance_report')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pt-[140px]">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard title={t('orders_count')} value={data.totals.orders_count} subValue={t('total_orders')} icon={<ShoppingBag className="w-5 h-5 text-blue-500" />} />
          <KPICard title={t('avg_ticket')} value={formatCurrency(data.totals.avg_ticket)} subValue={t('basket_average')} icon={<Layers className="w-5 h-5 text-indigo-500" />} />
          <KPICard title={t('avg_duration_minutes')} value={`${Math.round(data.totals.avg_duration_minutes)} dk`} subValue={t('average_duration')} icon={<Gauge className="w-5 h-5 text-purple-500" />} />
          <KPICard title={t('over60_count')} value={data.totals.over60_count} subValue={t('long_duration')} color="text-red-600" icon={<AlertCircle className="w-5 h-5 text-red-500" />} />
        </div>

        {/* Waiter Performance */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center bg-gray-50/50">
            <div className="bg-indigo-100 p-2 rounded-lg mr-3">
               <User className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{t('waiter_performance')}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('waiter')}</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('orders')}</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('amount')}</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('performance_short')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {data.waiters.map((row: any, index: number) => {
                  const maxTotal = Math.max(...data.waiters.map((w: any) => parseFloat(w.total)));
                  const percent = (parseFloat(row.total) / maxTotal) * 100;
                  
                  return (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 flex items-center">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold mr-3">
                            {row.waiter_name.substring(0, 2).toUpperCase()}
                        </div>
                        {row.waiter_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right font-medium">
                        <span className="bg-gray-100 px-2 py-1 rounded-md">{row.orders}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-900 text-right">{formatCurrency(parseFloat(row.total))}</td>
                    <td className="px-6 py-4 whitespace-nowrap w-24 align-middle">
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${percent}%` }}></div>
                        </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Performance */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center bg-gray-50/50">
              <div className="bg-emerald-100 p-2 rounded-lg mr-3">
                  <ShoppingBag className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t('product_performance')}</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('product')}</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('quantity')}</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('amount')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {data.products.map((row: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{row.product_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right font-medium">{row.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-900 text-right">{formatCurrency(parseFloat(row.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Group Performance */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center bg-gray-50/50">
              <div className="bg-purple-100 p-2 rounded-lg mr-3">
                  <Layers className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t('group_performance')}</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('group')}</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('quantity')}</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('amount')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {data.groups.map((row: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{row.group_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right font-medium">{row.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-900 text-right">{formatCurrency(parseFloat(row.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function KPICard({ title, value, subValue, icon, color = 'text-gray-900' }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
      <div className="relative z-10">
          <div className="flex justify-between items-start mb-2">
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">{title}</p>
              {icon && <div className="bg-gray-50 p-2 rounded-lg">{icon}</div>}
          </div>
          <p className={`text-3xl font-black mt-1 tracking-tight ${color}`}>{value}</p>
          {subValue && <p className="text-xs text-gray-400 mt-2 font-medium">{subValue}</p>}
      </div>
    </div>
  );
}
