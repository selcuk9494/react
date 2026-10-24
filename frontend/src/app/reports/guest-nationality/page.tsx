'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Globe2, Search, Users, ReceiptText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/utils/api';
import ReportHeader from '@/components/ReportHeader';
import ReportShell from '@/components/ReportShell';
import StatTile from '@/components/StatTile';
import { useSharedReportFilters, getBranchKasaOptions } from '@/utils/reportFilters';
import ReportExportButtons from '@/components/ReportExportButtons';

type ReportRow = {
  adsno: number | string;
  adtur: number;
  tarih: string;
  masa_no: number;
  person_count: number;
  total_amount: number;
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
  const { period, setPeriod, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, kasaNo, setKasaNo } = useSharedReportFilters();
  const kasaOptions = getBranchKasaOptions(user);
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
        if (kasaNo) params.kasa_no = String(kasaNo);
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
  }, [token, allowed, period, customStartDate, customEndDate, kasaNo]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(value);

  const nationalityRows = useMemo(() => {
    const grouped = new Map<string, { nationality: string; person_count: number; order_count: number; total_amount: number }>();
    for (const row of report?.data || []) {
      const nationality = row.country_name || 'Belirtilmemiş';
      const current = grouped.get(nationality) || {
        nationality,
        person_count: 0,
        order_count: 0,
        total_amount: 0,
      };
      current.person_count += Number(row.person_count || 0);
      current.order_count += 1;
      current.total_amount += Number(row.total_amount || 0);
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
  const totalAmount = nationalityRows.reduce((total, row) => total + row.total_amount, 0);
  const totalOrders = nationalityRows.reduce((total, row) => total + row.order_count, 0);
  const countryCount = new Set(
    nationalityRows.map((row) => row.nationality).filter((name) => name !== 'Belirtilmemiş'),
  ).size;
  const avgGuests = totalOrders ? (filteredGuests / totalOrders).toFixed(1) : '0';

  const exportColumns = [
    { key: 'nationality', label: 'Milliyet' },
    { key: 'person_count', label: 'Kişi Sayısı' },
    { key: 'order_count', label: 'Adisyon Sayısı' },
    { key: 'total_amount', label: 'Adisyon Toplamı', format: (value: unknown) => formatCurrency(Number(value || 0)) },
    { key: 'percentage', label: 'Toplam Oranı', format: (value: unknown) => `%${Number(value || 0).toFixed(1)}` },
  ];

  if (!allowed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-center text-slate-600">Bu raporu görüntüleme yetkiniz yok.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans safe-bottom">
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
        kasaNo={kasaNo}
        setKasaNo={setKasaNo}
        kasaOptions={kasaOptions}
      />

      <ReportShell>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatTile tone="dark" label="Adisyon Toplamı" value={formatCurrency(totalAmount)} icon={ReceiptText} className="col-span-2 lg:col-span-1" />
          <StatTile accent="indigo" label="Toplam Kişi" value={filteredGuests} icon={Users} />
          <StatTile accent="emerald" label="Adisyon" value={totalOrders} icon={ReceiptText} />
          <StatTile accent="sky" label="Milliyet" value={countryCount} icon={Globe2} />
          <StatTile accent="amber" label="Ort. Kişi" value={avgGuests} icon={Users} />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900">Milliyet Dağılımı</h2>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Milliyet ara..."
                  className="w-full sm:w-56 pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                />
              </div>
              <span className="text-sm text-slate-500 whitespace-nowrap">{nationalityRows.length} milliyet</span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">Rapor yükleniyor...</div>
          ) : nationalityRows.length === 0 ? (
            <div className="p-12 text-center text-slate-500">Seçilen kriterlerde kayıt bulunamadı.</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-semibold">Milliyet</th>
                      <th className="px-4 py-3 font-semibold text-right">Kişi Sayısı</th>
                      <th className="px-4 py-3 font-semibold text-right">Adisyon Sayısı</th>
                      <th className="px-4 py-3 font-semibold text-right">Adisyon Toplamı</th>
                      <th className="px-4 py-3 font-semibold">Kişi Oranı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nationalityRows.map((row) => (
                      <tr key={row.nationality} className="border-t border-slate-100 hover:bg-indigo-50/40">
                        <td className="px-4 py-3 font-bold text-slate-900">{row.nationality}</td>
                        <td className="px-4 py-3 text-right font-black text-indigo-700">{row.person_count}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{row.order_count}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(row.total_amount)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-28 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, row.percentage)}%` }} />
                            </div>
                            <span className="font-semibold text-slate-600">%{row.percentage.toFixed(1)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-slate-100">
                {nationalityRows.map((row) => (
                  <div key={row.nationality} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-slate-900">{row.nationality}</div>
                      <div className="font-black text-indigo-700">{row.person_count} kişi</div>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-1 text-xs text-slate-500">
                      <span>{row.order_count} adisyon</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(row.total_amount)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, row.percentage)}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-600">%{row.percentage.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </ReportShell>
    </div>
  );
}
