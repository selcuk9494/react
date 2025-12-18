'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import axios from 'axios';
import { getApiUrl } from '@/utils/api';
import {
  ArrowLeft,
  Calendar,
  Tag,
  ChevronRight,
  Clock,
  MapPin,
  CreditCard,
  User
} from 'lucide-react';
import clsx from 'clsx';

function DiscountReportContent() {
  const router = useRouter();
  const { token } = useAuth();
  const { t, formatCurrency, formatDate, formatTime } = useI18n();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const periods = [
    { id: 'today', label: 'Bugün' },
    { id: 'yesterday', label: 'Dün' },
    { id: 'week', label: 'Bu Hafta' },
    { id: 'month', label: 'Bu Ay' },
    { id: 'custom', label: 'Özel Tarih' }
  ];

  const fetchDiscountOrders = async () => {
    if (!token) return;
    try {
      setLoading(true);
      let url = `${getApiUrl()}/reports/discount?period=${period}`;
      
      if (period === 'custom' && customStartDate && customEndDate) {
        url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
      }

      console.log('📡 Fetching discount orders:', url);
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Discount orders received:', response.data?.length || 0, 'orders');
      setOrders(response.data || []);
    } catch (error: any) {
      console.error('❌ Fetch discount orders error:', error);
      console.error('Error response:', error.response?.data);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== 'custom' || (customStartDate && customEndDate)) {
      fetchDiscountOrders();
    }
  }, [period, customStartDate, customEndDate, token]);

  const getTotalDiscount = () => {
    return orders.reduce((sum, order) => sum + Number(order.iskonto || 0), 0);
  };

  const getTotalAmount = () => {
    return orders.reduce((sum, order) => sum + Number(order.tutar || 0), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white px-4 py-4 sticky top-0 z-30 shadow-md border-b-2 border-emerald-100 flex items-center justify-between backdrop-blur-sm bg-white/95">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => router.back()}
            className="p-2.5 hover:bg-emerald-50 rounded-xl transition-all duration-200 text-emerald-600 hover:shadow-md active:scale-95"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">İskonto Raporu</h1>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        {/* Period Filters */}
        <div className="bg-white rounded-3xl p-4 shadow-lg border-2 border-emerald-100 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={clsx(
                  "flex items-center px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border-2 transition-all duration-200",
                  period === p.id
                    ? "border-emerald-600 text-emerald-700 bg-emerald-50 shadow-md"
                    : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
                )}
              >
                {p.id === 'today' && <Calendar className="w-4 h-4 mr-2" />}
                {p.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Başlangıç</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Bitiş</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-xl">
            <Tag className="w-10 h-10 mb-3 opacity-80" />
            <p className="text-sm font-bold opacity-90 mb-1">Toplam İndirim</p>
            <p className="text-3xl font-black">{formatCurrency(getTotalDiscount())}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 text-white shadow-xl">
            <CreditCard className="w-10 h-10 mb-3 opacity-80" />
            <p className="text-sm font-bold opacity-90 mb-1">Toplam Tutar</p>
            <p className="text-3xl font-black">{formatCurrency(getTotalAmount())}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl p-6 text-white shadow-xl">
            <Calendar className="w-10 h-10 mb-3 opacity-80" />
            <p className="text-sm font-bold opacity-90 mb-1">Adisyon Sayısı</p>
            <p className="text-3xl font-black">{orders.length}</p>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-gray-300">
              <Tag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-semibold">İndirim yapılan adisyon bulunamadı</p>
            </div>
          ) : (
            orders.map((order, idx) => (
              <button
                key={idx}
                onClick={() => router.push(`/reports/orders/detail?id=${order.adsno}&type=closed`)}
                className="w-full bg-gradient-to-br from-white to-emerald-50/30 rounded-3xl p-5 shadow-md border-2 border-emerald-100 hover:shadow-xl hover:border-emerald-300 transition-all duration-200 text-left group"
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-emerald-500 p-2 rounded-xl shadow-md">
                      <Tag className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-black text-gray-900">
                      #{order.adsno}
                    </h3>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition" />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  {order.tarih && (
                    <div className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-2 text-gray-400" />
                      <span className="text-gray-600">{formatDate(order.tarih)}</span>
                    </div>
                  )}
                  
                  {order.kapanis_saati && (
                    <div className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-2 text-gray-400" />
                      <span className="text-gray-600">{formatTime(order.kapanis_saati)}</span>
                    </div>
                  )}

                  {order.masa_no !== undefined && (
                    <div className="flex items-center">
                      <MapPin className="w-3.5 h-3.5 mr-2 text-gray-400" />
                      <span className="text-gray-600">Masa No: {order.masa_no === 99999 ? 'Paket' : order.masa_no}</span>
                    </div>
                  )}

                  {(order.customer_name || order.mustid) && (
                    <div className="flex items-center">
                      <User className="w-3.5 h-3.5 mr-2 text-gray-400" />
                      <span className="text-gray-600 truncate">{order.customer_name || order.mustid}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-3 border-t-2 border-dashed border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Toplam Tutar</p>
                    <p className="text-xl font-black text-gray-900">{formatCurrency(order.tutar)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-600 font-bold mb-1">İndirim</p>
                    <p className="text-xl font-black text-emerald-600">-{formatCurrency(order.iskonto)}</p>
                  </div>
                </div>

                {order.payment_name && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center">
                      <CreditCard className="w-3.5 h-3.5 mr-2 text-gray-400" />
                      <span className="text-xs text-gray-600">{order.payment_name}</span>
                    </div>
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function DiscountReportPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>}>
      <DiscountReportContent />
    </Suspense>
  );
}
