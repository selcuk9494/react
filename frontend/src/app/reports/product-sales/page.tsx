'use client';

import React, { useState, Suspense, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package, Layers, ArrowUpDown, ReceiptText, X, Store, Plus, ChevronDown, Check } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import {
  useSharedReportFilters,
  getBranchKasaOptions,
  getBranchKasaEntries,
  formatKasaLabel,
  getBusinessColor,
  getKasaColor,
  readStoredBusinessId,
  persistBusinessId,
  type KasaEntry,
} from '@/utils/reportFilters';
import { useReportData } from '@/utils/useReportData';
import clsx from 'clsx';
import AutoFitText from '@/components/AutoFitText';
import axios from 'axios';
import { getApiUrl } from '@/utils/api';
import ReportExportButtons from '@/components/ReportExportButtons';

/** Tablo sütunu için çoklu seçimli filtre. */
function ColMultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Seç…',
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.toLowerCase().includes(needle));
  }, [options, q]);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected.length} seçili`;

  return (
    <div ref={rootRef} className="relative w-full min-w-[7rem]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'w-full flex items-center justify-between gap-1 rounded-md border bg-white px-2 py-1 text-xs font-normal text-left',
          selected.length
            ? 'border-indigo-300 text-indigo-900'
            : 'border-slate-200 text-slate-600',
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute z-40 left-0 right-0 mt-1 min-w-[12rem] max-h-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="p-1.5 border-b border-slate-100 flex gap-1">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ara…"
              className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs"
              autoFocus
            />
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] font-semibold text-slate-600 px-1.5 rounded hover:bg-slate-100"
              >
                Temizle
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-400">Sonuç yok</p>
            ) : (
              filtered.map((opt) => {
                const on = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={clsx(
                      'w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-slate-50',
                      on && 'bg-indigo-50 text-indigo-900',
                    )}
                  >
                    <span
                      className={clsx(
                        'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                        on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300',
                      )}
                    >
                      {on && <Check className="w-2.5 h-2.5" />}
                    </span>
                    <span className="truncate">{opt || '(boş)'}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductSalesContent() {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [groups, setGroups] = useState<any[]>([]);
  const { period, setPeriod, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, kasaNo, setKasaNo } = useSharedReportFilters();
  const kasaOptions = getBranchKasaOptions(user);
  const userKasaEntries = getBranchKasaEntries(user);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [selectedPlu, setSelectedPlu] = useState<number | null>(null);
  const [selectedProductName, setSelectedProductName] = useState('');
  const [productOrders, setProductOrders] = useState<any[]>([]);
  const [productOrdersLoading, setProductOrdersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<
    'product_name' | 'group_name' | 'plu' | 'total' | 'quantity' | 'pct_total' | 'pct_qty'
  >('total');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [colFilters, setColFilters] = useState({
    product_name: [] as string[],
    group_name: [] as string[],
    plu: [] as string[],
    quantity: '',
    total: '',
    pct_total: '',
    pct_qty: '',
  });
  const [apiKasaList, setApiKasaList] = useState<KasaEntry[]>([]);
  const [kasaBreakdown, setKasaBreakdown] = useState<
    { kasa: number; total: number; qty: number; products: number }[]
  >([]);
  const [kasaBreakdownLoading, setKasaBreakdownLoading] = useState(false);
  type Biz = { id: number; name: string; group_ids: number[]; sort_order?: number };
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [businessesLoaded, setBusinessesLoaded] = useState(false);
  const [selectedBusinessId, setSelectedBusinessIdState] = useState('');
  const [showBizModal, setShowBizModal] = useState(false);
  const [draftBusinesses, setDraftBusinesses] = useState<
    { key: string; id?: number; name: string; group_ids: number[] }[]
  >([]);
  const [bizSaving, setBizSaving] = useState(false);

  useEffect(() => {
    setSelectedBusinessIdState(readStoredBusinessId());
  }, []);

  const setSelectedBusinessId = (id: string) => {
    setSelectedBusinessIdState(id);
    persistBusinessId(id);
  };

  const kasaEntries = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of [...userKasaEntries, ...apiKasaList]) {
      if (!map.has(e.kasa_no) || e.name) {
        map.set(e.kasa_no, e.name || map.get(e.kasa_no) || '');
      }
    }
    for (const n of kasaOptions || []) {
      if (!map.has(n)) map.set(n, '');
    }
    return Array.from(map.entries())
      .map(([kasa_no, name]) => ({ kasa_no, name }))
      .sort((a, b) => a.kasa_no - b.kasa_no);
  }, [userKasaEntries, apiKasaList, kasaOptions]);

  const allKasaOptions = useMemo(
    () => kasaEntries.map((e) => e.kasa_no),
    [kasaEntries],
  );

  const groupToBusinesses = useMemo(() => {
    const m = new Map<
      number,
      { businessId: number; name: string; index: number }[]
    >();
    businesses.forEach((b, index) => {
      for (const gid of b.group_ids || []) {
        const list = m.get(gid) || [];
        list.push({ businessId: b.id, name: b.name, index });
        m.set(gid, list);
      }
    });
    return m;
  }, [businesses]);

  const selectedBusiness = useMemo(
    () => businesses.find((b) => String(b.id) === String(selectedBusinessId)) || null,
    [businesses, selectedBusinessId],
  );

  const businessGroupIds = useMemo(
    () => (selectedBusiness ? [...(selectedBusiness.group_ids || [])] : []) as number[],
    [selectedBusiness],
  );

  /** İşletme seçiliyse o işletmenin grupları; değilse hepsi. */
  const visibleGroups = useMemo(() => {
    if (!selectedBusinessId || !businessesLoaded || !businessGroupIds.length) {
      if (selectedBusinessId && businessesLoaded && selectedBusiness && !businessGroupIds.length) {
        return [];
      }
      return groups;
    }
    const set = new Set(businessGroupIds);
    return groups.filter((g) => set.has(g.id));
  }, [
    groups,
    selectedBusinessId,
    businessesLoaded,
    businessGroupIds,
    selectedBusiness,
  ]);

  /** API grup filtresi: işletme + isteğe bağlı manuel grup seçimi. */
  const effectiveGroupIds = useMemo(() => {
    if (selectedBusinessId && businessesLoaded) {
      const mapped = businessGroupIds;
      if (!mapped.length) return [-1];
      if (!selectedGroups.length) return mapped;
      const intersect = selectedGroups.filter((id) => mapped.includes(id));
      return intersect.length ? intersect : mapped;
    }
    return selectedGroups;
  }, [
    selectedBusinessId,
    businessesLoaded,
    businessGroupIds,
    selectedGroups,
  ]);

  /** Birden fazla şubeye bağlı ortak gruplar (ör. DRINKS). */
  const sharedGroupIdsInFilter = useMemo(() => {
    if (!selectedBusinessId || !businessesLoaded) return [] as number[];
    return effectiveGroupIds.filter(
      (id) => (groupToBusinesses.get(id) || []).length > 1,
    );
  }, [
    selectedBusinessId,
    businessesLoaded,
    effectiveGroupIds,
    groupToBusinesses,
  ]);

  /** Tüm şubelere eşlenmiş gruplar — dışında kalan tip / null = tanımsız. */
  const allMappedGroupIds = useMemo(() => {
    const s = new Set<number>();
    for (const b of businesses) {
      for (const gid of b.group_ids || []) {
        const n = Number(gid);
        if (Number.isFinite(n)) s.add(n);
      }
    }
    return Array.from(s);
  }, [businesses]);

  /** Diğer şubelerin özel grupları (karışık siparişte tek kazanan için). */
  const rivalGroupIds = useMemo(() => {
    if (!selectedBusinessId || !businessesLoaded) return [] as number[];
    const shared = new Set(
      [...groupToBusinesses.entries()]
        .filter(([, list]) => list.length > 1)
        .map(([gid]) => gid),
    );
    const rivals = new Set<number>();
    for (const b of businesses) {
      if (String(b.id) === String(selectedBusinessId)) continue;
      for (const gid of b.group_ids || []) {
        const n = Number(gid);
        if (!Number.isFinite(n) || shared.has(n)) continue;
        rivals.add(n);
      }
    }
    return Array.from(rivals);
  }, [selectedBusinessId, businessesLoaded, businesses, groupToBusinesses]);

  const breakdownKasaOptions = allKasaOptions;
  const breakdownKasaKey = allKasaOptions.join(',');
  const effectiveGroupKey = effectiveGroupIds.join(',');
  const sharedGroupKey = sharedGroupIdsInFilter.join(',');
  const knownGroupKey = allMappedGroupIds.join(',');
  const rivalGroupKey = rivalGroupIds.join(',');

  const additionalParams = useMemo(() => {
    const params: any = {};
    if (effectiveGroupIds.length) params.group_ids = effectiveGroupKey;
    // Ortak / tanımsız: siparişte baskın şubeye yazılır (tek yerde)
    if (selectedBusinessId && businessesLoaded && effectiveGroupIds.length) {
      if (sharedGroupIdsInFilter.length) {
        params.shared_group_ids = sharedGroupKey;
      }
      if (allMappedGroupIds.length) {
        params.known_group_ids = knownGroupKey;
      }
      if (rivalGroupIds.length) {
        params.rival_group_ids = rivalGroupKey;
      }
    }
    if (selectedPlu !== null) params.plu = String(selectedPlu);
    return params;
  }, [
    effectiveGroupIds.length,
    effectiveGroupKey,
    sharedGroupIdsInFilter.length,
    sharedGroupKey,
    allMappedGroupIds.length,
    knownGroupKey,
    rivalGroupIds.length,
    rivalGroupKey,
    selectedBusinessId,
    businessesLoaded,
    selectedPlu,
  ]);

  const { data, isLoading, error } = useReportData({
    endpoint: '/reports/product-sales',
    token,
    period,
    customStartDate,
    customEndDate,
    additionalParams,
    kasaNo,
  });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${getApiUrl()}/reports/kasas`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const fromList = Array.isArray(res.data?.kasa_list)
          ? res.data.kasa_list
              .map((item: any) => ({
                kasa_no: Number(item?.kasa_no),
                name:
                  item?.name != null && String(item.name).trim()
                    ? String(item.name).trim()
                    : '',
              }))
              .filter((e: KasaEntry) => Number.isFinite(e.kasa_no) && e.kasa_no > 0)
          : [];
        if (fromList.length > 0) {
          if (!cancelled) setApiKasaList(fromList);
          return;
        }
        const list = Array.isArray(res.data?.kasas)
          ? res.data.kasas
              .map((n: any) => Number(n))
              .filter((n: number) => Number.isFinite(n) && n > 0)
              .map((kasa_no: number) => ({ kasa_no, name: '' }))
          : [];
        if (!cancelled) setApiKasaList(list);
      } catch {
        if (!cancelled) setApiKasaList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.selected_branch, user?.selected_branch_id]);

  useEffect(() => {
    const onNames = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (!Array.isArray(detail)) return;
      const list = detail
        .map((item: any) => ({
          kasa_no: Number(item?.kasa_no),
          name:
            item?.name != null && String(item.name).trim()
              ? String(item.name).trim()
              : '',
        }))
        .filter((e: KasaEntry) => Number.isFinite(e.kasa_no) && e.kasa_no > 0);
      if (list.length) setApiKasaList(list);
    };
    window.addEventListener('fr-kasa-names-updated', onNames as EventListener);
    return () =>
      window.removeEventListener('fr-kasa-names-updated', onNames as EventListener);
  }, []);

  // Tum kasalar seciliyken tek istekte kasa ozetlerini al
  useEffect(() => {
    if (!token || kasaNo || breakdownKasaKey.split(',').filter(Boolean).length < 2) {
      setKasaBreakdown([]);
      setKasaBreakdownLoading(false);
      return;
    }
    if (period === 'custom' && (!customStartDate || !customEndDate)) {
      setKasaBreakdownLoading(false);
      return;
    }
    const kasaList = breakdownKasaKey
      .split(',')
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0);
    const controller = new AbortController();
    let active = true;
    (async () => {
      setKasaBreakdownLoading(true);
      try {
        const params = new URLSearchParams({ period, by_kasa: '1' });
        if (period === 'custom') {
          params.set('start_date', customStartDate);
          params.set('end_date', customEndDate);
        }
        if (effectiveGroupKey) params.set('group_ids', effectiveGroupKey);
        if (selectedBusinessId && sharedGroupKey) {
          params.set('shared_group_ids', sharedGroupKey);
        }
        if (selectedBusinessId && knownGroupKey) {
          params.set('known_group_ids', knownGroupKey);
        }
        if (selectedBusinessId && rivalGroupKey) {
          params.set('rival_group_ids', rivalGroupKey);
        }
        const res = await axios.get(
          `${getApiUrl()}/reports/product-sales?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
            timeout: 90000,
          },
        );
        const byKasa = new Map<number, { total: number; qty: number; products: number }>();
        for (const it of Array.isArray(res.data) ? res.data : []) {
          const kasa = Number(it?.kasa);
          if (!Number.isFinite(kasa) || kasa <= 0) continue;
          byKasa.set(kasa, {
            total: Number(it.total) || 0,
            qty: Number(it.quantity) || 0,
            products: Number(it.products) || 0,
          });
        }
        const rows = kasaList.map((kasa) => {
          const row = byKasa.get(kasa);
          return {
            kasa,
            total: row?.total ?? 0,
            qty: row?.qty ?? 0,
            products: row?.products ?? 0,
          };
        });
        if (active) setKasaBreakdown(rows);
      } catch (err: any) {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
        if (active) setKasaBreakdown([]);
      } finally {
        if (active) setKasaBreakdownLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    token,
    kasaNo,
    breakdownKasaKey,
    period,
    customStartDate,
    customEndDate,
    effectiveGroupKey,
    sharedGroupKey,
    selectedBusinessId,
    knownGroupKey,
    rivalGroupKey,
  ]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await axios.get(`${getApiUrl()}/reports/product-groups`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGroups(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    if (token) fetchGroups();
  }, [token]);

  useEffect(() => {
    if (!token) {
      setBusinesses([]);
      setBusinessesLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${getApiUrl()}/reports/businesses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const list: Biz[] = (res.data?.businesses || [])
          .map((b: any, index: number) => ({
            id: Number(b.id),
            name: String(b.name || '').trim(),
            sort_order: Number(b.sort_order) || index,
            group_ids: Array.from(
              new Set(
                (Array.isArray(b.group_ids) ? b.group_ids : [])
                  .map((n: any) => Number(n))
                  .filter((n: number) => Number.isFinite(n)),
              ),
            ),
          }))
          .filter((b: Biz) => Number.isFinite(b.id) && b.name);
        if (!cancelled) {
          setBusinesses(list);
          setBusinessesLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setBusinesses([]);
          setBusinessesLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.selected_branch, user?.selected_branch_id]);

  useEffect(() => {
    if (!businessesLoaded) return;
    if (selectedBusinessId && businessGroupIds.length) {
      setSelectedGroups((prev) => {
        const same =
          prev.length === businessGroupIds.length &&
          prev.every((id, i) => id === businessGroupIds[i]);
        return same ? prev : [...businessGroupIds];
      });
      return;
    }
    if (selectedBusinessId && !businessGroupIds.length) {
      setSelectedGroups([]);
      return;
    }
    setSelectedGroups((prev) => {
      if (!prev.length) return prev;
      const allowed = new Set(visibleGroups.map((g) => g.id));
      const next = prev.filter((id) => allowed.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [selectedBusinessId, businessGroupIds, businessesLoaded, visibleGroups]);

  useEffect(() => {
      const groupIdParam = searchParams.get('group_id');
      if (groupIdParam) {
          const gid = parseInt(groupIdParam);
          if (!isNaN(gid)) setSelectedGroups([gid]);
      }
  }, [searchParams]);

  useEffect(() => {
    const fetchProductOrders = async () => {
      if (!token || selectedPlu === null) {
        setProductOrders([]);
        return;
      }
      setProductOrdersLoading(true);
      try {
        const params = new URLSearchParams({
          plu: String(selectedPlu),
          period,
        });
        if (period === 'custom') {
          if (customStartDate) params.set('start_date', customStartDate);
          if (customEndDate) params.set('end_date', customEndDate);
        }
        if (kasaNo) params.set('kasa_no', String(kasaNo));
        const res = await axios.get(
          `${getApiUrl()}/reports/product-sales/orders?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setProductOrders(res.data || []);
      } catch (e) {
        console.error(e);
        setProductOrders([]);
      } finally {
        setProductOrdersLoading(false);
      }
    };
    fetchProductOrders();
  }, [token, selectedPlu, period, customStartDate, customEndDate, kasaNo]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const asNumber = (value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const openBizModal = () => {
    setDraftBusinesses(
      businesses.length
        ? businesses.map((b) => ({
            key: `id-${b.id}`,
            id: b.id,
            name: b.name,
            group_ids: [...(b.group_ids || [])],
          }))
        : [
            { key: `new-${Date.now()}`, name: 'German Döner', group_ids: [] },
            { key: `new-${Date.now() + 1}`, name: 'Smash Burger', group_ids: [] },
            { key: `new-${Date.now() + 2}`, name: 'Sams Chicken', group_ids: [] },
          ],
    );
    setShowBizModal(true);
  };

  const addDraftBusiness = () => {
    setDraftBusinesses((prev) => [
      ...prev,
      { key: `new-${Date.now()}`, name: '', group_ids: [] },
    ]);
  };

  /** Bir ürün grubunu birden fazla şubeye bağla (toggle). */
  const assignGroupToSube = (groupId: number, bizKey: string) => {
    setDraftBusinesses((prev) =>
      prev.map((b) => {
        if (b.key !== bizKey) return b;
        const on = b.group_ids.includes(groupId);
        return {
          ...b,
          group_ids: on
            ? b.group_ids.filter((id) => id !== groupId)
            : [...b.group_ids, groupId],
        };
      }),
    );
  };

  const clearGroupSube = (groupId: number) => {
    setDraftBusinesses((prev) =>
      prev.map((b) => ({
        ...b,
        group_ids: b.group_ids.filter((id) => id !== groupId),
      })),
    );
  };

  const saveBusinesses = async () => {
    if (!token) return;
    setBizSaving(true);
    try {
      const payload = {
        businesses: draftBusinesses
          .map((b) => ({
            name: b.name.trim(),
            group_ids: b.group_ids,
          }))
          .filter((b) => b.name),
      };
      const res = await axios.put(
        `${getApiUrl()}/reports/businesses`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const list: Biz[] = (res.data?.businesses || []).map((b: any, index: number) => ({
        id: Number(b.id),
        name: String(b.name || '').trim(),
        sort_order: Number(b.sort_order) || index,
        group_ids: Array.from(
          new Set(
            (Array.isArray(b.group_ids) ? b.group_ids : [])
              .map((n: any) => Number(n))
              .filter((n: number) => Number.isFinite(n)),
          ),
        ),
      }));
      setBusinesses(list);
      setBusinessesLoaded(true);
      if (
        selectedBusinessId &&
        !list.some((b) => String(b.id) === String(selectedBusinessId))
      ) {
        setSelectedBusinessId('');
      }
      setShowBizModal(false);
    } catch (e) {
      console.error(e);
      alert('Şube tanımları kaydedilemedi.');
    } finally {
      setBizSaving(false);
    }
  };

  const openOrderDetail = (order: any) => {
    const params = new URLSearchParams({
      id: String(order.adsno),
      type: order.status || 'closed',
    });
    if (typeof order.adtur !== 'undefined' && order.adtur !== null) {
      params.set('adtur', String(order.adtur));
    }
    if (order.tarih) {
      params.set('date', String(order.tarih));
    }
    router.push(`/reports/orders/detail?${params.toString()}`);
  };

  const matchesMultiFilter = (raw: string, selected: string[]) => {
    if (!selected.length) return true;
    const v = String(raw ?? '');
    return selected.some((s) => s === v);
  };

  const filterOptions = useMemo(() => {
    const products = new Set<string>();
    const groups = new Set<string>();
    const plus = new Set<string>();
    for (const item of data || []) {
      const p = String(item?.product_name ?? '').trim();
      const g = String(item?.group_name ?? '').trim();
      const plu = String(item?.plu ?? '').trim();
      if (p) products.add(p);
      if (g) groups.add(g);
      else groups.add('');
      if (plu) plus.add(plu);
    }
    const sortTr = (a: string, b: string) =>
      a.localeCompare(b, 'tr', { sensitivity: 'base' });
    return {
      product_name: Array.from(products).sort(sortTr),
      group_name: Array.from(groups).sort(sortTr),
      plu: Array.from(plus).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)),
    };
  }, [data]);

  const matchesNumFilter = (value: number, filter: string) => {
    const f = filter.trim().replace(',', '.');
    if (!f) return true;
    // "10-50" aralık, ">10", "<10" veya düz metin/contains
    const range = f.match(/^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)$/);
    if (range) {
      const min = Number(range[1]);
      const max = Number(range[2]);
      return value >= Math.min(min, max) && value <= Math.max(min, max);
    }
    if (f.startsWith('>=')) return value >= Number(f.slice(2));
    if (f.startsWith('<=')) return value <= Number(f.slice(2));
    if (f.startsWith('>')) return value > Number(f.slice(1));
    if (f.startsWith('<')) return value < Number(f.slice(1));
    if (!Number.isNaN(Number(f)) && f !== '') {
      // sayısal eşitlik veya string contains (15.5 → 15)
      return (
        Math.abs(value - Number(f)) < 0.0001 ||
        String(value).includes(f) ||
        value.toFixed(1).includes(f) ||
        value.toFixed(2).includes(f)
      );
    }
    return String(value).toLowerCase().includes(f);
  };

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (data || []).filter((item: any) => {
      if (
        q &&
        !(
          item.product_name?.toLowerCase().includes(q) ||
          item.plu?.toString().includes(q) ||
          item.group_name?.toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      if (!matchesMultiFilter(item.product_name || '', colFilters.product_name)) return false;
      if (!matchesMultiFilter(item.group_name || '', colFilters.group_name)) return false;
      if (!matchesMultiFilter(String(item.plu ?? ''), colFilters.plu)) return false;
      return true;
    });
  }, [data, searchQuery, colFilters.product_name, colFilters.group_name, colFilters.plu]);

  const baseTotalSales = useMemo(
    () => filteredData.reduce((acc: number, curr: any) => acc + asNumber(curr.total), 0),
    [filteredData],
  );
  const baseTotalQty = useMemo(
    () => filteredData.reduce((acc: number, curr: any) => acc + asNumber(curr.quantity), 0),
    [filteredData],
  );

  const columnFilteredData = useMemo(() => {
    return filteredData.filter((item: any) => {
      const qty = asNumber(item.quantity);
      const total = asNumber(item.total);
      const pctTotal = baseTotalSales > 0 ? (total / baseTotalSales) * 100 : 0;
      const pctQty = baseTotalQty > 0 ? (qty / baseTotalQty) * 100 : 0;
      if (!matchesNumFilter(qty, colFilters.quantity)) return false;
      if (!matchesNumFilter(total, colFilters.total)) return false;
      if (!matchesNumFilter(pctTotal, colFilters.pct_total)) return false;
      if (!matchesNumFilter(pctQty, colFilters.pct_qty)) return false;
      return true;
    });
  }, [
    filteredData,
    baseTotalSales,
    baseTotalQty,
    colFilters.quantity,
    colFilters.total,
    colFilters.pct_total,
    colFilters.pct_qty,
  ]);

  const totalSales = columnFilteredData.reduce(
    (acc: number, curr: any) => acc + asNumber(curr.total),
    0,
  );
  const totalQty = columnFilteredData.reduce(
    (acc: number, curr: any) => acc + asNumber(curr.quantity),
    0,
  );

  const toggleSort = (
    key: 'product_name' | 'group_name' | 'plu' | 'total' | 'quantity' | 'pct_total' | 'pct_qty',
  ) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(key);
      setSortDir(
        key === 'product_name' || key === 'group_name' || key === 'plu' ? 'asc' : 'desc',
      );
    }
  };

  const sortedData = useMemo(() => {
    const rows = [...columnFilteredData];
    rows.sort((a, b) => {
      const aTotal = asNumber(a.total);
      const bTotal = asNumber(b.total);
      const aQty = asNumber(a.quantity);
      const bQty = asNumber(b.quantity);
      const aPctT = totalSales > 0 ? aTotal / totalSales : 0;
      const bPctT = totalSales > 0 ? bTotal / totalSales : 0;
      const aPctQ = totalQty > 0 ? aQty / totalQty : 0;
      const bPctQ = totalQty > 0 ? bQty / totalQty : 0;

      let cmp = 0;
      if (sortBy === 'product_name') {
        cmp = String(a.product_name || '').localeCompare(String(b.product_name || ''), 'tr');
      } else if (sortBy === 'group_name') {
        cmp = String(a.group_name || '').localeCompare(String(b.group_name || ''), 'tr');
      } else if (sortBy === 'plu') {
        cmp = asNumber(a.plu) - asNumber(b.plu);
      } else if (sortBy === 'quantity') {
        cmp = aQty - bQty;
      } else if (sortBy === 'pct_total') {
        cmp = aPctT - bPctT;
      } else if (sortBy === 'pct_qty') {
        cmp = aPctQ - bPctQ;
      } else {
        cmp = aTotal - bTotal;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return rows;
  }, [columnFilteredData, sortBy, sortDir, totalSales, totalQty]);

  const groupAgg = useMemo(() => {
    const m = new Map<number, { name: string; total: number; qty: number }>();
    columnFilteredData.forEach((it: any) => {
      const gid = it.group_id ?? -1;
      const name = it.group_name ?? 'Diğer';
      const prev = m.get(gid) || { name, total: 0, qty: 0 };
      prev.total += asNumber(it.total);
      prev.qty += asNumber(it.quantity);
      m.set(gid, prev);
    });
    const arr = Array.from(m.entries()).map(([id, v]) => ({ id, ...v }));
    arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [columnFilteredData]);

  const hasActiveColFilters = Object.values(colFilters).some((v) =>
    Array.isArray(v) ? v.length > 0 : String(v).trim() !== '',
  );
  const clearColFilters = () =>
    setColFilters({
      product_name: [],
      group_name: [],
      plu: [],
      quantity: '',
      total: '',
      pct_total: '',
      pct_qty: '',
    });

  const SortTh = ({
    label,
    col,
    align = 'left',
  }: {
    label: string;
    col: typeof sortBy;
    align?: 'left' | 'right';
  }) => (
    <th
      className={clsx(
        'px-4 pt-3 pb-1 font-semibold cursor-pointer select-none hover:text-slate-800',
        align === 'right' ? 'text-right' : 'text-left',
        sortBy === col ? 'text-indigo-700' : '',
      )}
      onClick={() => toggleSort(col)}
      title="Sırala"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortBy === col && (
          <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );

  const exportColumns = [
    { key: 'product_name', label: 'Ürün' },
    { key: 'group_name', label: 'Grup' },
    { key: 'plu', label: 'PLU' },
    { key: 'quantity', label: 'Adet', format: (value: any) => asNumber(value) },
    { key: 'total', label: 'Toplam', format: (value: any) => formatCurrency(asNumber(value)) },
    { key: 'pct_total', label: 'Tutar %', format: (_value: any, row: any) => totalSales > 0 ? ((asNumber(row.total) / totalSales) * 100).toFixed(2) : '0' },
    { key: 'pct_qty', label: 'Adet %', format: (_value: any, row: any) => totalQty > 0 ? ((asNumber(row.quantity) / totalQty) * 100).toFixed(2) : '0' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 pb-16 font-sans safe-bottom">
      <ReportHeader
        title={"Ürün Satış Raporu"}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        actions={<ReportExportButtons title="Ürün Satış Raporu" columns={exportColumns} rows={sortedData} />}
        kasaNo={kasaNo}
        setKasaNo={setKasaNo}
        kasaOptions={allKasaOptions}
      />

      <main
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5"
        style={{ paddingTop: 'calc(140px + env(safe-area-inset-top))' }}
      >
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <Store className="w-5 h-5 text-emerald-700" />
              <span className="text-sm font-semibold text-slate-700">Şube</span>
              <button
                type="button"
                onClick={openBizModal}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Şube tanımla
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1 py-0.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedBusinessId('');
                  setSelectedGroups([]);
                }}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm border whitespace-nowrap font-semibold',
                  !selectedBusinessId
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-700 border-slate-200',
                )}
              >
                Tüm Şubeler
              </button>
              {businesses.map((b, index) => {
                const color = getBusinessColor(index);
                const active = String(selectedBusinessId) === String(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBusinessId(String(b.id))}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-sm border whitespace-nowrap font-semibold',
                      active ? `${color.solid} ${color.solidText}` : `${color.bg} ${color.border} ${color.text}`,
                    )}
                  >
                    {b.name}
                    <span className="ml-1.5 text-[10px] opacity-80">
                      {(b.group_ids || []).length} grup
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-semibold text-slate-700">Ürün Grubu</span>
              {selectedGroups.length > 0 && (
                <button
                  onClick={() => setSelectedGroups(selectedBusinessId ? [...businessGroupIds] : [])}
                  className="text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Temizle
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1 py-0.5">
              <button
                onClick={() => setSelectedGroups(selectedBusinessId ? [...businessGroupIds] : [])}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-sm border whitespace-nowrap",
                  selectedGroups.length === 0 ||
                    (selectedBusinessId &&
                      selectedGroups.length === businessGroupIds.length &&
                      businessGroupIds.every((id) => selectedGroups.includes(id)))
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-700 border-slate-200"
                )}
              >
                Tümü
              </button>
              {visibleGroups.map((g) => {
                const bizList = groupToBusinesses.get(g.id) || [];
                const color = bizList[0] ? getBusinessColor(bizList[0].index) : null;
                const selected = selectedGroups.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    title={
                      bizList.length
                        ? bizList.map((b) => b.name).join(', ')
                        : undefined
                    }
                    onClick={() => {
                      setSelectedGroups((prev) => {
                        if (prev.includes(g.id)) return prev.filter((x) => x !== g.id);
                        return [...prev, g.id];
                      });
                    }}
                    className={clsx(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border whitespace-nowrap transition',
                      selected && color
                        ? `${color.solid} ${color.solidText}`
                        : selected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : color
                            ? `${color.bg} ${color.border} ${color.text}`
                            : 'bg-white text-slate-700 border-slate-200',
                    )}
                  >
                    <span className="font-medium">{g.name}</span>
                    {bizList.slice(0, 2).map((biz) => {
                      const c = getBusinessColor(biz.index);
                      return (
                        <span
                          key={biz.businessId}
                          className={clsx(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded-md border',
                            selected ? 'bg-white/20 border-white/30 text-white' : c.tag,
                          )}
                        >
                          {biz.name}
                        </span>
                      );
                    })}
                    {bizList.length > 2 && (
                      <span
                        className={clsx(
                          'text-[10px] font-semibold',
                          selected ? 'text-white/80' : 'text-slate-400',
                        )}
                      >
                        +{bizList.length - 2}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white"
              >
                <option value="total">Tutar</option>
                <option value="quantity">Adet</option>
                <option value="pct_total">Tutar %</option>
                <option value="pct_qty">Adet %</option>
              </select>
              <button
                onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
              >
                <ArrowUpDown className="w-4 h-4 text-slate-600" />
              </button>
              <input
                type="text"
                placeholder={t('search_product')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="hidden md:block w-48 lg:w-64 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="md:hidden">
            <input
              type="text"
              placeholder={t('search_product')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          {selectedBusiness && (
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="font-bold text-slate-800">{selectedBusiness.name}</span>
              {' '}ürün raporu — gruplar bu şubeye bağlı.
              {' '}Ortak veya grubu tanımsız ürünler, siparişteki baskın şubede tek kez sayılır.
              {' '}Kasa filtresi üstte ayrı çalışır.
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            ))}
            <div className="lg:col-span-4 h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          </div>
        ) : error || !data || data.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{error ? `Error: ${error.message}` : t('period_no_sales_products')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="sm:col-span-2 xl:col-span-1 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg">
                <p className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-2">
                  {kasaNo
                    ? formatKasaLabel(kasaNo, kasaEntries)
                    : 'Tüm Kasalar'}
                  {selectedBusiness ? ` · ${selectedBusiness.name}` : ''}{' '}
                  · {t('total_sales')}
                </p>
                <AutoFitText
                  text={formatCurrency(totalSales)}
                  className="font-black tracking-tight"
                  maxPx={36}
                  minPx={22}
                />
                <p className="text-slate-400 text-sm mt-2 font-medium">
                  {totalQty} {t('total_products')} · {sortedData.length} kalem
                </p>
              </div>

              {!kasaNo && allKasaOptions.length > 1 && (
                (kasaBreakdownLoading && kasaBreakdown.length === 0
                  ? allKasaOptions.map((k) => (
                      <div key={k} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
                    ))
                  : (kasaBreakdown.length ? kasaBreakdown : allKasaOptions.map((kasa) => ({
                      kasa,
                      total: 0,
                      qty: 0,
                      products: 0,
                    }))).map((row) => {
                      const color = getKasaColor(row.kasa);
                      return (
                      <button
                        key={row.kasa}
                        type="button"
                        onClick={() => setKasaNo(String(row.kasa))}
                        className={clsx(
                          'text-left rounded-2xl border p-5 shadow-sm hover:shadow-md transition',
                          color.bg,
                          color.border,
                          kasaBreakdownLoading && 'opacity-70',
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-md border', color.tag)}>
                            {formatKasaLabel(row.kasa, kasaEntries)}
                          </span>
                          <span className={clsx('text-[11px]', color.text, 'opacity-70')}>
                            {row.products} ürün
                          </span>
                        </div>
                        <p className={clsx('text-xl font-black', color.text)}>
                          {formatCurrency(row.total)}
                        </p>
                        <p className={clsx('text-xs mt-1 opacity-70', color.text)}>
                          {row.qty} adet
                        </p>
                      </button>
                      );
                    }))
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-slate-900">Gruplar</div>
                <div className="text-sm text-slate-500">{groupAgg.length} grup</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {(selectedGroups.length > 0 ? groupAgg.filter(g => selectedGroups.includes(g.id)) : groupAgg).map((g) => {
                  const bizList = groupToBusinesses.get(g.id) || [];
                  const color = bizList[0] ? getBusinessColor(bizList[0].index) : null;
                  return (
                    <div
                      key={g.id}
                      className={clsx(
                        'rounded-xl p-3 border',
                        color
                          ? `${color.bg} ${color.border}`
                          : 'border-slate-100 bg-slate-50/80',
                      )}
                    >
                      {bizList.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {bizList.map((biz) => {
                            const c = getBusinessColor(biz.index);
                            return (
                              <span
                                key={biz.businessId}
                                className={clsx(
                                  'text-[10px] font-bold px-1.5 py-0.5 rounded-md border',
                                  c.tag,
                                )}
                              >
                                {biz.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div
                        className={clsx(
                          'text-sm font-semibold truncate',
                          color ? color.text : 'text-slate-800',
                        )}
                        title={g.name}
                      >
                        {g.name || 'Diğer'}
                      </div>
                      <div className="text-xs text-slate-500">{g.qty} adet</div>
                      <div className="text-sm font-bold text-slate-900 mt-1">{formatCurrency(g.total)}</div>
                      <div className="mt-2 h-1.5 bg-white/70 rounded">
                        <div
                          className={clsx('h-1.5 rounded', color ? color.bar : 'bg-indigo-600')}
                          style={{ width: `${totalSales > 0 ? Math.min(100, (g.total / totalSales) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedPlu !== null && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-100">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 text-indigo-700 font-black">
                      <ReceiptText className="w-5 h-5" />
                      Satıldığı Adisyonlar
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {selectedProductName || `PLU ${selectedPlu}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlu(null);
                      setSelectedProductName('');
                      setProductOrders([]);
                    }}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
                    title="Kapat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {productOrdersLoading ? (
                  <div className="py-8 text-center text-slate-500 font-semibold">Adisyonlar yükleniyor...</div>
                ) : productOrders.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 font-semibold">Bu ürün için adisyon bulunamadı.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-100">
                          <th className="py-2 pr-4 font-semibold">Adisyon</th>
                          <th className="py-2 pr-4 font-semibold">Durum</th>
                          <th className="py-2 pr-4 font-semibold">Masa</th>
                          <th className="py-2 pr-4 font-semibold">Tarih</th>
                          <th className="py-2 pr-4 font-semibold text-right">Adet</th>
                          <th className="py-2 font-semibold text-right">Tutar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productOrders.map((order, idx) => (
                          <tr
                            key={`${order.status}-${order.adsno}-${order.adtur}-${idx}`}
                            className="border-b border-slate-50 hover:bg-indigo-50/50 cursor-pointer"
                            onClick={() => openOrderDetail(order)}
                          >
                            <td className="py-2.5 pr-4 font-bold text-slate-900">#{order.adsno}</td>
                            <td className="py-2.5 pr-4">
                              <span className={clsx(
                                'text-xs font-bold px-2 py-0.5 rounded-md',
                                order.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700',
                              )}>
                                {order.status === 'open' ? 'Açık' : 'Kapalı'}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-slate-700">{order.masano || '-'}</td>
                            <td className="py-2.5 pr-4 text-slate-600">
                              {order.tarih || '-'}{order.saat ? ` ${String(order.saat).slice(0, 5)}` : ''}
                            </td>
                            <td className="py-2.5 pr-4 text-right">{order.quantity}</td>
                            <td className="py-2.5 text-right font-bold">{formatCurrency(Number(order.total || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <h2 className="font-bold text-slate-900">Ürünler</h2>
                <div className="flex items-center gap-2">
                  {hasActiveColFilters && (
                    <button
                      type="button"
                      onClick={clearColFilters}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md bg-slate-100"
                    >
                      Filtreleri temizle
                    </button>
                  )}
                  <span className="text-sm text-slate-500">{sortedData.length} kayıt</span>
                </div>
              </div>

              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 pt-3 pb-1 font-semibold w-12 text-left">#</th>
                      <SortTh label="Ürün" col="product_name" />
                      <SortTh label="Grup" col="group_name" />
                      <SortTh label="PLU" col="plu" />
                      <SortTh label="Adet" col="quantity" align="right" />
                      <SortTh label="Tutar" col="total" align="right" />
                      <SortTh label="Tutar %" col="pct_total" align="right" />
                      <SortTh label="Adet %" col="pct_qty" align="right" />
                    </tr>
                    <tr className="border-t border-slate-100">
                      <th className="px-2 pb-2" />
                      <th className="px-2 pb-2">
                        <ColMultiSelect
                          options={filterOptions.product_name}
                          selected={colFilters.product_name}
                          onChange={(product_name) =>
                            setColFilters((p) => ({ ...p, product_name }))
                          }
                          placeholder="Ürün seç…"
                        />
                      </th>
                      <th className="px-2 pb-2">
                        <ColMultiSelect
                          options={filterOptions.group_name}
                          selected={colFilters.group_name}
                          onChange={(group_name) =>
                            setColFilters((p) => ({ ...p, group_name }))
                          }
                          placeholder="Grup seç…"
                        />
                      </th>
                      <th className="px-2 pb-2">
                        <ColMultiSelect
                          options={filterOptions.plu}
                          selected={colFilters.plu}
                          onChange={(plu) => setColFilters((p) => ({ ...p, plu }))}
                          placeholder="PLU seç…"
                        />
                      </th>
                      <th className="px-2 pb-2">
                        <input
                          type="text"
                          value={colFilters.quantity}
                          onChange={(e) =>
                            setColFilters((p) => ({ ...p, quantity: e.target.value }))
                          }
                          placeholder=">10 / 5-20"
                          title="Örn: 10, >10, 5-20"
                          className="w-full min-w-[4.5rem] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 font-normal text-right"
                        />
                      </th>
                      <th className="px-2 pb-2">
                        <input
                          type="text"
                          value={colFilters.total}
                          onChange={(e) =>
                            setColFilters((p) => ({ ...p, total: e.target.value }))
                          }
                          placeholder=">1000"
                          title="Örn: 1000, >1000, 500-2000"
                          className="w-full min-w-[5rem] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 font-normal text-right"
                        />
                      </th>
                      <th className="px-2 pb-2">
                        <input
                          type="text"
                          value={colFilters.pct_total}
                          onChange={(e) =>
                            setColFilters((p) => ({ ...p, pct_total: e.target.value }))
                          }
                          placeholder=">5"
                          title="Örn: 5, >5, 1-10"
                          className="w-full min-w-[4rem] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 font-normal text-right"
                        />
                      </th>
                      <th className="px-2 pb-2">
                        <input
                          type="text"
                          value={colFilters.pct_qty}
                          onChange={(e) =>
                            setColFilters((p) => ({ ...p, pct_qty: e.target.value }))
                          }
                          placeholder=">2"
                          title="Örn: 2, >2, 1-5"
                          className="w-full min-w-[4rem] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 font-normal text-right"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                          Filtreye uyan ürün yok.
                        </td>
                      </tr>
                    ) : (
                      sortedData.map((item: any, index: number) => (
                        <tr
                          key={`${item.plu}-${index}`}
                          className="border-t border-slate-100 hover:bg-indigo-50/40 cursor-pointer"
                          onClick={() => {
                            setSelectedPlu(item.plu ?? null);
                            setSelectedProductName(item.product_name || '');
                          }}
                        >
                          <td className="px-4 py-3 text-slate-400 font-medium">{index + 1}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{item.product_name}</td>
                          <td className="px-4 py-3 text-slate-600">{item.group_name || '-'}</td>
                          <td className="px-4 py-3 text-slate-500">{item.plu ?? '-'}</td>
                          <td className="px-4 py-3 text-right font-medium">{asNumber(item.quantity)}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(asNumber(item.total))}</td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {(totalSales > 0 ? (asNumber(item.total) / totalSales) * 100 : 0).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {(totalQty > 0 ? (asNumber(item.quantity) / totalQty) * 100 : 0).toFixed(1)}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="lg:hidden divide-y divide-slate-100">
                {sortedData.map((item: any, index: number) => (
                  <button
                    key={`${item.plu}-${index}`}
                    type="button"
                    className="w-full text-left px-4 py-4 hover:bg-slate-50"
                    onClick={() => {
                      setSelectedPlu(item.plu ?? null);
                      setSelectedProductName(item.product_name || '');
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{item.product_name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {asNumber(item.quantity)} adet · {item.group_name || 'Grup yok'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-slate-900">{formatCurrency(asNumber(item.total))}</div>
                        <div className="text-[11px] text-slate-400">
                          %{(totalSales > 0 ? (asNumber(item.total) / totalSales) * 100 : 0).toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {showBizModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
          onClick={() => !bizSaving && setShowBizModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Şube ismi ↔ Ürün grubu</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Önce şube isimlerini burada tanımlayın (German Döner, Smash Burger…). Sonra her ürün grubunu bir şubeye bağlayın. Kasa numarası kullanılmaz. Kayıt tüm kullanıcılar için ortaktır.
                </p>
              </div>
              <button
                type="button"
                disabled={bizSaving}
                onClick={() => setShowBizModal(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-5">
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-800">1. Şube isimleri</h4>
                  <button
                    type="button"
                    onClick={addDraftBusiness}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    + Şube ekle
                  </button>
                </div>
                <div className="space-y-2">
                  {draftBusinesses.map((b, index) => {
                    const color = getBusinessColor(index);
                    return (
                      <div
                        key={b.key}
                        className={clsx(
                          'flex items-center gap-2 rounded-xl border px-3 py-2',
                          color.bg,
                          color.border,
                        )}
                      >
                        <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-md border', color.tag)}>
                          #{index + 1}
                        </span>
                        <input
                          type="text"
                          maxLength={120}
                          placeholder="Şube adı (örn: German Döner)"
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900"
                          value={b.name}
                          onChange={(e) =>
                            setDraftBusinesses((prev) =>
                              prev.map((x) =>
                                x.key === b.key ? { ...x, name: e.target.value } : x,
                              ),
                            )
                          }
                        />
                        <button
                          type="button"
                          className="text-xs font-bold text-rose-600 px-2 py-1"
                          onClick={() =>
                            setDraftBusinesses((prev) => prev.filter((x) => x.key !== b.key))
                          }
                        >
                          Sil
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h4 className="text-sm font-bold text-slate-800 mb-2">2. Grup ↔ Şube eşleme</h4>
                <p className="text-xs text-slate-500 mb-3">
                  Bir grup birden fazla şubeye bağlanabilir (ör. DRINKS). İstediğiniz kadar şube seçin.
                </p>
                <div className="space-y-3">
                  {groups.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">Ürün grubu bulunamadı.</p>
                  ) : (
                    groups.map((g) => (
                        <div
                          key={g.id}
                          className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="font-semibold text-slate-900 text-sm truncate" title={g.name}>
                              {g.name}
                            </div>
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-slate-500 hover:underline shrink-0"
                              onClick={() => clearGroupSube(g.id)}
                            >
                              Temizle
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {draftBusinesses
                              .filter((b) => b.name.trim())
                              .map((b) => {
                                const color = getBusinessColor(
                                  draftBusinesses.findIndex((x) => x.key === b.key),
                                );
                                const on = b.group_ids.includes(g.id);
                                return (
                                  <button
                                    key={b.key}
                                    type="button"
                                    onClick={() => assignGroupToSube(g.id, b.key)}
                                    className={clsx(
                                      'text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition',
                                      on
                                        ? `${color.solid} ${color.solidText}`
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300',
                                    )}
                                  >
                                    {b.name.trim()}
                                  </button>
                                );
                              })}
                            {draftBusinesses.every((b) => !b.name.trim()) && (
                              <span className="text-xs text-amber-700">
                                Önce yukarıdan şube ismi yazın.
                              </span>
                            )}
                          </div>
                        </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                disabled={bizSaving}
                onClick={() => setShowBizModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={bizSaving}
                onClick={saveBusinesses}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                {bizSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
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
