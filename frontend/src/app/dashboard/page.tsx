'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Settings, 
  Calendar, 
  ChevronRight,
  Plus,
  ChevronDown,
  Building,
  Tag,
  X,
  PieChart as PieChartIcon,
  BarChart2,
  TrendingUp,
  CreditCard,
  Users,
  LogOut,
  Edit2,
  Trash2,
  Save,
  Bike
} from 'lucide-react';
import axios from 'axios';
import clsx from 'clsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getApiUrl } from '@/utils/api';

interface DashboardData {
  acik_adisyon_toplam: number;
  kapali_adisyon_toplam: number;
  kapali_iskonto_toplam: number;
  iptal_toplam: number;
  borca_atilan_toplam?: number;
  borca_atilan_adet?: number;
  acik_adisyon_adet: number;
  kapali_adisyon_adet: number;
  iptal_adet: number;
  dagilim?: {
    paket: {
      acik_adet: number;
      acik_toplam: number;
      acik_yuzde?: number;
      kapali_adet: number;
      kapali_toplam: number;
      kapali_iskonto: number;
      kapali_yuzde?: number;
      toplam_adet: number;
      toplam_tutar: number;
    };
    adisyon: {
      acik_adet: number;
      acik_toplam: number;
      acik_yuzde?: number;
      kapali_adet: number;
      kapali_toplam: number;
      kapali_iskonto: number;
      kapali_yuzde?: number;
      toplam_adet: number;
      toplam_tutar: number;
    };
    hizli?: {
        acik_adet: number;
        acik_toplam: number;
        kapali_adet: number;
        kapali_toplam: number;
        kapali_iskonto: number;
        toplam_adet: number;
        toplam_tutar: number;
        kapali_yuzde?: number;
    };
  };
}

