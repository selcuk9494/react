'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Bike } from 'lucide-react';
import axios from 'axios';
import ReportHeader from '@/components/ReportHeader';
import { getApiUrl } from '@/utils/api';

interface CourierRow {
  adsno: number;
  kurye: string;
  cikis: string; // HH:MM:SS
  donus: string | null;
  tarih: string; // YYYY-MM-DD
  status: 'open' | 'closed';
}

export default function CourierTrackingReport() {
  const { user, token } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<CourierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    if (!token) return;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;

    const fetchData = async () => {
      try {
        let url = `${getApiUrl()}/reports/courier-tracking?period=${period}`;
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
    
    // Auto refresh every 30 seconds for tracking
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [token, period, customStartDate, customEndDate]);

  const parseDateTime = (dateStr: string, timeStr: string | null) => {
    if (!dateStr || !timeStr) return null;
    try {
      const d = new Date(dateStr);
      const [h, m] = timeStr.split(':');
      d.setHours(parseInt(h), parseInt(m), 0, 0);
      return d;
    } catch (e) {
      return null;
    }
  };

  const getDuration = (row: CourierRow) => {
    const start = parseDateTime(row.tarih, row.cikis);
    if (!start) return 0;

    let end = parseDateTime(row.tarih, row.donus);
    if (!end) {
        end = new Date();
    }
    
    if (end < start) {
        end.setDate(end.getDate() + 1);
    }

    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (1000 * 60)); // minutes
  };

  const isLate = (row: CourierRow) => {
    const duration = getDuration(row);
    return duration > 30;
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    const parts = timeStr.split(':');
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
    return timeStr;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ReportHeader
        title={t('courier_tracking_report')}
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
            <Bike className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('not_found')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('courier')}</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('departure')}</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('return_time')}</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('duration_min')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('status')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((row, index) => {
                    const late = isLate(row);
                    const duration = getDuration(row);
                    
                    return (
                      <tr 
                        key={`${row.adsno}-${index}`} 
                        className={late ? 'bg-red-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${late ? 'text-red-900' : 'text-gray-900'}`}>
                          {row.adsno}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${late ? 'text-red-900' : 'text-gray-900'}`}>
                          {row.kurye || '-'}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-center ${late ? 'text-red-900' : 'text-gray-500'}`}>
                          {formatTime(row.cikis)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-center ${late ? 'text-red-900' : 'text-gray-500'}`}>
                          {formatTime(row.donus)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            late ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {duration} dk
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {row.status === 'open' ? (
                            <span className="text-blue-600 bg-blue-100 px-2 py-1 rounded-md text-xs">{t('on_road')}</span>
                          ) : (
                            <span className="text-green-600 bg-green-100 px-2 py-1 rounded-md text-xs">{t('returned')}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
