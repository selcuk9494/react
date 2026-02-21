
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/utils/api';
import axios from 'axios';
import { ArrowLeft, Search, Save, Package } from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: number;
  urun_adi: string;
  grup2: string;
}

interface StockItem {
  product_name: string;
  quantity: string;
}

export default function StockEntryPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockMap, setStockMap] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('Tümü');

  // Fallback products for demo or error cases
  const MOCK_PRODUCTS: Product[] = [
    { id: 101, urun_adi: 'Hamburger', grup2: 'Ana Yemek' },
    { id: 102, urun_adi: 'Cheeseburger', grup2: 'Ana Yemek' },
    { id: 103, urun_adi: 'Pizza Margherita', grup2: 'Ana Yemek' },
    { id: 104, urun_adi: 'Cola', grup2: 'İçecek' },
    { id: 105, urun_adi: 'Fanta', grup2: 'İçecek' },
    { id: 106, urun_adi: 'Su', grup2: 'İçecek' },
    { id: 107, urun_adi: 'Patates Kızartması', grup2: 'Ara Sıcak' },
    { id: 108, urun_adi: 'Soğan Halkası', grup2: 'Ara Sıcak' },
    { id: 109, urun_adi: 'Cheesecake', grup2: 'Tatlı' },
    { id: 110, urun_adi: 'Tiramisu', grup2: 'Tatlı' }
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

        // If items empty, use mock products (especially for Demo)
        if (items.length === 0) {
            console.log('Using mock products');
            items = MOCK_PRODUCTS;
        }
        
        setProducts(items);
        
        // Extract groups
        const uniqueGroups = ['Tümü', ...new Set(items.map((p: Product) => p.grup2).filter(Boolean) as string[])];
        setGroups(uniqueGroups);

      } catch (error) {
        console.error('Error fetching products:', error);
        // Ensure at least mock products are shown on critical error
        setProducts(MOCK_PRODUCTS);
        setGroups(['Tümü', ...new Set(MOCK_PRODUCTS.map(p => p.grup2))]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [token, user]);

  const handleQuantityChange = (productName: string, qty: string) => {
    // Only allow numbers
    if (qty && !/^\d+$/.test(qty)) return;
    
    setStockMap(prev => ({
      ...prev,
      [productName]: qty
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const branchId = user?.selected_branch_id || user?.branches?.[user?.selected_branch || 0]?.id;
      
      const itemsToSave = Object.entries(stockMap)
        .filter(([_, qty]) => qty !== '' && parseInt(qty) >= 0)
        .map(([name, qty]) => ({
          productName: name, // Fixed: match backend expectation (productName)
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

      alert('Stok girişi başarıyla kaydedildi.');
      setStockMap({});
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error saving stock:', error?.response?.data || error);
      let message = 'Kaydedilirken bir hata oluştu.';
      const backendMessage = error?.response?.data?.message;
      if (typeof backendMessage === 'string' && backendMessage.trim().length > 0) {
        message = backendMessage;
      } else if (Array.isArray(backendMessage) && backendMessage.length > 0) {
        message = backendMessage.join('\n');
      }
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.urun_adi.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = selectedGroup === 'Tümü' || p.grup2 === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30 px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Günlük Stok Girişi</h1>
              <p className="text-xs text-gray-500">Bugün için başlangıç stoğu girin</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Search & Filter */}
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
            
            {/* Group Filters */}
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

        {/* Product List */}
        {loading ? (
            <div className="text-center py-10">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-500">Ürünler yükleniyor...</p>
            </div>
        ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-1 divide-y divide-gray-100">
                    {filteredProducts.length > 0 ? (
                        filteredProducts.map(product => (
                            <div key={product.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                                <div>
                                    <h3 className="font-medium text-gray-900">{product.urun_adi}</h3>
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{product.grup2 || 'Diğer'}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            inputMode="numeric"
                                            placeholder="0"
                                            className={`w-20 text-center font-bold text-lg border-2 rounded-lg py-1 focus:ring-2 focus:ring-indigo-500 outline-none transition ${
                                                stockMap[product.urun_adi] ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-gray-200 text-gray-700'
                                            }`}
                                            value={stockMap[product.urun_adi] || ''}
                                            onChange={(e) => handleQuantityChange(product.urun_adi, e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p>Ürün bulunamadı.</p>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
