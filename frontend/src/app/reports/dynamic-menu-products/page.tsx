'use client';

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { LayoutList, Search } from 'lucide-react';
import clsx from 'clsx';
import ReportHeader from '@/components/ReportHeader';
import ReportExportButtons from '@/components/ReportExportButtons';
import { useReportData } from '@/utils/useReportData';
import AutoFitText from '@/components/AutoFitText';

type MenuProductRow = {
  plu: number | string;
  product_name: string;
  group_name: string;
  quantity: number;
  price: number;
  total: number;
  is_dynamic_menu?: boolean;
};

export default function DynamicMenuProductsPage() {
  const { token } = useAuth();
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [includeMenu, setIncludeMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const additionalParams = useMemo(
    () => ({ include_menu: includeMenu ? '1' : '0' }),
    [includeMenu],
  );

  const { data, isLoading, error } = useReportData({
    endpoint: '/reports/dynamic-menu-products',
    token,
    period,
    customStartDate,
    customEndDate,
    additionalParams,
  });

  const asNumber = (value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);

  const rows: MenuProductRow[] = Array.isArray(data) ? data : [];
  const filtered = rows.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(item.product_name || '').toLowerCase().includes(q) ||
      String(item.group_name || '').toLowerCase().includes(q) ||
      String(item.plu ?? '').toLowerCase().includes(q)
    );
  });

  const totalSales = filtered.reduce((sum, item) => sum + asNumber(item.total), 0);
  const totalQty = filtered.reduce((sum, item) => sum + asNumber(item.quantity), 0);

  const exportColumns = [
    { key: 'plu', label: 'PLU' },
    { key: 'product_name', label: lang === 'tr' ? 'Ürün Adı' : 'Product' },
    { key: 'group_name', label: lang === 'tr' ? 'Grup' : 'Group' },
    {
      key: 'price',
      label: lang === 'tr' ? 'Fiyat' : 'Price',
      format: (value: any) => formatCurrency(asNumber(value)),
    },
    { key: 'quantity', label: lang === 'tr' ? 'Satış Adeti' : 'Qty', format: (value: any) => asNumber(value) },
    {
      key: 'total',
      label: lang === 'tr' ? 'Toplam' : 'Total',
      format: (value: any) => formatCurrency(asNumber(value)),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans safe-bottom">
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
            rows={filtered}
          />
        }
      />

      <main
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4"
        style={{ paddingTop: 'calc(120px + env(safe-area-inset-top))' }}
      >
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-11">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'tr' ? 'PLU, ürün veya grup ara...' : 'Search PLU, product or group...'}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setIncludeMenu((prev) => !prev)}
            className={clsx(
              'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-colors',
              includeMenu
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-violet-50 text-violet-800 border-violet-200',
            )}
          >
            <span>
              {includeMenu
                ? t('dynamic_menu_show_on')
                : t('dynamic_menu_show_off')}
            </span>
            <span className="text-xs opacity-80">
              {includeMenu ? (lang === 'tr' ? 'Açık' : 'On') : lang === 'tr' ? 'Kapalı' : 'Off'}
            </span>
          </button>
          <p className="text-[11px] text-gray-500 leading-4">
            {t('dynamic_menu_filter_hint')}
          </p>
        </div>

        {isLoading ? (
          <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-3xl p-8 animate-pulse h-36" />
        ) : error ? (
          <div className="text-center py-12 text-gray-500">{error.message}</div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 rounded-3xl p-8 text-center text-white shadow-2xl">
              <p className="text-violet-100 text-sm font-bold mb-3">
                {lang === 'tr' ? 'ÜRÜN TOPLAMI / CİRO' : 'PRODUCT TOTAL / REVENUE'}
              </p>
              <AutoFitText
                text={formatCurrency(totalSales)}
                className="font-black tracking-tight drop-shadow-lg"
                maxPx={48}
                minPx={24}
              />
              <p className="text-violet-100 text-base mt-4 font-semibold">
                {filtered.length} {lang === 'tr' ? 'ürün' : 'products'} • {totalQty} {lang === 'tr' ? 'adet' : 'qty'}
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <LayoutList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{t('no_data_selected_range')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((item) => (
                  <div
                    key={`${item.plu}-${item.product_name}`}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            PLU {item.plu}
                          </span>
                          {item.is_dynamic_menu && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700">
                              {lang === 'tr' ? 'Dinamik menü' : 'Dynamic menu'}
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-gray-900 mt-1 truncate">{item.product_name}</h3>
                        <p className="text-xs text-gray-500">{item.group_name || (lang === 'tr' ? 'Grup yok' : 'No group')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-gray-900">{formatCurrency(asNumber(item.total))}</p>
                        <p className="text-xs text-gray-500">
                          {asNumber(item.quantity)} {lang === 'tr' ? 'adet' : 'qty'} • {formatCurrency(asNumber(item.price))}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
