'use client';

import React, { useState, Suspense, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSearchParams } from 'next/navigation';
import { Package, Layers, Download, ArrowUpDown } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import { useReportData } from '@/utils/useReportData';
import clsx from 'clsx';
import AutoFitText from '@/components/AutoFitText';
import axios from 'axios';
import { getApiUrl } from '@/utils/api';

function ProductSalesContent() {
  const { token } = useAuth();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  
  const [groups, setGroups] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [selectedPlu, setSelectedPlu] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'groups'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'total' | 'quantity' | 'pct_total' | 'pct_qty'>('total');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const additionalParams = useMemo(() => {
    const params: any = {};
    if (selectedGroups.length) params.group_ids = selectedGroups.join(',');
    if (selectedPlu !== null) params.plu = String(selectedPlu);
    return params;
  }, [selectedGroups, selectedPlu]);

  const { data, isLoading, error } = useReportData({
    endpoint: '/reports/product-sales',
    token,
    period,
    customStartDate,
    customEndDate,
    additionalParams,
  });

  useEffect(() => {
    const fetchGroups = async () => {
      setGroupsLoading(true);
      try {
        const res = await axios.get(`${getApiUrl()}/reports/product-groups`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGroups(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setGroupsLoading(false);
      }
    };
    if (token) fetchGroups();
  }, [token]);

  useEffect(() => {
      const groupIdParam = searchParams.get('group_id');
      if (groupIdParam) {
          const gid = parseInt(groupIdParam);
          if (!isNaN(gid)) setSelectedGroups([gid]);
          setActiveTab('products');
      }
  }, [searchParams]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const filteredData = (data || []).filter((item: any) => {
    const q = searchQuery.toLowerCase();
    return item.product_name?.toLowerCase().includes(q) || item.plu?.toString().includes(q);
  });

  const sortedData = [...filteredData].sort((a, b) => {
    const aVal = sortBy === 'total' ? a.total : sortBy === 'quantity' ? a.quantity : sortBy === 'pct_total' ? (totalSales > 0 ? a.total / totalSales : 0) : (totalQty > 0 ? a.quantity / totalQty : 0);
    const bVal = sortBy === 'total' ? b.total : sortBy === 'quantity' ? b.quantity : sortBy === 'pct_total' ? (totalSales > 0 ? b.total / totalSales : 0) : (totalQty > 0 ? b.quantity / totalQty : 0);
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const totalSales = filteredData.reduce((acc: number, curr: any) => acc + curr.total, 0);
  const totalQty = filteredData.reduce((acc: number, curr: any) => acc + curr.quantity, 0);
  const groupAgg = useMemo(() => {
    const m = new Map<number, { name: string; total: number; qty: number }>();
    filteredData.forEach((it: any) => {
      const gid = it.group_id ?? -1;
      const name = it.group_name ?? 'Diğer';
      const prev = m.get(gid) || { name, total: 0, qty: 0 };
      prev.total += it.total || 0;
      prev.qty += it.quantity || 0;
      m.set(gid, prev);
    });
    const arr = Array.from(m.entries()).map(([id, v]) => ({ id, ...v }));
    arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [filteredData]);

  const exportCSV = () => {
    const rows = [
      ['product_name', 'group_name', 'plu', 'quantity', 'total', 'pct_total', 'pct_qty'],
      ...sortedData.map((it: any) => [
        it.product_name,
        it.group_name ?? '',
        it.plu ?? '',
        it.quantity ?? 0,
        it.total ?? 0,
        totalSales > 0 ? ((it.total / totalSales) * 100).toFixed(2) : '0',
        totalQty > 0 ? ((it.quantity / totalQty) * 100).toFixed(2) : '0',
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-sales-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans safe-bottom">
      <ReportHeader
        title={"Ürün Satış Raporu"}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6" style={{ paddingTop: 'calc(120px + env(safe-area-inset-top))' }}>
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-semibold text-gray-700">Ürün Grubu</span>
            </div>
            {selectedGroups.length > 0 && (
              <button
                onClick={() => setSelectedGroups([])}
                className="text-xs px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Temizle
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setSelectedGroups([])}
              className={clsx(
                "px-3 py-1.5 rounded-xl text-sm border",
                selectedGroups.length === 0 ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-200"
              )}
            >
              Tümü
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setSelectedGroups((prev) => {
                    if (prev.includes(g.id)) return prev.filter((x) => x !== g.id);
                    return [...prev, g.id];
                  });
                }}
                className={clsx(
                  "px-3 py-1.5 rounded-xl text-sm border whitespace-nowrap",
                  selectedGroups.includes(g.id) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-200"
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
              >
                <option value="total">Tutar</option>
                <option value="quantity">Adet</option>
                <option value="pct_total">Tutar %</option>
                <option value="pct_qty">Adet %</option>
              </select>
              <button
                onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
                className="px-2 py-1.5 rounded-lg border border-gray-200"
              >
                <ArrowUpDown className="w-4 h-4 text-gray-600" />
              </button>
              {selectedPlu !== null && (
                <button
                  onClick={() => setSelectedPlu(null)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                >
                  Ürün filtresini temizle (PLU {selectedPlu})
                </button>
              )}
            </div>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm"
            >
              <Download className="w-4 h-4" />
              Dışa Aktar (CSV)
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-8 animate-pulse">
              <div className="h-4 bg-white/30 rounded w-32 mx-auto mb-3"></div>
              <div className="h-12 bg-white/40 rounded w-48 mx-auto mb-4"></div>
              <div className="h-3 bg-white/20 rounded w-24 mx-auto"></div>
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-3xl p-5 shadow-lg animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-20"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error || !data || data.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{error ? `Error: ${error.message}` : t('period_no_sales_products')}</p>
            {error && (
              <details className="mt-4 text-left max-w-md mx-auto bg-red-50 p-4 rounded-lg">
                <summary className="cursor-pointer text-red-700 font-medium">Debug Info</summary>
                <pre className="mt-2 text-xs text-red-600 overflow-auto">{JSON.stringify(error, null, 2)}</pre>
              </details>
            )}
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-3xl p-8 text-center text-white shadow-2xl">
              <p className="text-blue-100 text-sm font-bold mb-3">💰 {t('total_sales')}</p>
              <AutoFitText
                text={formatCurrency(totalSales)}
                className="font-black tracking-tight drop-shadow-lg"
                maxPx={48}
                minPx={24}
              />
              <p className="text-blue-200 text-base mt-4 font-semibold">{totalQty} {t('total_products')}</p>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <input
                type="text"
                placeholder={t('search_product')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-3">
              <div className="bg-white rounded-3xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-gray-900">Gruplar</div>
                  <div className="text-sm text-gray-500">{groupAgg.length} grup</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(selectedGroups.length > 0 ? groupAgg.filter(g => selectedGroups.includes(g.id)) : groupAgg.slice(0, 6)).map((g, i) => (
                    <div key={g.id} className="border rounded-xl p-3">
                      <div className="text-sm font-semibold text-gray-800">{g.name || 'Diğer'}</div>
                      <div className="text-xs text-gray-500">{g.qty} adet</div>
                      <div className="text-sm font-bold text-gray-900">{formatCurrency(g.total)}</div>
                      <div className="mt-1 h-1.5 bg-gray-200 rounded">
                        <div
                          className="h-1.5 bg-indigo-600 rounded"
                          style={{ width: `${totalSales > 0 ? Math.min(100, (g.total / totalSales) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {sortedData.map((item: any, index: number) => (
                <div key={index} className="bg-white rounded-3xl p-5 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3
                        className="font-bold text-gray-900 cursor-pointer hover:text-indigo-700"
                        onClick={() => setSelectedPlu(item.plu ?? null)}
                        title={item.plu ? `PLU ${item.plu} ile filtrele` : undefined}
                      >
                        {item.product_name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {item.quantity} {t('pieces')} • Tutar % {(totalSales > 0 ? ((item.total / totalSales) * 100) : 0).toFixed(1)} • Adet % {(totalQty > 0 ? ((item.quantity / totalQty) * 100) : 0).toFixed(1)}
                      </p>
                      <div className="mt-2 h-2 bg-gray-200 rounded">
                        <div
                          className="h-2 bg-indigo-600 rounded"
                          style={{ width: `${totalSales > 0 ? Math.min(100, (item.total / totalSales) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(item.total)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function ProductSalesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
      <ProductSalesContent />
    </Suspense>
  );
}
