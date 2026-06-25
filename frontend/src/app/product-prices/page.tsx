'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { getApiUrl } from '@/utils/api';
import clsx from 'clsx';
import Link from 'next/link';
import { ArrowLeft, Search, RefreshCw, Tag, X, Plus, Save, Edit2 } from 'lucide-react';

type PriceItem = {
  id: number;
  urun_adi: string;
  grup2: string;
  kitchen_printer_id?: number | null;
  fiyat: number | null;
  onceki_fiyat?: number | null;
};

type KitchenPrinter = {
  id: number;
  name: string;
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
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PriceItem | null>(null);
  const [kitchenPrinters, setKitchenPrinters] = useState<KitchenPrinter[]>([]);
  const [productForm, setProductForm] = useState({
    product_name: '',
    group_name: '',
    price: '',
    kitchen_printer_id: '',
  });
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const initialPriceMapRef = useRef<Record<string, string>>({});

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

  const draftKey = useMemo(() => {
    const uid =
      user?.email
        ? String(user.email).trim().toLowerCase()
        : user?.id
          ? String(user.id)
          : 'unknown';
    const bid = branchId ? String(branchId) : 'unknown';
    return `product_prices_draft:${uid}:${bid}`;
  }, [user, branchId]);

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
        const url = `${getApiUrl()}/stock/product-prices?branchId=${branchId}`;
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
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
        initialPriceMapRef.current = nextMap;
        let merged = { ...nextMap };
        try {
          if (typeof window !== 'undefined') {
            const legacyKeyById = `product_prices_draft:${user?.id ? String(user.id) : 'unknown'}:${branchId ? String(branchId) : 'unknown'}`;
            const legacyKeyUnknown = `product_prices_draft:unknown:${branchId ? String(branchId) : 'unknown'}`;
            const tryKeys = [draftKey, legacyKeyById, legacyKeyUnknown];
            for (const key of tryKeys) {
              const raw = window.localStorage.getItem(key);
              if (!raw) continue;
              const parsed = JSON.parse(raw);
              const draftPrices =
                parsed?.prices && typeof parsed.prices === 'object'
                  ? parsed.prices
                  : null;
              if (!draftPrices) continue;
              for (const [k, v] of Object.entries(draftPrices)) {
                if (Object.prototype.hasOwnProperty.call(merged, k)) {
                  merged[k] = String(v ?? '');
                }
              }
              if (key !== draftKey) {
                try {
                  window.localStorage.setItem(
                    draftKey,
                    JSON.stringify({ updatedAt: Date.now(), prices: draftPrices }),
                  );
                  window.localStorage.removeItem(key);
                } catch {}
              }
              break;
            }
          }
        } catch {}
        setPriceMap(merged);
      } catch (e: any) {
        const status = e?.response?.status;
        const message = e?.response?.data?.message;
        const extra =
          typeof e?.response?.data === 'string'
            ? `: ${e.response.data.slice(0, 200)}`
            : '';
        alert(
          status
            ? `Fiyat listesi alınamadı (${status})${message ? `: ${message}` : ''}${extra}`
            : 'Fiyat listesi alınamadı.',
        );
      } finally {
        setLoadingList(false);
        setRefreshing(false);
      }
    },
    [token, branchId, canEditPrices, draftKey, user?.id, user?.email],
  );

  useEffect(() => {
    if (!token) return;
    if (!canEditPrices) return;
    loadPrices(false);
  }, [token, canEditPrices, loadPrices]);

  const loadKitchenPrinters = useCallback(async () => {
    if (!token || !branchId || !canEditPrices) return;
    try {
      const res = await axios.get(`${getApiUrl()}/stock/kitchen-printers?branchId=${branchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setKitchenPrinters(res.data || []);
    } catch (e) {
      console.error(e);
      setKitchenPrinters([]);
    }
  }, [token, branchId, canEditPrices]);

  useEffect(() => {
    loadKitchenPrinters();
  }, [loadKitchenPrinters]);

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

  const changedItems = useMemo(() => {
    const base = initialPriceMapRef.current || {};
    const changes: Array<{ plu: number; fiyat: number }> = [];
    for (const p of items) {
      const key = String(p.id);
      const currentRaw = (priceMap[key] ?? '').trim();
      const baseRaw = (base[key] ?? '').trim();
      if (currentRaw === baseRaw) continue;
      if (currentRaw === '') continue;
      const val = Number(currentRaw);
      if (!Number.isFinite(val) || val < 0) continue;
      changes.push({ plu: p.id, fiyat: val });
    }
    return changes;
  }, [items, priceMap]);

  const saveDraft = useCallback(() => {
    if (!canEditPrices) return;
    if (!draftKey) return;
    if (typeof window === 'undefined') return;
    try {
      const base = initialPriceMapRef.current || {};
      const prices: Record<string, string> = {};
      for (const [k, v] of Object.entries(priceMap)) {
        const cur = String(v ?? '').trim();
        const prev = String(base[k] ?? '').trim();
        if (cur && cur !== prev) prices[k] = cur;
      }
      if (Object.keys(prices).length === 0) {
        alert('Taslağa kaydedilecek değişiklik yok.');
        return;
      }
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ updatedAt: Date.now(), prices }),
      );
      alert('Taslak kaydedildi.');
    } catch {
      alert('Taslak kaydedilemedi.');
    }
  }, [canEditPrices, draftKey, priceMap]);

  const focusNextInput = useCallback((productId: number) => {
    const ids = filtered.map((p) => p.id);
    const idx = ids.indexOf(productId);
    const nextId = idx >= 0 ? ids[idx + 1] : null;
    if (!nextId) return;
    const el = inputRefs.current[String(nextId)];
    if (!el) return;
    el.focus();
    el.select();
  }, [filtered]);

  const saveAll = useCallback(async () => {
    if (!token) return;
    if (!branchId) return;
    if (!canEditPrices) return;
    if (changedItems.length === 0) return;

    try {
      setSaving(true);
      const url = `${getApiUrl()}/stock/product-prices?branchId=${branchId}`;
      await axios.put(
        url,
        { items: changedItems },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(draftKey);
        }
      } catch {}
      await loadPrices(true);
      alert('Fiyatlar başarıyla gönderildi.');
    } catch (e: any) {
      const status = e?.response?.status;
      const message = e?.response?.data?.message;
      alert(
        status
          ? `Fiyatlar güncellenemedi (${status})${message ? `: ${message}` : ''}`
          : 'Fiyatlar güncellenemedi.',
      );
    } finally {
      setSaving(false);
    }
  }, [token, branchId, canEditPrices, changedItems, loadPrices]);

  const resetProductForm = useCallback(() => {
    setProductForm({
      product_name: '',
      group_name: '',
      price: '',
      kitchen_printer_id: '',
    });
    setEditingProduct(null);
  }, []);

  const openCreateForm = useCallback(() => {
    resetProductForm();
    setCreateOpen((v) => !v);
  }, [resetProductForm]);

  const openEditForm = useCallback((product: PriceItem) => {
    setEditingProduct(product);
    setProductForm({
      product_name: product.urun_adi || '',
      group_name: product.grup2 || '',
      price:
        typeof product.fiyat === 'number'
          ? String(product.fiyat)
          : product.fiyat === null
            ? ''
            : String(product.fiyat),
      kitchen_printer_id: product.kitchen_printer_id ? String(product.kitchen_printer_id) : '',
    });
    setCreateOpen(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const saveProductForm = useCallback(async () => {
    if (!token || !branchId || !canEditPrices) return;
    const productName = productForm.product_name.trim();
    const groupName = productForm.group_name.trim();
    const price = Number(productForm.price.replace(',', '.'));
    const kitchenPrinterId = Number(productForm.kitchen_printer_id);

    if (!productName || !groupName || !Number.isFinite(kitchenPrinterId) || kitchenPrinterId <= 0 || !Number.isFinite(price) || price < 0) {
      alert('Ürün adı, grubu, fiyatı ve mutfak yazıcısı zorunludur.');
      return;
    }

    try {
      setCreatingProduct(true);
      const payload = {
        product_name: productName,
        group_name: groupName,
        price,
        kitchen_printer_id: kitchenPrinterId,
        ...(editingProduct ? { plu: editingProduct.id } : {}),
      };
      await axios[editingProduct ? 'put' : 'post'](
        `${getApiUrl()}/stock/product?branchId=${branchId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      resetProductForm();
      setCreateOpen(false);
      await loadPrices(true);
      alert(editingProduct ? 'Ürün güncellendi.' : 'Ürün eklendi.');
    } catch (e: any) {
      const status = e?.response?.status;
      const message = e?.response?.data?.message;
      alert(
        status
          ? `Ürün kaydedilemedi (${status})${message ? `: ${message}` : ''}`
          : 'Ürün kaydedilemedi.',
      );
    } finally {
      setCreatingProduct(false);
    }
  }, [token, branchId, canEditPrices, productForm, editingProduct, resetProductForm, loadPrices]);

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
            <div className="flex items-center gap-2">
              {canEditPrices && (
                <button
                  onClick={openCreateForm}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white transition-all active:scale-95 font-black text-sm inline-flex items-center gap-2"
                  title="Ürün ekle"
                >
                  <Plus className="w-4 h-4" />
                  Ürün Ekle
                </button>
              )}
              <button
                onClick={() => loadPrices(true)}
                disabled={refreshing}
                className={clsx(
                  'px-4 py-2.5 hover:bg-emerald-50 rounded-xl text-emerald-700 transition-all active:scale-95 disabled:opacity-50 font-black text-sm inline-flex items-center gap-2',
                )}
                title="Şubeden ürünleri çek"
              >
                <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
                Şubeden ürünleri çek
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {!canEditPrices && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 font-bold">
            Bu alanı görüntüleme yetkiniz yok. Admin panelden "Ürün Fiyatları" yetkisini açın.
          </div>
        )}

        {canEditPrices && createOpen && (
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-emerald-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-gray-900">
                  {editingProduct ? 'Ürünü Düzenle' : 'Yeni Ürün'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Ürün adı, grubu, fiyatı ve mutfak yazıcısı zorunludur.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  resetProductForm();
                }}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                className="border border-gray-200 rounded-xl px-3 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Ürün adı"
                value={productForm.product_name}
                onChange={(e) => setProductForm((p) => ({ ...p, product_name: e.target.value }))}
              />
              <input
                className="border border-gray-200 rounded-xl px-3 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Grup"
                list="product-groups"
                value={productForm.group_name}
                onChange={(e) => setProductForm((p) => ({ ...p, group_name: e.target.value }))}
              />
              <datalist id="product-groups">
                {groups.filter((g) => g !== 'Tümü').map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
              <input
                className="border border-gray-200 rounded-xl px-3 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Fiyat"
                inputMode="decimal"
                value={productForm.price}
                onChange={(e) => {
                  const normalized = e.target.value.replace(',', '.');
                  if (normalized !== '' && !/^\d*(\.\d{0,2})?$/.test(normalized)) return;
                  setProductForm((p) => ({ ...p, price: normalized }));
                }}
              />
              <select
                className="border border-gray-200 rounded-xl px-3 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                value={productForm.kitchen_printer_id}
                onChange={(e) => setProductForm((p) => ({ ...p, kitchen_printer_id: e.target.value }))}
              >
                <option value="">Mutfak yazıcısı seç</option>
                {kitchenPrinters.map((printer) => (
                  <option key={printer.id} value={printer.id}>
                    {printer.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveProductForm}
                disabled={creatingProduct}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-sm inline-flex items-center gap-2 disabled:opacity-60"
              >
                {creatingProduct ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingProduct ? 'Ürünü Güncelle' : 'Ürünü Kaydet'}
              </button>
            </div>
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
                        <button
                          type="button"
                          onClick={() => openEditForm(p)}
                          disabled={!canEditPrices || saving}
                          className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-50"
                          title="Ürünü düzenle"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
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
                              focusNextInput(p.id);
                            }
                          }}
                          inputMode="decimal"
                          className="w-24 text-right font-black text-lg border-2 rounded-xl py-2 px-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all border-gray-200 text-gray-900 bg-gray-50 disabled:opacity-60"
                          placeholder="0"
                          disabled={!canEditPrices || saving}
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

      {canEditPrices && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 p-4 shadow-2xl shadow-gray-900/20">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="text-sm font-black text-gray-700">
              {changedItems.length} değişiklik
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveDraft}
                disabled={saving}
                className={clsx(
                  'px-4 py-3 rounded-2xl font-black text-sm transition-all active:scale-[0.98] shadow-lg border',
                  saving
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed border-gray-200'
                    : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50',
                )}
              >
                Taslak olarak kayıt et
              </button>
              <button
                onClick={saveAll}
                disabled={saving || changedItems.length === 0}
                className={clsx(
                  'px-5 py-3 rounded-2xl font-black text-sm transition-all active:scale-[0.98] shadow-lg',
                  saving || changedItems.length === 0
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/30 hover:shadow-xl',
                )}
              >
                Fiyat Gönder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
