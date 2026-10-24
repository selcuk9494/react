'use client';

import React, { useState, Suspense, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package, Layers, ArrowUpDown, ReceiptText, X, Store, Plus } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import {
  useSharedReportFilters,
  getBranchKasaOptions,
  getBranchKasaEntries,
  formatKasaLabel,
  getBusinessColor,
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
  const [sortBy, setSortBy] = useState<'total' | 'quantity' | 'pct_total' | 'pct_qty'>('total');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
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

  const groupToBusiness = useMemo(() => {
    const m = new Map<number, { businessId: number; name: string; index: number }>();
    businesses.forEach((b, index) => {
      for (const gid of b.group_ids || []) {
        m.set(gid, { businessId: b.id, name: b.name, index });
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

  const breakdownKasaOptions = allKasaOptions;

  const additionalParams = useMemo(() => {
    const params: any = {};
    if (effectiveGroupIds.length) params.group_ids = effectiveGroupIds.join(',');
    if (selectedPlu !== null) params.plu = String(selectedPlu);
    return params;
  }, [effectiveGroupIds, selectedPlu]);

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

  // Tum kasalar seciliyken her kasanin ozetini ayni sayfada goster
  useEffect(() => {
    if (!token || kasaNo || breakdownKasaOptions.length < 1 || allKasaOptions.length < 2) {
      setKasaBreakdown([]);
      return;
    }
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;
    let cancelled = false;
    (async () => {
      setKasaBreakdownLoading(true);
      try {
        const rows = await Promise.all(
          breakdownKasaOptions.map(async (kasa) => {
            const params = new URLSearchParams({ period, kasa_no: String(kasa) });
            if (period === 'custom') {
              params.set('start_date', customStartDate);
              params.set('end_date', customEndDate);
            }
            // Kasa özeti: seçili işletmenin grup filtresi varsa uygula
            if (effectiveGroupIds.length) {
              params.set('group_ids', effectiveGroupIds.join(','));
            }
            const res = await axios.get(
              `${getApiUrl()}/reports/product-sales?${params.toString()}`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            const items = Array.isArray(res.data) ? res.data : [];
            const total = items.reduce(
              (a: number, it: any) => a + (Number(it.total) || 0),
              0,
            );
            const qty = items.reduce(
              (a: number, it: any) => a + (Number(it.quantity) || 0),
              0,
            );
            return { kasa, total, qty, products: items.length };
          }),
        );
        if (!cancelled) setKasaBreakdown(rows);
      } catch {
        if (!cancelled) setKasaBreakdown([]);
      } finally {
        if (!cancelled) setKasaBreakdownLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    token,
    kasaNo,
    breakdownKasaOptions,
    period,
    customStartDate,
    customEndDate,
    effectiveGroupIds,
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

  /** Bir ürün grubunu tek şubeye bağla (veya aynı şubeye tekrar basınca kaldır). */
  const assignGroupToSube = (groupId: number, bizKey: string) => {
    setDraftBusinesses((prev) =>
      prev.map((b) => {
        if (b.key === bizKey) {
          const on = b.group_ids.includes(groupId);
          return {
            ...b,
            group_ids: on
              ? b.group_ids.filter((id) => id !== groupId)
              : [...b.group_ids.filter((id) => id !== groupId), groupId],
          };
        }
        return {
          ...b,
          group_ids: b.group_ids.filter((id) => id !== groupId),
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

  const filteredData = (data || []).filter((item: any) => {
    const q = searchQuery.toLowerCase();
    return item.product_name?.toLowerCase().includes(q) || item.plu?.toString().includes(q);
  });

  const totalSales = filteredData.reduce((acc: number, curr: any) => acc + asNumber(curr.total), 0);
  const totalQty = filteredData.reduce((acc: number, curr: any) => acc + asNumber(curr.quantity), 0);

  const sortedData = [...filteredData].sort((a, b) => {
    const aTotal = asNumber(a.total);
    const bTotal = asNumber(b.total);
    const aQty = asNumber(a.quantity);
    const bQty = asNumber(b.quantity);
    const aVal = sortBy === 'total' ? aTotal : sortBy === 'quantity' ? aQty : sortBy === 'pct_total' ? (totalSales > 0 ? aTotal / totalSales : 0) : (totalQty > 0 ? aQty / totalQty : 0);
    const bVal = sortBy === 'total' ? bTotal : sortBy === 'quantity' ? bQty : sortBy === 'pct_total' ? (totalSales > 0 ? bTotal / totalSales : 0) : (totalQty > 0 ? bQty / totalQty : 0);
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });
  const groupAgg = useMemo(() => {
    const m = new Map<number, { name: string; total: number; qty: number }>();
    filteredData.forEach((it: any) => {
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
  }, [filteredData]);

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
                const biz = groupToBusiness.get(g.id);
                const color = biz ? getBusinessColor(biz.index) : null;
                const selected = selectedGroups.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    title={biz ? biz.name : undefined}
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
                    {biz && (
                      <span
                        className={clsx(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded-md border',
                          selected ? 'bg-white/20 border-white/30 text-white' : color?.tag,
                        )}
                      >
                        {biz.name}
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
              {' '}ürün raporu — gruplar bu şubeye bağlı. Kasa filtresi üstte ayrı çalışır (kasa eşlemesi yok).
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
                kasaBreakdownLoading
                  ? breakdownKasaOptions.map((k) => (
                      <div key={k} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
                    ))
                  : kasaBreakdown.map((row) => (
                      <button
                        key={row.kasa}
                        type="button"
                        onClick={() => setKasaNo(String(row.kasa))}
                        className="text-left bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-emerald-400 hover:shadow-md transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            {formatKasaLabel(row.kasa, kasaEntries)}
                          </span>
                          <span className="text-[11px] text-slate-400">{row.products} ürün</span>
                        </div>
                        <p className="text-xl font-black text-slate-900">{formatCurrency(row.total)}</p>
                        <p className="text-xs text-slate-500 mt-1">{row.qty} adet</p>
                      </button>
                    ))
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-slate-900">Gruplar</div>
                <div className="text-sm text-slate-500">{groupAgg.length} grup</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {(selectedGroups.length > 0 ? groupAgg.filter(g => selectedGroups.includes(g.id)) : groupAgg).map((g) => {
                  const biz = groupToBusiness.get(g.id);
                  const color = biz ? getBusinessColor(biz.index) : null;
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
                      {biz && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-md border', color?.tag)}>
                            {biz.name}
                          </span>
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
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Ürünler</h2>
                <span className="text-sm text-slate-500">{sortedData.length} kayıt</span>
              </div>

              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-semibold w-12">#</th>
                      <th className="px-4 py-3 font-semibold">Ürün</th>
                      <th className="px-4 py-3 font-semibold">Grup</th>
                      <th className="px-4 py-3 font-semibold">PLU</th>
                      <th className="px-4 py-3 font-semibold text-right">Adet</th>
                      <th className="px-4 py-3 font-semibold text-right">Tutar</th>
                      <th className="px-4 py-3 font-semibold text-right">Tutar %</th>
                      <th className="px-4 py-3 font-semibold text-right">Adet %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.map((item: any, index: number) => (
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
                    ))}
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
                  Her ürün grubu için şube seçin. Kasa butonu yoktur.
                </p>
                <div className="space-y-3">
                  {groups.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">Ürün grubu bulunamadı.</p>
                  ) : (
                    groups.map((g) => {
                      const assigned = draftBusinesses.find((b) =>
                        b.group_ids.includes(g.id),
                      );
                      return (
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
                                const on = assigned?.key === b.key;
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
                      );
                    })
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
