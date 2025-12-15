'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { AlertCircle } from 'lucide-react';
import axios from 'axios';
import ReportHeader from '@/components/ReportHeader';
import { getApiUrl } from '@/utils/api';

export default function CancelledItemsPage() {
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
        let url = `${getApiUrl()}/reports/cancelled-items?period=${period}`;
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

  return (
    <div className="min-h-screen bg-gray-50">
      <ReportHeader
        title={t('cancelled_report_title')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('no_cancellations_text')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('product')}</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">{t('quantity')}</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('reason')}</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('waiter')}</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">{t('date')}</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('type')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {data.map((row, index) => (
                    <tr key={index} className="transition-colors duration-150 hover:bg-gray-50 group">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 group-hover:text-red-700 transition-colors">
                        {row.product_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-bold">
                        {row.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 italic">
                        {row.reason || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                        {row.waiter_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-center font-medium">
                        {new Date(row.date).toLocaleDateString('tr-TR')} <span className="text-gray-300">|</span> {new Date(row.date).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full shadow-sm ${
                          row.type === 'iptal' ? 'bg-red-100 text-red-700 ring-1 ring-red-200' : 
                          row.type === 'ikram' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                        }`}>
                          {row.type === 'iptal' && <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5 self-center"></span>}
                          {row.type === 'ikram' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 self-center"></span>}
                          {row.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
