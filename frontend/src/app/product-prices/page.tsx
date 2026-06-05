'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { getApiUrl } from '@/utils/api';
import clsx from 'clsx';
import Link from 'next/link';
import { ArrowLeft, Search, RefreshCw, Tag, X } from 'lucide-react';

type PriceItem = {
  id: number;
  urun_adi: string;
  grup2: string;
  fiyat: number | null;
  onceki_fiyat?: number | null;
};

export default function ProductPricesPage() {
  const { token, user, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [items, setItems] = useState<PriceItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [groups, setGroups] = useState<string[]>(['Tümü']);
  const [selectedGroup, setSelectedGroup] = useState('Tümü');
  const [priceMap, setPriceMap] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const canEditPrices = useMemo(() => {
    if (!user) return false;
    if (user.is_admin) return true;
    if (user.allowed_reports === null || user.allowed_reports === undefined) return true;
    return Array.isArray(user.allowed_reports) && user.allowed_reports.includes('product_prices');
  }, [user]);

  const branchId = useMemo(() => {
    return (
      user?.selected_branch_id ||
      user?.branches?.[user?.selected_branch || 0]?.id ||
      null
    );
  }, [user]);

  useEffect(() => {
    if (!token && !loading) {
      router.replace('/auth/login');
    }
  }, [token, loading, router]);

  const loadPrices = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (!branchId) return;
      if (!canEditPrices) return;
      try {
        if (isRefresh) setRefreshing(true);
        else setLoadingList(true);
        const res = await axios.get(
          `${getApiUrl()}/stock/product-prices?branchId=${branchId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const list = (res.data || []) as PriceItem[];
        setItems(list);
        setGroups([
          'Tümü',
          ...Array.from(
            new Set(list.map((p) => p.grup2).filter(Boolean) as string[]),
          ),
        ]);
        const nextMap: Record<string, string> = {};
        for (const p of list) {
          nextMap[String(p.id)] =
            typeof p.fiyat === 'number' ? String(p.fiyat) : p.fiyat === null ? '' : String(p.fiyat);
        }
        setPriceMap(nextMap);
      } catch (e: any) {
        const status = e?.response?.status;
        const message = e?.response?.data?.message;
        alert(
          status
            ? `Fiyat listesi alınamadı (${status})${message ? `: ${message}` : ''}`
            : 'Fiyat listesi alınamadı.',
        );
      } finally {
        setLoadingList(false);
        setRefreshing(false);
      }
    },
    [token, branchId, canEditPrices],
  );

  useEffect(() => {
    if (!token) return;
    if (!canEditPrices) return;
    loadPrices(false);
  }, [token, canEditPrices, loadPrices]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((p) => {
      const matchesSearch = !q || (p.urun_adi || '').toLowerCase().includes(q);
      const matchesGroup = selectedGroup === 'Tümü' || p.grup2 === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [items, searchQuery, selectedGroup]);

  const grouped = useMemo(() => {
    const map: Record<string, PriceItem[]> = {};
    for (const p of filtered) {
      const g = p.grup2 || 'Diğer';
      if (!map[g]) map[g] = [];
      map[g].push(p);
    }
    return map;
  }, [filtered]);

  const handlePriceChange = useCallback((productId: number, price: string) => {
    const normalized = price.replace(',', '.');
    if (normalized !== '' && !/^\d*(\.\d{0,2})?$/.test(normalized)) return;
    setPriceMap((prev) => ({ ...prev, [String(productId)]: normalized }));
  }, []);

  const savePrice = useCallback(
    async (productId: number, focusNext: boolean) => {
      if (!token) return;
      if (!branchId) return;
      if (!canEditPrices) return;

      const raw = (priceMap[String(productId)] ?? '').trim();
      if (raw === '') return;
      const val = Number(raw);
      if (!Number.isFinite(val) || val < 0) {
        alert('Geçersiz fiyat');
        return;
      }

      try {
        setSavingId(productId);
        await axios.put(
          `${getApiUrl()}/stock/product-price?branchId=${branchId}`,
          { plu: productId, fiyat: val },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (focusNext) {
          const ids = filtered.map((p) => p.id);
          const idx = ids.indexOf(productId);
          const nextId = idx >= 0 ? ids[idx + 1] : null;
          if (nextId) {
            const el = inputRefs.current[String(nextId)];
            if (el) {
              el.focus();
              el.select();
            }
          }
        }
      } catch (e: any) {
        const status = e?.response?.status;
        const message = e?.response?.data?.message;
        alert(
          status
            ? `Fiyat güncellenemedi (${status})${message ? `: ${message}` : ''}`
            : 'Fiyat güncellenemedi.',
        );
      } finally {
        setSavingId(null);
      }
    },
    [token, branchId, canEditPrices, priceMap, filtered],
  );

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 pb-20 safe-bottom">
      <div className="bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-all"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-emerald-600" />
                  {t('product_prices_title')}
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">{t('product_prices_desc')}</p>
              </div>
            </div>
            <button
              onClick={() => loadPrices(true)}
              disabled={refreshing}
              className="p-2.5 hover:bg-emerald-50 rounded-xl text-emerald-700 transition-all active:scale-95 disabled:opacity-50"
              title="Yenile"
            >
              <RefreshCw className={clsx('w-5 h-5', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {!canEditPrices && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 font-bold">
            Bu alanı görüntüleme yetkiniz yok. Admin panelden "Ürün Fiyatları" yetkisini açın.
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Ürün ara..."
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-medium"
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

          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                className={clsx(
                  'px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200',
                  selectedGroup === g
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {loadingList ? (
          <div className="text-center py-16">
            <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 font-medium">Ürünler yükleniyor...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([groupName, groupItems]) => (
              <div
                key={groupName}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
              >
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="text-sm font-black text-gray-900">{groupName}</div>
                  <div className="text-xs font-bold text-gray-500">{groupItems.length} ürün</div>
                </div>
                <div className="divide-y divide-gray-50">
                  {groupItems.map((p) => (
                    <div key={p.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-all">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="font-semibold truncate text-gray-900">{p.urun_adi}</div>
                        {typeof p.onceki_fiyat === 'number' && (
                          <div className="text-[11px] text-gray-500 font-semibold mt-0.5">
                            Önceki: {p.onceki_fiyat}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          ref={(el) => {
                            inputRefs.current[String(p.id)] = el;
                          }}
                          value={priceMap[String(p.id)] ?? ''}
                          onChange={(e) => handlePriceChange(p.id, e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              savePrice(p.id, true);
                            }
                          }}
                          onBlur={() => savePrice(p.id, false)}
                          inputMode="decimal"
                          className="w-24 text-right font-black text-lg border-2 rounded-xl py-2 px-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all border-gray-200 text-gray-900 bg-gray-50 disabled:opacity-60"
                          placeholder="0"
                          disabled={!canEditPrices || savingId === p.id}
                        />
                        <div className="text-xs font-black text-gray-500">₺</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-lg">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Ürün bulunamadı</h3>
                <p className="text-gray-500">Arama kriterlerinize uygun ürün yok.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

