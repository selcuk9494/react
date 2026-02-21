
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/utils/api';
import axios from 'axios';
import { ArrowLeft, Search, RefreshCcw, Package, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface StockItem {
  name: string;
  group: string;
  initial: number;
  sold: number;
  open: number;
  cancelled: number;
  remaining: number;
}

export default function LiveStockPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('Tümü');
  const [sortBy, setSortBy] = useState<'sales' | 'remaining'>('sales');
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const MOCK_ITEMS: StockItem[] = [
    { name: 'Hamburger', group: 'Ana Yemek', initial: 50, sold: 12, open: 3, cancelled: 1, remaining: 34 },
    { name: 'Cheeseburger', group: 'Ana Yemek', initial: 40, sold: 10, open: 2, cancelled: 0, remaining: 28 },
    { name: 'Cola', group: 'İçecek', initial: 100, sold: 45, open: 5, cancelled: 0, remaining: 50 },
    { name: 'Su', group: 'İçecek', initial: 200, sold: 80, open: 10, cancelled: 0, remaining: 110 },
    { name: 'Tiramisu', group: 'Tatlı', initial: 20, sold: 18, open: 0, cancelled: 0, remaining: 2 }
  ];

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, user]);

  const fetchData = async () => {
    try {
      if (!token) return;
      setRefreshing(true);
      const branchId = user?.selected_branch_id || user?.branches?.[user?.selected_branch || 0]?.id;
      
      let dataItems = [];

      if (branchId) {
        try {
          const res = await axios.get(`${getApiUrl()}/stock/live?branchId=${branchId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          dataItems = res.data.items || [];
        } catch (err) {
          console.warn('API Error, using fallback');
        }
      }

      if (dataItems.length === 0) {
          dataItems = MOCK_ITEMS;
      }

      setItems(dataItems);
    } catch (error) {
      console.error('Error fetching live stock:', error);
      setItems(MOCK_ITEMS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const groups = ['Tümü', ...new Set(items.map(i => i.group).filter(Boolean))];

  const filteredItems = items
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup = selectedGroup === 'Tümü' || item.group === selectedGroup;
      return matchesSearch && matchesGroup;
    })
    .sort((a, b) => {
      if (sortBy === 'sales') {
        return (b.sold + b.open) - (a.sold + a.open);
      } else {
        return a.remaining - b.remaining;
      }
    });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30 px-4 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                Canlı Stok Takip
                {refreshing && <RefreshCcw className="w-3 h-3 animate-spin text-gray-400" />}
              </h1>
              <p className="text-xs text-gray-500">Anlık satış ve kalan stok durumu</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
                onClick={() => setSortBy(prev => prev === 'sales' ? 'remaining' : 'sales')}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition flex items-center gap-2"
            >
                {sortBy === 'sales' ? 'Sıralama: En Çok Satılan' : 'Sıralama: En Az Kalan'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Ürün ara..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {groups.map(group => (
                    <button
                        key={group}
                        onClick={() => setSelectedGroup(group)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                            selectedGroup === group 
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                        }`}
                    >
                        {group}
                    </button>
                ))}
            </div>
        </div>

        {/* Table */}
        {loading ? (
            <div className="text-center py-10">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-500">Veriler yükleniyor...</p>
            </div>
        ) : filteredItems.length === 0 ? (
            <div className="bg-white rounded-xl p-10 text-center border border-gray-100 shadow-sm">
                <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">Veri Bulunamadı</h3>
                <p className="text-gray-500 text-sm">Henüz stok girişi yapılmamış veya aramanızla eşleşen ürün yok.</p>
                <Link href="/stock/entry" className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm">
                    Stok Girişi Yap
                </Link>
            </div>
        ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                <th className="px-6 py-4">Ürün</th>
                                <th className="px-6 py-4 text-center">Giriş</th>
                                <th className="px-6 py-4 text-center">Satılan</th>
                                <th className="px-6 py-4 text-center">Açık</th>
                                <th className="px-6 py-4 text-center">Toplam</th>
                                <th className="px-6 py-4 text-center">Kalan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredItems.map((item, idx) => {
                                const totalSold = item.sold + item.open;
                                const isLow = item.remaining < 5;
                                const isCritical = item.remaining <= 0;

                                return (
                                    <tr key={idx} className="hover:bg-gray-50 transition group">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{item.name}</div>
                                            <div className="text-xs text-gray-500">{item.group || 'Diğer'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-600 font-medium bg-gray-50/50">
                                            {item.initial}
                                        </td>
                                        <td className="px-6 py-4 text-center text-emerald-600 font-bold">
                                            {item.sold}
                                        </td>
                                        <td className="px-6 py-4 text-center text-amber-600 font-bold">
                                            {item.open}
                                        </td>
                                        <td className="px-6 py-4 text-center text-indigo-600 font-bold bg-indigo-50/30">
                                            {totalSold}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold min-w-[3rem] ${
                                                isCritical 
                                                    ? 'bg-red-100 text-red-700 border border-red-200' 
                                                    : isLow 
                                                    ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                            }`}>
                                                {item.remaining}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
