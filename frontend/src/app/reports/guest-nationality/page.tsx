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

  const nationalityRows = useMemo(() => {
    const grouped = new Map<string, { nationality: string; person_count: number; order_count: number }>();
    for (const row of report?.data || []) {
      const nationality = row.country_name || 'Belirtilmemiş';
      const current = grouped.get(nationality) || {
        nationality,
        person_count: 0,
        order_count: 0,
      };
      current.person_count += Number(row.person_count || 0);
      current.order_count += 1;
      grouped.set(nationality, current);
    }
    const totalGuests = Array.from(grouped.values()).reduce(
      (total, row) => total + row.person_count,
      0,
    );
    const needle = search.trim().toLocaleLowerCase('tr-TR');
    return Array.from(grouped.values())
      .map((row) => ({
        ...row,
        percentage: totalGuests > 0 ? (row.person_count / totalGuests) * 100 : 0,
      }))
      .filter((row) =>
        !needle || row.nationality.toLocaleLowerCase('tr-TR').includes(needle),
      )
      .sort((a, b) => b.person_count - a.person_count);
  }, [report, search]);

  const filteredGuests = nationalityRows.reduce(
    (total, row) => total + Number(row.person_count || 0),
    0,
  );

  const exportColumns = [
    { key: 'nationality', label: 'Milliyet' },
    { key: 'person_count', label: 'Kişi Sayısı' },
    { key: 'order_count', label: 'Adisyon Sayısı' },
    { key: 'percentage', label: 'Toplam Oranı', format: (value: unknown) => `%${Number(value || 0).toFixed(1)}` },
  ];
  const summaryCards: Array<{
    label: string;
    value: string | number;
    icon: LucideIcon;
    color: string;
  }> = [
    { label: 'Toplam Kişi', value: filteredGuests, icon: Users, color: 'text-indigo-600' },
    { label: 'Adisyon', value: nationalityRows.reduce((total, row) => total + row.order_count, 0), icon: ReceiptText, color: 'text-emerald-600' },
    {
      label: 'Milliyet',
      value: new Set(
        nationalityRows
          .map((row) => row.nationality)
          .filter((name) => name !== 'Belirtilmemiş'),
      ).size,
      icon: Globe2,
      color: 'text-blue-600',
    },
    {
      label: 'Ort. Kişi',
      value: nationalityRows.length
        ? (
            filteredGuests /
            nationalityRows.reduce((total, row) => total + row.order_count, 0)
          ).toFixed(1)
        : '0',
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
            rows={nationalityRows}
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
          <div className="max-w-xl">
            <label className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Milliyet ara"
                className="w-full border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Rapor yükleniyor...</div>
          ) : nationalityRows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Seçilen kriterlerde kayıt bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    {['Milliyet', 'Kişi Sayısı', 'Adisyon Sayısı', 'Toplam Oranı'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {nationalityRows.map((row) => (
                    <tr key={row.nationality} className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-bold text-gray-900">{row.nationality}</td>
                      <td className="px-4 py-4 font-black text-indigo-700">{row.person_count}</td>
                      <td className="px-4 py-4">{row.order_count}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-28 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, row.percentage)}%` }} />
                          </div>
                          <span className="font-semibold">%{row.percentage.toFixed(1)}</span>
                        </div>
                      </td>
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
