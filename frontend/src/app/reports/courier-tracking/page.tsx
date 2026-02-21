'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Bike } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'trips'|'couriers'>('trips');
  const [groupShown, setGroupShown] = useState<Record<string, number>>({});

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
  const courierNames = Array.from(new Set(filteredData.map(r => r.kurye || '-'))).sort((a, b) => a.localeCompare(b));
  const groupedByCourier: Array<{ name: string; items: CourierRow[]; avg: number; count: number; open: number; closed: number }> =
    courierNames.map(name => {
      const items = filteredData.filter(r => (r.kurye || '-') === name);
      const total = items.reduce((acc, r) => acc + getDuration(r), 0);
      const avg = items.length ? Math.round(total / items.length) : 0;
      const open = items.filter(r => r.status === 'open').length;
      const closed = items.filter(r => r.status === 'closed').length;
      return { name, items, avg, count: items.length, open, closed };
    }).filter(g => g.count > 0);

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
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              <div>
                <p className="text-[11px] font-bold text-gray-700 mb-1">{t('courier')}</p>
                <select
                  className="w-full px-3 py-2 rounded-lg text-xs font-bold border bg-white border-gray-200 text-gray-600"
                  value={courierFilter}
                  onChange={(e) => setCourierFilter(e.target.value)}
                >
                  <option value="">{t('courier')}</option>
                  {courierNames.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-700 mb-1">Görünüm</p>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'trips', label: 'Detay' },
                    { id: 'couriers', label: 'Kurye Bazlı' },
                  ].map(b => (
                    <button
                      key={b.id}
                      onClick={() => setViewMode(b.id as any)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border ${viewMode === b.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600'}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-700 mb-1">{t('status')}</p>
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
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-700 mb-1">{t('duration')}</p>
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
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl p-6 shadow-lg border-2 border-indigo-100">
                  <h4 className="text-lg font-black text-indigo-900 mb-4 flex items-center gap-2">
                    📊 {t('status')}
                  </h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusAgg} dataKey="value" nameKey="name" innerRadius={60} outerRadius={85} paddingAngle={4}>
                          {statusAgg.map((entry, index) => <Cell key={`s-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl p-6 shadow-lg border-2 border-blue-100">
                  <h4 className="text-lg font-black text-blue-900 mb-4 flex items-center gap-2">
                    ⏱️ {t('duration')}
                  </h4>
                  <div className="h-48">
                    <RC2 width="100%" height="100%">
                      <BarChart data={histogram}>
                        <XAxis dataKey="name" style={{ fontSize: '12px', fontWeight: 'bold' }} />
                        <YAxis style={{ fontSize: '12px', fontWeight: 'bold' }} />
                        <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </RC2>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-6 shadow-lg border-2 border-emerald-100">
                  <h4 className="text-lg font-black text-emerald-900 mb-4 flex items-center gap-2">
                    📈 {t('average_duration')}
                  </h4>
                  <div className="h-48">
                    <RC2 width="100%" height="100%">
                      <BarChart data={courierAvg}>
                        <XAxis dataKey="name" style={{ fontSize: '12px', fontWeight: 'bold' }} />
                        <YAxis style={{ fontSize: '12px', fontWeight: 'bold' }} />
                        <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </RC2>
                  </div>
                </div>
              </div>
              {viewMode === 'couriers' ? (
                <div className="space-y-4">
                  {groupedByCourier.map(group => (
                    <div key={group.name} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-sm font-bold text-gray-900">{group.name}</h5>
                          <p className="text-xs text-gray-500">{group.count} kayıt • ort {group.avg} dk • {group.open} yolda • {group.closed} döndü</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-bold">{group.open} {t('on_road')}</span>
                          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-bold">{group.closed} {t('returned')}</span>
                          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg font-bold">{group.avg} dk</span>
                        </div>
                      </div>
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead className="bg-gray-50/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                              <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">{t('departure')}</th>
                              <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">{t('return_time')}</th>
                              <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">{t('duration_min')}</th>
                              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('status')}</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-50">
                            {(group.items.slice(0, groupShown[group.name] ?? 5)).map((row, idx) => {
                              const late = isLate(row);
                              const duration = getDuration(row);
                              return (
                                <tr key={`${group.name}-${row.adsno}-${idx}`} className={`hover:bg-gray-50 ${late ? 'bg-red-50/50 hover:bg-red-50' : ''}`}>
                                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.adsno}</td>
                                  <td className="px-4 py-3 text-sm text-center text-gray-500">{formatTime(row.cikis)}</td>
                                  <td className="px-4 py-3 text-sm text-center text-gray-500">{formatTime(row.donus)}</td>
                                  <td className="px-4 py-3 text-sm text-center">
                                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full ${late ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                      {duration} dk
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right">
                                    {row.status === 'open' ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">{t('on_road')}</span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">{t('returned')}</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {(groupShown[group.name] ?? 5) < group.items.length && (
                        <div className="mt-3 flex justify-center">
                          <button
                            className="px-3 py-2 rounded-lg text-xs font-bold border bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            onClick={() => setGroupShown(prev => ({ ...prev, [group.name]: (prev[group.name] ?? 5) + 10 }))}
                          >
                            {t('load_more')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
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
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
