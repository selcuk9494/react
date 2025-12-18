'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Clock, 
  MapPin, 
  CreditCard,
  Timer,
  CheckCircle,
  Users,
  ShoppingBasket,
  Tag
} from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '@/utils/api';
import clsx from 'clsx';

function OrderDetailContent() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang } = useI18n();

  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');

  const id = searchParams.get('id');
  const type = searchParams.get('type') || 'closed';
  const adtur = searchParams.get('adtur');

  useEffect(() => {
    if (id) {
        fetchOrderDetail();
    }
  }, [id, type]);

  const fetchOrderDetail = async () => {
    if (!token) return;
    try {
      setLoading(true);
      let url = `${getApiUrl()}/reports/order-detail/${id}?order_type=${type}`;
      if (adtur) {
        url += `&adtur=${adtur}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = response.data || {};
      payload.order_type = type;
      setOrderData(payload);
    } catch (error) {
      console.error('Fetch order detail error:', error);
      // alert(t('error_loading_data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        if (!token) return;
        if (!orderData?.mustid) return;
        if (orderData?.customer_name) {
          setCustomerName(orderData.customer_name);
          return;
        }
        const res = await axios.get(`${getApiUrl()}/reports/customer?id=${orderData.mustid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const full = res.data?.full_name || res.data?.first_name || '';
        if (full) setCustomerName(full);
      } catch (e) {
        console.error(e);
      }
    };
    fetchCustomer();
  }, [orderData?.mustid]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-US', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getElapsedMinutes = (dateString?: string, timeString?: string) => {
    if (!dateString || !timeString) return 0;
    const d = new Date(dateString);
    const parts = timeString.split(':');
    const hh = Number(parts[0] || 0);
    const mm = Number(parts[1] || 0);
    d.setHours(hh, mm, 0, 0);
    const diff = Date.now() - d.getTime();
    if (diff <= 0) return 0;
    return Math.floor(diff / 60000);
  };

  const getElapsedText = (dateString?: string, start?: string, end?: string, type?: string) => {
    if (type === 'closed' && start && end && dateString) {
      const ds = new Date(dateString);
      const s = start.split(':');
      const e = end.split(':');
      const dStart = new Date(ds); dStart.setHours(Number(s[0]||0), Number(s[1]||0), 0, 0);
      const dEnd = new Date(ds); dEnd.setHours(Number(e[0]||0), Number(e[1]||0), 0, 0);
      let diff = dEnd.getTime() - dStart.getTime();
      if (diff < 0) diff = 0;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      if (hours > 0) return `${hours} sa ${minutes} dk`;
      return `${minutes} dk`;
    }
    if (start && dateString) {
      const ds = new Date(dateString);
      const s = start.split(':');
      const hh = Number(s[0]||0);
      const mm = Number(s[1]||0);
      ds.setHours(hh, mm, 0, 0);
      const diff = Date.now() - ds.getTime();
      if (diff <= 0) return '0 dk';
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      if (hours > 0) return `${hours} sa ${minutes} dk`;
      return `${minutes} dk`;
    }
    return '';
  };

  const getItemsSubtotal = () => {
    if (!orderData || !orderData.items) return 0;
    return orderData.items.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
  };
  const getTotalPaid = () => {
    return orderData?.toplam_tutar || 0;
  };

  const paymentLabel = (orderData?.payment_name || (orderData?.order_type === 'open' ? t('payment_not_received') : t('unspecified'))) as string;

  if (loading) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white px-4 py-4 sticky top-0 z-40 shadow-sm border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-4">
            <button 
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-full transition text-gray-700"
            >
                <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">{t('order_detail')}</h1>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto w-full">
        {/* Info Card */}
        <div className="bg-indigo-600 rounded-2xl p-6 shadow-lg mb-6 text-white relative overflow-hidden">
             {/* Decorative Background Circles */}
             <div className="absolute top-0 right-0 -mr-10 -mt-10 w-32 h-32 bg-white opacity-10 rounded-full"></div>
             <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-32 h-32 bg-white opacity-10 rounded-full"></div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-indigo-200 text-sm font-medium mb-1">{t('order_no')}</p>
                                <p className="text-3xl font-bold text-white">#{orderData?.adsno || id}</p>
                                {typeof orderData?.adtur !== 'undefined' && (
                                    <div className="mt-1 bg-white/10 rounded-lg inline-flex items-center px-2 py-0.5">
                                        <span className="text-[10px] font-bold text-indigo-100">
                                            {orderData.adtur===0 ? t('order_type_adisyon') : (orderData.adtur===1 ? t('order_type_paket') : (orderData.adtur===3 ? t('order_type_hizli') : 'Diğer'))}
                                        </span>
                                    </div>
                                )}
                            </div>
                            {orderData?.type_label && (
                                <div className="bg-indigo-500/50 backdrop-blur-sm border border-indigo-400/30 px-3 py-1.5 rounded-lg">
                                    <span className="text-xs font-bold text-indigo-100">
                                        {orderData.type_label}
                                    </span>
                                </div>
                            )}
                        </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                    {((orderData?.masa_no ?? orderData?.masano) !== undefined && (orderData?.masa_no ?? orderData?.masano) !== null && (orderData?.masa_no ?? orderData?.masano) !== 99999) && (
                        <div className="flex items-center space-x-2">
                            <div className="p-1.5 bg-indigo-500/30 rounded-lg">
                                {/* Restaurant Icon alternative */}
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <div>
                              <p className="text-xs text-indigo-200">{t('table_no_label').replace(':','')}</p>
                              <p className="text-sm font-semibold">{(orderData?.masa_no ?? orderData?.masano) === 0 ? t('order_type_paket') : `Masa ${(orderData?.masa_no ?? orderData?.masano)}`}</p>
                            </div>
                        </div>
                    )}
                    
                    {orderData?.tarih && (
                        <div className="flex items-center space-x-2">
                             <div className="p-1.5 bg-indigo-500/30 rounded-lg">
                                <Calendar className="w-4 h-4 text-indigo-200" />
                            </div>
                            <div>
                                <p className="text-xs text-indigo-200">{t('date')}</p>
                                <p className="text-sm font-semibold">{formatDate(orderData.tarih)}</p>
                            </div>
                        </div>
                    )}

                    {(orderData?.garson || orderData?.garson_adi) && (
                         <div className="flex items-center space-x-2">
                             <div className="p-1.5 bg-indigo-500/30 rounded-lg">
                                <User className="w-4 h-4 text-indigo-200" />
                            </div>
                            <div>
                                <p className="text-xs text-indigo-200">{t('waiter')}</p>
                                <p className="text-sm font-semibold truncate max-w-[120px]">{orderData.garson || orderData.garson_adi}</p>
                            </div>
                        </div>
                    )}

                    {(orderData?.sipyer || orderData?.sipyer_name) && (
                         <div className="flex items-center space-x-2">
                             <div className="p-1.5 bg-indigo-500/30 rounded-lg">
                                <MapPin className="w-4 h-4 text-indigo-200" />
                            </div>
                            <div>
                                <p className="text-xs text-indigo-200">{t('order_place')}</p>
                                <p className="text-sm font-semibold">
                                    {orderData.sipyer_name || ((orderData.sipyer === 2) ? 'Paket' : ((orderData.sipyer === 1 && Number(orderData.masano) === 99999) ? 'Hızlı Satış' : 'Adisyon'))}
                                </p>
                            </div>
                        </div>
                    )}

                    {orderData?.acilis_saati && (
                        <div className="flex items-center space-x-2">
                             <div className="p-1.5 bg-indigo-500/30 rounded-lg">
                                <Clock className="w-4 h-4 text-indigo-200" />
                            </div>
                            <div>
                                <p className="text-xs text-indigo-200">{t('opening')}</p>
                                <p className="text-sm font-semibold">{formatTime(orderData.acilis_saati)}</p>
                            </div>
                        </div>
                    )}

                     {orderData?.kapanis_saati && orderData?.order_type === 'closed' && (
                        <div className="flex items-center space-x-2">
                             <div className="p-1.5 bg-indigo-500/30 rounded-lg">
                                <CheckCircle className="w-4 h-4 text-emerald-300" />
                            </div>
                            <div>
                                <p className="text-xs text-indigo-200">{t('closing')}</p>
                                <p className="text-sm font-semibold">{formatTime(orderData.kapanis_saati)}</p>
                            </div>
                        </div>
                    )}

                     {(orderData?.customer_name || orderData?.mustid) && (
                         <div className="flex items-center space-x-2 col-span-2">
                             <div className="p-1.5 bg-indigo-500/30 rounded-lg">
                                <Users className="w-4 h-4 text-indigo-200" />
                            </div>
                            <div>
                                <p className="text-xs text-indigo-200">{t('customer')}</p>
                                <p className="text-sm font-semibold">{orderData.customer_name || orderData.mustid}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center space-x-2 col-span-2">
                         <div className="p-1.5 bg-indigo-500/30 rounded-lg">
                            <CreditCard className="w-4 h-4 text-indigo-200" />
                        </div>
                        <div>
                            <p className="text-xs text-indigo-200">{t('payment')}</p>
                            <p className="text-sm font-semibold">{paymentLabel}</p>
                        </div>
                    </div>

                        {orderData?.acilis_saati && (
                            <div className="flex items-center space-x-2 col-span-2">
                                <div className="p-1.5 bg-indigo-500/30 rounded-lg">
                                    <Timer className="w-4 h-4 text-indigo-200" />
                                </div>
                                <div>
                                    <p className="text-xs text-indigo-200">{orderData?.order_type === 'closed' ? t('duration') : t('elapsed')}</p>
                                    <p className={clsx(
                                        "text-sm font-semibold",
                                        !orderData.kapanis_saati && getElapsedMinutes(orderData.tarih, orderData.acilis_saati) > 60 ? "text-red-300 font-bold" : ""
                                    )}>
                                        {getElapsedText(orderData?.tarih, orderData?.acilis_saati, orderData?.kapanis_saati, orderData?.order_type)}
                                    </p>
                                </div>
                            </div>
                        )}
                        {typeof orderData?.mustid !== 'undefined' && (
                            <div className="flex items-center space-x-2 col-span-2">
                              <div className="p-1.5 bg-indigo-500/30 rounded-lg">
                                <Users className="w-4 h-4 text-indigo-200" />
                              </div>
                              <div>
                                <p className="text-xs text-indigo-200">Müşteri</p>
                                <p className="text-sm font-semibold">{customerName || orderData.customer_name || orderData.mustid}</p>
                              </div>
                            </div>
                        )}
                </div>
            </div>
        </div>

        {/* Products Section */}
        <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 px-1">{t('products')}</h2>
            
            <div className="space-y-3">
                {orderData && orderData.items && orderData.items.map((item: any, index: number) => {
                    // sturu: 0 = iptal (kırmızı), 1 = ikram (mavi), 2 = iade (turuncu), diğer = normal
                    const sturu = item.sturu ?? 0;
                    const isIptal = sturu === 4 || sturu === 0; // İptal
                    const isIkram = sturu === 1; // İkram
                    const isIade = sturu === 2; // İade
                    
                    const borderColor = isIptal ? 'border-red-300 bg-red-50' : 
                                       isIkram ? 'border-blue-300 bg-blue-50' : 
                                       isIade ? 'border-orange-300 bg-orange-50' : 
                                       'border-gray-100';
                    
                    const textColor = isIptal ? 'text-red-700' : 
                                     isIkram ? 'text-blue-700' : 
                                     isIade ? 'text-orange-700' : 
                                     'text-gray-900';
                    
                    const priceColor = isIptal ? 'text-red-600' : 
                                      isIkram ? 'text-blue-600' : 
                                      isIade ? 'text-orange-600' : 
                                      'text-emerald-600';
                    
                    return (
                        <div key={index} className={clsx("bg-white rounded-2xl p-4 shadow-sm border", borderColor)}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                    <h3 className={clsx("text-base font-bold", textColor, isIptal && "line-through")}>
                                        {item.product_name || item.urun_adi || 'Ürün'}
                                    </h3>
                                    {isIptal && <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full mt-1 inline-block">İPTAL</span>}
                                    {isIkram && <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full mt-1 inline-block">İKRAM</span>}
                                    {isIade && <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full mt-1 inline-block">İADE</span>}
                                </div>
                                <span className={clsx("text-base font-bold ml-4", priceColor, isIptal && "line-through")}>
                                    {formatCurrency((item.total ?? item.toplam) || 0)}
                                </span>
                            </div>
                            <div className={clsx("flex justify-between items-center text-sm", isIptal ? "text-red-500" : "text-gray-500")}>
                                <span>
                                    {(item.quantity ?? item.miktar) || 1} {t('quantity').toLowerCase()} × {formatCurrency((item.price ?? item.birim_fiyat) || 0)}
                                </span>
                            </div>
                            {(item.ack1 || item.ack2 || item.ack3 || (item.notes && item.notes.length > 0)) && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    {item.ack1 && <p className="text-xs text-amber-600 italic flex items-center"><span className="mr-1">📝</span> {item.ack1}</p>}
                                    {item.ack2 && <p className="text-xs text-amber-600 italic flex items-center"><span className="mr-1">📝</span> {item.ack2}</p>}
                                    {item.ack3 && <p className="text-xs text-amber-600 italic flex items-center"><span className="mr-1">📝</span> {item.ack3}</p>}
                                    {item.notes && item.notes.map((note: string, i: number) => (
                                        <p key={i} className="text-xs text-amber-600 italic flex items-center"><span className="mr-1">📝</span> {note}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {(!orderData || !orderData.items || orderData.items.length === 0) && (
                    <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 border-dashed">
                        <ShoppingBasket className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">{t('no_products')}</p>
                    </div>
                )}
            </div>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">{t('subtotal')}</span>
                    <span className="font-bold text-gray-900">{formatCurrency(getItemsSubtotal())}</span>
                </div>
                {orderData?.toplam_iskonto > 0 && (
                    <div className="flex justify-between items-center text-emerald-600">
                        <span className="font-medium flex items-center"><Tag className="w-4 h-4 mr-1.5"/> {t('discount')}</span>
                        <span className="font-bold">-{formatCurrency(orderData.toplam_iskonto)}</span>
                    </div>
                )}
                <div className="border-t border-gray-100 my-3"></div>
                <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">{t('total_paid')}</span>
                    <span className="text-2xl font-bold text-indigo-600">{formatCurrency(getTotalPaid())}</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
      <OrderDetailContent />
    </Suspense>
  );
}