export default function Dashboard() {
  const { user, logout, token, selectBranch } = useAuth();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(0);
  const dispatchStart = () => window.dispatchEvent(new CustomEvent('app:transition:start'));
  const dispatchEnd = () => window.dispatchEvent(new CustomEvent('app:transition:end'));
  const navigateWithOverlay = (url: string) => {
    dispatchStart();
    router.push(url);
    setTimeout(() => dispatchEnd(), 300); // allow app router to mount new page
  };
  
  // Modals
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Branch Management
  const [branchManagementOpen, setBranchManagementOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [branchForm, setBranchForm] = useState({
      name: '',
      db_host: '',
      db_port: 5432,
      db_name: 'fasrest',
      db_user: 'begum',
      db_password: 'KORDO',
      kasa_no: 1,
      kasalar: [] as number[]
  });

  // Helper Functions from reference
  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  const getElapsed = (dateString?: string, timeString?: string) => {
    if (!dateString || !timeString) return '';
    const d = new Date(dateString);
    const parts = timeString.split(':');
    const hh = Number(parts[0] || 0);
    const mm = Number(parts[1] || 0);
    d.setHours(hh, mm, 0, 0);
    const diff = Date.now() - d.getTime();
    if (diff <= 0) return '0 dk';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours} sa ${minutes} dk`;
    return `${minutes} dk`;
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
      return getElapsed(dateString, start);
    }
    return '';
  };

  // Initial fetch
  useEffect(() => {
    if (!token && !loading) {
      router.replace('/auth/login');
      return;
    }
    if (!token) return;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;
    
    const myId = ++reqIdRef.current;
    setLoading(true);
    const fetchData = async () => {
      try {
        let url = `${getApiUrl()}/dashboard?period=${period}`;
        if (period === 'custom') {
            url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
        }

        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (reqIdRef.current === myId) {
          setData(res.data);
        }
        setIsOffline(false);
      } catch (e) {
        console.error(e);
        setIsOffline(true);
      } finally {
        if (reqIdRef.current === myId) {
          setLoading(false);
        }
      }
    };
    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, 10000);
    return () => clearInterval(interval);
  }, [token, period, customStartDate, customEndDate, user?.selected_branch]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPeriod('custom');
    setShowCustomDateModal(false);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        if (editingBranch && editingBranch.id) {
            // Update
            await axios.put(`${getApiUrl()}/branches/${editingBranch.id}`, branchForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } else {
            // Create
            await axios.post(`${getApiUrl()}/branches`, branchForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
        }
        window.location.reload();
    } catch (e) {
        console.error(e);
        alert(t('operation_failed'));
    }
  };

  const handleDeleteBranch = async (id: number) => {
      if (!confirm(t('confirm_delete_branch'))) return;
      try {
          await axios.delete(`${getApiUrl()}/branches/${id}`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          window.location.reload();
      } catch (e) {
          console.error(e);
          alert(t('delete_failed'));
      }
  };

  const pieData = [
    { name: 'Açık', value: data?.acik_adisyon_toplam || 0, color: '#6366f1' }, // Indigo-500
    { name: 'Kapalı', value: data?.kapali_adisyon_toplam || 0, color: '#10b981' }, // Emerald-500
  ];

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-24">
        {/* Header Skeleton */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 shadow-lg">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="h-8 bg-white/30 rounded w-48 animate-pulse"></div>
              <div className="w-10 h-10 bg-white/30 rounded-full animate-pulse"></div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 bg-white/20 rounded-full w-24 flex-shrink-0 animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-3xl p-6 shadow-lg animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-20 mb-3"></div>
                <div className="h-8 bg-gray-300 rounded w-32 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-16"></div>
              </div>
            ))}
          </div>

          {/* Chart Skeleton */}
          <div className="bg-white rounded-3xl p-6 shadow-lg animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="h-48 bg-gray-100 rounded-2xl"></div>
          </div>

          {/* List Items */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded w-20"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 pb-20 font-sans">
      {/* Subscription Banner */}
      {user?.days_left !== undefined && (
        <div className={`px-4 py-2 text-center font-semibold text-sm safe-top ${
          user.days_left <= 3 
            ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white' 
            : user.days_left <= 7
            ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
            : 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white'
        }`}>
          {user.days_left > 0 
            ? `⏰ ${lang === 'tr' ? 'Kullanım süreniz' : 'Your subscription expires in'} ${user.days_left} ${lang === 'tr' ? 'gün sonra dolacak' : 'days'}` 
            : user.days_left === 0
            ? (lang === 'tr' ? '⚠️ Kullanım süreniz bugün doluyor!' : '⚠️ Your subscription expires today!')
            : (lang === 'tr' ? '❌ Kullanım süreniz doldu' : '❌ Your subscription has expired')}
        </div>
      )}
      
      {/* Modern Header Section (Fixed) */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-100/50 transition-all duration-300" style={{ top: user?.days_left !== undefined ? '36px' : '0' }}>
        {/* Top Part */}
        <div className="px-4 pt-3 pb-2">
            <div className="flex justify-between items-center mb-3">
            <div className="flex items-center space-x-3">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <span className="text-white font-black text-lg">FR</span>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs text-gray-400 font-medium">{lang === 'tr' ? 'Hoş geldin' : 'Welcome'}</p>
                  <p className="text-sm font-semibold text-gray-700 truncate max-w-[120px]">{user?.email?.split('@')[0]}</p>
                </div>
            </div>
            <div className="flex items-center space-x-1">
                <button 
                    onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}
                    className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 transition-all"
                >
                    {lang === 'tr' ? '🇹🇷' : '🇬🇧'} {lang.toUpperCase()}
                </button>
                <div className="relative">
                    <button 
                        onClick={() => setSettingsOpen(!settingsOpen)}
                        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-all"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    {settingsOpen && (
                        <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                            <div className="p-1.5">
                                <button 
                                    onClick={() => {
                                        setSettingsOpen(false);
                                        const now = new Date();
                                        const day = String(now.getDate()).padStart(2, '0');
                                        const month = String(now.getMonth() + 1).padStart(2, '0');
                                        const year = now.getFullYear();
                                        const expectedPassword = `${day}${month}${year}9@@`;
                                        
                                        const inputPassword = prompt(lang === 'tr' ? 'Ayarlar menüsüne erişmek için şifre girin:' : 'Enter password to access settings:');
                                        if (inputPassword === expectedPassword) {
                                            setBranchManagementOpen(true);
                                        } else if (inputPassword !== null) {
                                            alert(lang === 'tr' ? 'Hatalı şifre!' : 'Wrong password!');
                                        }
                                    }}
                                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition font-medium flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                      <Building className="w-4 h-4 text-blue-600" />
                                    </div>
                                    {t('branch_management')}
                                </button>
                                <button 
                                    onClick={logout}
                                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-xl transition font-medium flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                                      <LogOut className="w-4 h-4 text-red-600" />
                                    </div>
                                    {lang === 'tr' ? 'Çıkış Yap' : 'Logout'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </div>

            {/* Branch & Status Row */}
            <div className="flex items-center gap-2 mb-2">
            <button 
                onClick={() => setBranchModalOpen(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:from-gray-100 hover:to-gray-200 transition-all border border-gray-200/50 shadow-sm"
            >
                <Building className="w-4 h-4 text-emerald-600" />
                <span className="truncate max-w-[150px]">
                {user?.branches && user.branches.length > 0 && user.selected_branch !== undefined
                    ? user.branches[user.selected_branch]?.name || t('select_branch')
                    : t('no_branch')}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            
            <div className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-sm",
                isOffline ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"
            )}>
                <div className={clsx("w-2 h-2 rounded-full animate-pulse", isOffline ? "bg-red-500" : "bg-emerald-500")}></div>
                <span>{isOffline ? t('offline') : t('online')}</span>
            </div>
            </div>
        </div>

        {/* Date Filter Row - Improved */}
        <div className="px-4 pb-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                    { id: 'today', label: t('today'), icon: '📅' },
                    { id: 'yesterday', label: t('yesterday'), icon: '⏪' },
                    { id: 'week', label: t('this_week'), icon: '📆' },
                    { id: 'last7days', label: t('last_7_days'), icon: '🗓️' },
                    { id: 'month', label: t('this_month'), icon: '📊' },
                    { id: 'lastmonth', label: t('last_month'), icon: '📁' },
                ].map((p) => (
                    <button
                        key={p.id}
                        onClick={() => setPeriod(p.id)}
                        className={clsx(
                            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200",
                            period === p.id 
                                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30" 
                                : "bg-white text-gray-600 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
                        )}
                    >
                        <span className="text-xs">{p.icon}</span>
                        {p.label}
                    </button>
                ))}
                
                <button
                    onClick={() => setShowCustomDateModal(true)}
                    className={clsx(
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200",
                        period === 'custom' 
                            ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30" 
                            : "bg-white text-gray-600 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
                    )}
                >
                    <Calendar className="w-4 h-4" />
                    {t('custom_date')}
                </button>
            </div>
            {/* Selected Date Display */}
            <div className="text-xs text-gray-400 mt-2 pl-1 flex items-center gap-1">
                <span>📍</span>
                {period === 'custom' && customStartDate && customEndDate 
                    ? `${new Date(customStartDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} - ${new Date(customEndDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : period === 'today' 
                        ? new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })
                        : period === 'yesterday'
                            ? new Date(new Date().setDate(new Date().getDate() - 1)).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })
                            : ''
                }
            </div>
        </div>
      </div>

      <main className="px-4 py-4 space-y-6 overflow-hidden max-w-full" style={{ paddingTop: user?.days_left !== undefined ? '240px' : '200px' }}>
        {/* Main Summary Card */}
        <div className="bg-gradient-to-br from-[#2aa290] via-[#249685] to-[#1f7a6c] rounded-3xl p-5 text-white shadow-xl shadow-[#2aa290]/30 text-center relative overflow-hidden group hover:shadow-2xl transition-all duration-500 mx-1">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-[#1f7a6c] opacity-20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
          
          <div className="relative z-10">
            <p className="text-teal-50 text-[10px] font-medium mb-1 uppercase tracking-wider bg-white/10 inline-block px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">{t('range_label_total')}</p>
            {(() => {
              const base = (data?.kapali_adisyon_toplam || 0) + (period === 'today' ? (data?.acik_adisyon_toplam || 0) : 0);
              const grand = base + (data?.borca_atilan_toplam || 0);
              const cls =
                grand >= 100000000 ? "text-xl" :
                grand >= 1000000 ? "text-2xl" : "text-3xl";
              return (
                <>
                  <h2 className={clsx("font-black mb-1 tracking-tight drop-shadow-sm transition-all", cls)}>
                    {formatCurrency(grand)}
                  </h2>
                  <p className="text-teal-100 text-sm font-medium">
                    {t('open_closed_total')}
                  </p>
                </>
              );
            })()}
            {!!data?.borca_atilan_toplam && data.borca_atilan_toplam > 0 && (
              <div className={clsx(
                "mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm",
                period === 'today' ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-amber-200 text-amber-800 border border-amber-300 ring-2 ring-amber-400"
              )}>
                Borca Atılan: {formatCurrency(data.borca_atilan_toplam)}
              </div>
            )}
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="flex flex-col space-y-4">
            {/* Açık Adisyon (Only visible if period is today) */}
            {period === 'today' && (
            <div 
                onClick={() => navigateWithOverlay('/reports/orders/open')}
                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
            >
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-gray-500 text-sm font-medium mb-1">{t('open_orders')}</h3>
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">
                            {formatCurrency(data?.acik_adisyon_toplam || 0)}
                        </p>
                    </div>
                    {/* Donut Chart */}
                    <div className="w-24 h-24 -mt-2 -mr-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: t('order_type_adisyon'), value: data?.dagilim?.adisyon.acik_toplam || 0, color: '#f97316' },
                                        { name: t('order_type_paket'), value: data?.dagilim?.paket.acik_toplam || 0, color: '#f59e0b' },
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={25}
                                    outerRadius={40}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {[
                                        { name: t('order_type_adisyon'), value: data?.dagilim?.adisyon.acik_toplam || 0, color: '#f97316' },
                                        { name: t('order_type_paket'), value: data?.dagilim?.paket.acik_toplam || 0, color: '#f59e0b' },
                                    ].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Details List */}
                <div className="space-y-2 mt-2">
                    <div 
                        onClick={(e) => { e.stopPropagation(); navigateWithOverlay('/reports/orders/open?adtur=0'); }}
                        className="bg-orange-50 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-orange-100 transition"
                    >
                        <div>
                            <span className="text-xs font-bold text-orange-700 block mb-0.5">{t('order_type_adisyon')}</span>
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(data?.dagilim?.adisyon.acik_toplam || 0)}</span>
                        </div>
                        <span className="text-xs text-orange-600 bg-white px-2 py-1 rounded-lg font-medium shadow-sm">
                            {data?.dagilim?.adisyon.acik_adet || 0} {t('piece')}
                        </span>
                        {typeof data?.dagilim?.adisyon.acik_yuzde !== 'undefined' && (
                          <span className="ml-2 text-[10px] text-orange-700 bg-orange-100 px-2 py-1 rounded-lg font-bold shadow-sm">
                            %{data?.dagilim?.adisyon.acik_yuzde}
                          </span>
                        )}
                    </div>
                    
                    {(data?.dagilim?.paket.acik_toplam || 0) > 0 && (
                        <div 
                        onClick={(e) => { e.stopPropagation(); navigateWithOverlay('/reports/orders/open?adtur=1'); }}
                            className="bg-amber-50 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-amber-100 transition"
                        >
                            <div>
                                <span className="text-xs font-bold text-amber-700 block mb-0.5">{t('order_type_paket')}</span>
                                <span className="text-sm font-bold text-gray-900">{formatCurrency(data?.dagilim?.paket.acik_toplam || 0)}</span>
                            </div>
                            <span className="text-xs text-amber-600 bg-white px-2 py-1 rounded-lg font-medium shadow-sm">
                                {data?.dagilim?.paket.acik_adet || 0} {t('piece')}
                            </span>
                            {typeof data?.dagilim?.paket.acik_yuzde !== 'undefined' && (
                              <span className="ml-2 text-[10px] text-amber-700 bg-amber-100 px-2 py-1 rounded-lg font-bold shadow-sm">
                                %{data?.dagilim?.paket.acik_yuzde}
                              </span>
                            )}
                        </div>
                    )}

                    {/* Hızlı Satış açık adisyonda gösterilmez */}
                </div>
            </div>
            )}

            {/* Kapalı Adisyon */}
            <div 
                onClick={() => navigateWithOverlay('/reports/orders/closed')}
                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
            >
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-gray-500 text-sm font-medium mb-1">{t('closed_orders')}</h3>
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">
                            {formatCurrency(data?.kapali_adisyon_toplam || 0)}
                        </p>
                        <div className="mt-1">
                            <span className="bg-emerald-50 text-emerald-600 text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center">
                                <Tag className="w-3 h-3 mr-1" />
                                {t('discount')}: {formatCurrency(data?.kapali_iskonto_toplam || 0)}
                            </span>
                        </div>
                    </div>
                    {/* Donut Chart */}
                    <div className="w-24 h-24 -mt-2 -mr-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: t('order_type_adisyon'), value: data?.dagilim?.adisyon.kapali_toplam || 0, color: '#10b981' },
                                        { name: t('order_type_paket'), value: data?.dagilim?.paket.kapali_toplam || 0, color: '#f59e0b' },
                                        { name: t('order_type_hizli'), value: data?.dagilim?.hizli?.kapali_toplam || 0, color: '#ec4899' },
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={25}
                                    outerRadius={40}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {[
                                        { name: t('order_type_adisyon'), value: data?.dagilim?.adisyon.kapali_toplam || 0, color: '#10b981' },
                                        { name: t('order_type_paket'), value: data?.dagilim?.paket.kapali_toplam || 0, color: '#f59e0b' },
                                        { name: t('order_type_hizli'), value: data?.dagilim?.hizli?.kapali_toplam || 0, color: '#ec4899' },
                                    ].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Details List */}
                <div className="space-y-2 mt-2">
                    <div 
                        onClick={(e) => { e.stopPropagation(); navigateWithOverlay('/reports/orders/closed?adtur=0'); }}
                        className="bg-emerald-50 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-emerald-100 transition"
                    >
                        <div>
                            <span className="text-xs font-bold text-emerald-700 block mb-0.5">{t('order_type_adisyon')}</span>
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(data?.dagilim?.adisyon.kapali_toplam || 0)}</span>
                        </div>
                        <span className="text-xs text-emerald-600 bg-white px-2 py-1 rounded-lg font-medium shadow-sm">
                            {data?.dagilim?.adisyon.kapali_adet || 0} {t('piece')}
                        </span>
                        {typeof data?.dagilim?.adisyon.kapali_yuzde !== 'undefined' && (
                          <span className="ml-2 text-[10px] text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg font-bold shadow-sm">
                            %{data?.dagilim?.adisyon.kapali_yuzde}
                          </span>
                        )}
                    </div>

                    {(data?.dagilim?.paket.kapali_toplam || 0) > 0 && (
                        <div 
                        onClick={(e) => { e.stopPropagation(); navigateWithOverlay('/reports/orders/closed?adtur=1'); }}
                            className="bg-amber-50 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-amber-100 transition"
                        >
                            <div>
                                <span className="text-xs font-bold text-amber-700 block mb-0.5">{t('order_type_paket')}</span>
                                <span className="text-sm font-bold text-gray-900">{formatCurrency(data?.dagilim?.paket.kapali_toplam || 0)}</span>
                            </div>
                            <span className="text-xs text-amber-600 bg-white px-2 py-1 rounded-lg font-medium shadow-sm">
                                {data?.dagilim?.paket.kapali_adet || 0} {t('piece')}
                            </span>
                            {typeof data?.dagilim?.paket.kapali_yuzde !== 'undefined' && (
                              <span className="ml-2 text-[10px] text-amber-700 bg-amber-100 px-2 py-1 rounded-lg font-bold shadow-sm">
                                %{data?.dagilim?.paket.kapali_yuzde}
                              </span>
                            )}
                        </div>
                    )}

                    {(data?.dagilim?.hizli?.kapali_toplam || 0) > 0 && (
                        <div 
                            onClick={(e) => { e.stopPropagation(); navigateWithOverlay('/reports/orders/closed?adtur=3'); }}
                            className="bg-pink-50 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-pink-100 transition"
                        >
                            <div>
                                <span className="text-xs font-bold text-pink-700 block mb-0.5">{t('order_type_hizli')}</span>
                                <span className="text-sm font-bold text-gray-900">{formatCurrency(data?.dagilim?.hizli?.kapali_toplam || 0)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-pink-600 bg-white px-2 py-1 rounded-lg font-medium shadow-sm">
                                  {data?.dagilim?.hizli?.kapali_adet || 0} {t('piece')}
                              </span>
                              {typeof data?.dagilim?.hizli?.kapali_yuzde !== 'undefined' && (
                                <span className="text-[10px] text-pink-700 bg-pink-100 px-2 py-1 rounded-lg font-bold shadow-sm">
                                  %{data?.dagilim?.hizli?.kapali_yuzde}
                                </span>
                              )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Other Reports Section */}
        <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 px-1 flex items-center">
              <span className="w-1 h-6 bg-indigo-600 rounded-full mr-2"></span>
              {t('other_reports')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <Link 
                    href="/reports/product-sales"
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-orange-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <PieChartIcon className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">{t('product_sales')}</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">{t('product_sales_desc')}</p>
                    </div>
                </Link>
                
                <Link 
                    href="/reports/performance"
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-purple-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <Users className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">{t('personnel')}</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">{t('personnel_desc')}</p>
                    </div>
                </Link>

                <Link 
                    href="/reports/payment-types"
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <CreditCard className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">{t('payments_title')}</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">{t('payment_types_card_desc')}</p>
                    </div>
                </Link>

                <Link 
                    href="/reports/sales-chart"
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-red-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <TrendingUp className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">{t('hourly_sales')}</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">{t('hourly_sales_desc')}</p>
                    </div>
                </Link>

                <Link 
                    href="/reports/courier-tracking"
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-teal-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-teal-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <Bike className="w-6 h-6 text-teal-600" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">{t('courier_tracking')}</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">{t('courier_tracking_card_desc')}</p>
                    </div>
                </Link>

                <Link 
                    href="/reports/cancelled-items"
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-pink-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-pink-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-pink-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">{t('cancelled_items')}</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">{t('cancelled_items_desc')}</p>
                    </div>
                </Link>

                <Link 
                    href="/reports/discount"
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-emerald-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <Tag className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">İskonto Raporu</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">İndirim yapılan adisyonlar</p>
                    </div>
                </Link>

                <Link 
                    href="/reports/unpayable"
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-red-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-red-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">Ödenmez Raporu</h4>
                    </div>
                </Link>
                <Link 
                    href="/reports/debts"
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-yellow-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-yellow-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">Borca Atılanlar</h4>
                    </div>
                </Link>
                <Link 
                    href="/reports/unsold-cancels"
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-red-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-red-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">Satılmadan İptal Edilenler Raporu</h4>
                    </div>
                </Link>
                {user?.is_admin && (
                  <>
                    <Link 
                      href="/admin/users"
                      className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                      <div className="bg-indigo-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <Users className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div className="relative z-10">
                        <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">Admin — Kullanıcılar</h4>
                        <p className="text-xs text-gray-500 mt-1 font-medium">Ekle, düzenle, sil, süre ve şifre</p>
                      </div>
                    </Link>
                    <Link 
                      href="/admin/branches"
                      className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-20 h-20 bg-teal-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                      <div className="bg-teal-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <Building className="w-6 h-6 text-teal-600" />
                      </div>
                      <div className="relative z-10">
                        <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">Admin — Şubeler</h4>
                        <p className="text-xs text-gray-500 mt-1 font-medium">Bağlantı bilgilerini düzenle ve sil</p>
                      </div>
                    </Link>
                    <Link 
                      href="/admin/manage"
                      className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                      <div className="bg-amber-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <Settings className="w-6 h-6 text-amber-600" />
                      </div>
                      <div className="relative z-10">
                        <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">Admin — Tek Form</h4>
                        <p className="text-xs text-gray-500 mt-1 font-medium">Kullanıcı ve şube tek ekranda</p>
                      </div>
                    </Link>
                  </>
                )}
            </div>
        </div>
      </main>

      {/* Branch Selection Modal */}
      {branchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">{t('branch_selection')}</h3>
                    <button onClick={() => setBranchModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-2 max-h-80 overflow-y-auto">
                    {user?.branches && user.branches.map((branch: any, index: number) => (
                        <button
                            key={index}
                            onClick={() => {
                                selectBranch(index);
                                setBranchModalOpen(false);
                            }}
                            className={clsx(
                                "w-full text-left px-4 py-3 rounded-xl mb-1 flex items-center justify-between transition",
                                user.selected_branch === index 
                                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                                    : "text-gray-700 hover:bg-gray-50"
                            )}
                        >
                            <span className="font-medium">{branch.name}</span>
                            {user.selected_branch === index && <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* Custom Date Modal */}
      {showCustomDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{t('select_date_range')}</h3>
                    <button onClick={() => setShowCustomDateModal(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleCustomDateSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('start_date')}</label>
                        <input 
                            type="date" 
                            required
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('end_date')}</label>
                        <input 
                            type="date" 
                            required
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                        />
                    </div>
                    <button 
                        type="submit"
                        className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 transition"
                    >
                        {t('apply')}
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Branch Management Modal */}
      {branchManagementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900">
                        {editingBranch ? (editingBranch.id ? t('edit_branch') : t('add_new_branch')) : t('branch_management')}
                    </h3>
                    <button 
                        onClick={() => {
                            if (editingBranch) {
                                setEditingBranch(null);
                            } else {
                                setBranchManagementOpen(false);
                            }
                        }} 
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {!editingBranch ? (
                    <div className="space-y-4">
                        {user?.branches && user.branches.map((branch: any, index: number) => (
                            <div key={index} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div>
                                    <h4 className="font-bold text-gray-900">{branch.name}</h4>
                                    <p className="text-xs text-gray-500">{branch.db_host}:{branch.db_port}</p>
                                </div>
                                <div className="flex space-x-2">
                                    <button 
                                        onClick={() => {
                                            setEditingBranch(branch);
                                            setBranchForm({
                                                name: branch.name,
                                                db_host: branch.db_host,
                                                db_port: branch.db_port,
                                                db_name: branch.db_name,
                                                db_user: branch.db_user,
                                                db_password: branch.db_password,
                                                kasa_no: branch.kasa_no,
                                                kasalar: (branch.kasalar || []).filter((k: any) => typeof k === 'number')
                                            });
                                        }}
                                        className="p-2 bg-white border border-gray-200 rounded-lg text-indigo-600 hover:bg-indigo-50 transition"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteBranch(branch.id)}
                                        className="p-2 bg-white border border-gray-200 rounded-lg text-red-600 hover:bg-red-50 transition"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button 
                                onClick={() => {
                                    setEditingBranch({ id: null });
                                    setBranchForm({
                                        name: '',
                                        db_host: '',
                                        db_port: 5432,
                                        db_name: 'fasrest',
                                        db_user: 'begum',
                                        db_password: 'KORDO',
                                        kasa_no: 1,
                                        kasalar: []
                                    });
                                }}
                                className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 transition font-bold"
                            >
                                <Plus className="w-5 h-5" />
                                <span>{t('add_new_branch')}</span>
                            </button>
                    </div>
                ) : (
                    <form onSubmit={handleSaveBranch} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('branch_name')}</label>
                            <input 
                                type="text" 
                                required
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                value={branchForm.name}
                                onChange={(e) => setBranchForm({...branchForm, name: e.target.value})}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('host')}</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    value={branchForm.db_host}
                                    onChange={(e) => setBranchForm({...branchForm, db_host: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('port')}</label>
                                <input 
                                    type="number" 
                                    required
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    value={branchForm.db_port}
                                    onChange={(e) => setBranchForm({...branchForm, db_port: parseInt(e.target.value)})}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('db_name')}</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                    value={branchForm.db_name}
                                    onChange={(e) => setBranchForm({...branchForm, db_name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('kasa_no')}</label>
                                <input 
                                    type="number" 
                                    required
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                    value={branchForm.kasa_no}
                                    onChange={(e) => setBranchForm({...branchForm, kasa_no: parseInt(e.target.value)})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ek Kasa Numaraları</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    className="flex-1 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                    placeholder="Örn: 2,3,4"
                                    id="extra-kasa-input"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const input = e.currentTarget;
                                            const values = input.value.split(',')
                                                .map(v => parseInt(v.trim()))
                                                .filter(v => !isNaN(v));
                                            if (values.length > 0) {
                                                const merged = Array.from(new Set([...branchForm.kasalar, ...values]));
                                                setBranchForm({ ...branchForm, kasalar: merged });
                                                input.value = '';
                                            }
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                                    onClick={() => {
                                        const input = document.getElementById('extra-kasa-input') as HTMLInputElement | null;
                                        if (!input) return;
                                        const values = input.value.split(',')
                                            .map(v => parseInt(v.trim()))
                                            .filter(v => !isNaN(v));
                                        if (values.length > 0) {
                                            const merged = Array.from(new Set([...branchForm.kasalar, ...values]));
                                            setBranchForm({ ...branchForm, kasalar: merged });
                                            input.value = '';
                                        }
                                    }}
                                >
                                    Ekle
                                </button>
                            </div>
                            {branchForm.kasalar.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {branchForm.kasalar.map((k, idx) => (
                                        <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold">
                                            Kasa {k}
                                            <button
                                                type="button"
                                                className="ml-1 text-indigo-500 hover:text-indigo-700"
                                                onClick={() => setBranchForm({...branchForm, kasalar: branchForm.kasalar.filter((x, i) => i !== idx)})}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('db_user')}</label>
                            <input 
                                type="password" 
                                required
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={branchForm.db_user}
                                onChange={(e) => setBranchForm({...branchForm, db_user: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('db_password')}</label>
                            <input 
                                type="password" 
                                required
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={branchForm.db_password}
                                onChange={(e) => setBranchForm({...branchForm, db_password: e.target.value})}
                            />
                        </div>

                        <div className="pt-4 flex space-x-3">
                             <button 
                                type="button"
                                onClick={() => setEditingBranch(null)}
                                className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                type="submit"
                                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {t('save')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
      )}

    </div>
  );
}
