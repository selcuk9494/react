'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter } from 'next/navigation';
import { Tag } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import { useReportData } from '@/utils/useReportData';

export default function DiscountPage() {
  const { token } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const { data, isLoading, error } = useReportData({
    endpoint: '/reports/discount',
    token,
    period,
    customStartDate,
    customEndDate,
  });

  // Debug log
  useEffect(() => {
    console.log('Discount Data:', { data, isLoading, error, dataType: typeof data, isArray: Array.isArray(data) });
    if (data && Array.isArray(data) && data.length > 0) {
      console.log('First discount item:', data[0]);
      console.log('Available fields:', Object.keys(data[0]));
    }
  }, [data, isLoading, error]);

  const formatCurrency = (val: number) => {
    if (val === null || val === undefined) return '₺0,00';
    const n = Number(val) || 0;
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(n);
  };

  const totalDiscount =
    Array.isArray(data) && data.length > 0
      ? data.reduce((acc: number, curr: any) => {
          const discount = Number(curr.iskonto ?? 0);
          return acc + discount;
        }, 0)
      : 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 safe-bottom">
      <ReportHeader
        title={t('discount_title')}
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6" style={{ paddingTop: 'calc(120px + env(safe-area-inset-top))' }}>
        {isLoading ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl p-8 animate-pulse">
              <div className="h-4 bg-white/30 rounded w-32 mx-auto mb-3"></div>
              <div className="h-12 bg-white/40 rounded w-48 mx-auto"></div>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-3xl p-5 shadow-lg animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-20"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <Tag className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <p className="text-red-500">Error: {error.message}</p>
          </div>
        ) : !data || !Array.isArray(data) || data.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('no_discounts')}</p>
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl p-8 text-center text-white shadow-2xl">
              <p className="text-orange-100 text-sm font-bold mb-3">
                🏷️ {t('total_discount')}
              </p>
              <h2 className="text-5xl font-black tracking-tight drop-shadow-lg">{formatCurrency(totalDiscount)}</h2>
              <p className="text-orange-200 text-sm mt-2">{data.length} {t('discount_records')}</p>
            </div>

            <div className="space-y-3">
              {data.map((item: any, index: number) => {
                const iskonto = Number(item.iskonto ?? 0);
                const netTutar = Number(item.net_tutar ?? 0);
                const tutar =
                  item.tutar !== undefined && item.tutar !== null
                    ? Number(item.tutar)
                    : netTutar + iskonto;
                const orderNo = item.adsno || item.order_no || index + 1;
                const customerName =
                  item.customer_name || item.mustid || t('customer');
                const orderDate = item.tarih || item.date || '';

                return (
                  <div
                    key={index}
                    className="bg-white rounded-3xl p-5 shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-98"
                    onClick={() =>
                      router.push(
                        `/reports/orders/detail?id=${orderNo}&type=closed`,
                      )
                    }
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center text-white font-bold">
                        {orderNo}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">
                          {customerName}
                        </h3>
                        <p className="text-xs text-gray-500">{orderDate}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {t('order_total')}: {formatCurrency(tutar)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">
                          {t('discount')}
                        </p>
                        <p className="text-lg font-bold text-red-600">
                          {formatCurrency(iskonto)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
