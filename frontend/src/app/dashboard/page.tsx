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
  Bike,
  Package
} from 'lucide-react';
import axios from 'axios';
import clsx from 'clsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getApiUrl } from '@/utils/api';
import AutoFitText from '@/components/AutoFitText';

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
  const [period, setPeriod] = useState(() => {
    if (typeof window === 'undefined') return 'today';
    const saved = window.localStorage.getItem('dashboard_period');
    const allowed = ['today', 'yesterday', 'week', 'last7days', 'month', 'lastmonth'];
    if (allowed.includes(saved || '')) return saved as string;
    return 'today';
  });
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dispatchStart = () => window.dispatchEvent(new CustomEvent('app:transition:start'));
  const dispatchEnd = () => window.dispatchEvent(new CustomEvent('app:transition:end'));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('dashboard_period', period);
  }, [period]);
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
    kasalar: [] as number[],
    closing_hour: 6,
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

  const isReportAllowed = (reportId: string) => {
    if (!user) return false;
    if (user.is_admin) return true;
    if (user.allowed_reports === null || user.allowed_reports === undefined) return true;
    return user.allowed_reports.includes(reportId);
  };

  // Initial fetch
  // Track previous values to detect changes
  const prevPeriodRef = useRef(period);
  const prevBranchRef = useRef(user?.selected_branch);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    if (!token && !loading) {
      router.replace('/auth/login');
      return;
    }
    if (!token) return;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;
    
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const myId = ++reqIdRef.current;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Detect if period or branch changed - clear data and show loading
    const periodChanged = prevPeriodRef.current !== period;
    const branchChanged = prevBranchRef.current !== user?.selected_branch;
    
    // ALWAYS clear data and show loading when period or branch changes
    if (periodChanged || branchChanged) {
      console.log('[Dashboard] Period or branch changed, clearing data');
      setData(null);
      setIsOffline(false);
      prevPeriodRef.current = period;
      prevBranchRef.current = user?.selected_branch;
    }
    
    // Always show loading when fetching
    setIsDataLoading(true);
    setLoading(true);
    
    const fetchData = async () => {
      try {
        let url = `${getApiUrl()}/dashboard?period=${period}`;
        if (period === 'custom') {
            url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
        }

        console.log('[Dashboard] Fetching data for period:', period);
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
          timeout: 15000 // 15 saniye timeout
        });
        
        // Only update if this is still the current request
        if (reqIdRef.current === myId && !abortController.signal.aborted) {
          // Check if response indicates connection error
          if (res.data?.connection_error) {
            console.log('[Dashboard] Connection error from backend');
            setIsOffline(true);
            setData(null);
          } else {
            console.log('[Dashboard] Data received successfully');
            setData(res.data);
            setIsOffline(false);
          }
        }
      } catch (e: any) {
        // Ignore abort errors
        if (e.name === 'AbortError' || e.code === 'ERR_CANCELED') {
          return;
        }
        console.error('[Dashboard] Error fetching data:', e);
        if (reqIdRef.current === myId) {
          setIsOffline(true);
          setData(null); // Clear stale data on error
        }
      } finally {
        if (reqIdRef.current === myId && !abortController.signal.aborted) {
          setLoading(false);
          setIsDataLoading(false);
        }
      }
    };
    fetchData();

    const interval = setInterval(() => {
      // Only auto-refresh if no request in progress and we have data
      if (data && (!abortControllerRef.current || abortControllerRef.current.signal.aborted)) {
        const refreshController = new AbortController();
        abortControllerRef.current = refreshController;
        
        (async () => {
          try {
            let url = `${getApiUrl()}/dashboard?period=${period}`;
            if (period === 'custom') {
              url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
            }
            const res = await axios.get(url, {
              headers: { Authorization: `Bearer ${token}` },
              signal: refreshController.signal,
              timeout: 15000
            });
            if (!refreshController.signal.aborted) {
              if (res.data?.connection_error) {
                setIsOffline(true);
              } else {
                setData(res.data);
                setIsOffline(false);
              }
            }
          } catch (e: any) {
            if (e.name !== 'AbortError' && e.code !== 'ERR_CANCELED') {
              setIsOffline(true);
            }
          }
        })();
      }
    }, 10000);
    
    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
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
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all",
                loading ? "bg-blue-50 text-blue-600 border border-blue-200" :
                isOffline ? "bg-red-50 text-red-600 border border-red-200" : 
                "bg-emerald-50 text-emerald-600 border border-emerald-200"
            )}>
                <div className={clsx(
                  "w-2 h-2 rounded-full", 
                  loading ? "bg-blue-500 animate-ping" :
                  isOffline ? "bg-red-500" : "bg-emerald-500 animate-pulse"
                )}></div>
                <span>
                  {loading 
                    ? (lang === 'tr' ? 'Yükleniyor...' : 'Loading...') 
                    : isOffline 
                    ? (lang === 'tr' ? 'Bağlantı Yok' : 'No Connection') 
                    : t('online')}
                </span>
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
                {(() => {
                  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
                  const fmt = (d: Date, withYear?: boolean) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined });
                  if (period === 'custom' && customStartDate && customEndDate) {
                    const s = new Date(customStartDate);
                    const e = new Date(customEndDate);
                    return `${fmt(s)} - ${fmt(e, true)}`;
                  }
                  if (period === 'today') {
                    return new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
                  }
                  if (period === 'yesterday') {
                    const y = new Date(); y.setDate(y.getDate() - 1);
                    return y.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
                  }
                  if (period === 'week') {
                    const end = new Date();
                    const start = new Date(end);
                    const day = start.getDay();
                    const diff = (day === 0 ? 6 : day - 1);
                    start.setDate(end.getDate() - diff);
                    return `${fmt(start)} - ${fmt(end, true)}`;
                  }
                  if (period === 'last7days') {
                    const end = new Date();
                    const start = new Date(end); start.setDate(end.getDate() - 6);
                    return `${fmt(start)} - ${fmt(end, true)}`;
                  }
                  if (period === 'month') {
                    const end = new Date();
                    const start = new Date(end.getFullYear(), end.getMonth(), 1);
                    return `${fmt(start)} - ${fmt(end, true)}`;
                  }
                  if (period === 'lastmonth') {
                    const ref = new Date(); ref.setMonth(ref.getMonth() - 1);
                    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
                    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
                    return `${fmt(start)} - ${fmt(end, true)}`;
                  }
                  return '';
                })()}
            </div>
        </div>
      </div>

      <main className="px-4 py-4 space-y-5 overflow-hidden max-w-full" style={{ paddingTop: user?.days_left !== undefined ? '230px' : '195px' }}>
        {/* Connection Error Banner */}
        {isOffline && !loading && (
          <div className="bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl p-4 text-white shadow-xl shadow-red-500/30 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">{lang === 'tr' ? 'Şube Bağlantısı Kurulamadı' : 'Branch Connection Failed'}</h3>
              <p className="text-red-100 text-sm">
                {lang === 'tr' 
                  ? 'Şube veritabanına bağlanılamıyor. Şube kapalı olabilir veya internet bağlantınızı kontrol edin.' 
                  : 'Cannot connect to branch database. Branch may be closed or check your internet connection.'}
              </p>
            </div>
          </div>
        )}

        {/* Main Summary Card - Premium Design */}
        <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-[28px] p-6 text-white shadow-2xl shadow-emerald-500/40 text-center relative overflow-hidden group">
          {/* Animated Background Elements */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 bg-teal-300 opacity-20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-emerald-400/20 to-cyan-400/20 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm px-4 py-1.5 rounded-full mb-3 border border-white/20">
              <span className={clsx("w-2 h-2 rounded-full", loading ? "bg-white animate-ping" : "bg-white animate-pulse")}></span>
              <span className="text-white/90 text-xs font-semibold uppercase tracking-wider">
                {loading ? (lang === 'tr' ? 'Güncelleniyor...' : 'Updating...') : t('range_label_total')}
              </span>
            </div>
            {(() => {
              const base = (data?.kapali_adisyon_toplam || 0) + (period === 'today' ? (data?.acik_adisyon_toplam || 0) : 0);
              const grand = base + (data?.borca_atilan_toplam || 0);
              const cls =
                grand >= 100000000 ? "text-2xl" :
                grand >= 1000000 ? "text-3xl" : "text-4xl";
              return (
                <>
                  <div className="w-full">
                    {/* Auto-fit amount */}
                    <AutoFitText
                      text={isDataLoading || !data ? '...' : formatCurrency(grand)}
                      className={clsx("font-black mb-2 tracking-tight drop-shadow-lg transition-all", (isDataLoading || !data) && "opacity-50 animate-pulse")}
                      maxPx={36}
                      minPx={22}
                    />
                  </div>
                  <p className="text-emerald-100 text-sm font-medium flex items-center justify-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-200 rounded-full"></span>
                    {t('open_closed_total')}
                    <span className="w-1.5 h-1.5 bg-emerald-200 rounded-full"></span>
                  </p>
                </>
              );
            })()}
            {!isDataLoading && data && !!data?.borca_atilan_toplam && data.borca_atilan_toplam > 0 && (
              <div className={clsx(
                "mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold backdrop-blur-sm",
                period === 'today' ? "bg-amber-500/90 text-white" : "bg-amber-400 text-amber-900"
              )}>
                <span>💰</span>
                {lang === 'tr' ? 'Borca Atılan' : 'Added to Debt'}: {formatCurrency(data.borca_atilan_toplam)}
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards Section */}
        <div className="flex flex-col space-y-4">
            {/* Açık Adisyon (Only visible if period is today) - Modern Card */}
            {period === 'today' && isReportAllowed('open_orders') && (
            <div 
                onClick={() => navigateWithOverlay('/reports/orders/open')}
                className="bg-white p-5 rounded-[24px] border border-orange-100 shadow-lg shadow-orange-100/50 cursor-pointer hover:shadow-xl hover:border-orange-200 transition-all duration-300 relative overflow-hidden group"
            >
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-100 to-amber-50 rounded-full -mr-16 -mt-16 opacity-60"></div>
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-3">
                      <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                              <span className="text-white text-sm">🟠</span>
                            </div>
                            <h3 className="text-gray-600 text-sm font-semibold">{t('open_orders')}</h3>
                          </div>
                          <p className="text-3xl font-black text-gray-900 tracking-tight">
                              {formatCurrency(data?.acik_adisyon_toplam || 0)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">{data?.acik_adisyon_adet || 0} {t('count_orders')}</p>
                      </div>
                      {/* Mini Donut Chart */}
                      <div className="w-20 h-20">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie
                                      data={[
                                          { name: t('order_type_adisyon'), value: data?.dagilim?.adisyon.acik_toplam || 0, color: '#f97316' },
                                          { name: t('order_type_paket'), value: data?.dagilim?.paket.acik_toplam || 0, color: '#fbbf24' },
                                      ]}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={22}
                                      outerRadius={36}
                                      paddingAngle={4}
                                      dataKey="value"
                                      stroke="none"
                                  >
                                      {[
                                          { color: '#f97316' },
                                          { color: '#fbbf24' },
                                      ].map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                      ))}
                                  </Pie>
                              </PieChart>
                          </ResponsiveContainer>
                      </div>
                  </div>

                  {/* Details List - Improved */}
                  <div className="space-y-2">
                      <div 
                          onClick={(e) => { e.stopPropagation(); navigateWithOverlay('/reports/orders/open?adtur=0'); }}
                          className="bg-gradient-to-r from-orange-50 to-orange-100/50 rounded-2xl p-3 flex justify-between items-center cursor-pointer hover:from-orange-100 hover:to-orange-100 transition-all border border-orange-200/50"
                      >
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                                <span className="text-white text-lg">🍽️</span>
                              </div>
                              <div>
                                <span className="text-xs font-bold text-orange-800 block">{t('order_type_adisyon')}</span>
                                <span className="text-sm font-black text-gray-900">{formatCurrency(data?.dagilim?.adisyon.acik_toplam || 0)}</span>
                              </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-orange-700 bg-white px-2.5 py-1 rounded-lg font-bold shadow-sm border border-orange-200">
                                {data?.dagilim?.adisyon.acik_adet || 0} {t('piece')}
                            </span>
                            {typeof data?.dagilim?.adisyon.acik_yuzde !== 'undefined' && (
                              <span className="text-[10px] text-white bg-orange-500 px-2 py-1 rounded-lg font-bold">
                                %{data?.dagilim?.adisyon.acik_yuzde}
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-orange-400" />
                          </div>
                      </div>
                      
                      {(data?.dagilim?.paket.acik_toplam || 0) > 0 && (
                          <div 
                          onClick={(e) => { e.stopPropagation(); navigateWithOverlay('/reports/orders/open?adtur=1'); }}
                              className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl p-3 flex justify-between items-center cursor-pointer hover:from-amber-100 hover:to-yellow-100 transition-all border border-amber-200/50"
                          >
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                                    <span className="text-white text-lg">📦</span>
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-amber-800 block">{t('order_type_paket')}</span>
                                    <span className="text-sm font-black text-gray-900">{formatCurrency(data?.dagilim?.paket.acik_toplam || 0)}</span>
                                  </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-amber-700 bg-white px-2.5 py-1 rounded-lg font-bold shadow-sm border border-amber-200">
                                    {data?.dagilim?.paket.acik_adet || 0} {t('piece')}
                                </span>
                                {typeof data?.dagilim?.paket.acik_yuzde !== 'undefined' && (
                                  <span className="text-[10px] text-white bg-amber-500 px-2 py-1 rounded-lg font-bold">
                                    %{data?.dagilim?.paket.acik_yuzde}
                                  </span>
                                )}
                                <ChevronRight className="w-4 h-4 text-amber-400" />
                              </div>
                          </div>
                      )}
                  </div>
                </div>
            </div>
            )}

            {/* Kapalı Adisyon - Modern Card */}
            {isReportAllowed('closed_orders') && (
            <div 
                onClick={() => navigateWithOverlay('/reports/orders/closed')}
                className="bg-white p-5 rounded-[24px] border border-emerald-100 shadow-lg shadow-emerald-100/50 cursor-pointer hover:shadow-xl hover:border-emerald-200 transition-all duration-300 relative overflow-hidden group"
            >
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-teal-50 rounded-full -mr-16 -mt-16 opacity-60"></div>
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-3">
                      <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                              <span className="text-white text-sm">✅</span>
                            </div>
                            <h3 className="text-gray-600 text-sm font-semibold">{t('closed_orders')}</h3>
                          </div>
                          <p className="text-3xl font-black text-gray-900 tracking-tight">
                              {formatCurrency(data?.kapali_adisyon_toplam || 0)}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-400">{data?.kapali_adisyon_adet || 0} {t('count_orders')}</span>
                            <span className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1 shadow-sm">
                                <Tag className="w-3 h-3" />
                                -{formatCurrency(data?.kapali_iskonto_toplam || 0)}
                            </span>
                          </div>
                      </div>
                    {/* Mini Donut Chart */}
                    <div className="w-20 h-20">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: t('order_type_adisyon'), value: data?.dagilim?.adisyon.kapali_toplam || 0, color: '#10b981' },
                                        { name: t('order_type_paket'), value: data?.dagilim?.paket.kapali_toplam || 0, color: '#fbbf24' },
                                        { name: t('order_type_hizli'), value: data?.dagilim?.hizli?.kapali_toplam || 0, color: '#ec4899' },
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={22}
                                    outerRadius={36}
                                    paddingAngle={4}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {[
                                        { color: '#10b981' },
                                        { color: '#fbbf24' },
                                        { color: '#ec4899' },
                                    ].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Details List - Improved */}
                <div className="space-y-2">
                    <div 
                        onClick={(e) => { e.stopPropagation(); navigateWithOverlay('/reports/orders/closed?adtur=0'); }}
                        className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-3 flex justify-between items-center cursor-pointer hover:from-emerald-100 hover:to-teal-100 transition-all border border-emerald-200/50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                              <span className="text-white text-lg">🍽️</span>
                            </div>
                            <div>
                              <span className="text-xs font-bold text-emerald-800 block">{t('order_type_adisyon')}</span>
                              <span className="text-sm font-black text-gray-900">{formatCurrency(data?.dagilim?.adisyon.kapali_toplam || 0)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-emerald-700 bg-white px-2.5 py-1 rounded-lg font-bold shadow-sm border border-emerald-200">
                              {data?.dagilim?.adisyon.kapali_adet || 0} {t('piece')}
                          </span>
                          {typeof data?.dagilim?.adisyon.kapali_yuzde !== 'undefined' && (
                            <span className="text-[10px] text-white bg-emerald-500 px-2 py-1 rounded-lg font-bold">
                              %{data?.dagilim?.adisyon.kapali_yuzde}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-emerald-400" />
                        </div>
                    </div>

                    {(data?.dagilim?.paket.kapali_toplam || 0) > 0 && (
                        <div 
                        onClick={(e) => { e.stopPropagation(); navigateWithOverlay('/reports/orders/closed?adtur=1'); }}
                            className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl p-3 flex justify-between items-center cursor-pointer hover:from-amber-100 hover:to-yellow-100 transition-all border border-amber-200/50"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                                  <span className="text-white text-lg">📦</span>
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-amber-800 block">{t('order_type_paket')}</span>
                                  <span className="text-sm font-black text-gray-900">{formatCurrency(data?.dagilim?.paket.kapali_toplam || 0)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-amber-700 bg-white px-2.5 py-1 rounded-lg font-bold shadow-sm border border-amber-200">
                                  {data?.dagilim?.paket.kapali_adet || 0} {t('piece')}
                              </span>
                              {typeof data?.dagilim?.paket.kapali_yuzde !== 'undefined' && (
                                <span className="text-[10px] text-white bg-amber-500 px-2 py-1 rounded-lg font-bold">
                                  %{data?.dagilim?.paket.kapali_yuzde}
                                </span>
                              )}
                              <ChevronRight className="w-4 h-4 text-amber-400" />
                            </div>
                        </div>
                    )}

                    {(data?.dagilim?.hizli?.kapali_toplam || 0) > 0 && (
                        <div 
                            onClick={(e) => { e.stopPropagation(); navigateWithOverlay('/reports/orders/closed?adtur=3'); }}
                            className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-3 flex justify-between items-center cursor-pointer hover:from-pink-100 hover:to-rose-100 transition-all border border-pink-200/50"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-pink-500 rounded-xl flex items-center justify-center">
                                  <span className="text-white text-lg">⚡</span>
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-pink-800 block">{t('order_type_hizli')}</span>
                                  <span className="text-sm font-black text-gray-900">{formatCurrency(data?.dagilim?.hizli?.kapali_toplam || 0)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-pink-700 bg-white px-2.5 py-1 rounded-lg font-bold shadow-sm border border-pink-200">
                                  {data?.dagilim?.hizli?.kapali_adet || 0} {t('piece')}
                              </span>
                              {typeof data?.dagilim?.hizli?.kapali_yuzde !== 'undefined' && (
                                <span className="text-[10px] text-white bg-pink-500 px-2 py-1 rounded-lg font-bold">
                                  %{data?.dagilim?.hizli?.kapali_yuzde}
                                </span>
                              )}
                              <ChevronRight className="w-4 h-4 text-pink-400" />
                            </div>
                        </div>
                    )}
                </div>
              </div>
            </div>
            )}
        </div>

        {/* Stock Management Section */}
        {(isReportAllowed('stock_entry') || isReportAllowed('live_stock')) && (
        <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Package className="w-4 h-4 text-white" />
                </div>
                {t('stock_management') || 'Stok Yönetimi'}
              </h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                {isReportAllowed('stock_entry') && (
                <Link 
                    href="/stock/entry"
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-100 to-cyan-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="bg-gradient-to-br from-blue-500 to-cyan-600 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-blue-500/30">
                        <Edit2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors">Günlük Giriş</h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">Stok girişi yap</p>
                    </div>
                </Link>
                )}

                {isReportAllowed('live_stock') && (
                <Link 
                    href="/stock/live"
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-cyan-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-cyan-100 to-sky-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="bg-gradient-to-br from-cyan-500 to-sky-600 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-cyan-500/30">
                        <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-cyan-600 transition-colors">Canlı Takip</h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">Anlık stok durumu</p>
                    </div>
                </Link>
                )}
            </div>
        </div>
        )}

        {/* Other Reports Section - Modern Grid */}
        <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <BarChart2 className="w-4 h-4 text-white" />
                </div>
                {t('other_reports')}
              </h3>
              <span className="text-xs text-gray-400 font-medium">8 {lang === 'tr' ? 'rapor' : 'reports'}</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {/* Product Sales */}
                {isReportAllowed('product_sales') && (
                <Link 
                    href="/reports/product-sales"
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-orange-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="bg-gradient-to-br from-orange-500 to-amber-500 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-orange-500/30">
                        <PieChartIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-orange-600 transition-colors">{t('product_sales')}</h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">{t('product_sales_desc')}</p>
                    </div>
                </Link>
                )}
                
                {/* Personnel */}
                {isReportAllowed('personnel') && (
                <Link 
                    href="/reports/performance"
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-purple-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-purple-100 to-violet-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="bg-gradient-to-br from-purple-500 to-violet-600 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-purple-500/30">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-purple-600 transition-colors">{t('personnel')}</h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">{t('personnel_desc')}</p>
                    </div>
                </Link>
                )}

                {/* Payment Types */}
                {isReportAllowed('payment_types') && (
                <Link 
                    href="/reports/payment-types"
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-100 to-sky-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="bg-gradient-to-br from-blue-500 to-sky-600 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-blue-500/30">
                        <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors">{t('payments_title')}</h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">{t('payment_types_card_desc')}</p>
                    </div>
                </Link>
                )}

                {/* Hourly Sales */}
                {isReportAllowed('hourly_sales') && (
                <Link 
                    href="/reports/sales-chart"
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-red-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-red-100 to-rose-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="bg-gradient-to-br from-red-500 to-rose-600 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-red-500/30">
                        <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-red-600 transition-colors">{t('hourly_sales')}</h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">{t('hourly_sales_desc')}</p>
                    </div>
                </Link>
                )}

                {/* Courier Tracking */}
                {isReportAllowed('courier') && (
                <Link 
                    href="/reports/courier-tracking"
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-teal-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-teal-100 to-cyan-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="bg-gradient-to-br from-teal-500 to-cyan-600 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-teal-500/30">
                        <Bike className="w-5 h-5 text-white" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-teal-600 transition-colors">{t('courier_tracking')}</h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">{t('courier_tracking_card_desc')}</p>
                    </div>
                </Link>
                )}

                {/* Cancelled Items */}
                {isReportAllowed('cancels') && (
                <Link 
                    href="/reports/cancelled-items"
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-pink-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-pink-100 to-rose-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="bg-gradient-to-br from-pink-500 to-rose-600 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-pink-500/30">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-pink-600 transition-colors">{t('cancelled_items')}</h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">{t('cancelled_items_desc')}</p>
                    </div>
                </Link>
                )}

                {/* Discount Report */}
                {isReportAllowed('discounts') && (
                <Link 
                    href="/reports/discount"
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-100 to-green-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="bg-gradient-to-br from-emerald-500 to-green-600 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-emerald-500/30">
                        <Tag className="w-5 h-5 text-white" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-emerald-600 transition-colors">{t('discount_report')}</h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">{t('discount_report_desc')}</p>
                    </div>
                </Link>
                )}

                {/* Unpayable Report */}
                {isReportAllowed('unpayable') && (
                <Link 
                    href="/reports/unpayable"
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-slate-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-slate-100 to-gray-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="bg-gradient-to-br from-slate-500 to-gray-600 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-slate-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-slate-600 transition-colors">{t('unpayable_report')}</h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">{t('unpayable_report_desc')}</p>
                    </div>
                </Link>
                )}

                {/* Debts Report */}
                {isReportAllowed('debts') && (
                <Link 
                    href="/reports/debts"
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-amber-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-amber-100 to-yellow-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="bg-gradient-to-br from-amber-500 to-yellow-500 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-amber-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-amber-600 transition-colors">{t('debts_report')}</h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">{t('debts_report_desc')}</p>
                    </div>
                </Link>
                )}

                {/* Unsold Cancels */}
                {isReportAllowed('unsold_cancels') && (
                <Link 
                    href="/reports/unsold-cancels"
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-rose-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-rose-100 to-red-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="bg-gradient-to-br from-rose-500 to-red-600 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-rose-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-rose-600 transition-colors">{lang === 'tr' ? 'Satılmadan İptaller' : 'Unsold Cancels'}</h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">{lang === 'tr' ? 'İptal edilen siparişler' : 'Cancelled orders'}</p>
                    </div>
                </Link>
                )}

                {/* Admin Cards */}
                {user?.is_admin && (
                  <>
                    <Link 
                      href="/admin/users"
                      className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-indigo-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-100 to-violet-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                      <div className="bg-gradient-to-br from-indigo-500 to-violet-600 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-indigo-500/30">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div className="relative z-10">
                        <h4 className="font-bold text-gray-800 text-sm group-hover:text-indigo-600 transition-colors">{lang === 'tr' ? 'Admin — Kullanıcılar' : 'Admin — Users'}</h4>
                        <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">{lang === 'tr' ? 'Ekle, düzenle, sil' : 'Add, edit, delete'}</p>
                      </div>
                    </Link>
                    <Link 
                      href="/admin/branches"
                      className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-teal-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-teal-100 to-cyan-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-teal-500/30">
                        <Building className="w-5 h-5 text-white" />
                      </div>
                      <div className="relative z-10">
                        <h4 className="font-bold text-gray-800 text-sm group-hover:text-teal-600 transition-colors">{lang === 'tr' ? 'Admin — Şubeler' : 'Admin — Branches'}</h4>
                        <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">{lang === 'tr' ? 'Bağlantı bilgileri' : 'Connection info'}</p>
                      </div>
                    </Link>
                    <Link 
                      href="/admin/manage"
                      className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-xl hover:border-amber-200 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-50 rounded-full -mr-8 -mt-8 opacity-60 group-hover:scale-150 transition-transform duration-500"></div>
                      <div className="bg-gradient-to-br from-amber-500 to-orange-500 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative z-10 shadow-lg shadow-amber-500/30">
                        <Settings className="w-5 h-5 text-white" />
                      </div>
                      <div className="relative z-10">
                        <h4 className="font-bold text-gray-800 text-sm group-hover:text-amber-600 transition-colors">{lang === 'tr' ? 'Admin — Tek Form' : 'Admin — Quick Form'}</h4>
                        <p className="text-[10px] text-gray-400 mt-1 font-medium line-clamp-1">{lang === 'tr' ? 'Kullanıcı ve şube' : 'User and branch'}</p>
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
                                                kasalar: (branch.kasalar || []).filter((k: any) => typeof k === 'number'),
                                                closing_hour:
                                                  typeof branch.closing_hour === 'number' &&
                                                  Number.isFinite(branch.closing_hour)
                                                    ? branch.closing_hour
                                                    : 6,
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
                                        kasalar: [],
                                        closing_hour: 6,
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
                                    onChange={(e) => setBranchForm({ ...branchForm, db_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('kasa_no')}</label>
                                <input 
                                    type="number" 
                                    required
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                    value={branchForm.kasa_no}
                                    onChange={(e) =>
                                      setBranchForm({
                                        ...branchForm,
                                        kasa_no: parseInt(e.target.value || '1', 10),
                                      })
                                    }
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Kapanış Saati (Saat)
                            </label>
                            <input
                              type="number"
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                              min={0}
                              max={23}
                              value={branchForm.closing_hour}
                              onChange={(e) =>
                                setBranchForm({
                                  ...branchForm,
                                  closing_hour: parseInt(e.target.value || '6', 10),
                                })
                              }
                            />
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
