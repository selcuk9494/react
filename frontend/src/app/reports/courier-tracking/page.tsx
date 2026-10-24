'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Bike, Timer, CheckCircle2, Navigation } from 'lucide-react';
import axios from 'axios';
import ReportHeader from '@/components/ReportHeader';
import ReportShell from '@/components/ReportShell';
import StatTile from '@/components/StatTile';
import { useSharedReportFilters, getBranchKasaOptions } from '@/utils/reportFilters';
import ReportExportButtons from '@/components/ReportExportButtons';
import { getApiUrl } from '@/utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend, ResponsiveContainer } from 'recharts';

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
  const { token, user } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<CourierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { period, setPeriod, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, kasaNo, setKasaNo } = useSharedReportFilters();
  const kasaOptions = getBranchKasaOptions(user);
  const [courierFilter, setCourierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [durationFilter, setDurationFilter] = useState<'all' | 'lt15' | '15to30' | 'gt30'>('all');
  const [viewMode, setViewMode] = useState<'trips' | 'couriers'>('trips');
  const [groupShown, setGroupShown] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!token) return;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;

    const fetchData = async () => {
      try {
        let url = `${getApiUrl()}/reports/courier-tracking?period=${period}`;
        if (kasaNo) url += `&kasa_no=${kasaNo}`;
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
  }, [token, period, customStartDate, customEndDate, kasaNo]);

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

  const openCount = filteredData.filter(r => r.status === 'open').length;
  const closedCount = filteredData.filter(r => r.status === 'closed').length;
  const avgDuration = filteredData.length
    ? Math.round(filteredData.reduce((a, r) => a + getDuration(r), 0) / filteredData.length)
    : 0;

  const statusAgg = [
    { name: t('on_road'), key: 'open', value: openCount, color: '#3b82f6' },
    { name: t('returned'), key: 'closed', value: closedCount, color: '#10b981' },
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
  const allCourierNames = useMemo(
    () => Array.from(new Set(data.map(r => r.kurye || '-'))).sort((a, b) => a.localeCompare(b)),
    [data],
  );
  const groupedByCourier = courierNames.map(name => {
    const items = filteredData.filter(r => (r.kurye || '-') === name);
    const total = items.reduce((acc, r) => acc + getDuration(r), 0);
    const avg = items.length ? Math.round(total / items.length) : 0;
    const open = items.filter(r => r.status === 'open').length;
    const closed = items.filter(r => r.status === 'closed').length;
    return { name, items, avg, count: items.length, open, closed };
  }).filter(g => g.count > 0);

  const filterBtn = (active: boolean) =>
    `px-3 py-2 rounded-lg text-xs font-bold border transition ${active ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`;

  return (
    <div className="min-h-screen bg-slate-50 font-sans safe-bottom">
      <ReportHeader
        title={t('courier_tracking_report')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        actions={
          <ReportExportButtons
            title={t('courier_tracking_report')}
            rows={filteredData}
            columns={[
              { key: 'adsno', label: 'Adisyon' },
              { key: 'kurye', label: 'Kurye' },
              { key: 'tarih', label: 'Tarih' },
              { key: 'cikis', label: 'Çıkış' },
              { key: 'donus', label: 'Dönüş' },
              { key: 'status', label: 'Durum' },
            ]}
          />
        }
        kasaNo={kasaNo}
        setKasaNo={setKasaNo}
        kasaOptions={kasaOptions}
      />

      <ReportShell>
        {/* Filters */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-700 mb-1">{t('courier')}</p>
              <select
                className="w-full px-3 py-2 rounded-lg text-xs font-bold border bg-white border-slate-200 text-slate-600"
                value={courierFilter}
                onChange={(e) => setCourierFilter(e.target.value)}
              >
                <option value="">{t('courier')}</option>
                {allCourierNames.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-700 mb-1">Görünüm</p>
              <div className="flex items-center gap-2">
                {[{ id: 'trips', label: 'Detay' }, { id: 'couriers', label: 'Kurye Bazlı' }].map(b => (
                  <button key={b.id} onClick={() => setViewMode(b.id as any)} className={filterBtn(viewMode === b.id)}>{b.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-700 mb-1">{t('status')}</p>
              <div className="flex items-center gap-2">
                {[{ id: 'all', label: t('filter_title') }, { id: 'open', label: t('on_road') }, { id: 'closed', label: t('returned') }].map(b => (
                  <button key={b.id} onClick={() => setStatusFilter(b.id as any)} className={filterBtn(statusFilter === b.id)}>{b.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-700 mb-1">{t('duration')}</p>
              <div className="flex items-center gap-2">
                {[{ id: 'all', label: t('duration') }, { id: 'lt15', label: '<15' }, { id: '15to30', label: '15-30' }, { id: 'gt30', label: '>30' }].map(b => (
                  <button key={b.id} onClick={() => setDurationFilter(b.id as any)} className={filterBtn(durationFilter === b.id)}>{b.label}</button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <Bike className="w-14 h-14 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('not_found')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile tone="dark" label="Toplam Sefer" value={filteredData.length} icon={Bike} />
              <StatTile accent="sky" label={t('on_road')} value={openCount} icon={Navigation} />
              <StatTile accent="emerald" label={t('returned')} value={closedCount} icon={CheckCircle2} />
              <StatTile accent="indigo" label={t('average_duration')} value={`${avgDuration} dk`} icon={Timer} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-base font-bold text-slate-900 mb-3">{t('status')}</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusAgg} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={4} stroke="none">
                        {statusAgg.map((entry, index) => <Cell key={`s-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
                      <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-base font-bold text-slate-900 mb-3">{t('duration')}</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogram} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-base font-bold text-slate-900 mb-3">{t('average_duration')}</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={courierAvg} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} cursor={{ fill: 'rgba(16,185,129,0.08)' }} />
                      <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            {viewMode === 'couriers' ? (
              <div className="space-y-4">
                {groupedByCourier.map(group => (
                  <section key={group.name} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
                      <div>
                        <h5 className="text-sm font-bold text-slate-900">{group.name}</h5>
                        <p className="text-xs text-slate-500">{group.count} kayıt • ort {group.avg} dk</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-sky-50 text-sky-700 px-2 py-1 rounded-lg font-bold">{group.open} {t('on_road')}</span>
                        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-bold">{group.closed} {t('returned')}</span>
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg font-bold">{group.avg} dk</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr className="text-left">
                            <th className="px-4 py-3 font-semibold">#</th>
                            <th className="px-4 py-3 font-semibold text-center">{t('departure')}</th>
                            <th className="px-4 py-3 font-semibold text-center">{t('return_time')}</th>
                            <th className="px-4 py-3 font-semibold text-center">{t('duration_min')}</th>
                            <th className="px-4 py-3 font-semibold text-right">{t('status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(group.items.slice(0, groupShown[group.name] ?? 5)).map((row, idx) => {
                            const late = isLate(row);
                            const duration = getDuration(row);
                            return (
                              <tr key={`${group.name}-${row.adsno}-${idx}`} className={`border-t border-slate-100 hover:bg-slate-50 ${late ? 'bg-red-50/50 hover:bg-red-50' : ''}`}>
                                <td className="px-4 py-3 font-bold text-slate-900">{row.adsno}</td>
                                <td className="px-4 py-3 text-center text-slate-500">{formatTime(row.cikis)}</td>
                                <td className="px-4 py-3 text-center text-slate-500">{formatTime(row.donus)}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-0.5 inline-flex text-xs font-bold rounded-full ${late ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{duration} dk</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {row.status === 'open' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-700">{t('on_road')}</span>
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
                      <div className="py-3 flex justify-center border-t border-slate-100">
                        <button
                          className="px-3 py-2 rounded-lg text-xs font-bold border bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          onClick={() => setGroupShown(prev => ({ ...prev, [group.name]: (prev[group.name] ?? 5) + 10 }))}
                        >
                          {t('load_more')}
                        </button>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-bold text-slate-900">Seferler</h2>
                  <span className="text-sm text-slate-500">{filteredData.length} kayıt</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr className="text-left">
                        <th className="px-4 py-3 font-semibold">#</th>
                        <th className="px-4 py-3 font-semibold">{t('courier')}</th>
                        <th className="px-4 py-3 font-semibold text-center">{t('departure')}</th>
                        <th className="px-4 py-3 font-semibold text-center">{t('return_time')}</th>
                        <th className="px-4 py-3 font-semibold text-center">{t('duration_min')}</th>
                        <th className="px-4 py-3 font-semibold text-right">{t('status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((row, index) => {
                        const late = isLate(row);
                        const duration = getDuration(row);
                        return (
                          <tr key={`${row.adsno}-${index}`} className={`border-t border-slate-100 hover:bg-slate-50 ${late ? 'bg-red-50/50 hover:bg-red-50' : ''}`}>
                            <td className={`px-4 py-3 font-bold ${late ? 'text-red-900' : 'text-slate-900'}`}>{row.adsno}</td>
                            <td className={`px-4 py-3 font-medium ${late ? 'text-red-900' : 'text-slate-700'}`}>{row.kurye || '-'}</td>
                            <td className="px-4 py-3 text-center text-slate-500">{formatTime(row.cikis)}</td>
                            <td className="px-4 py-3 text-center text-slate-500">{formatTime(row.donus)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2.5 py-0.5 inline-flex text-xs font-bold rounded-full ${late ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{duration} dk</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {row.status === 'open' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-700">
                                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full mr-1.5 animate-pulse" />{t('on_road')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5" />{t('returned')}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </ReportShell>
    </div>
  );
}
