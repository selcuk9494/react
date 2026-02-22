'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/utils/api';
import axios from 'axios';
import { 
  ArrowLeft, 
  Search, 
  RefreshCcw, 
  Package, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Filter,
  X,
  AlertCircle,
  Bell,
  Activity
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

interface StockItem {
  name: string;
  group: string;
  initial: number;
  sold: number;
  open: number;
  cancelled: number;
  remaining: number;
  hasStockEntry?: boolean;
}

export default function LiveStockPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('Tümü');
  const [sortBy, setSortBy] = useState<'sales' | 'remaining' | 'critical'>('sales');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [showStockEntryOnly, setShowStockEntryOnly] = useState(false);
  const [criticalThreshold, setCriticalThreshold] = useState(5);
  const [connectionError, setConnectionError] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevBranchRef = useRef(user?.selected_branch);

  const fetchData = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (!token) return;
      if (showRefreshIndicator) setRefreshing(true);
      
      // Detect branch change and clear data
      if (prevBranchRef.current !== user?.selected_branch) {
        setItems([]);
        setLoading(true);
        setConnectionError(false);
        prevBranchRef.current = user?.selected_branch;
      }
      
      const branchId = user?.selected_branch_id || user?.branches?.[user?.selected_branch || 0]?.id;
      
      let dataItems: StockItem[] = [];

      if (branchId) {
        try {
          const res = await axios.get(`${getApiUrl()}/stock/live?branchId=${branchId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          dataItems = res.data.items || [];
          setConnectionError(false);
        } catch (err: any) {
          console.warn('API Error:', err);
          setConnectionError(true);
          dataItems = [];
        }
      } else {
        setConnectionError(true);
      }

      setItems(dataItems);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching live stock:', error);
      setConnectionError(true);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, user]);

  useEffect(() => {
    fetchData();
    // 5 saniyede bir güncelleme
    intervalRef.current = setInterval(() => fetchData(false), 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const handleManualRefresh = () => {
    fetchData(true);
  };

  const groups = useMemo(() => {
    return ['Tümü', ...new Set(items.map(i => i.group).filter(Boolean))];
  }, [items]);

  const criticalItems = useMemo(() => {
    return items.filter(item => item.remaining <= criticalThreshold);
  }, [items, criticalThreshold]);

  const filteredItems = useMemo(() => {
    let result = items
      .filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesGroup = selectedGroup === 'Tümü' || item.group === selectedGroup;
        const matchesCritical = !showCriticalOnly || item.remaining <= criticalThreshold;
        const matchesStockEntry = !showStockEntryOnly || item.hasStockEntry;
        return matchesSearch && matchesGroup && matchesCritical && matchesStockEntry;
      });
    
    // Sorting
    if (sortBy === 'sales') {
      result = result.sort((a, b) => (b.sold + b.open) - (a.sold + a.open));
    } else if (sortBy === 'remaining') {
      result = result.sort((a, b) => a.remaining - b.remaining);
    } else if (sortBy === 'critical') {
      result = result.sort((a, b) => {
        const aIsCritical = a.remaining <= criticalThreshold ? 0 : 1;
        const bIsCritical = b.remaining <= criticalThreshold ? 0 : 1;
        if (aIsCritical !== bIsCritical) return aIsCritical - bIsCritical;
        return a.remaining - b.remaining;
      });
    }
    
    return result;
  }, [items, searchQuery, selectedGroup, sortBy, showCriticalOnly, criticalThreshold]);

  const stats = useMemo(() => {
    const totalSold = items.reduce((sum, item) => sum + item.sold, 0);
    const totalOpen = items.reduce((sum, item) => sum + item.open, 0);
    const criticalCount = items.filter(item => item.remaining <= criticalThreshold && item.hasStockEntry).length;
    const outOfStock = items.filter(item => item.remaining <= 0 && item.hasStockEntry).length;
    const stockEntryCount = items.filter(item => item.hasStockEntry).length;
    
    return { totalSold, totalOpen, criticalCount, outOfStock, stockEntryCount };
  }, [items, criticalThreshold]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 pb-20">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link 
                href="/dashboard" 
                className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-600 transition-all active:scale-95"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-600" />
                  Canlı Stok Takip
                  {refreshing && (
                    <RefreshCcw className="w-4 h-4 animate-spin text-cyan-500" />
                  )}
                </h1>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  Her 5 saniyede güncellenir
                  {lastUpdate && (
                    <span className="ml-2 text-gray-400">
                      • Son: {lastUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Connection Status Badge */}
              <div className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all",
                loading || refreshing ? "bg-blue-50 text-blue-600 border border-blue-200" :
                connectionError ? "bg-red-50 text-red-600 border border-red-200" : 
                "bg-emerald-50 text-emerald-600 border border-emerald-200"
              )}>
                <div className={clsx(
                  "w-2 h-2 rounded-full", 
                  loading || refreshing ? "bg-blue-500 animate-ping" :
                  connectionError ? "bg-red-500" : "bg-emerald-500 animate-pulse"
                )}></div>
                <span>
                  {loading || refreshing ? 'Yükleniyor...' : connectionError ? 'Bağlantı Yok' : 'Bağlı'}
                </span>
              </div>
              <button 
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="p-2.5 bg-cyan-50 hover:bg-cyan-100 rounded-xl text-cyan-600 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCcw className={clsx("w-5 h-5", refreshing && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Connection Error Banner */}
        {connectionError && !loading && (
          <div className="bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl p-4 text-white shadow-xl shadow-red-500/30 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Şube Bağlantısı Kurulamadı</h3>
              <p className="text-red-100 text-sm">
                Şube veritabanına bağlanılamıyor. Şube kapalı olabilir veya internet bağlantınızı kontrol edin.
              </p>
            </div>
            <button
              onClick={handleManualRefresh}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-all"
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {/* Critical Alert Banner */}
        {!connectionError && stats.criticalCount > 0 && (
          <div className="bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl p-4 text-white shadow-xl shadow-red-500/30 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Kritik Stok Uyarısı!</h3>
              <p className="text-red-100 text-sm">
                {stats.outOfStock > 0 && <span className="font-bold">{stats.outOfStock} ürün tükendi! </span>}
                {stats.criticalCount} ürün kritik seviyede (≤{criticalThreshold} adet)
              </p>
            </div>
            <button
              onClick={() => {
                setShowCriticalOnly(true);
                setSortBy('critical');
              }}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-all"
            >
              Göster
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-sm text-gray-500 font-medium">Satılan</span>
            </div>
            <p className={clsx("text-2xl font-black text-emerald-600", loading && "opacity-50")}>{loading ? '...' : stats.totalSold}</p>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm text-gray-500 font-medium">Açık Sipariş</span>
            </div>
            <p className={clsx("text-2xl font-black text-amber-600", loading && "opacity-50")}>{loading ? '...' : stats.totalOpen}</p>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-sm text-gray-500 font-medium">Kritik</span>
            </div>
            <p className="text-2xl font-black text-orange-600">{stats.criticalCount}</p>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <X className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm text-gray-500 font-medium">Tükenen</span>
            </div>
            <p className="text-2xl font-black text-red-600">{stats.outOfStock}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Ürün ara..." 
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:bg-white outline-none transition-all font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>
            
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-3 bg-gray-50 border-0 rounded-xl text-gray-900 font-medium focus:ring-2 focus:ring-cyan-500 outline-none cursor-pointer"
              >
                <option value="sales">En Çok Satan</option>
                <option value="remaining">En Az Kalan</option>
                <option value="critical">Kritik Öncelikli</option>
              </select>
              
              <button
                onClick={() => setShowStockEntryOnly(!showStockEntryOnly)}
                className={clsx(
                  "px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2",
                  showStockEntryOnly 
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                <Package className="w-4 h-4" />
                <span className="hidden md:inline">Stok Girilen ({stats.stockEntryCount})</span>
              </button>
              
              <button
                onClick={() => setShowCriticalOnly(!showCriticalOnly)}
                className={clsx(
                  "px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2",
                  showCriticalOnly 
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/30" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                <Bell className="w-4 h-4" />
                <span className="hidden md:inline">Kritik</span>
              </button>
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {groups.map(group => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={clsx(
                  "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200",
                  selectedGroup === group 
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 font-medium">Veriler yükleniyor...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-lg">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Veri Bulunamadı</h3>
            <p className="text-gray-500 mb-6">Henüz stok girişi yapılmamış veya aramanızla eşleşen ürün yok.</p>
            <Link 
              href="/stock/entry" 
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:shadow-xl hover:shadow-cyan-500/30 transition-all font-bold"
            >
              Stok Girişi Yap
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ürün</th>
                      <th className="px-2 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Giriş</th>
                      <th className="px-2 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Satılan</th>
                      <th className="px-2 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Açık</th>
                      <th className="px-2 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Top.</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Kalan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredItems.map((item, idx) => {
                      const totalSold = item.sold + item.open;
                      const isOutOfStock = item.remaining <= 0 && item.hasStockEntry;
                      const isCritical = item.remaining <= criticalThreshold && item.remaining > 0 && item.hasStockEntry;
                      const isLow = item.remaining <= criticalThreshold * 2 && item.remaining > criticalThreshold && item.hasStockEntry;
                      const noStockEntry = !item.hasStockEntry;

                      return (
                        <tr 
                          key={idx} 
                          className={clsx(
                            "transition-all duration-200",
                            isOutOfStock && "bg-red-50",
                            isCritical && !isOutOfStock && "bg-orange-50",
                            noStockEntry && "bg-gray-50/50",
                            !isOutOfStock && !isCritical && !noStockEntry && "hover:bg-gray-50"
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isOutOfStock && <X className="w-4 h-4 text-red-600 flex-shrink-0" />}
                              {isCritical && <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 animate-pulse" />}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className={clsx(
                                    "font-bold text-sm truncate",
                                    isOutOfStock ? "text-red-700" : isCritical ? "text-orange-700" : noStockEntry ? "text-gray-500" : "text-gray-900"
                                  )}>
                                    {item.name}
                                  </p>
                                  {item.hasStockEntry && (
                                    <span className="px-1 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded flex-shrink-0">
                                      STOK
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 truncate">{item.group || 'Diğer'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <span className={clsx(
                              "text-sm font-semibold",
                              item.hasStockEntry ? "text-gray-600" : "text-gray-400"
                            )}>
                              {item.hasStockEntry ? item.initial : '-'}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <span className="text-sm font-bold text-emerald-600">{item.sold}</span>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <span className="text-sm font-bold text-amber-600">{item.open}</span>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <span className="text-sm font-black text-indigo-600">{totalSold}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={clsx(
                              "inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-sm font-black min-w-[2.5rem]",
                              isOutOfStock 
                                ? "bg-red-500 text-white" 
                                : isCritical 
                                ? "bg-gradient-to-r from-orange-500 to-red-500 text-white animate-pulse" 
                                : isLow
                                ? "bg-amber-100 text-amber-700 border border-amber-300"
                                : item.hasStockEntry
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                : "text-gray-400"
                            )}>
                              {item.hasStockEntry ? item.remaining : '-'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-2">
              {filteredItems.map((item, idx) => {
                const totalSold = item.sold + item.open;
                const isOutOfStock = item.remaining <= 0 && item.hasStockEntry;
                const isCritical = item.remaining <= criticalThreshold && item.remaining > 0 && item.hasStockEntry;
                const isLow = item.remaining <= criticalThreshold * 2 && item.remaining > criticalThreshold && item.hasStockEntry;
                const noStockEntry = !item.hasStockEntry;

                return (
                  <div 
                    key={idx} 
                    className={clsx(
                      "bg-white rounded-xl p-3 border shadow-sm",
                      isOutOfStock && "bg-red-50 border-red-200",
                      isCritical && !isOutOfStock && "bg-orange-50 border-orange-200",
                      noStockEntry && "bg-gray-50 border-gray-200",
                      !isOutOfStock && !isCritical && !noStockEntry && "border-gray-100"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isOutOfStock && <X className="w-4 h-4 text-red-600 flex-shrink-0" />}
                        {isCritical && <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 animate-pulse" />}
                        <div className="min-w-0">
                          <p className={clsx(
                            "font-bold text-sm truncate",
                            isOutOfStock ? "text-red-700" : isCritical ? "text-orange-700" : noStockEntry ? "text-gray-500" : "text-gray-900"
                          )}>
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-500">{item.group || 'Diğer'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.hasStockEntry && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded">STOK</span>
                        )}
                        <span className={clsx(
                          "px-3 py-1.5 rounded-lg text-base font-black min-w-[3rem] text-center",
                          isOutOfStock 
                            ? "bg-red-500 text-white" 
                            : isCritical 
                            ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" 
                            : isLow
                            ? "bg-amber-100 text-amber-700"
                            : item.hasStockEntry
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-400"
                        )}>
                          {item.hasStockEntry ? item.remaining : '-'}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs border-t border-gray-100 pt-2 mt-1">
                      <div className="text-center">
                        <span className="text-gray-500 block">Giriş</span>
                        <span className="font-bold text-gray-700">{item.hasStockEntry ? item.initial : '-'}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-gray-500 block">Satılan</span>
                        <span className="font-bold text-emerald-600">{item.sold}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-gray-500 block">Açık</span>
                        <span className="font-bold text-amber-600">{item.open}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-gray-500 block">Toplam</span>
                        <span className="font-black text-indigo-600">{totalSold}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
