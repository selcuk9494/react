'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Clock, DatabaseBackup, HardDrive, Play, RefreshCw, Save, Server, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/utils/api';

type BackupTarget = {
  id: number;
  name: string;
  kind: 'local' | 'rclone' | 'icloud';
  local_path?: string | null;
  rclone_remote?: string | null;
  retention_days: number;
  is_active: boolean;
};

type BackupConfig = {
  branch_id: number;
  branch_name: string;
  owner_email: string;
  db_host: string;
  db_port: number;
  db_name: string;
  db_user: string;
  branch_count?: string | number | null;
  config_id?: number | null;
  target_id?: number | null;
  is_enabled?: boolean | null;
  schedule_hour?: number | null;
  retention_days?: number | null;
  last_run_at?: string | null;
  next_run_at?: string | null;
  target_name?: string | null;
  target_kind?: string | null;
  last_status?: string | null;
  last_backup_at?: string | null;
  last_error?: string | null;
  last_size_bytes?: string | number | null;
};

type BackupJob = {
  id: number;
  branch_id?: number | null;
  branch_name?: string | null;
  owner_email?: string | null;
  database_name?: string | null;
  status: 'pending' | 'running' | 'success' | 'failed';
  trigger_type: string;
  file_name?: string | null;
  storage_path?: string | null;
  size_bytes?: string | number | null;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  error?: string | null;
  created_at: string;
  target_name?: string | null;
};

const formatBytes = (value?: string | number | null) => {
  const bytes = Number(value || 0);
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const statusClass = (status?: string | null) => {
  if (status === 'success') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'running') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
};

const statusLabel = (status?: string | null) => {
  if (status === 'success') return 'Başarılı';
  if (status === 'failed') return 'Sorunlu';
  if (status === 'running') return 'Çalışıyor';
  if (status === 'pending') return 'Bekliyor';
  return 'Yok';
};

