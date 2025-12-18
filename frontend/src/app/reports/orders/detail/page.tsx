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
  Tag,
  Share2,
  FileText,
  MessageCircle
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
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [customerName, setCustomerName] = useState('');

  const id = searchParams.get('id');
  const type = searchParams.get('type') || 'closed';
  const adtur = searchParams.get('adtur');

  useEffect(() => {
    if (id) {
        fetchOrderDetail();
    }
  }, [id, type, adtur]);

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!showShareMenu) return;
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('.share-menu-container')) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside as EventListener);
    return () => document.removeEventListener('mousedown', handleClickOutside as EventListener);
  }, [showShareMenu]);

  const fetchOrderDetail = async () => {
    if (!token) return;
    try {
      setLoading(true);
      let url = `${getApiUrl()}/reports/order-detail/${id}?order_type=${type}`;
      if (adtur) {
        url += `&adtur=${adtur}`;
      }
      
      console.log('📡 Fetching order detail:', url);
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Order data received:', response.data);
      const payload = response.data || {};
      payload.order_type = type;
      setOrderData(payload);
    } catch (error: any) {
      console.error('❌ Fetch order detail error:', error);
      console.error('Error response:', error.response?.data);
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
    if (!orderData || !orderData.items || !Array.isArray(orderData.items)) return 0;
    return orderData.items.reduce((sum: number, item: any) => {
      const itemTotal = item.total || item.toplam || 0;
      return sum + Number(itemTotal);
    }, 0);
  };
  
  const getTotalPaid = () => {
    return Number(orderData?.toplam_tutar || 0);
  };

  const generateShareText = () => {
    if (!orderData) return '';
    
    let text = `🧾 *Adisyon Detayı*\n\n`;
    text += `📋 Adisyon No: #${orderData.adsno}\n`;
    text += `📅 Tarih: ${formatDate(orderData.tarih)}\n`;
    
    if (orderData.masano) {
      text += `🪑 Masa: ${orderData.masano === 99999 ? 'Paket' : orderData.masano}\n`;
    }
    
    if (orderData.garson) {
      text += `👤 Garson: ${orderData.garson}\n`;
    }
    
    if (orderData.customer_name) {
      text += `👥 Müşteri: ${orderData.customer_name}\n`;
    }
    
    if (orderData.acilis_saati) {
      text += `🕐 Açılış: ${formatTime(orderData.acilis_saati)}\n`;
    }
    
    if (orderData.kapanis_saati) {
      text += `🕐 Kapanış: ${formatTime(orderData.kapanis_saati)}\n`;
    }
    
    text += `\n*📦 Ürünler:*\n`;
    if (orderData.items && Array.isArray(orderData.items)) {
      orderData.items.forEach((item: any, idx: number) => {
        const qty = item.quantity || item.miktar || 1;
        const price = item.price || item.birim_fiyat || 0;
        const total = item.total || item.toplam || 0;
        const name = item.product_name || item.urun_adi || 'Ürün';
        const sturu = item.sturu || 0;
        
        let statusEmoji = '';
        if (sturu === 4) statusEmoji = '❌ ';
        else if (sturu === 1) statusEmoji = '🎁 ';
        else if (sturu === 2) statusEmoji = '↩️ ';
        
        text += `${idx + 1}. ${statusEmoji}${name}\n`;
        text += `   ${qty}x × ${formatCurrency(price)} = ${formatCurrency(total)}\n`;
        
        if (item.ack1) text += `   📝 ${item.ack1}\n`;
        if (item.ack2) text += `   📝 ${item.ack2}\n`;
        if (item.ack3) text += `   📝 ${item.ack3}\n`;
      });
    }
    
    text += `\n*💰 Özet:*\n`;
    text += `Ara Toplam: ${formatCurrency(getItemsSubtotal())}\n`;
    
    if (orderData.toplam_iskonto > 0) {
      text += `İndirim: -${formatCurrency(orderData.toplam_iskonto)}\n`;
    }
    
    text += `*Toplam: ${formatCurrency(getTotalPaid())}*\n`;
    
    if (orderData.payment_name) {
      text += `\n💳 Ödeme: ${orderData.payment_name}\n`;
    }
    
    text += `\n_FR Rapor - ${new Date().toLocaleString('tr-TR')}_`;
    
    return text;
  };

  const shareWhatsApp = () => {
    const text = generateShareText();
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
    setShowShareMenu(false);
  };

  const sharePDF = () => {
    // PDF export için basit bir çözüm - window.print kullanarak
    window.print();
    setShowShareMenu(false);
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
      <div className="bg-white px-4 py-4 sticky top-0 z-30 shadow-md border-b-2 border-indigo-100 flex items-center justify-between backdrop-blur-sm bg-white/95 no-print">
        <div className="flex items-center space-x-4">
            <button 
                onClick={() => router.back()}
                className="p-2.5 hover:bg-indigo-50 rounded-xl transition-all duration-200 text-indigo-600 hover:shadow-md active:scale-95"
            >
                <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('order_detail')}</h1>
        </div>
        
        {/* Share Button */}
        <div className="relative z-50">
            <button 
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="p-2.5 hover:bg-indigo-50 rounded-xl transition-all duration-200 text-indigo-600 hover:shadow-md active:scale-95"
            >
                <Share2 className="w-6 h-6" />
            </button>
            
            {/* Share Menu Dropdown */}
            {showShareMenu && (
                <div className="share-menu-container absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border-2 border-indigo-100 overflow-hidden z-[100] animate-in fade-in zoom-in duration-200">
                    <div className="p-2">
                        <button
                            onClick={shareWhatsApp}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 rounded-xl transition-all duration-200 text-left group"
                        >
                            <div className="bg-green-500 p-2 rounded-lg group-hover:scale-110 transition-transform">
                                <MessageCircle className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">WhatsApp</p>
                                <p className="text-xs text-gray-500">Mesaj olarak paylaş</p>
                            </div>
                        </button>
                        
                        <div className="h-px bg-gray-100 my-2"></div>
                        
                        <button
                            onClick={sharePDF}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 rounded-xl transition-all duration-200 text-left group"
                        >
                            <div className="bg-red-500 p-2 rounded-lg group-hover:scale-110 transition-transform">
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">PDF / Yazdır</p>
                                <p className="text-xs text-gray-500">PDF olarak kaydet</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto w-full print-content">
        {/* Info Card */}
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-6 shadow-2xl mb-6 text-white relative overflow-hidden">
             {/* Decorative Background Elements */}
             <div className="absolute top-0 right-0 -mr-16 -mt-16 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
             <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-40 h-40 bg-purple-400 opacity-10 rounded-full blur-2xl"></div>
             <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-pink-400 opacity-5 rounded-full blur-xl"></div>

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
                </div>
            </div>
        </div>

        {/* Products Section */}
        <div className="mb-6">
            <div className="flex items-center gap-3 mb-5 px-1">
                <ShoppingBasket className="w-6 h-6 text-indigo-600" />
                <h2 className="text-2xl font-black text-gray-900">{t('products')}</h2>
                {orderData?.items && (
                    <span className="ml-auto bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full text-sm">
                        {orderData.items.length} ürün
                    </span>
                )}
            </div>
            
            <div className="space-y-3">
                {orderData && Array.isArray(orderData.items) && orderData.items.length > 0 && orderData.items.map((item: any, index: number) => {
                    // sturu: 4 = iptal (kırmızı), 1 = ikram (mavi), 2 = iade (turuncu), diğer = normal
                    const sturu = item.sturu ?? 0;
                    const isIptal = sturu === 4; // İptal
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
                        <div key={index} className={clsx(
                            "relative rounded-2xl p-5 shadow-md border-2 transition-all duration-200 hover:shadow-lg",
                            borderColor,
                            isIptal && "opacity-75"
                        )}>
                            {/* Status Badge - Top Right */}
                            {(isIptal || isIkram || isIade) && (
                                <div className="absolute top-3 right-3">
                                    {isIptal && (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-3 py-1.5 rounded-full border-2 border-red-200 shadow-sm">
                                            ❌ İPTAL
                                        </span>
                                    )}
                                    {isIkram && (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1.5 rounded-full border-2 border-blue-200 shadow-sm">
                                            🎁 İKRAM
                                        </span>
                                    )}
                                    {isIade && (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1.5 rounded-full border-2 border-orange-200 shadow-sm">
                                            ↩️ İADE
                                        </span>
                                    )}
                                </div>
                            )}
                            
                            <div className="flex justify-between items-start mb-3 pr-20">
                                <div className="flex-1">
                                    <h3 className={clsx(
                                        "text-lg font-bold leading-tight mb-1",
                                        textColor,
                                        isIptal && "line-through opacity-60"
                                    )}>
                                        {item.product_name || item.urun_adi || 'Ürün'}
                                    </h3>
                                    <div className={clsx(
                                        "flex items-center gap-2 text-sm font-medium",
                                        isIptal ? "text-red-500" : "text-gray-600"
                                    )}>
                                        <span className="bg-gray-100 px-2.5 py-1 rounded-lg">
                                            {(item.quantity ?? item.miktar) || 1}x
                                        </span>
                                        <span>×</span>
                                        <span>{formatCurrency((item.price ?? item.birim_fiyat) || 0)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center pt-3 border-t-2 border-dashed border-gray-200">
                                <span className="text-sm font-semibold text-gray-600">Toplam</span>
                                <span className={clsx(
                                    "text-xl font-black",
                                    priceColor,
                                    isIptal && "line-through opacity-60"
                                )}>
                                    {formatCurrency((item.total ?? item.toplam) || 0)}
                                </span>
                            </div>
                            
                            {(item.ack1 || item.ack2 || item.ack3 || (item.notes && item.notes.length > 0)) && (
                                <div className="mt-4 pt-4 border-t border-gray-200 bg-amber-50/50 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                                    <p className="text-xs font-semibold text-amber-800 mb-2">📝 Notlar:</p>
                                    <div className="space-y-1">
                                        {item.ack1 && <p className="text-xs text-amber-700 font-medium flex items-start"><span className="mr-2 mt-0.5">•</span><span>{item.ack1}</span></p>}
                                        {item.ack2 && <p className="text-xs text-amber-700 font-medium flex items-start"><span className="mr-2 mt-0.5">•</span><span>{item.ack2}</span></p>}
                                        {item.ack3 && <p className="text-xs text-amber-700 font-medium flex items-start"><span className="mr-2 mt-0.5">•</span><span>{item.ack3}</span></p>}
                                        {item.notes && item.notes.map((note: string, i: number) => (
                                            <p key={i} className="text-xs text-amber-700 font-medium flex items-start"><span className="mr-2 mt-0.5">•</span><span>{note}</span></p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {(!orderData || !orderData.items || orderData.items.length === 0) && (
                    <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl border-2 border-dashed border-gray-300">
                        <div className="bg-white rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center shadow-md">
                            <ShoppingBasket className="w-10 h-10 text-gray-400" />
                        </div>
                        <p className="text-gray-600 text-lg font-semibold">{t('no_products')}</p>
                        <p className="text-gray-400 text-sm mt-1">Bu adisyonda henüz ürün bulunmuyor</p>
                    </div>
                )}
            </div>
        </div>

        {/* Summary Card */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-6 shadow-xl border-2 border-gray-200">
            <div className="space-y-4">
                <div className="flex justify-between items-center pb-3">
                    <span className="text-gray-600 font-semibold flex items-center gap-2">
                        <ShoppingBasket className="w-5 h-5" />
                        {t('subtotal')}
                    </span>
                    <span className="text-lg font-bold text-gray-900">{formatCurrency(getItemsSubtotal())}</span>
                </div>
                {orderData?.toplam_iskonto > 0 && (
                    <div className="flex justify-between items-center pb-3 bg-emerald-50 -mx-6 px-6 py-3 rounded-xl border-l-4 border-emerald-500">
                        <span className="font-semibold flex items-center gap-2 text-emerald-700">
                            <Tag className="w-5 h-5"/> 
                            {t('discount')}
                        </span>
                        <span className="text-lg font-bold text-emerald-600">-{formatCurrency(orderData.toplam_iskonto)}</span>
                    </div>
                )}
                <div className="border-t-2 border-dashed border-gray-300 my-4"></div>
                <div className="flex justify-between items-center bg-indigo-600 -mx-6 -mb-6 px-6 py-5 rounded-b-3xl">
                    <span className="text-lg font-bold text-white flex items-center gap-2">
                        <CreditCard className="w-6 h-6" />
                        {t('total_paid')}
                    </span>
                    <span className="text-3xl font-black text-white drop-shadow-lg">{formatCurrency(getTotalPaid())}</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .bg-gradient-to-br,
          .bg-gradient-to-br * {
            background: white !important;
            color: black !important;
          }
          .shadow-2xl, .shadow-xl, .shadow-lg, .shadow-md {
            box-shadow: none !important;
          }
          .border-indigo-600, .border-emerald-600 {
            border-color: #000 !important;
          }
        }
      `}</style>
      
      <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
        <OrderDetailContent />
      </Suspense>
    </>
  );
}
