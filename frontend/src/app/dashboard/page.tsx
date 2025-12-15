'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter } from 'next/navigation';
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
  acik_adisyon_adet: number;
  kapali_adisyon_adet: number;
  iptal_adet: number;
  dagilim?: {
    paket: {
      acik_adet: number;
      acik_toplam: number;
      kapali_adet: number;
      kapali_toplam: number;
      kapali_iskonto: number;
      toplam_adet: number;
      toplam_tutar: number;
    };
    adisyon: {
      acik_adet: number;
      acik_toplam: number;
      kapali_adet: number;
      kapali_toplam: number;
      kapali_iskonto: number;
      toplam_adet: number;
      toplam_tutar: number;
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
  
  // Modals
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailType, setDetailType] = useState<'open' | 'closed'>('open');
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);

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
      kasa_no: 1
  });

  // Initial fetch
  useEffect(() => {
    if (!token) return;
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;
    
    const fetchData = async () => {
      try {
        let url = `${getApiUrl()}/dashboard?period=${period}`;
        if (period === 'custom') {
            url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
        }

        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data);
        setIsOffline(false);
      } catch (e) {
        console.error(e);
        setIsOffline(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Polling setup only if not custom date
    if (period !== 'custom') {
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }
  }, [token, period, customStartDate, customEndDate]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const openDetailModal = async (type: 'open' | 'closed', subType?: 'adisyon' | 'paket') => {
    setDetailType(type);
    setDetailModalOpen(true);
    setLoadingOrders(true);
    try {
        let url = `${getApiUrl()}/reports/orders?status=${type}&period=${period}`;
        if (period === 'custom') {
            url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
        }
        if (subType) {
            url += `&type=${subType}`;
        }
        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setOrders(res.data);
    } catch (e) {
        console.error(e);
    } finally {
        setLoadingOrders(false);
    }
  };

  const handleOrderClick = async (adsno: number) => {
    setOrderDetailLoading(true);
    try {
        const res = await axios.get(`${getApiUrl()}/reports/order-details?adsno=${adsno}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setSelectedOrder(res.data);
    } catch (e) {
        console.error(e);
    } finally {
        setOrderDetailLoading(false);
    }
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
        alert('İşlem başarısız oldu.');
    }
  };

  const handleDeleteBranch = async (id: number) => {
      if (!confirm('Bu şubeyi silmek istediğinize emin misiniz?')) return;
      try {
          await axios.delete(`${getApiUrl()}/branches/${id}`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          window.location.reload();
      } catch (e) {
          console.error(e);
          alert('Silme işlemi başarısız.');
      }
  };

  const pieData = [
    { name: 'Açık', value: data?.acik_adisyon_toplam || 0, color: '#6366f1' }, // Indigo-500
    { name: 'Kapalı', value: data?.kapali_adisyon_toplam || 0, color: '#10b981' }, // Emerald-500
  ];

  if (loading && !data) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {/* Header Section */}
      <div className="bg-white/80 backdrop-blur-md px-4 pt-4 pb-2 sticky top-0 z-10 shadow-sm border-b border-gray-100 transition-all duration-300">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#2aa290] to-[#1f7a6c]">{t('reports')}</h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{user?.email}</span>
            <button 
                onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}
                className="text-xs font-bold text-gray-600 ml-2 bg-gray-100 px-2 py-1 rounded-md hover:bg-gray-200 transition ring-1 ring-gray-200"
            >
                {lang.toUpperCase()}
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
                <button 
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className="text-gray-500 hover:bg-gray-100 p-2 rounded-full"
                >
                    <Settings className="w-6 h-6" />
                </button>
                {settingsOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 animate-in fade-in zoom-in duration-200">
                        <div className="p-2">
                            <button 
                                onClick={() => {
                                    setSettingsOpen(false);
                                    setBranchManagementOpen(true);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition font-medium flex items-center"
                            >
                                <Building className="w-4 h-4 mr-2" />
                                Şube Yönetimi
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <button 
                                onClick={logout}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition font-medium flex items-center"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                {t('login').replace('Giriş Yap', 'Çıkış Yap').replace('Sign In', 'Logout')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <button 
                onClick={logout}
                className="text-gray-500 hover:bg-gray-100 p-2 rounded-full"
                title="Çıkış Yap"
            >
                <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Branch & Status Row */}
        <div className="flex items-center space-x-2 mb-4">
          <button 
            onClick={() => setBranchModalOpen(true)}
            className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition"
          >
            <Building className="w-4 h-4 text-gray-500" />
            <span>
              {user?.branches && user.branches.length > 0 && user.selected_branch !== undefined
                ? user.branches[user.selected_branch]?.name || 'Şube Seçiniz'
                : 'Şube Yok'}
            </span>
          </button>
          
          <div className={clsx(
            "flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold",
            isOffline ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
          )}>
            <div className={clsx("w-2 h-2 rounded-full", isOffline ? "bg-red-500" : "bg-green-500")}></div>
            <span>{isOffline ? t('offline') : t('online')}</span>
            <ChevronDown className="w-3 h-3" />
          </div>
        </div>

        {/* Date Filter Row */}
        <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-2">
            {[
                { id: 'today', label: 'Bugün' },
                { id: 'yesterday', label: 'Dün' },
                { id: 'week', label: 'Bu Hafta' },
                { id: 'last7days', label: 'Son 7 Gün' },
                { id: 'month', label: 'Bu Ay' },
                { id: 'lastmonth', label: 'Geçen Ay' },
            ].map((p) => (
                <button
                    key={p.id}
                    onClick={() => setPeriod(p.id)}
                    className={clsx(
                        "flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition",
                        period === p.id 
                            ? "border-indigo-600 text-indigo-700 bg-indigo-50" 
                            : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
                    )}
                >
                    {p.id === 'today' && <Calendar className="w-4 h-4 mr-2" />}
                    {p.label}
                </button>
            ))}
            
            <button
                onClick={() => setShowCustomDateModal(true)}
                className={clsx(
                    "flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition",
                    period === 'custom' 
                        ? "border-indigo-600 text-indigo-700 bg-indigo-50" 
                        : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
                )}
            >
                <Calendar className="w-4 h-4 mr-2" />
                Özel Tarih
            </button>
        </div>
        <div className="text-xs text-gray-500 mt-1 pl-1">
            {period === 'custom' && customStartDate && customEndDate 
                ? `${new Date(customStartDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} - ${new Date(customEndDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : period === 'today' 
                    ? new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                    : period === 'yesterday'
                        ? new Date(new Date().setDate(new Date().getDate() - 1)).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                        : ''
            }
        </div>
      </div>

      <main className="px-4 py-4 space-y-6 overflow-hidden max-w-full">
        {/* Main Summary Card */}
        <div className="bg-gradient-to-br from-[#2aa290] via-[#249685] to-[#1f7a6c] rounded-3xl p-8 text-white shadow-xl shadow-[#2aa290]/30 text-center relative overflow-hidden group hover:shadow-2xl transition-all duration-500 mx-1">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-[#1f7a6c] opacity-20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
          
          <div className="relative z-10">
            <p className="text-teal-50 text-sm font-medium mb-3 uppercase tracking-wider bg-white/10 inline-block px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">Genel Toplam</p>
            <h2 className="text-5xl font-black mb-3 tracking-tight drop-shadow-sm">
              {formatCurrency(
                (data?.kapali_adisyon_toplam || 0) + 
                (period === 'today' ? (data?.acik_adisyon_toplam || 0) : 0)
              )}
            </h2>
            <p className="text-teal-100 text-sm font-medium">
              Açık ve Kapalı Adisyonlar
            </p>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="flex flex-col space-y-4">
            {/* Açık Adisyon (Only visible if period is today) */}
            {period === 'today' && (
            <div 
                onClick={() => openDetailModal('open')}
                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
            >
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-gray-500 text-sm font-medium mb-1">Açık Adisyon</h3>
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
                                        { name: 'Adisyon', value: data?.dagilim?.adisyon.acik_toplam || 0, color: '#6366f1' },
                                        { name: 'Paket', value: data?.dagilim?.paket.acik_toplam || 0, color: '#f59e0b' },
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
                                        { name: 'Adisyon', value: data?.dagilim?.adisyon.acik_toplam || 0, color: '#6366f1' },
                                        { name: 'Paket', value: data?.dagilim?.paket.acik_toplam || 0, color: '#f59e0b' },
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
                        onClick={(e) => { e.stopPropagation(); openDetailModal('open', 'adisyon'); }}
                        className="bg-indigo-50 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-indigo-100 transition"
                    >
                        <div>
                            <span className="text-xs font-bold text-indigo-700 block mb-0.5">Adisyon</span>
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(data?.dagilim?.adisyon.acik_toplam || 0)}</span>
                        </div>
                        <span className="text-xs text-indigo-600 bg-white px-2 py-1 rounded-lg font-medium shadow-sm">
                            {data?.dagilim?.adisyon.acik_adet || 0} adet
                        </span>
                    </div>
                    
                    {(data?.dagilim?.paket.acik_toplam || 0) > 0 && (
                        <div 
                            onClick={(e) => { e.stopPropagation(); openDetailModal('open', 'paket'); }}
                            className="bg-amber-50 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-amber-100 transition"
                        >
                            <div>
                                <span className="text-xs font-bold text-amber-700 block mb-0.5">Paket</span>
                                <span className="text-sm font-bold text-gray-900">{formatCurrency(data?.dagilim?.paket.acik_toplam || 0)}</span>
                            </div>
                            <span className="text-xs text-amber-600 bg-white px-2 py-1 rounded-lg font-medium shadow-sm">
                                {data?.dagilim?.paket.acik_adet || 0} adet
                            </span>
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* Kapalı Adisyon */}
            <div 
                onClick={() => openDetailModal('closed')}
                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
            >
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-gray-500 text-sm font-medium mb-1">Kapalı Adisyon</h3>
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">
                            {formatCurrency(data?.kapali_adisyon_toplam || 0)}
                        </p>
                        <div className="mt-1">
                            <span className="bg-emerald-50 text-emerald-600 text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center">
                                <Tag className="w-3 h-3 mr-1" />
                                İskonto: {formatCurrency(data?.kapali_iskonto_toplam || 0)}
                            </span>
                        </div>
                    </div>
                    {/* Donut Chart */}
                    <div className="w-24 h-24 -mt-2 -mr-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Adisyon', value: data?.dagilim?.adisyon.kapali_toplam || 0, color: '#10b981' },
                                        { name: 'Paket', value: data?.dagilim?.paket.kapali_toplam || 0, color: '#f59e0b' },
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
                                        { name: 'Adisyon', value: data?.dagilim?.adisyon.kapali_toplam || 0, color: '#10b981' },
                                        { name: 'Paket', value: data?.dagilim?.paket.kapali_toplam || 0, color: '#f59e0b' },
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
                        onClick={(e) => { e.stopPropagation(); openDetailModal('closed', 'adisyon'); }}
                        className="bg-emerald-50 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-emerald-100 transition"
                    >
                        <div>
                            <span className="text-xs font-bold text-emerald-700 block mb-0.5">Adisyon</span>
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(data?.dagilim?.adisyon.kapali_toplam || 0)}</span>
                        </div>
                        <span className="text-xs text-emerald-600 bg-white px-2 py-1 rounded-lg font-medium shadow-sm">
                            {data?.dagilim?.adisyon.kapali_adet || 0} adet
                        </span>
                    </div>

                    {(data?.dagilim?.paket.kapali_toplam || 0) > 0 && (
                        <div 
                            onClick={(e) => { e.stopPropagation(); openDetailModal('closed', 'paket'); }}
                            className="bg-amber-50 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-amber-100 transition"
                        >
                            <div>
                                <span className="text-xs font-bold text-amber-700 block mb-0.5">Paket</span>
                                <span className="text-sm font-bold text-gray-900">{formatCurrency(data?.dagilim?.paket.kapali_toplam || 0)}</span>
                            </div>
                            <span className="text-xs text-amber-600 bg-white px-2 py-1 rounded-lg font-medium shadow-sm">
                                {data?.dagilim?.paket.kapali_adet || 0} adet
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Other Reports Section */}
        <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 px-1 flex items-center">
              <span className="w-1 h-6 bg-indigo-600 rounded-full mr-2"></span>
              Diğer Raporlar
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <button 
                    onClick={() => router.push('/reports/product-sales')}
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-orange-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <PieChartIcon className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">Ürün Satışları</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">En çok satan ürünler</p>
                    </div>
                </button>
                
                <button 
                    onClick={() => router.push('/reports/performance')}
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-purple-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <Users className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">Personel</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">Garson performans</p>
                    </div>
                </button>

                <button 
                    onClick={() => router.push('/reports/payment-types')}
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <CreditCard className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">Ödeme Tipleri</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">Nakit, Kredi Kartı</p>
                    </div>
                </button>

                <button 
                    onClick={() => router.push('/reports/sales-chart')}
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-red-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <TrendingUp className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">Saatlik Satış</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">Günün yoğun saatleri</p>
                    </div>
                </button>

                <button 
                    onClick={() => router.push('/reports/cancelled-items')}
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-pink-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-pink-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-pink-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">İptal / İade</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">İptal edilenler</p>
                    </div>
                </button>

                <button 
                    onClick={() => router.push('/reports/product-sales?group_id=1')} 
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-cyan-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-cyan-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">Ürün Grupları</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">Kategori bazlı</p>
                    </div>
                </button>

                <button 
                    onClick={() => router.push('/reports/courier-tracking')}
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-teal-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="bg-teal-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-sm">
                        <Bike className="w-6 h-6 text-teal-600" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">Kurye Takip</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">Paket süreleri</p>
                    </div>
                </button>
            </div>
        </div>
      </main>

      {/* Branch Selection Modal */}
      {branchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">Şube Seçimi</h3>
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
                    <h3 className="text-lg font-bold text-gray-900">Tarih Aralığı Seç</h3>
                    <button onClick={() => setShowCustomDateModal(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleCustomDateSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi</label>
                        <input 
                            type="date" 
                            required
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi</label>
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
                        Uygula
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50">
             <div className="bg-gray-50 w-full h-full flex flex-col animate-in slide-in-from-right duration-300">
                {/* Modal Header */}
                <div className="bg-white px-4 py-4 flex items-center shadow-sm z-10">
                    <button onClick={() => setDetailModalOpen(false)} className="mr-4 text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                        </svg>
                    </button>
                    <h2 className="text-xl font-bold text-gray-900 flex-1 text-center mr-10">
                        {detailType === 'open' ? 'Açık Adisyon' : 'Kapalı Adisyon'}
                    </h2>
                </div>

                {/* Filter Section */}
                <div className="p-4">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500 mr-2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                            <h3 className="font-bold text-gray-900">Filtrele</h3>
                        </div>
                        <div className="flex space-x-3">
                            <div className="flex-1">
                                <label className="block text-xs text-gray-500 mb-1">Masa No:</label>
                                <input 
                                    type="text" 
                                    placeholder="Örn: 5" 
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs text-gray-500 mb-1">Tarih:</label>
                                <button className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-left flex items-center text-gray-500">
                                    <Calendar className="w-4 h-4 mr-2" />
                                    Seç
                                </button>
                            </div>
                        </div>
                    </div>
                    <p className="text-gray-500 text-sm mt-4 ml-1">{orders.length} adet adisyon</p>
                </div>
                
                {/* List Content */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
                    {loadingOrders ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <>
                            {orders.map((order, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => handleOrderClick(order.adsno)}
                                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative cursor-pointer hover:shadow-md transition"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center space-x-3">
                                            <div className="bg-green-100 rounded-full p-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-600">
                                                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <h3 className="font-bold text-gray-900 text-lg">
                                                {order.masano === 99999 ? 'Paket' : `Masa ${order.masano}`} {order.masano === 99999 ? '' : order.masano}
                                            </h3>
                                        </div>
                                        <div className="flex items-center">
                                            {order.masano === 99999 && (
                                                <span className="bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded-full mr-2">
                                                    Paket
                                                </span>
                                            )}
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <p className="text-2xl font-bold text-green-600">{formatCurrency(parseFloat(order.tutar))}</p>
                                    </div>

                                    <div className="space-y-1 text-sm text-gray-500">
                                        <div className="flex items-center">
                                            <Users className="w-4 h-4 mr-2" />
                                            <span>Garson: {order.garson || 'Bilinmiyor'}</span>
                                        </div>
                                        <div className="flex items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                            </svg>
                                            <span>Kapanış: {new Date(order.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="flex items-center">
                                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                                            </svg>
                                            <span>Sipyer: RESTORAN</span>
                                        </div>
                                    </div>

                                    <div className="absolute bottom-4 right-4 text-xs text-gray-400">
                                        {new Date(order.tarih).toLocaleDateString('tr-TR')}
                                    </div>
                                </div>
                            ))}
                            {orders.length === 0 && (
                                <div className="text-center py-10 text-gray-500">
                                    Kayıt bulunamadı.
                                </div>
                            )}
                        </>
                    )}
                </div>
             </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-50">
            <div className="bg-white w-full h-full flex flex-col animate-in slide-in-from-right duration-300">
                 {/* Header */}
                 <div className="bg-white px-4 py-4 flex items-center shadow-sm z-10 border-b border-gray-100">
                    <button onClick={() => setSelectedOrder(null)} className="mr-4 text-gray-700 p-1 hover:bg-gray-100 rounded-full transition">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                        </svg>
                    </button>
                    <h2 className="text-xl font-bold text-gray-900 flex-1 text-center mr-10">
                        Adisyon Detayı
                    </h2>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                     {/* Header Info Card */}
                     <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-4 text-center">
                        <h3 className="text-3xl font-bold text-indigo-900 mb-1">
                            {selectedOrder.masano === 99999 ? 'Paket' : `Masa ${selectedOrder.masano}`}
                        </h3>
                        <p className="text-gray-500 text-sm font-medium bg-gray-100 inline-block px-3 py-1 rounded-full mt-2">
                            Adisyon No: #{selectedOrder.adsno}
                        </p>
                        
                        <div className="mt-6 grid grid-cols-3 gap-4 divide-x divide-gray-100">
                             <div className="text-center">
                                 <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">TARİH</p>
                                 <p className="font-semibold text-gray-900 text-sm">
                                     {new Date(selectedOrder.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                 </p>
                             </div>
                             <div className="text-center">
                                 <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">SAAT</p>
                                 <p className="font-semibold text-gray-900 text-sm">
                                     {new Date(selectedOrder.tarih).toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'})}
                                 </p>
                             </div>
                              <div className="text-center">
                                 <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">GARSON</p>
                                 <p className="font-semibold text-gray-900 text-sm truncate px-1">
                                     {selectedOrder.garson || '-'}
                                 </p>
                             </div>
                         </div>
                      </div>
 
                      {/* Products List */}
                      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                         <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                             <h4 className="font-bold text-gray-900">Siparişler</h4>
                             <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
                                 {selectedOrder.items.length} Kalem
                             </span>
                         </div>
                         <div className="divide-y divide-gray-50">
                             {selectedOrder.items.map((item: any, idx: number) => (
                                <div key={idx} className="p-4 flex justify-between items-center hover:bg-gray-50 transition">
                                    <div className="flex items-center space-x-4">
                                        <div className="bg-indigo-50 text-indigo-700 w-10 h-10 flex items-center justify-center rounded-xl font-bold text-sm shadow-sm">
                                            {item.quantity}x
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{item.product_name}</p>
                                            <p className="text-xs text-gray-500 font-medium mt-0.5">
                                                {formatCurrency(item.total / item.quantity)} / adet
                                            </p>
                                        </div>
                                    </div>
                                    <div className="font-bold text-gray-900 text-lg">
                                        {formatCurrency(item.total)}
                                    </div>
                                </div>
                            ))}
                        </div>
                     </div>

                     {/* Summary Footer */}
                     <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-center">
                                 <span className="text-gray-500 font-medium">Ara Toplam</span>
                                 <span className="font-bold text-gray-900">{formatCurrency(selectedOrder.toplam_tutar)}</span>
                            </div>
                             <div className="flex justify-between items-center">
                                 <span className="text-gray-500 font-medium">Kişi Sayısı</span>
                                 <span className="font-bold text-gray-900">{selectedOrder.kisi_sayisi}</span>
                            </div>
                            {selectedOrder.odeme_yontemi && (
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium">Ödeme Yöntemi</span>
                                    <span className="font-bold text-gray-900">{selectedOrder.odeme_yontemi}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="border-t-2 border-dashed border-gray-100 pt-4 flex justify-between items-center">
                            <span className="text-lg font-bold text-gray-900">Genel Toplam</span>
                            <span className="text-3xl font-black text-indigo-600 tracking-tight">{formatCurrency(selectedOrder.toplam_tutar)}</span>
                        </div>
                     </div>
                </div>
            </div>
        </div>
      )}

      {/* Loading Overlay for Detail */}
      {orderDetailLoading && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                <span className="font-medium text-gray-700">Yükleniyor...</span>
            </div>
        </div>
      )}

      {/* Branch Management Modal */}
      {branchManagementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900">
                        {editingBranch ? (editingBranch.id ? 'Şube Düzenle' : 'Yeni Şube Ekle') : 'Şube Yönetimi'}
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
                                                kasa_no: branch.kasa_no
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
                                        kasa_no: 1
                                    });
                                }}
                                className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 transition font-bold"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Yeni Şube Ekle</span>
                            </button>
                    </div>
                ) : (
                    <form onSubmit={handleSaveBranch} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Şube Adı</label>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    value={branchForm.db_host}
                                    onChange={(e) => setBranchForm({...branchForm, db_host: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">DB Adı</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                    value={branchForm.db_name}
                                    onChange={(e) => setBranchForm({...branchForm, db_name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kasa No</label>
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">DB Kullanıcı</label>
                            <input 
                                type="password" 
                                required
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={branchForm.db_user}
                                onChange={(e) => setBranchForm({...branchForm, db_user: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">DB Şifre</label>
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
                                İptal
                            </button>
                            <button 
                                type="submit"
                                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Kaydet
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
