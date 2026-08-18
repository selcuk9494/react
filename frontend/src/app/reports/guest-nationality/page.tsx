'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Globe2, Search, Users, ReceiptText, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/utils/api';
import ReportHeader from '@/components/ReportHeader';
import ReportExportButtons from '@/components/ReportExportButtons';

type ReportRow = {
  adsno: number | string;
  adtur: number;
  tarih: string;
  masa_no: number;
  person_count: number;
  country_code?: string | number | null;
  country_name: string;
  kapanis_saati?: string | null;
};

type ReportResponse = {
  data: ReportRow[];
  countries: string[];
  summary: {
    order_count: number;
    total_guests: number;
    country_count: number;
    avg_guests: number;
  };
};

export default function GuestNationalityReportPage() {
  const { token, user } = useAuth();
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [countryFilter, setCountryFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState('');
  const [search, setSearch] = useState('');

  const allowed =
    user?.is_admin ||
    user?.allowed_reports == null ||
    user.allowed_reports.includes('guest_nationality');

  useEffect(() => {
    if (!token || !allowed) return;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;

    const fetchReport = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = { period };
        if (period === 'custom') {
          params.start_date = customStartDate;
          params.end_date = customEndDate;
        }
        const response = await axios.get(
          `${getApiUrl()}/reports/guest-nationality`,
          {
            params,
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setReport(response.data);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [token, allowed, period, customStartDate, customEndDate]);

  const rows = useMemo(() => {
    const minPeople = Number(personFilter || 0);
    const needle = search.trim().toLocaleLowerCase('tr-TR');
    return (report?.data || []).filter((row) => {
      if (countryFilter !== 'all' && row.country_name !== countryFilter) return false;
      if (minPeople > 0 && Number(row.person_count) < minPeople) return false;
      if (
        needle &&
        !String(row.adsno).toLocaleLowerCase('tr-TR').includes(needle) &&
        !String(row.masa_no).toLocaleLowerCase('tr-TR').includes(needle) &&
        !row.country_name.toLocaleLowerCase('tr-TR').includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [report, countryFilter, personFilter, search]);

  const filteredGuests = rows.reduce(
    (total, row) => total + Number(row.person_count || 0),
    0,
  );
  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('tr-TR');
  const formatTime = (value?: string | null) =>
    value ? String(value).substring(0, 5) : '-';
  const orderType = (value: number) =>
    Number(value) === 1 ? 'Paket' : Number(value) === 3 ? 'Hızlı Satış' : 'Adisyon';

  const exportColumns = [
    { key: 'tarih', label: 'Tarih', format: (value: unknown) => formatDate(String(value)) },
    { key: 'kapanis_saati', label: 'Saat', format: (value: unknown) => formatTime(String(value || '')) },
    { key: 'adsno', label: 'Adisyon No' },
    { key: 'masa_no', label: 'Masa' },
    { key: 'adtur', label: 'Tip', format: (value: unknown) => orderType(Number(value)) },
    { key: 'person_count', label: 'Kişi Sayısı' },
    { key: 'country_name', label: 'Milliyet' },
    { key: 'country_code', label: 'Ülke Kodu' },
  ];
  const summaryCards: Array<{
    label: string;
    value: string | number;
    icon: LucideIcon;
    color: string;
  }> = [
    { label: 'Toplam Kişi', value: filteredGuests, icon: Users, color: 'text-indigo-600' },
    { label: 'Adisyon', value: rows.length, icon: ReceiptText, color: 'text-emerald-600' },
    {
      label: 'Milliyet',
      value: new Set(
        rows
          .map((row) => row.country_name)
          .filter((name) => name !== 'Belirtilmemiş'),
      ).size,
      icon: Globe2,
      color: 'text-blue-600',
    },
    {
      label: 'Ort. Kişi',
      value: rows.length ? (filteredGuests / rows.length).toFixed(1) : '0',
      icon: Users,
      color: 'text-amber-600',
    },
  ];

  if (!allowed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <p className="text-center text-gray-600">Bu raporu görüntüleme yetkiniz yok.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <ReportHeader
        title="Kişi ve Uyruk Raporu"
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        actions={
          <ReportExportButtons
            title="Kişi ve Uyruk Raporu"
            columns={exportColumns}
            rows={rows}
          />
        }
      />

      <main className="max-w-5xl mx-auto px-4 pt-[145px] space-y-4">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <Icon className={`w-5 h-5 mb-2 ${color}`} />
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-2xl font-black text-gray-900">{String(value)}</p>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Adisyon, masa veya milliyet ara"
                className="w-full border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm"
              />
            </label>
            <select
              value={countryFilter}
              onChange={(event) => setCountryFilter(event.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
            >
              <option value="all">Tüm milliyetler</option>
              {(report?.countries || []).map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              value={personFilter}
              onChange={(event) => setPersonFilter(event.target.value)}
              placeholder="En az kişi sayısı"
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Rapor yükleniyor...</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Seçilen kriterlerde kayıt bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    {['Tarih / Saat', 'Adisyon', 'Masa', 'Tip', 'Kişi', 'Milliyet'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {rows.map((row) => (
                    <tr key={`${row.adsno}-${row.adtur}-${row.tarih}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{formatDate(row.tarih)} · {formatTime(row.kapanis_saati)}</td>
                      <td className="px-4 py-3 font-bold">#{row.adsno}</td>
                      <td className="px-4 py-3">{row.masa_no === 99999 ? 'Paket' : row.masa_no || '-'}</td>
                      <td className="px-4 py-3">{orderType(row.adtur)}</td>
                      <td className="px-4 py-3 font-bold text-indigo-700">{row.person_count}</td>
                      <td className="px-4 py-3">{row.country_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
