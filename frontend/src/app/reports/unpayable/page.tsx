'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/utils/api';
import { BarChart2, Search, Ban, CalendarDays } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import ReportShell from '@/components/ReportShell';
import StatTile from '@/components/StatTile';
import { useSharedReportFilters, getBranchKasaOptions } from '@/utils/reportFilters';
import ReportExportButtons from '@/components/ReportExportButtons';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface UnpayableItem {
  adtur: number;
  adsno: string;
  tarih: string;
  saat: string | null;
  masano: number;
  pluid: string;
  product_name: string;
  miktar: number;
  bfiyat: number;
  tutar: number;
  ack4: string;
  musteri_fullname: string;
}

export default function UnpayablePage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { period, setPeriod, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, kasaNo, setKasaNo } = useSharedReportFilters();
  const kasaOptions = getBranchKasaOptions(user);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<UnpayableItem[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!token) return;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;
    const myId = ++reqIdRef.current;
    const fetchData = async () => {
      setLoading(true);
      setItems([]);
      try {
        let url = `${getApiUrl()}/reports/unpayable?period=${period}`;
        if (kasaNo) url += `&kasa_no=${kasaNo}`;
        if (period === 'custom') {
          url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
        }
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        if (reqIdRef.current === myId) {
          setItems(res.data || []);
        }
      } catch (e) {
        console.error(e);
        if (reqIdRef.current === myId) {
          setItems([]);
        }
      } finally {
        if (reqIdRef.current === myId) {
          setLoading(false);
        }
      }
    };
    fetchData();
  }, [token, period, customStartDate, customEndDate, kasaNo]);

  const filteredItems = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => (i.musteri_fullname || '').toLowerCase().includes(q));
  }, [items, customerQuery]);

  const chartData = useMemo(() => {
    const map = new Map<string, { tarih: string; toplam_tutar: number; adet: number }>();
    filteredItems.forEach(i => {
      const key = i.tarih;
      const prev = map.get(key) || { tarih: key, toplam_tutar: 0, adet: 0 };
      prev.toplam_tutar += i.tutar;
      prev.adet += 1;
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => a.tarih.localeCompare(b.tarih));
  }, [filteredItems]);

  const totalTutar = useMemo(() => filteredItems.reduce((sum, i) => sum + (Number(i.tutar) || 0), 0), [filteredItems]);
  const totalCount = filteredItems.length;

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  const formatCompact = (val: number) => new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(val);

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans safe-bottom">
      <ReportHeader
        title="Ödenmez Raporu"
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        actions={
          <ReportExportButtons
            title="Ödenmez Raporu"
            rows={filteredItems}
            columns={[
              { key: 'adsno', label: 'Adisyon' },
              { key: 'product_name', label: 'Ürün' },
              { key: 'musteri_fullname', label: 'Müşteri' },
              { key: 'tarih', label: 'Tarih' },
              { key: 'saat', label: 'Saat' },
              { key: 'miktar', label: 'Miktar' },
              { key: 'tutar', label: 'Tutar', format: (value) => formatCurrency(Number(value || 0)) },
            ]}
          />
        }
        kasaNo={kasaNo}
        setKasaNo={setKasaNo}
        kasaOptions={kasaOptions}
      />

      <ReportShell>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatTile tone="dark" label="Toplam Tutar" value={formatCurrency(totalTutar)} sub={`${totalCount} kayıt`} icon={Ban} />
          <StatTile accent="red" label="Kayıt Sayısı" value={totalCount} icon={Ban} />
          <StatTile accent="indigo" label="Gün Sayısı" value={chartData.length} icon={CalendarDays} />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-bold text-slate-900">Günlük Ödenmez Toplam</h2>
          </div>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="tarih" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tickFormatter={formatCompact} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  formatter={(v: any) => [formatCurrency(Number(v)), 'Toplam Tutar']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                  cursor={{ fill: 'rgba(239,68,68,0.08)' }}
                />
                <Bar dataKey="toplam_tutar" fill="#ef4444" radius={[6, 6, 0, 0]} name="Toplam Tutar" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900">Detaylar</h2>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Müşteri ara..."
                  className="w-full sm:w-56 pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                />
              </div>
              <span className="text-sm text-slate-500 whitespace-nowrap">{totalCount} kayıt</span>
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Müşteri</th>
                  <th className="px-4 py-3 font-semibold">Tarih</th>
                  <th className="px-4 py-3 font-semibold">Saat</th>
                  <th className="px-4 py-3 font-semibold">Masa</th>
                  <th className="px-4 py-3 font-semibold">Ürün</th>
                  <th className="px-4 py-3 font-semibold text-right">Miktar</th>
                  <th className="px-4 py-3 font-semibold text-right">Birim Fiyat</th>
                  <th className="px-4 py-3 font-semibold text-right">Tutar</th>
                  <th className="px-4 py-3 font-semibold">Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((i, idx) => (
                  <tr key={idx} className="border-t border-slate-100 hover:bg-red-50/40">
                    <td className="px-4 py-3 font-semibold text-slate-900">{i.musteri_fullname || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{i.tarih}</td>
                    <td className="px-4 py-3 text-slate-600">{i.saat || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{i.masano}</td>
                    <td className="px-4 py-3 text-slate-900">{i.product_name}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{i.miktar}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(i.bfiyat || 0)}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-700">{formatCurrency(i.tutar || 0)}</td>
                    <td className="px-4 py-3 text-slate-500">{i.ack4}</td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-500">Kayıt bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-slate-100">
            {filteredItems.map((i, idx) => (
              <div key={idx} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{i.product_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {i.musteri_fullname || '-'} · {i.tarih} {i.saat || ''}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Masa {i.masano} · {i.miktar} adet</div>
                  </div>
                  <div className="font-bold text-red-700 shrink-0">{formatCurrency(i.tutar || 0)}</div>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="px-4 py-6 text-center text-slate-500">Kayıt bulunamadı.</div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-red-50/60 px-4 py-3">
            <span className="text-sm font-semibold text-red-700">Toplam Kayıt: {totalCount}</span>
            <span className="text-lg font-black text-red-700">{formatCurrency(totalTutar)}</span>
          </div>
        </section>
      </ReportShell>
    </div>
  );
}
