'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { getApiUrl } from '@/utils/api';
import { Calendar, BarChart2 } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

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
  const { token } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
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
  }, [token, period, customStartDate, customEndDate]);

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

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPeriod('custom');
    setShowCustomDateModal(false);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  if (loading && items.length === 0) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <ReportHeader
        title="Ödenmez Raporu"
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <main className="px-4 py-4 space-y-6 overflow-hidden max-w-full" style={{ paddingTop: 'calc(120px + env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="px-3 py-2 rounded bg-gray-200 text-gray-900">Geri</button>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center mb-3">
            <BarChart2 className="w-5 h-5 text-indigo-600 mr-2" />
            <h2 className="text-lg font-bold text-gray-900">Günlük Ödenmez Toplam</h2>
          </div>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="tarih" />
                <YAxis />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="toplam_tutar" fill="#ef4444" name="Toplam Tutar" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Detaylar</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-700 px-3 py-2">Müşteri</th>
                  <th className="text-left text-xs font-semibold text-gray-700 px-3 py-2">Tarih</th>
                  <th className="text-left text-xs font-semibold text-gray-700 px-3 py-2">Saat</th>
                  <th className="text-left text-xs font-semibold text-gray-700 px-3 py-2">Masa</th>
                  <th className="text-left text-xs font-semibold text-gray-700 px-3 py-2">Ürün</th>
                  <th className="text-right text-xs font-semibold text-gray-700 px-3 py-2">Miktar</th>
                  <th className="text-right text-xs font-semibold text-gray-700 px-3 py-2">Birim Fiyat</th>
                  <th className="text-right text-xs font-semibold text-gray-700 px-3 py-2">Tutar</th>
                  <th className="text-left text-xs font-semibold text-gray-700 px-3 py-2">Ack4</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((i, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2 text-sm text-gray-900">{i.musteri_fullname || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{i.tarih}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{i.saat || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{i.masano}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{i.product_name}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">{i.miktar}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatCurrency(i.bfiyat || 0)}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatCurrency(i.tutar || 0)}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{i.ack4}</td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-3 text-sm text-gray-500">Kayıt bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <div className="text-sm font-semibold text-red-700">Toplam Kayıt: {totalCount}</div>
            <div className="text-lg font-bold text-red-700">Toplam Tutar: {formatCurrency(totalTutar)}</div>
          </div>
        </div>
      </main>

      {showCustomDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Tarih Aralığı Seç</h3>
              <button onClick={() => setShowCustomDateModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCustomDateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi</label>
                <input 
                  type="date" 
                  required
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi</label>
                <input 
                  type="date" 
                  required
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 transition"
              >
                Uygula
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
