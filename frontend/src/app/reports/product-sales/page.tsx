'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSearchParams } from 'next/navigation';
import { ShoppingBag, ChevronRight, Search, Package, Box, TrendingUp, DollarSign, Layers } from 'lucide-react';
import axios from 'axios';
import ReportHeader from '@/components/ReportHeader';
import { getApiUrl } from '@/utils/api';
import clsx from 'clsx';

function ProductSalesContent() {
  const { token } = useAuth();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  
  // States
  const [data, setData] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'groups'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'total' | 'quantity'>('total');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  // Initial group load
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

  // Initial params check
  useEffect(() => {
      const groupIdParam = searchParams.get('group_id');
      if (groupIdParam) {
          setSelectedGroup(parseInt(groupIdParam));
          setActiveTab('products');
      }
  }, [searchParams]);

  // Data Fetch
  useEffect(() => {
    if (!token) return;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        let url = `${getApiUrl()}/reports/product-sales?period=${period}`;
        if (period === 'custom') {
            url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
        }
        if (selectedGroup) {
            url += `&group_id=${selectedGroup}`;
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
  }, [token, period, customStartDate, customEndDate, selectedGroup]);

  // Helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const getTotalSales = () => data.reduce((sum, item) => sum + parseFloat(item.total), 0);
  const getTotalQuantity = () => data.reduce((sum, item) => sum + item.quantity, 0);
  const getAverageSales = () => data.length ? getTotalSales() / data.length : 0;
  
  const getItemPercent = (val: number) => {
      const total = getTotalSales();
      return total ? Math.round((val / total) * 100) : 0;
  };

  // Filter & Sort
  const filteredData = data
    .filter(i => (i.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
        const valA = sortBy === 'total' ? parseFloat(a.total) : a.quantity;
        const valB = sortBy === 'total' ? parseFloat(b.total) : b.quantity;
        return sortDir === 'desc' ? valB - valA : valA - valB;
    });

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <ReportHeader
        title={selectedGroup ? (groups.find(g => g.id === selectedGroup)?.name || t('products')) : t('all_products')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200">
                <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">{t('total_sales')}</p>
                <h3 className="text-2xl font-bold">{formatCurrency(getTotalSales())}</h3>
                <div className="mt-2 bg-white/20 w-8 h-8 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                </div>
            </div>
            <div className="bg-emerald-500 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200">
                <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">{t('quantity')}</p>
                <h3 className="text-2xl font-bold">{getTotalQuantity().toFixed(0)}</h3>
                <div className="mt-2 bg-white/20 w-8 h-8 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-white" />
                </div>
            </div>
            <div className="bg-amber-500 rounded-2xl p-5 text-white shadow-lg shadow-amber-200">
                <p className="text-amber-100 text-xs font-bold uppercase tracking-wider mb-1">{t('average_label')}</p>
                <h3 className="text-2xl font-bold">{formatCurrency(getAverageSales())}</h3>
                <div className="mt-2 bg-white/20 w-8 h-8 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                </div>
            </div>
            <div className="bg-rose-500 rounded-2xl p-5 text-white shadow-lg shadow-rose-200">
                <p className="text-rose-100 text-xs font-bold uppercase tracking-wider mb-1">{t('product_types')}</p>
                <h3 className="text-2xl font-bold">{data.length}</h3>
                <div className="mt-2 bg-white/20 w-8 h-8 rounded-lg flex items-center justify-center">
                    <Layers className="w-5 h-5 text-white" />
                </div>
            </div>
        </div>

        {/* Tabs & Search Row */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex space-x-1 w-full md:w-auto bg-gray-100/50 p-1 rounded-lg">
                <button
                    onClick={() => setActiveTab('groups')}
                    className={clsx(
                        "flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center space-x-2",
                        activeTab === 'groups' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:bg-gray-200/50"
                    )}
                >
                    <Box className="w-4 h-4" />
                    <span>{t('groups')}</span>
                </button>
                <button
                    onClick={() => setActiveTab('products')}
                    className={clsx(
                        "flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center space-x-2",
                        activeTab === 'products' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:bg-gray-200/50"
                    )}
                >
                    <Package className="w-4 h-4" />
                    <span>{t('products')}</span>
                </button>
            </div>

            {activeTab === 'products' && (
                <div className="flex items-center space-x-2 w-full md:w-auto">
                     {/* Search */}
                    <div className="relative flex-1 md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition"
                            placeholder={t('search_product')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    {/* Sort Buttons */}
                    <button 
                        onClick={() => {
                            if (sortBy === 'total') setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                            else { setSortBy('total'); setSortDir('desc'); }
                        }}
                        className={clsx(
                            "px-3 py-2 rounded-lg text-xs font-bold border transition flex items-center space-x-1 whitespace-nowrap",
                            sortBy === 'total' ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-gray-200 text-gray-500"
                        )}
                    >
                        <DollarSign className="w-3 h-3" />
                        <span>{t('amount')}</span>
                    </button>
                    <button 
                        onClick={() => {
                            if (sortBy === 'quantity') setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                            else { setSortBy('quantity'); setSortDir('desc'); }
                        }}
                        className={clsx(
                            "px-3 py-2 rounded-lg text-xs font-bold border transition flex items-center space-x-1 whitespace-nowrap",
                            sortBy === 'quantity' ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-gray-200 text-gray-500"
                        )}
                    >
                        <Package className="w-3 h-3" />
                        <span>{t('quantity')}</span>
                    </button>
                </div>
            )}
        </div>

        {/* Content Section */}
        {loading || groupsLoading ? (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        ) : (
            <>
                {activeTab === 'groups' ? (
                     <div className="space-y-3">
                        <button 
                             onClick={() => { setSelectedGroup(null); setActiveTab('products'); }}
                             className="w-full bg-indigo-600 text-white p-4 rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700 transition flex items-center justify-between group"
                        >
                            <span className="font-bold text-lg">{t('all_products')}</span>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        
                        {groups.map((group) => (
                            <button 
                                key={group.id}
                                onClick={() => { setSelectedGroup(group.id); setActiveTab('products'); }}
                                className="w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition flex items-center justify-between group"
                            >
                                <span className="font-bold text-gray-800 text-lg">{group.name}</span>
                                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                            </button>
                        ))}
                        
                        {groups.length === 0 && (
                            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                                <Box className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">{t('groups_not_found')}</p>
                            </div>
                        )}
                     </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredData.map((item, index) => (
                            <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition relative overflow-hidden group">
                                {/* Rank Badge */}
                                <div className="absolute top-4 left-4 w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm z-10">
                                    #{index + 1}
                                </div>
                                
                                <div className="pl-12">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-gray-900 text-base line-clamp-2 pr-2 min-h-[3rem] flex items-center">
                                            {item.product_name}
                                        </h4>
                                        <div className="text-right">
                                            <p className="font-black text-emerald-600 text-lg tracking-tight">
                                                {formatCurrency(parseFloat(item.total))}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                                        <div className="flex items-center space-x-2 text-gray-500">
                                            <Package className="w-4 h-4" />
                                            <span className="text-sm font-medium">{item.quantity.toFixed(2)} {t('quantity').toLowerCase()}</span>
                                        </div>
                                        <div className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-1 rounded-lg">
                                            %{getItemPercent(parseFloat(item.total))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {filteredData.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-gray-100">
                                <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">{t('period_no_sales_products')}</p>
                            </div>
                        )}
                    </div>
                )}
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
