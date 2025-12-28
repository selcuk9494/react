'use client';

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import ReportHeader from '@/components/ReportHeader';
import { useReportData } from '@/utils/useReportData';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

const COLORS = ['#4F46E5', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444', '#A855F7', '#14B8A6', '#F43F5E', '#84CC16', '#0EA5E9'];

export default function ProductGroupSalesPage() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const { data, isLoading, error } = useReportData({
    endpoint: '/reports/product-sales',
    token,
    period,
    customStartDate,
    customEndDate,
  });

  const totalSales = Array.isArray(data) ? data.reduce((acc: number, curr: any) => acc + (curr.total || 0), 0) : 0;
  const groupAgg = useMemo(() => {
    if (!Array.isArray(data)) return [];
    const m = new Map<number, { name: string; total: number; qty: number }>();
    data.forEach((it: any) => {
      const gid = it.group_id ?? -1;
      const name = it.group_name ?? 'Diğer';
      const prev = m.get(gid) || { name, total: 0, qty: 0 };
      prev.total += it.total || 0;
      prev.qty += it.quantity || 0;
      m.set(gid, prev);
    });
    const arr = Array.from(m.entries()).map(([id, v]) => ({ id, ...v, pct: totalSales > 0 ? (v.total / totalSales) * 100 : 0 }));
    arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [data, totalSales]);

  const chartData = groupAgg.map((g) => ({ name: g.name, value: Math.round(g.total) }));

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 safe-bottom">
      <ReportHeader
        title="Ürün Grup Satışları"
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6" style={{ paddingTop: 'calc(120px + env(safe-area-inset-top))' }}>
        {isLoading ? (
          <div className="bg-white rounded-3xl p-6 shadow-lg animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="h-64 bg-gray-100 rounded-2xl"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500">Error: {error.message}</p>
          </div>
        ) : groupAgg.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">{t('no_data')}</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-3xl p-6 shadow-lg">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Dağılım (Tutar)</h2>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={120} paddingAngle={2}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-gray-900">Gruplar</div>
                <Link href="/reports/product-sales" className="text-sm text-indigo-600 hover:underline">
                  Ürün Bazlı Görünüm
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {groupAgg.map((g, i) => (
                  <div key={g.id} className="border rounded-xl p-3">
                    <div className="text-sm font-semibold text-gray-800">{g.name || 'Diğer'}</div>
                    <div className="text-xs text-gray-500">{g.qty} adet</div>
                    <div className="text-sm font-bold text-gray-900">{formatCurrency(g.total)}</div>
                    <div className="mt-1 h-1.5 bg-gray-200 rounded">
                      <div
                        className="h-1.5 rounded"
                        style={{ width: `${Math.min(100, g.pct)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{g.pct.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
