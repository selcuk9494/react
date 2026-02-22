'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/utils/api';
import axios from 'axios';
import { 
  ArrowLeft, 
  Users, 
  TrendingUp, 
  ShoppingBag,
  Award,
  RefreshCcw,
  Calendar,
  ChevronDown,
  AlertCircle,
  Star,
  Gift,
  XCircle,
  RotateCcw
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

interface PersonnelData {
  id: number;
  name: string;
  order_count: number;
  closed_order_count: number;
  open_order_count: number;
  total_sales: number;
  closed_sales: number;
  open_sales: number;
  avg_ticket: number;
  ikram_total: number;
  iade_total: number;
  iptal_total: number;
  ikram_count: number;
  iade_count: number;
  iptal_count: number;
}

interface ReportData {
  period: { start: string; end: string };
  summary: {
    total_sales: number;
    total_orders: number;
    personnel_count: number;
    avg_per_personnel: number;
  };
  personnel: PersonnelData[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(value);
};

const periodLabels: Record<string, string> = {
  today: 'Bugün',
  yesterday: 'Dün',
  week: 'Bu Hafta',
  last7days: 'Son 7 Gün',
  month: 'Bu Ay',
  lastmonth: 'Geçen Ay',
};

export default function PersonnelReportPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('today');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<PersonnelData | null>(null);
  
  const prevPeriodRef = useRef(period);
  const prevBranchRef = useRef(user?.selected_branch);

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }

    const fetchData = async () => {
      // Period veya branch değiştiyse veriyi temizle
      if (prevPeriodRef.current !== period || prevBranchRef.current !== user?.selected_branch) {
        setData(null);
        prevPeriodRef.current = period;
        prevBranchRef.current = user?.selected_branch;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        const res = await axios.get(`${getApiUrl()}/reports/personnel?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000
        });
        setData(res.data);
      } catch (err: any) {
        console.error('Personnel report error:', err);
        setError('Veri alınamadı. Lütfen tekrar deneyin.');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, period, user?.selected_branch, router]);

  const handleRefresh = () => {
    setData(null);
    setLoading(true);
    // Force re-fetch by toggling period
    setPeriod(p => p);
  };

  // Sıralı personel listesi (toplam satışa göre)
  const sortedPersonnel = data?.personnel?.sort((a, b) => b.total_sales - a.total_sales) || [];
  
  // En iyi performans gösteren
  const topPerformer = sortedPersonnel[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 pb-20">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link 
                href="/dashboard" 
                className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  Personel Raporu
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Period Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowPeriodMenu(!showPeriodMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-xl text-sm font-medium border border-purple-200"
                >
                  <Calendar className="w-4 h-4" />
                  <span>{periodLabels[period]}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {showPeriodMenu && (
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                    {Object.entries(periodLabels).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setPeriod(key);
                          setShowPeriodMenu(false);
                        }}
                        className={clsx(
                          "w-full px-4 py-2 text-left text-sm hover:bg-purple-50 transition-all",
                          period === key ? "bg-purple-100 text-purple-700 font-semibold" : "text-gray-700"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <button 
                onClick={handleRefresh}
                disabled={loading}
                className="p-2 bg-purple-50 hover:bg-purple-100 rounded-xl text-purple-600 transition-all disabled:opacity-50"
              >
                <RefreshCcw className={clsx("w-5 h-5", loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && !data && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-12 bg-gray-200 rounded w-1/2"></div>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Card */}
        {data && (
          <>
            <div className="bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-600 rounded-2xl p-5 text-white shadow-xl shadow-purple-500/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Award className="w-6 h-6" />
                  <span className="font-bold text-lg">Toplam Performans</span>
                </div>
                <span className="text-purple-200 text-sm">{periodLabels[period]}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-purple-200 text-xs mb-1">Toplam Satış</p>
                  <p className="text-2xl font-black">{formatCurrency(data.summary.total_sales)}</p>
                </div>
                <div>
                  <p className="text-purple-200 text-xs mb-1">Toplam Sipariş</p>
                  <p className="text-2xl font-black">{data.summary.total_orders}</p>
                </div>
                <div>
                  <p className="text-purple-200 text-xs mb-1">Personel Sayısı</p>
                  <p className="text-xl font-bold">{data.summary.personnel_count}</p>
                </div>
                <div>
                  <p className="text-purple-200 text-xs mb-1">Kişi Başı Ort.</p>
                  <p className="text-xl font-bold">{formatCurrency(data.summary.avg_per_personnel)}</p>
                </div>
              </div>
            </div>

            {/* Top Performer Banner */}
            {topPerformer && (
              <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl p-4 text-white flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Star className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-amber-100 text-xs">En İyi Performans</p>
                  <p className="font-bold text-lg">{topPerformer.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-amber-100 text-xs">Satış</p>
                  <p className="font-bold">{formatCurrency(topPerformer.total_sales)}</p>
                </div>
              </div>
            )}

            {/* Personnel List */}
            <div className="space-y-3">
              <h2 className="font-bold text-gray-800 px-1">Personel Detayları</h2>
              
              {sortedPersonnel.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Bu dönemde personel verisi bulunamadı</p>
                </div>
              ) : (
                sortedPersonnel.map((person, index) => (
                  <div 
                    key={person.id}
                    onClick={() => setSelectedPersonnel(selectedPersonnel?.id === person.id ? null : person)}
                    className={clsx(
                      "bg-white rounded-xl p-4 shadow-sm border transition-all cursor-pointer",
                      selectedPersonnel?.id === person.id 
                        ? "border-purple-300 shadow-purple-100" 
                        : "border-gray-100 hover:border-purple-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank Badge */}
                      <div className={clsx(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                        index === 0 ? "bg-amber-100 text-amber-700" :
                        index === 1 ? "bg-gray-200 text-gray-600" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-purple-50 text-purple-600"
                      )}>
                        {index + 1}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">{person.name}</h3>
                        <p className="text-xs text-gray-500">
                          {person.order_count} sipariş • Ort: {formatCurrency(person.avg_ticket)}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-bold text-purple-600">{formatCurrency(person.total_sales)}</p>
                        {period === 'today' && person.open_order_count > 0 && (
                          <p className="text-xs text-orange-500">{person.open_order_count} açık</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Expanded Details */}
                    {selectedPersonnel?.id === person.id && (
                      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3">
                        <div className="bg-emerald-50 rounded-lg p-3 text-center">
                          <ShoppingBag className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                          <p className="text-xs text-emerald-600">Kapalı</p>
                          <p className="font-bold text-emerald-700">{formatCurrency(person.closed_sales)}</p>
                          <p className="text-xs text-emerald-500">{person.closed_order_count} sipariş</p>
                        </div>
                        
                        {period === 'today' && (
                          <div className="bg-orange-50 rounded-lg p-3 text-center">
                            <TrendingUp className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                            <p className="text-xs text-orange-600">Açık</p>
                            <p className="font-bold text-orange-700">{formatCurrency(person.open_sales)}</p>
                            <p className="text-xs text-orange-500">{person.open_order_count} sipariş</p>
                          </div>
                        )}
                        
                        <div className="bg-purple-50 rounded-lg p-3 text-center">
                          <Award className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                          <p className="text-xs text-purple-600">Ort. Fiş</p>
                          <p className="font-bold text-purple-700">{formatCurrency(person.avg_ticket)}</p>
                        </div>
                        
                        {/* İkram/İade/İptal */}
                        {(person.ikram_count > 0 || person.iade_count > 0 || person.iptal_count > 0) && (
                          <div className="col-span-3 flex gap-2 mt-2">
                            {person.ikram_count > 0 && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-lg text-xs">
                                <Gift className="w-3 h-3 text-blue-500" />
                                <span className="text-blue-700">{person.ikram_count} İkram</span>
                                <span className="text-blue-500">({formatCurrency(person.ikram_total)})</span>
                              </div>
                            )}
                            {person.iade_count > 0 && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg text-xs">
                                <RotateCcw className="w-3 h-3 text-amber-500" />
                                <span className="text-amber-700">{person.iade_count} İade</span>
                                <span className="text-amber-500">({formatCurrency(person.iade_total)})</span>
                              </div>
                            )}
                            {person.iptal_count > 0 && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg text-xs">
                                <XCircle className="w-3 h-3 text-red-500" />
                                <span className="text-red-700">{person.iptal_count} İptal</span>
                                <span className="text-red-500">({formatCurrency(person.iptal_total)})</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
