'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Bike, Search, Clock } from 'lucide-react';
import axios from 'axios';
import ReportHeader from '@/components/ReportHeader';
import { getApiUrl } from '@/utils/api';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer as RC2, PieChart, Pie, Cell, Legend, ResponsiveContainer } from 'recharts';

interface CourierRow {
  adsno: number;
  kurye: string;
  cikis: string; 
  donus: string | null;
  tarih: string; 
  status: 'open' | 'closed';
  sipsaat?: string | null;
  stoptar?: string | null;
}

export default function CourierTrackingReport() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<CourierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [courierFilter, setCourierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'open'|'closed'>('all');
  const [durationFilter, setDurationFilter] = useState<'all'|'lt15'|'15to30'|'gt30'>('all');

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
    } catch {
      return null;
    }
  };

  const getDuration = (row: CourierRow) => {
    const start = parseDateTime(row.tarih, row.cikis);
    if (!start) return 0;
    let end = parseDateTime(row.tarih, row.donus);
    if (!end) end = new Date();
    if (end < start) end.setDate(end.getDate() + 1);
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / 60000);
  };

  const isLate = (row: CourierRow) => getDuration(row) > 30;

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    const parts = timeStr.split(':');
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
    return timeStr;
  };

  const filteredData = data
    .filter(r => courierFilter ? (r.kurye || '').toLowerCase().includes(courierFilter.toLowerCase()) : true)
    .filter(r => statusFilter === 'all' ? true : r.status === statusFilter)
    .filter(r => {
      const d = getDuration(r);
      if (durationFilter === 'lt15') return d < 15;
      if (durationFilter === '15to30') return d >= 15 && d <= 30;
      if (durationFilter === 'gt30') return d > 30;
      return true;
    });

  const statusAgg = [
    { name: t('on_road'), key: 'open', value: filteredData.filter(r => r.status === 'open').length, color: '#3b82f6' },
    { name: t('returned'), key: 'closed', value: filteredData.filter(r => r.status === 'closed').length, color: '#10b981' },
  ];

  const buckets = [
    { label: '<10', range: [0, 9] },
    { label: '10-20', range: [10, 20] },
    { label: '20-30', range: [21, 30] },
    { label: '30-45', range: [31, 45] },
    { label: '45+', range: [46, 10000] },
  ];
  const histogram = buckets.map(b => ({
    name: b.label,
    value: filteredData.filter(r => {
      const d = getDuration(r);
      return d >= b.range[0] && d <= b.range[1];
    }).length
  }));

  const courierStatsMap: Record<string, { count: number; total: number }> = {};
  filteredData.forEach(r => {
    const k = r.kurye || '-';
    const d = getDuration(r);
    if (!courierStatsMap[k]) courierStatsMap[k] = { count: 0, total: 0 };
    courierStatsMap[k].count += 1;
    courierStatsMap[k].total += d;
  });
  const courierAvg = Object.entries(courierStatsMap)
    .map(([name, s]) => ({ name, value: s.count ? Math.round(s.total / s.count) : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

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
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
            <div className="relative flex-1">
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
              {[
                { id: 'all', label: t('filter_title') },
                { id: 'open', label: t('on_road') },
                { id: 'closed', label: t('returned') },
              ].map(b => (
                <button
                  key={b.id}
                  onClick={() => setStatusFilter(b.id as any)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border ${statusFilter === b.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600'}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {[
                { id: 'all', label: t('duration') },
                { id: 'lt15', label: '<15' },
                { id: '15to30', label: '15-30' },
                { id: 'gt30', label: '>30' },
              ].map(b => (
                <button
                  key={b.id}
                  onClick={() => setDurationFilter(b.id as any)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border ${durationFilter === b.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600'}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
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
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-2">{t('status')}</h4>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusAgg} dataKey="value" nameKey="name" innerRadius={50} outerRadius={70} paddingAngle={2}>
                          {statusAgg.map((entry, index) => <Cell key={`s-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-2">{t('duration')}</h4>
                  <div className="h-40">
                    <RC2 width="100%" height="100%">
                      <BarChart data={histogram}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Bar dataKey="value" fill="#6366f1" />
                      </BarChart>
                    </RC2>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-2">{t('average_duration')}</h4>
                  <div className="h-40">
                    <RC2 width="100%" height="100%">
                      <BarChart data={courierAvg}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Bar dataKey="value" fill="#10b981" />
                      </BarChart>
                    </RC2>
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
        </div>
      </main>
    </div>
  );
}