export default function AdminBackupsPage() {
  const { token, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const hasLoadedOverviewRef = useRef(false);
  const lastAutoFetchKeyRef = useRef('');
  const [targets, setTargets] = useState<BackupTarget[]>([]);
  const [configs, setConfigs] = useState<BackupConfig[]>([]);
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingBranchId, setSavingBranchId] = useState<number | null>(null);
  const [runningBranchId, setRunningBranchId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    is_enabled: true,
    target_id: '',
    schedule_hour: 2,
    retention_days: 3,
  });
  const [targetForm, setTargetForm] = useState({
    name: 'Sunucu lokal yedek klasörü',
    kind: 'local' as 'local' | 'rclone' | 'icloud',
    local_path: '',
    rclone_remote: '',
    retention_days: 3,
    is_active: true,
  });
  const [configForms, setConfigForms] = useState<Record<number, {
    is_enabled: boolean;
    target_id: string;
    schedule_hour: number;
    retention_days: number;
  }>>({});

  const fetchOverview = async () => {
    if (!token) return;
    setLoading(!hasLoadedOverviewRef.current);
    setMessage('');
    try {
      const res = await axios.get(`${getApiUrl()}/admin/backups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data || {};
      const nextTargets = Array.isArray(data.targets) ? data.targets : [];
      const nextConfigs = Array.isArray(data.configs) ? data.configs : [];
      setTargets(nextTargets);
      setBulkForm((current) => ({
        ...current,
        target_id: current.target_id || (nextTargets[0]?.id ? String(nextTargets[0].id) : ''),
      }));
      setConfigs(nextConfigs);
      setJobs(Array.isArray(data.backups) ? data.backups : []);
      setConfigForms(Object.fromEntries(nextConfigs.map((item: BackupConfig) => [
        item.branch_id,
        {
          is_enabled: item.is_enabled === true,
          target_id: item.target_id ? String(item.target_id) : (nextTargets[0]?.id ? String(nextTargets[0].id) : ''),
          schedule_hour: Number(item.schedule_hour ?? 2),
          retention_days: Number(item.retention_days ?? 3),
        },
      ])));
    } catch (error: any) {
      console.error(error);
      const status = error?.response?.status;
      const apiMessage = error?.response?.data?.message;
      if (status === 403) {
        setMessage('Bu ekran için Veritabanı Yedekleri yetkisi gerekiyor.');
      } else {
        setMessage(apiMessage || 'Yedekleme bilgileri alınamadı. Backend bağlantısını ve yedek tablolarını kontrol edin.');
      }
    } finally {
      hasLoadedOverviewRef.current = true;
      setLoading(false);
    }
  };

  const backupPermissionKey = Array.isArray(user?.allowed_reports)
    ? user.allowed_reports.join('|')
    : String(user?.allowed_reports ?? 'all');

  useEffect(() => {
    if (authLoading) return;
    if (!token) return;
    const canSeeBackups =
      user?.allowed_reports === null ||
      typeof user?.allowed_reports === 'undefined' ||
      user?.allowed_reports?.includes('database_backups');
    if (!user?.is_admin || !canSeeBackups) {
      router.push('/dashboard');
      return;
    }
    const autoFetchKey = `${token}:${user?.is_admin ? 'admin' : 'user'}:${backupPermissionKey}`;
    if (lastAutoFetchKeyRef.current === autoFetchKey) return;
    lastAutoFetchKeyRef.current = autoFetchKey;
    fetchOverview();
  }, [token, authLoading, user?.is_admin, backupPermissionKey]);

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      const haystack = `${job.branch_name || ''} ${job.owner_email || ''} ${job.database_name || ''} ${job.file_name || ''}`.toLowerCase();
      return matchesStatus && (!normalized || haystack.includes(normalized));
    });
  }, [jobs, statusFilter, query]);

  const selectedAllBranches = configs.length > 0 && configs.every((item) => selectedBranchIds.includes(item.branch_id));

  const stats = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        acc.total += 1;
        if (job.status === 'success') acc.success += 1;
        if (job.status === 'failed') acc.failed += 1;
        if (job.status === 'running') acc.running += 1;
        acc.size += Number(job.size_bytes || 0);
        return acc;
      },
      { total: 0, success: 0, failed: 0, running: 0, size: 0 },
    );
  }, [jobs]);

  const updateConfigForm = (branchId: number, patch: Partial<typeof configForms[number]>) => {
    setConfigForms((current) => ({
      ...current,
      [branchId]: Object.assign({
        is_enabled: false,
        target_id: targets[0]?.id ? String(targets[0].id) : '',
        schedule_hour: 2,
        retention_days: 3,
      }, current[branchId] || {}, patch),
    }));
  };

  const toggleBranchSelection = (branchId: number) => {
    setSelectedBranchIds((current) =>
      current.includes(branchId)
        ? current.filter((id) => id !== branchId)
        : [...current, branchId],
    );
  };

  const toggleAllBranches = () => {
    setSelectedBranchIds(selectedAllBranches ? [] : configs.map((item) => item.branch_id));
  };

  const saveTarget = async () => {
    if (!token) return;
    setMessage('');
    try {
      await axios.post(`${getApiUrl()}/admin/backups/targets`, targetForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTargetForm({
        name: 'Sunucu lokal yedek klasörü',
        kind: 'local',
        local_path: '',
        rclone_remote: '',
        retention_days: 3,
        is_active: true,
      });
      await fetchOverview();
      setMessage('Yedekleme hedefi kaydedildi.');
    } catch (error) {
      console.error(error);
      setMessage('Yedekleme hedefi kaydedilemedi.');
    }
  };

  const deleteTarget = async (targetId: number) => {
    if (!token || !confirm('Bu hedef silinsin mi? Şube ayarlarından kaldırılacak.')) return;
    await axios.delete(`${getApiUrl()}/admin/backups/targets/${targetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchOverview();
  };

  const saveConfig = async (branchId: number) => {
    if (!token) return;
    const form = configForms[branchId];
    if (!form) return;
    setSavingBranchId(branchId);
    setMessage('');
    try {
      await axios.put(`${getApiUrl()}/admin/backups/configs/${branchId}`, {
        is_enabled: form.is_enabled,
        target_id: form.target_id ? Number(form.target_id) : null,
        schedule_hour: Number(form.schedule_hour),
        retention_days: Number(form.retention_days),
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchOverview();
      setMessage('Şube yedek ayarı kaydedildi.');
    } catch (error) {
      console.error(error);
      setMessage('Şube yedek ayarı kaydedilemedi.');
    } finally {
      setSavingBranchId(null);
    }
  };

  const applyBulkConfig = async () => {
    if (!token || selectedBranchIds.length === 0) return;
    setBulkSaving(true);
    setMessage('');
    try {
      await Promise.all(selectedBranchIds.map((branchId) =>
        axios.put(`${getApiUrl()}/admin/backups/configs/${branchId}`, {
          is_enabled: bulkForm.is_enabled,
          target_id: bulkForm.target_id ? Number(bulkForm.target_id) : null,
          schedule_hour: Number(bulkForm.schedule_hour),
          retention_days: Number(bulkForm.retention_days),
        }, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ));
      await fetchOverview();
      setMessage(`${selectedBranchIds.length} şube yedek ayarına atandı.`);
    } catch (error) {
      console.error(error);
      setMessage('Toplu şube ataması yapılamadı.');
    } finally {
      setBulkSaving(false);
    }
  };

  const runBackup = async (branchId: number) => {
    if (!token) return;
    const form = configForms[branchId];
    setRunningBranchId(branchId);
    setMessage('');
    try {
      await axios.post(`${getApiUrl()}/admin/backups/run`, {
        branch_id: branchId,
        target_id: form?.target_id ? Number(form.target_id) : undefined,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchOverview();
      setMessage('Yedekleme işi başlatıldı.');
    } catch (error) {
      console.error(error);
      setMessage('Yedekleme başlatılamadı.');
    } finally {
      setRunningBranchId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24">
        <div className="mx-auto flex max-w-5xl justify-center py-16">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 pt-24 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-950">Admin Paneli — Veritabanı Yedekleri</h1>
            <p className="mt-1 text-sm text-gray-500">Şube veritabanlarını pg_dump ile alır, 3 gün saklama ve sorunlu yedek takibi yapar.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchOverview} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm">
              <RefreshCw className="h-4 w-4" />
              Yenile
            </button>
            <button onClick={() => router.back()} className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-900">
              Geri
            </button>
          </div>
        </div>

        {message && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            {message}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { label: 'Toplam yedek', value: stats.total, icon: DatabaseBackup },
            { label: 'Başarılı', value: stats.success, icon: Save },
            { label: 'Sorunlu', value: stats.failed, icon: RefreshCw },
            { label: 'Toplam boyut', value: formatBytes(stats.size), icon: HardDrive },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">{item.label}</span>
                  <Icon className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="mt-3 text-2xl font-bold text-gray-950">{item.value}</div>
              </div>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold text-gray-950">Şube Yedek Ayarları</h2>
            </div>
            <div className="border-b bg-gray-50 p-4 space-y-3">
              <div className="text-sm font-semibold text-gray-900">Toplu şube ataması</div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[150px_1fr_120px_130px_220px] lg:items-end">
                <label className="flex items-center gap-2 pb-2 text-sm font-medium text-gray-800">
                  <input
                    type="checkbox"
                    checked={selectedAllBranches}
                    onChange={toggleAllBranches}
                  />
                  Tüm şubeler
                </label>
                <label className="space-y-1 text-xs font-medium text-gray-500">
                  <span>Yedek hedefi</span>
                  <select
                    value={bulkForm.target_id}
                    onChange={(event) => setBulkForm({ ...bulkForm, target_id: event.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
                  >
                    {targets.map((target) => (
                      <option key={target.id} value={target.id}>{target.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium text-gray-500">
                  <span>Yedek saati</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={bulkForm.schedule_hour}
                    onChange={(event) => setBulkForm({ ...bulkForm, schedule_hour: parseInt(event.target.value || '2', 10) })}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
                  />
                </label>
                <label className="space-y-1 text-xs font-medium text-gray-500">
                  <span>Saklama günü</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={bulkForm.retention_days}
                    onChange={(event) => setBulkForm({ ...bulkForm, retention_days: parseInt(event.target.value || '3', 10) })}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={bulkForm.is_enabled}
                      onChange={(event) => setBulkForm({ ...bulkForm, is_enabled: event.target.checked })}
                    />
                    Otomatik
                  </label>
                  <button
                    onClick={applyBulkConfig}
                    disabled={bulkSaving || selectedBranchIds.length === 0}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {bulkSaving ? 'Atanıyor...' : `${selectedBranchIds.length} şubeye ata`}
                  </button>
                </div>
              </div>
            </div>
            <div className="divide-y">
              {configs.map((item) => {
                const form = configForms[item.branch_id] || {
                  is_enabled: false,
                  target_id: targets[0]?.id ? String(targets[0].id) : '',
                  schedule_hour: 2,
                  retention_days: 3,
                };
                return (
                  <div key={item.branch_id} className="p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <input
                          type="checkbox"
                          checked={selectedBranchIds.includes(item.branch_id)}
                          onChange={() => toggleBranchSelection(item.branch_id)}
                          className="mt-1 h-4 w-4"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-gray-950">{item.branch_name}</h3>
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(item.last_status)}`}>
                              {statusLabel(item.last_status)}
                            </span>
                            {Number(item.branch_count || 0) > 1 && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                {Number(item.branch_count)} kayıt tek kaynak
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {item.owner_email} • {item.db_host}:{item.db_port} / {item.db_name} ({item.db_user})
                          </div>
                          {item.last_error && <div className="mt-2 text-xs text-red-600">{item.last_error}</div>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 md:grid-cols-[115px_190px_105px_115px_auto_auto] md:items-end">
                        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={form.is_enabled}
                            onChange={(event) => updateConfigForm(item.branch_id, { is_enabled: event.target.checked })}
                          />
                          Otomatik
                        </label>
                        <label className="space-y-1 text-xs font-medium text-gray-500">
                          <span>Hedef</span>
                          <select
                            value={form.target_id}
                            onChange={(event) => updateConfigForm(item.branch_id, { target_id: event.target.value })}
                            className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
                          >
                            {targets.map((target) => (
                              <option key={target.id} value={target.id}>{target.name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1 text-xs font-medium text-gray-500">
                          <span>Saat</span>
                          <input
                            type="number"
                            min={0}
                            max={23}
                            value={form.schedule_hour}
                            onChange={(event) => updateConfigForm(item.branch_id, { schedule_hour: parseInt(event.target.value || '2', 10) })}
                            className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
                          />
                        </label>
                        <label className="space-y-1 text-xs font-medium text-gray-500">
                          <span>Saklama günü</span>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={form.retention_days}
                            onChange={(event) => updateConfigForm(item.branch_id, { retention_days: parseInt(event.target.value || '3', 10) })}
                            className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
                          />
                        </label>
                        <button
                          onClick={() => saveConfig(item.branch_id)}
                          disabled={savingBranchId === item.branch_id}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          Kaydet
                        </button>
                        <button
                          onClick={() => runBackup(item.branch_id)}
                          disabled={runningBranchId === item.branch_id}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          <Play className="h-4 w-4" />
                          Yedek Al
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>Son: {formatDate(item.last_backup_at)}</span>
                      <span>Sıradaki: {formatDate(item.next_run_at)}</span>
                      <span>Son boyut: {formatBytes(item.last_size_bytes)}</span>
                    </div>
                  </div>
                );
              })}
              {configs.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-500">Henüz şube yok.</div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-indigo-500" />
                <h2 className="font-semibold text-gray-950">Yedekleme Hedefi</h2>
              </div>
              <div className="mt-4 space-y-3">
                <label className="block space-y-1 text-xs font-medium text-gray-500">
                  <span>Hedef adı</span>
                  <input
                    value={targetForm.name}
                    onChange={(event) => setTargetForm({ ...targetForm, name: event.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
                    placeholder="Hedef adı"
                  />
                </label>
                <label className="block space-y-1 text-xs font-medium text-gray-500">
                  <span>Hedef türü</span>
                  <select
                    value={targetForm.kind}
                    onChange={(event) => {
                      const kind = event.target.value as 'local' | 'rclone' | 'icloud';
                      setTargetForm({
                        ...targetForm,
                        kind,
                        name:
                          kind === 'icloud' && targetForm.name === 'Sunucu lokal yedek klasörü'
                            ? 'iCloud Drive yedekleri'
                            : targetForm.name,
                      });
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="local">Lokal/NAS klasörü</option>
                    <option value="icloud">iCloud Drive</option>
                    <option value="rclone">rclone remote</option>
                  </select>
                </label>
                {targetForm.kind === 'local' ? (
                  <label className="block space-y-1 text-xs font-medium text-gray-500">
                    <span>Klasör yolu</span>
                    <input
                      value={targetForm.local_path}
                      onChange={(event) => setTargetForm({ ...targetForm, local_path: event.target.value })}
                      className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
                      placeholder="Boşsa backend/backups/database"
                    />
                  </label>
                ) : (
                  <label className="block space-y-1 text-xs font-medium text-gray-500">
                    <span>{targetForm.kind === 'icloud' ? 'iCloud remote yolu' : 'rclone hedefi'}</span>
                    <input
                      value={targetForm.rclone_remote}
                      onChange={(event) => setTargetForm({ ...targetForm, rclone_remote: event.target.value })}
                      className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
                      placeholder={targetForm.kind === 'icloud' ? 'örn. icloud:FastRestBackups' : 'örn. drive:fastrest-backups'}
                    />
                    {targetForm.kind === 'icloud' && (
                      <span className="block text-[11px] leading-4 text-gray-500">
                        Sunucuda rclone ile iCloud remote bir kez tanımlanmalı. Örnek remote adı: icloud
                      </span>
                    )}
                  </label>
                )}
                <label className="block space-y-1 text-xs font-medium text-gray-500">
                  <span>Varsayılan saklama günü</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={targetForm.retention_days}
                    onChange={(event) => setTargetForm({ ...targetForm, retention_days: parseInt(event.target.value || '3', 10) })}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
                    placeholder="Saklama günü"
                  />
                </label>
                <button onClick={saveTarget} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
                  Hedef Ekle
                </button>
              </div>
            </div>

            <div className="rounded-xl border bg-white shadow-sm">
              <div className="border-b px-4 py-3">
                <h2 className="font-semibold text-gray-950">Kayıtlı Hedefler</h2>
              </div>
              <div className="divide-y">
                {targets.map((target) => (
                  <div key={target.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-950">{target.name}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {target.kind === 'rclone' || target.kind === 'icloud' ? target.rclone_remote : target.local_path || 'Varsayılan lokal klasör'}
                        </div>
                        {target.kind === 'icloud' && <div className="mt-1 text-xs font-medium text-sky-600">iCloud Drive</div>}
                        <div className="mt-1 text-xs text-gray-500">{target.retention_days} gün saklama</div>
                      </div>
                      <button onClick={() => deleteTarget(target.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Sil">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="rounded-xl border bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-500" />
              <h2 className="font-semibold text-gray-950">Yedek Geçmişi</h2>
            </div>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900 md:w-72"
                placeholder="Şube, kullanıcı, DB ara"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border px-3 py-2 text-sm text-gray-900"
              >
                <option value="all">Tümü</option>
                <option value="success">Başarılı</option>
                <option value="failed">Sorunlu</option>
                <option value="running">Çalışıyor</option>
                <option value="pending">Bekliyor</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Şube</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Boyut</th>
                  <th className="px-4 py-3">Hedef</th>
                  <th className="px-4 py-3">Dosya / Hata</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="align-top">
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(job.status)}`}>
                        {statusLabel(job.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-950">{job.branch_name || '-'}</div>
                      <div className="text-xs text-gray-500">{job.owner_email || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{formatDate(job.created_at)}</div>
                      <div className="text-xs text-gray-400">{job.trigger_type === 'scheduled' ? 'Otomatik' : 'Manuel'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatBytes(job.size_bytes)}</td>
                    <td className="px-4 py-3 text-gray-600">{job.target_name || '-'}</td>
                    <td className="max-w-xl px-4 py-3">
                      {job.error ? (
                        <div className="text-xs text-red-600">{job.error}</div>
                      ) : (
                        <>
                          <div className="text-xs text-gray-700">{job.file_name || '-'}</div>
                          <div className="mt-1 break-all text-xs text-gray-400">{job.storage_path || '-'}</div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredJobs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">Yedek kaydı yok.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
