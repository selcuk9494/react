'use client';

import React, { useState, Suspense, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSearchParams } from 'next/navigation';
import { ShoppingBag, Search, Package, TrendingUp, DollarSign, Layers } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import { useReportData } from '@/utils/useReportData';
import clsx from 'clsx';
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
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'groups'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'total' | 'quantity'>('total');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const additionalParams = useMemo(() => {
    return selectedGroup ? { group_id: selectedGroup } : {};
  }, [selectedGroup]);

  const { data, isLoading, error } = useReportData({
    endpoint: '/reports/product-sales',
    token,
    period,
    customStartDate,
    customEndDate,
    additionalParams,
  });

  // Debug log
  useEffect(() => {
    console.log('Product Sales Data:', { data, isLoading, error, period, selectedGroup });
  }, [data, isLoading, error, period, selectedGroup]);

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
          setSelectedGroup(parseInt(groupIdParam));
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
    const aVal = sortBy === 'total' ? a.total : a.quantity;
    const bVal = sortBy === 'total' ? b.total : b.quantity;
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const totalSales = filteredData.reduce((acc: number, curr: any) => acc + curr.total, 0);
  const totalQty = filteredData.reduce((acc: number, curr: any) => acc + curr.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans safe-bottom">
      <ReportHeader
        title={t('product_sales_title')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6" style={{ paddingTop: 'calc(120px + env(safe-area-inset-top))' }}>
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
              <h2 className="text-5xl font-black tracking-tight drop-shadow-lg">{formatCurrency(totalSales)}</h2>
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
              {sortedData.map((item: any, index: number) => (
                <div key={index} className="bg-white rounded-3xl p-5 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">{item.quantity} {t('pieces')}</p>
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
