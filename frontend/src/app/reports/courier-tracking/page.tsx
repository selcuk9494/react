'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Bike, Search, Clock, User, Filter } from 'lucide-react';
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
  mustid?: number | null;
  musteri_adi?: string | null;
}

export default function CourierTrackingReport() {
  const { user, token } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<CourierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [courierFilter, setCourierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'open'|'closed'>('all');
  const [lateOnly, setLateOnly] = useState(false);
  const [lateThreshold, setLateThreshold] = useState(30);

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
    return duration > lateThreshold;
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    const parts = timeStr.split(':');
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
    return timeStr;
  };

  // Filtered data
  const filteredData = data
    .filter(r => statusFilter === 'all' ? true : r.status === statusFilter)
    .filter(r => courierFilter ? (r.kurye || '').toLowerCase().includes(courierFilter.toLowerCase()) : true)
    .filter(r => lateOnly ? isLate(r) : true);

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-[140px]">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12">
            <Bike className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('not_found')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <Search className="w-4 h-4 text-gray-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Kurye adı"
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={courierFilter}
                    onChange={(e) => setCourierFilter(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border ${statusFilter==='all' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600'}`}
                  >
                    Tümü
                  </button>
                  <button
                    onClick={() => setStatusFilter('open')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border ${statusFilter==='open' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600'}`}
                  >
                    Yolda
                  </button>
                  <button
                    onClick={() => setStatusFilter('closed')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border ${statusFilter==='closed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-600'}`}
                  >
                    Döndü
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                    <input type="checkbox" checked={lateOnly} onChange={(e) => setLateOnly(e.target.checked)} />
                    Sadece gecikenler
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                      <Clock className="w-4 h-4 text-gray-400" />
                    </span>
                    <input
                      type="number"
                      min={1}
                      className="w-24 pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={lateThreshold}
                      onChange={(e) => setLateThreshold(parseInt(e.target.value || '30'))}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('courier')}</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">{t('departure')}</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">{t('return_time')}</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">{t('duration_min')}</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Müşteri</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('status')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {filteredData.map((row, index) => {
                    const late = isLate(row);
                    const duration = getDuration(row);
                    
                    return (
                      <tr 
                        key={`${row.adsno}-${index}`} 
                        className={`transition-colors duration-150 hover:bg-gray-50 ${late ? 'bg-red-50/50 hover:bg-red-50' : ''}`}
                      >
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${late ? 'text-red-900' : 'text-gray-900'}`}>
                          {row.adsno}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${late ? 'text-red-900' : 'text-gray-700'}`}>
                          {row.kurye || '-'}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-center font-medium ${late ? 'text-red-800' : 'text-gray-500'}`}>
                          {formatTime(row.cikis)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-center font-medium ${late ? 'text-red-800' : 'text-gray-500'}`}>
                          {formatTime(row.donus)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full shadow-sm ${
                            late ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {duration} dk
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-gray-700 font-medium">{row.musteri_adi || '-'}</span>
                            {row.mustid && (
                              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-bold">#{row.mustid}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {row.status === 'open' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5 animate-pulse"></span>
                              {t('on_road')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                               <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>
                              {t('returned')}
                            </span>
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
