'use client';

import React from 'react';
import { X, User, CreditCard, Clock, Calendar, MapPin } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';

interface OrderDetailModalProps {
  order: any;
  onClose: () => void;
}

export default function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
  const { t } = useI18n();

  if (!order) return null;

  const formatCurrency = (val: number) => {
    if (isNaN(val) || val === null || val === undefined) return '₺0,00';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">{t('order_detail')}</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-orange-100 text-sm">#{order.adsno}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Customer */}
          {(order.customer_name || order.mustid) && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('customer')}</p>
                <p className="font-semibold text-gray-900">{order.customer_name || order.mustid || '-'}</p>
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('date')}</p>
                <p className="font-semibold text-gray-900 text-sm">{order.tarih || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('time')}</p>
                <p className="font-semibold text-gray-900 text-sm">{order.kapanis_saati || order.acilis_saati || '-'}</p>
              </div>
            </div>
          </div>

          {/* Table & Waiter */}
          <div className="grid grid-cols-2 gap-3">
            {order.masano && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('table')}</p>
                  <p className="font-semibold text-gray-900">{order.masano}</p>
                </div>
              </div>
            )}

            {order.garson_adi && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('waiter')}</p>
                  <p className="font-semibold text-gray-900 text-sm">{order.garson_adi}</p>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method */}
          {order.payment_name && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('payment_method')}</p>
                <p className="font-semibold text-gray-900">{order.payment_name}</p>
              </div>
            </div>
          )}

          {/* Amounts */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('order_total')}</span>
              <span className="font-semibold text-gray-900">{formatCurrency(parseFloat(order.tutar) || 0)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('discount')}</span>
              <span className="font-bold text-red-600">{formatCurrency(parseFloat(order.iskonto) || 0)}</span>
            </div>

            <div className="flex justify-between items-center pt-3 border-t-2">
              <span className="text-lg font-bold text-gray-900">{t('net_total')}</span>
              <span className="text-xl font-black text-green-600">
                {formatCurrency((parseFloat(order.tutar) || 0) - (parseFloat(order.iskonto) || 0))}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 px-6 rounded-xl font-medium hover:shadow-lg transition-all active:scale-95"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
