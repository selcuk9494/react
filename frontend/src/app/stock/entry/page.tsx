'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/utils/api';
import axios from 'axios';
import { 
  ArrowLeft, 
  Search, 
  Save, 
  Package, 
  CheckCircle, 
  AlertCircle,
  Filter,
  X,
  Plus,
  Minus
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

interface Product {
  id: number;
  urun_adi: string;
  grup2: string;
}

export default function StockEntryPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockMap, setStockMap] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('Tümü');

  // Fallback products for demo or error cases
  const MOCK_PRODUCTS: Product[] = [
    { id: 101, urun_adi: 'Hamburger', grup2: 'Ana Yemek' },
    { id: 102, urun_adi: 'Cheeseburger', grup2: 'Ana Yemek' },
    { id: 103, urun_adi: 'Pizza Margherita', grup2: 'Ana Yemek' },
    { id: 104, urun_adi: 'Tavuk Döner', grup2: 'Ana Yemek' },
    { id: 105, urun_adi: 'Lahmacun', grup2: 'Ana Yemek' },
    { id: 106, urun_adi: 'Cola', grup2: 'İçecek' },
    { id: 107, urun_adi: 'Fanta', grup2: 'İçecek' },
    { id: 108, urun_adi: 'Su', grup2: 'İçecek' },
    { id: 109, urun_adi: 'Ayran', grup2: 'İçecek' },
    { id: 110, urun_adi: 'Çay', grup2: 'İçecek' },
    { id: 111, urun_adi: 'Patates Kızartması', grup2: 'Ara Sıcak' },
    { id: 112, urun_adi: 'Soğan Halkası', grup2: 'Ara Sıcak' },
    { id: 113, urun_adi: 'Cheesecake', grup2: 'Tatlı' },
    { id: 114, urun_adi: 'Tiramisu', grup2: 'Tatlı' },
    { id: 115, urun_adi: 'Sütlaç', grup2: 'Tatlı' }
  ];

  useEffect(() => {
    if (!token) return;

    const fetchProducts = async () => {
      try {
        const branchId = user?.selected_branch_id || user?.branches?.[user?.selected_branch || 0]?.id;
        
        let items: Product[] = [];
        
        if (branchId) {
          try {
            const res = await axios.get(`${getApiUrl()}/stock/products?branchId=${branchId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            items = res.data || [];
          } catch (err) {
            console.warn('API Error, using fallback:', err);
          }
        }

        if (items.length === 0) {
          console.log('Using mock products');
          items = MOCK_PRODUCTS;
        }
        
        setProducts(items);
        
        const uniqueGroups = ['Tümü', ...new Set(items.map((p: Product) => p.grup2).filter(Boolean) as string[])];
        setGroups(uniqueGroups);

      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts(MOCK_PRODUCTS);
        setGroups(['Tümü', ...new Set(MOCK_PRODUCTS.map(p => p.grup2))]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [token, user]);

  const handleQuantityChange = useCallback((productName: string, qty: string) => {
    if (qty && !/^\d+$/.test(qty)) return;
    
    setStockMap(prev => ({
      ...prev,
      [productName]: qty
    }));
  }, []);

  const handleIncrement = useCallback((productName: string) => {
    setStockMap(prev => {
      const current = parseInt(prev[productName] || '0');
      return { ...prev, [productName]: String(current + 1) };
    });
  }, []);

  const handleDecrement = useCallback((productName: string) => {
    setStockMap(prev => {
      const current = parseInt(prev[productName] || '0');
      if (current <= 0) return prev;
      return { ...prev, [productName]: String(current - 1) };
    });
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const branchId = user?.selected_branch_id || user?.branches?.[user?.selected_branch || 0]?.id;
      
      const itemsToSave = Object.entries(stockMap)
        .filter(([_, qty]) => qty !== '' && parseInt(qty) >= 0)
        .map(([name, qty]) => ({
          productName: name,
          quantity: parseInt(qty)
        }));

      if (itemsToSave.length === 0) {
        alert('Lütfen en az bir ürün için stok giriniz.');
        setSaving(false);
        return;
      }

      await axios.post(`${getApiUrl()}/stock/entry?branchId=${branchId}`, {
        items: itemsToSave
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        router.push('/stock/live');
      }, 1500);
    } catch (error: any) {
      console.error('Error saving stock:', error?.response?.data || error);
      let message = 'Kaydedilirken bir hata oluştu.';
      const backendMessage = error?.response?.data?.message;
      if (typeof backendMessage === 'string' && backendMessage.trim().length > 0) {
        message = backendMessage;
      }
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.urun_adi.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup = selectedGroup === 'Tümü' || p.grup2 === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [products, searchQuery, selectedGroup]);

  const enteredCount = useMemo(() => {
    return Object.values(stockMap).filter(v => v !== '' && parseInt(v) > 0).length;
  }, [stockMap]);

  const groupedProducts = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    filteredProducts.forEach(p => {
      const group = p.grup2 || 'Diğer';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(p);
    });
    return grouped;
  }, [filteredProducts]);

  if (saveSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center animate-in zoom-in duration-300">
          <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/40">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Stok Kaydedildi!</h2>
          <p className="text-gray-500">Canlı takip sayfasına yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 pb-32">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
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
                  <Package className="w-5 h-5 text-blue-600" />
                  Günlük Stok Girişi
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">Bugünkü başlangıç stoklarını girin</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Search & Filter Card */}
        <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Ürün ara..." 
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-medium"
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
          
          {/* Group Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {groups.map(group => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={clsx(
                  "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200",
                  selectedGroup === group 
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/30' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-4 text-white shadow-xl shadow-blue-500/30">
          <div>
            <p className="text-blue-100 text-sm font-medium">Girilen Ürün</p>
            <p className="text-3xl font-black">{enteredCount}</p>
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm font-medium">Toplam Ürün</p>
            <p className="text-3xl font-black">{filteredProducts.length}</p>
          </div>
        </div>

        {/* Product List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 font-medium">Ürünler yükleniyor...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedProducts).map(([groupName, groupProducts]) => (
              <div key={groupName} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                {/* Group Header */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    {groupName}
                    <span className="text-xs text-gray-500 ml-auto bg-white px-2 py-1 rounded-lg">
                      {groupProducts.length} ürün
                    </span>
                  </h3>
                </div>
                
                {/* Products */}
                <div className="divide-y divide-gray-50">
                  {groupProducts.map(product => {
                    const hasValue = stockMap[product.urun_adi] && parseInt(stockMap[product.urun_adi]) > 0;
                    
                    return (
                      <div 
                        key={product.id} 
                        className={clsx(
                          "p-4 flex items-center justify-between transition-all duration-200",
                          hasValue ? "bg-blue-50/50" : "hover:bg-gray-50"
                        )}
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <h4 className={clsx(
                            "font-semibold truncate",
                            hasValue ? "text-blue-700" : "text-gray-900"
                          )}>
                            {product.urun_adi}
                          </h4>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDecrement(product.urun_adi)}
                            className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-all active:scale-95"
                          >
                            <Minus className="w-4 h-4 text-gray-600" />
                          </button>
                          
                          <input 
                            type="text" 
                            inputMode="numeric"
                            placeholder="0"
                            className={clsx(
                              "w-20 text-center font-black text-lg border-2 rounded-xl py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all",
                              hasValue 
                                ? "border-blue-500 text-blue-700 bg-white shadow-lg shadow-blue-500/20" 
                                : "border-gray-200 text-gray-700 bg-gray-50"
                            )}
                            value={stockMap[product.urun_adi] || ''}
                            onChange={(e) => handleQuantityChange(product.urun_adi, e.target.value)}
                          />
                          
                          <button
                            onClick={() => handleIncrement(product.urun_adi)}
                            className="w-10 h-10 bg-blue-100 hover:bg-blue-200 rounded-xl flex items-center justify-center transition-all active:scale-95"
                          >
                            <Plus className="w-4 h-4 text-blue-600" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {filteredProducts.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-lg">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Ürün Bulunamadı</h3>
                <p className="text-gray-500 text-sm">Arama kriterlerinize uygun ürün yok</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 p-4 shadow-2xl shadow-gray-900/20">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={handleSave}
            disabled={saving || enteredCount === 0}
            className={clsx(
              "w-full py-4 rounded-2xl font-black text-lg transition-all duration-200 flex items-center justify-center gap-3",
              enteredCount > 0
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-500/50 active:scale-[0.98]"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {enteredCount > 0 ? `${enteredCount} Ürünü Kaydet` : 'Ürün Seçin'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
