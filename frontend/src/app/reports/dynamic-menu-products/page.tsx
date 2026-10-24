'use client';

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { LayoutList, Search, Wallet, Package, Hash } from 'lucide-react';
import clsx from 'clsx';
import ReportHeader from '@/components/ReportHeader';
import ReportShell from '@/components/ReportShell';
import StatTile from '@/components/StatTile';
import { useSharedReportFilters, getBranchKasaOptions } from '@/utils/reportFilters';
import ReportExportButtons from '@/components/ReportExportButtons';
import { useReportData } from '@/utils/useReportData';

type MenuProductRow = {
  plu: number | string;
  product_name: string;
  group_name: string;
  quantity: number;
  price: number;
  total: number;
  is_dynamic_menu?: boolean;
  missing_product?: boolean;
};

export default function DynamicMenuProductsPage() {
  const { token, user } = useAuth();
  const { t, lang } = useI18n();
  const { period, setPeriod, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, kasaNo, setKasaNo } = useSharedReportFilters();
  const kasaOptions = getBranchKasaOptions(user);
  const [includeMenu, setIncludeMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const additionalParams = useMemo(() => ({ include_menu: '1' }), []);

  const { data, isLoading, error } = useReportData({
    endpoint: '/reports/dynamic-menu-products',
    token,
    period,
    customStartDate,
    customEndDate,
    additionalParams,
    kasaNo,
  });

  const asNumber = (value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);

  const isMenuName = (item: MenuProductRow) => {
    const name = String(item.product_name || '').trim();
    return Boolean(item.is_dynamic_menu) || name.startsWith('*') || name.endsWith('*');
  };

  const isBarePluName = (item: MenuProductRow) => {
    const name = String(item.product_name || '').trim();
    const plu = String(item.plu ?? '').trim();
    return !name || name === plu;
  };

  const productTitle = (item: MenuProductRow) =>
    isBarePluName(item)
      ? lang === 'tr'
        ? 'Ürün kartı yok'
        : 'No product card'
      : item.product_name;

  const rows: MenuProductRow[] = Array.isArray(data) ? data : [];
  const matchesSearch = (item: MenuProductRow) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(item.product_name || '').toLowerCase().includes(q) ||
      String(item.group_name || '').toLowerCase().includes(q) ||
      String(item.plu ?? '').toLowerCase().includes(q)
    );
  };
  const searched = rows.filter(matchesSearch);
  const productRows = searched.filter((item) => !isMenuName(item));
  const filtered = includeMenu ? searched : productRows;

  const totalSales = searched.reduce((sum, item) => sum + asNumber(item.total), 0);
  const totalQty = productRows.reduce((sum, item) => sum + asNumber(item.quantity), 0);

  const exportRows = [
    ...filtered.map((item) => ({
      ...item,
      product_name: productTitle(item),
    })),
    {
      plu: '',
      product_name: lang === 'tr' ? 'TOPLAM' : 'TOTAL',
      group_name: '',
      price: '',
      quantity: searched.reduce((sum, item) => sum + asNumber(item.quantity), 0),
      total: totalSales,
    },
  ];

  const exportColumns = [
    { key: 'plu', label: 'PLU' },
    { key: 'product_name', label: lang === 'tr' ? 'Ürün Adı' : 'Product' },
    { key: 'group_name', label: lang === 'tr' ? 'Grup' : 'Group' },
    {
      key: 'price',
      label: lang === 'tr' ? 'Fiyat' : 'Price',
      format: (value: any) =>
        value === '' || value === null || typeof value === 'undefined'
          ? ''
          : formatCurrency(asNumber(value)),
      excelRaw: true,
    },
    {
      key: 'quantity',
      label: lang === 'tr' ? 'Satış Adeti' : 'Qty',
      format: (value: any) => asNumber(value),
      excelRaw: true,
    },
    {
      key: 'total',
      label: lang === 'tr' ? 'Toplam' : 'Total',
      format: (value: any) => formatCurrency(asNumber(value)),
      excelRaw: true,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans safe-bottom">
      <ReportHeader
        title={t('dynamic_menu_products')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        actions={
          <ReportExportButtons
            title={t('dynamic_menu_products')}
            columns={exportColumns}
            rows={exportRows}
          />
        }
        kasaNo={kasaNo}
        setKasaNo={setKasaNo}
        kasaOptions={kasaOptions}
      />

      <ReportShell>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'tr' ? 'PLU, ürün veya grup ara...' : 'Search PLU, product or group...'}
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={() => setIncludeMenu((prev) => !prev)}
            className={clsx(
              'flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors shrink-0',
              includeMenu
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-violet-50 text-violet-800 border-violet-200',
            )}
          >
            <span>{includeMenu ? t('dynamic_menu_show_on') : t('dynamic_menu_show_off')}</span>
            <span className="text-xs opacity-80">{includeMenu ? (lang === 'tr' ? 'Açık' : 'On') : lang === 'tr' ? 'Kapalı' : 'Off'}</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-500 leading-4 -mt-2 px-1">{t('dynamic_menu_filter_hint')}</p>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
              ))}
            </div>
            <div className="h-80 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-500">{error.message}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatTile tone="dark" label={lang === 'tr' ? 'Ürün Toplamı / Ciro' : 'Product Total / Revenue'} value={formatCurrency(totalSales)} sub={`${filtered.length} ${lang === 'tr' ? 'ürün' : 'products'}`} icon={Wallet} />
              <StatTile accent="violet" label={lang === 'tr' ? 'Ürün' : 'Products'} value={filtered.length} icon={Package} />
              <StatTile accent="indigo" label={lang === 'tr' ? 'Adet' : 'Qty'} value={totalQty} icon={Hash} />
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <LayoutList className="w-14 h-14 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">{t('no_data_selected_range')}</p>
              </div>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-bold text-slate-900">{t('dynamic_menu_products')}</h2>
                  <span className="text-sm text-slate-500">{filtered.length} kayıt</span>
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr className="text-left">
                        <th className="px-4 py-3 font-semibold">PLU</th>
                        <th className="px-4 py-3 font-semibold">{lang === 'tr' ? 'Ürün' : 'Product'}</th>
                        <th className="px-4 py-3 font-semibold">{lang === 'tr' ? 'Grup' : 'Group'}</th>
                        <th className="px-4 py-3 font-semibold text-right">{lang === 'tr' ? 'Adet' : 'Qty'}</th>
                        <th className="px-4 py-3 font-semibold text-right">{lang === 'tr' ? 'Fiyat' : 'Price'}</th>
                        <th className="px-4 py-3 font-semibold text-right">{lang === 'tr' ? 'Toplam' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item) => (
                        <tr key={`${item.plu}-${item.product_name}`} className="border-t border-slate-100 hover:bg-violet-50/40">
                          <td className="px-4 py-3 text-slate-500">{item.plu}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900">{productTitle(item)}</span>
                              {(item.is_dynamic_menu || isMenuName(item)) && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700">
                                  {lang === 'tr' ? 'Dinamik menü' : 'Dynamic menu'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {isBarePluName(item)
                              ? (lang === 'tr' ? 'Ürün listesinde yok' : 'Missing from product list')
                              : item.group_name || (lang === 'tr' ? 'Grup yok' : 'No group')}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">{asNumber(item.quantity)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(asNumber(item.price))}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(asNumber(item.total))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-slate-100">
                  {filtered.map((item) => (
                    <div key={`${item.plu}-${item.product_name}`} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">PLU {item.plu}</span>
                            {(item.is_dynamic_menu || isMenuName(item)) && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700">{lang === 'tr' ? 'Dinamik menü' : 'Dynamic menu'}</span>
                            )}
                          </div>
                          <div className="font-bold text-slate-900 mt-1 truncate">{productTitle(item)}</div>
                          <div className="text-xs text-slate-500">{item.group_name || (lang === 'tr' ? 'Grup yok' : 'No group')}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-black text-slate-900">{formatCurrency(asNumber(item.total))}</div>
                          <div className="text-xs text-slate-500">{asNumber(item.quantity)} {lang === 'tr' ? 'adet' : 'qty'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 bg-violet-50/60 px-4 py-3">
                  <span className="text-sm font-semibold text-violet-700">{lang === 'tr' ? 'Toplam' : 'Total'}</span>
                  <span className="text-lg font-black text-violet-700">{formatCurrency(totalSales)}</span>
                </div>
              </section>
            )}
          </>
        )}
      </ReportShell>
    </div>
  );
}
