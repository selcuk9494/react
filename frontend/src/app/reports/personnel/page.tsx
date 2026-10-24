'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSharedReportFilters, getBranchKasaOptions } from '@/utils/reportFilters';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/utils/api';
import axios from 'axios';
import {
  Users,
  TrendingUp,
  ShoppingBag,
  Award,
  RefreshCcw,
  AlertCircle,
  Star,
  Gift,
  XCircle,
  RotateCcw,
  Receipt,
} from 'lucide-react';
import clsx from 'clsx';
import ReportHeader from '@/components/ReportHeader';
import ReportShell from '@/components/ReportShell';
import StatTile from '@/components/StatTile';
import ReportExportButtons from '@/components/ReportExportButtons';

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

export default function PersonnelReportPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { period, setPeriod, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, kasaNo, setKasaNo } = useSharedReportFilters();
  const kasaOptions = getBranchKasaOptions(user);
  const [selectedPersonnel, setSelectedPersonnel] = useState<PersonnelData | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const prevPeriodRef = useRef(period);
  const prevBranchRef = useRef(user?.selected_branch);

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    if (period === 'custom' && (!customStartDate || !customEndDate)) return;

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
        let url = `${getApiUrl()}/reports/personnel?period=${period}`;
        if (kasaNo) url += `&kasa_no=${kasaNo}`;
        if (period === 'custom') {
          url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
        }
        const res = await axios.get(url, {
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
  }, [token, period, customStartDate, customEndDate, user?.selected_branch, router, kasaNo, reloadTick]);

  const handleRefresh = () => {
    setData(null);
    setLoading(true);
    setReloadTick((n) => n + 1);
  };

  // Sıralı personel listesi (toplam satışa göre)
  const sortedPersonnel = data?.personnel?.slice().sort((a, b) => b.total_sales - a.total_sales) || [];
  const topPerformer = sortedPersonnel[0];

  return (
    <div className="min-h-screen bg-slate-50 font-sans safe-bottom">
      <ReportHeader
        title="Personel Raporu"
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        actions={
          <>
            <ReportExportButtons
              title="Personel Raporu"
              rows={sortedPersonnel}
              columns={[
                { key: 'name', label: 'Personel' },
                { key: 'order_count', label: 'Adisyon' },
                { key: 'closed_order_count', label: 'Kapalı' },
                { key: 'open_order_count', label: 'Açık' },
                { key: 'total_sales', label: 'Toplam', format: (value) => formatCurrency(Number(value || 0)) },
                { key: 'avg_ticket', label: 'Ortalama', format: (value) => formatCurrency(Number(value || 0)) },
                { key: 'ikram_total', label: 'İkram', format: (value) => formatCurrency(Number(value || 0)) },
                { key: 'iade_total', label: 'İade', format: (value) => formatCurrency(Number(value || 0)) },
                { key: 'iptal_total', label: 'İptal', format: (value) => formatCurrency(Number(value || 0)) },
              ]}
            />
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
              title="Yenile"
              type="button"
            >
              <RefreshCcw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </>
        }
        kasaNo={kasaNo}
        setKasaNo={setKasaNo}
        kasaOptions={kasaOptions}
      />

      <ReportShell>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {loading && !data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
              ))}
            </div>
            <div className="h-80 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile tone="dark" label="Toplam Satış" value={formatCurrency(data.summary.total_sales)} sub={`${data.summary.personnel_count} personel`} icon={Award} />
              <StatTile accent="indigo" label="Toplam Sipariş" value={data.summary.total_orders} icon={Receipt} />
              <StatTile accent="purple" label="Personel" value={data.summary.personnel_count} icon={Users} />
              <StatTile accent="emerald" label="Kişi Başı Ort." value={formatCurrency(data.summary.avg_per_personnel)} icon={TrendingUp} />
            </div>

            {topPerformer && (
              <div className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 p-4 text-white flex items-center gap-3 shadow-sm">
                <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-amber-100 text-xs">En İyi Performans</p>
                  <p className="font-bold text-lg truncate">{topPerformer.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-amber-100 text-xs">Satış</p>
                  <p className="font-bold">{formatCurrency(topPerformer.total_sales)}</p>
                </div>
              </div>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Personel Detayları</h2>
                <span className="text-sm text-slate-500">{sortedPersonnel.length} personel</span>
              </div>

              {sortedPersonnel.length === 0 ? (
                <div className="p-10 text-center">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Bu dönemde personel verisi bulunamadı</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sortedPersonnel.map((person, index) => (
                    <div key={person.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPersonnel(selectedPersonnel?.id === person.id ? null : person)}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition"
                      >
                        <div className={clsx(
                          'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
                          index === 0 ? 'bg-amber-100 text-amber-700' :
                            index === 1 ? 'bg-slate-200 text-slate-600' :
                              index === 2 ? 'bg-orange-100 text-orange-700' :
                                'bg-purple-50 text-purple-600'
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 truncate">{person.name}</h3>
                          <p className="text-xs text-slate-500">{person.order_count} sipariş • Ort: {formatCurrency(person.avg_ticket)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-slate-900">{formatCurrency(person.total_sales)}</p>
                          {period === 'today' && person.open_order_count > 0 && (
                            <p className="text-xs text-orange-500">{person.open_order_count} açık</p>
                          )}
                        </div>
                      </button>

                      {selectedPersonnel?.id === person.id && (
                        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50/60">
                          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                            <ShoppingBag className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                            <p className="text-xs text-emerald-600">Kapalı</p>
                            <p className="font-bold text-emerald-700">{formatCurrency(person.closed_sales)}</p>
                            <p className="text-xs text-emerald-500">{person.closed_order_count} sipariş</p>
                          </div>
                          {period === 'today' && (
                            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                              <TrendingUp className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                              <p className="text-xs text-orange-600">Açık</p>
                              <p className="font-bold text-orange-700">{formatCurrency(person.open_sales)}</p>
                              <p className="text-xs text-orange-500">{person.open_order_count} sipariş</p>
                            </div>
                          )}
                          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                            <Award className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                            <p className="text-xs text-purple-600">Ort. Fiş</p>
                            <p className="font-bold text-purple-700">{formatCurrency(person.avg_ticket)}</p>
                          </div>
                          {(person.ikram_count > 0 || person.iade_count > 0 || person.iptal_count > 0) && (
                            <div className="col-span-2 md:col-span-3 flex flex-wrap gap-2">
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
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </ReportShell>
    </div>
  );
}
