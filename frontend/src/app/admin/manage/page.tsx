'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/utils/api';
import {
  Building,
  Check,
  Link2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';

type Branch = {
  id?: number | null;
  name: string;
  db_host: string;
  db_port: number;
  db_name: string;
  db_user: string;
  db_password: string;
  kasa_no: number;
  kasalar?: number[];
  kasalar_input?: string;
  closing_hour: number;
  owner_email?: string;
};

type AdminUser = {
  id: string;
  email: string;
  is_admin?: boolean;
  selected_branch?: number;
  expiry_date?: string;
  branches?: Branch[];
  allowed_reports?: string[] | null;
};

const AVAILABLE_REPORTS = [
  { id: 'dashboard', label: 'Dashboard Satış Özeti' },
  { id: 'open_orders', label: 'Açık Adisyon' },
  { id: 'open_order_item_cancel', label: 'Açık Adisyon Ürün İptal' },
  { id: 'open_order_item_gift', label: 'Açık Adisyon Ürün İkram' },
  { id: 'open_order_discount', label: 'Açık Adisyon Dip İndirim' },
  { id: 'closed_orders', label: 'Kapalı Adisyon' },
  { id: 'stock_entry', label: 'Günlük Stok Girişi' },
  { id: 'live_stock', label: 'Canlı Stok Takip' },
  { id: 'database_backups', label: 'Veritabanı Yedekleri' },
  { id: 'product_prices', label: 'Ürün Fiyatları' },
  { id: 'product_sales', label: 'Ürün Satışları' },
  { id: 'personnel', label: 'Personel Performans' },
  { id: 'payment_types', label: 'Ödeme Tipleri' },
  { id: 'payment_types_detail', label: 'Ödeme Tipleri Detay' },
  { id: 'cash_report', label: 'Kasa Raporu' },
  { id: 'hourly_sales', label: 'Saatlik Satış' },
  { id: 'cancels', label: 'İptaller' },
  { id: 'discounts', label: 'İndirimler' },
  { id: 'debts', label: 'Borca Atılanlar' },
  { id: 'courier', label: 'Kurye Takip' },
  { id: 'unpayable', label: 'Ödenmezler' },
  { id: 'unsold_cancels', label: 'Satılmadan İptaller' },
];

const emptyBranch: Branch = {
  id: null,
  name: '',
  db_host: '',
  db_port: 5432,
  db_name: '',
  db_user: '',
  db_password: '',
  kasa_no: 1,
  kasalar_input: '1',
  closing_hour: 6,
};

const parseInteger = (value: unknown, fallback: number) => {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeKasalar = (value: unknown, fallback = 1) => {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s;]+/)
      : typeof value === 'number'
        ? [value]
        : [];

  const parsed = Array.from(
    new Set(
      raw
        .map((item) => parseInteger(item, NaN))
        .filter((item) => Number.isFinite(item)),
    ),
  );
  return parsed.length ? parsed : [fallback];
};

const formatKasalar = (branch: Partial<Branch>) =>
  normalizeKasalar(
    branch.kasalar ?? branch.kasalar_input ?? branch.kasa_no,
    branch.kasa_no || 1,
  ).join(', ');

const branchPayload = (branch: Branch) => {
  const kasalar = normalizeKasalar(
    branch.kasalar_input ?? branch.kasalar ?? branch.kasa_no,
    parseInteger(branch.kasa_no, 1),
  );

  return {
    name: branch.name.trim(),
    db_host: branch.db_host.trim(),
    db_port: parseInteger(branch.db_port, 5432),
    db_name: branch.db_name.trim(),
    db_user: branch.db_user.trim(),
    db_password: branch.db_password,
    kasa_no: kasalar[0] ?? 1,
    kasalar,
    closing_hour: Math.max(0, Math.min(23, parseInteger(branch.closing_hour, 6))),
  };
};

export default function AdminManagePage() {
  const { token, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'branches'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [branchQuery, setBranchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [checkedUserIds, setCheckedUserIds] = useState<string[]>([]);
  const [bulkDays, setBulkDays] = useState(30);
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('');
  const [assignBranchId, setAssignBranchId] = useState<number | ''>('');
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    expiry_days: 30,
    expiry_date: '',
    is_admin: false,
  });
  const [branchForm, setBranchForm] = useState<Branch>(emptyBranch);
  const [reportsForm, setReportsForm] = useState<string[]>(
    AVAILABLE_REPORTS.map((report) => report.id),
  );

  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token],
  );

  const selectedUser = users.find((item) => item.id === selectedUserId) || null;
  const selectedBranch = branches.find((item) => item.id === selectedBranchId) || null;

  const filteredUsers = users.filter((item) =>
    item.email.toLowerCase().includes(userQuery.trim().toLowerCase()),
  );

  const filteredBranches = branches.filter((item) => {
    const needle = branchQuery.trim().toLowerCase();
    return [item.name, item.db_host, item.db_name, item.db_user, item.owner_email]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [usersRes, branchesRes] = await Promise.all([
        axios.get(`${getApiUrl()}/admin/users`, authHeaders),
        axios.get(`${getApiUrl()}/admin/branches`, authHeaders),
      ]);
      setUsers(usersRes.data || []);
      setBranches(branchesRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!token) return;
    if (!user?.is_admin) {
      router.push('/dashboard');
      return;
    }
    fetchData().catch(console.error);
  }, [token, authLoading, user?.is_admin, router]);

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const refreshAfterSave = async (successMessage: string) => {
    await fetchData();
    showMessage(successMessage);
  };

  const resetUserForm = () => {
    setSelectedUserId('');
    setUserForm({ email: '', password: '', expiry_days: 30, expiry_date: '', is_admin: false });
    setReportsForm(AVAILABLE_REPORTS.map((report) => report.id));
  };

  const toggleCheckedUser = (userId: string) => {
    setCheckedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((item) => item !== userId)
        : [...prev, userId],
    );
  };

  const extendUsers = async (scope: 'selected' | 'all') => {
    const targetIds = scope === 'all' ? users.map((item) => item.id) : checkedUserIds;
    const days = parseInteger(bulkDays, 30);
    if (!targetIds.length) {
      showMessage('Süre eklenecek kullanıcı seçin.');
      return;
    }
    if (days <= 0) {
      showMessage('Geçerli bir gün sayısı girin.');
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        targetIds.map((userId) =>
          axios.post(`${getApiUrl()}/admin/users/${userId}/extend`, { days }, authHeaders),
        ),
      );
      setCheckedUserIds([]);
      await refreshAfterSave(`${targetIds.length} kullanıcıya ${days} gün eklendi.`);
    } catch (error) {
      console.error(error);
      showMessage('Toplu süre eklenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const resetBranchForm = () => {
    setSelectedBranchId('');
    setBranchForm(emptyBranch);
  };

  const selectUser = (item: AdminUser) => {
    setSelectedUserId(item.id);
    setUserForm({
      email: item.email || '',
      password: '',
      expiry_days: 30,
      expiry_date: item.expiry_date ? String(item.expiry_date).slice(0, 10) : '',
      is_admin: !!item.is_admin,
    });
    setReportsForm(item.allowed_reports || AVAILABLE_REPORTS.map((report) => report.id));
  };

  const selectBranch = (item: Branch) => {
    setSelectedBranchId(item.id || '');
    setBranchForm({
      ...emptyBranch,
      ...item,
      db_port: parseInteger(item.db_port, 5432),
      kasa_no: normalizeKasalar(item.kasalar ?? item.kasa_no, item.kasa_no || 1)[0] ?? 1,
      kasalar_input: formatKasalar(item),
      closing_hour: parseInteger(item.closing_hour, 6),
    });
  };

  const saveUser = async () => {
    if (!token || saving) return;
    if (!/\S+@\S+\.\S+/.test(userForm.email)) {
      showMessage('Geçerli bir e-posta girin.');
      return;
    }
    if (!selectedUserId && !userForm.password.trim()) {
      showMessage('Yeni kullanıcı için şifre zorunlu.');
      return;
    }
    setSaving(true);
    try {
      if (selectedUserId) {
        await axios.put(
          `${getApiUrl()}/admin/users/${selectedUserId}`,
          {
            email: userForm.email.trim(),
            is_admin: userForm.is_admin,
            expiry_date: userForm.expiry_date || undefined,
            allowed_reports: reportsForm,
          },
          authHeaders,
        );
        if (userForm.password.trim()) {
          await axios.post(
            `${getApiUrl()}/admin/users/${selectedUserId}/password`,
            { password: userForm.password },
            authHeaders,
          );
        }
        await refreshAfterSave('Kullanıcı güncellendi.');
      } else {
        const created = await axios.post(
          `${getApiUrl()}/admin/users`,
          {
            email: userForm.email.trim(),
            password: userForm.password,
            expiry_days: parseInteger(userForm.expiry_days, 30),
            is_admin: userForm.is_admin,
            allowed_reports: reportsForm,
          },
          authHeaders,
        );
        setSelectedUserId(created.data?.id || '');
        await refreshAfterSave('Kullanıcı oluşturuldu.');
      }
    } catch (error) {
      console.error(error);
      showMessage('Kullanıcı kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const saveBranch = async () => {
    if (!token || saving) return;
    const payload = branchPayload(branchForm);
    if (!payload.name || !payload.db_host || !payload.db_name || !payload.db_user || !payload.db_password) {
      showMessage('Şube için tüm bağlantı alanlarını doldurun.');
      return;
    }
    setSaving(true);
    try {
      if (selectedBranchId) {
        await axios.put(`${getApiUrl()}/admin/branches/${selectedBranchId}`, payload, authHeaders);
        await refreshAfterSave('Şube güncellendi.');
      } else {
        const created = await axios.post(`${getApiUrl()}/admin/branches`, payload, authHeaders);
        setSelectedBranchId(created.data?.id || '');
        await refreshAfterSave('Şube kaydedildi.');
      }
    } catch (error) {
      console.error(error);
      showMessage('Şube kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async () => {
    if (!selectedUserId || !confirm('Kullanıcı silinsin mi?')) return;
    await axios.delete(`${getApiUrl()}/admin/users/${selectedUserId}`, authHeaders);
    resetUserForm();
    await refreshAfterSave('Kullanıcı silindi.');
  };

  const deleteBranch = async () => {
    if (!selectedBranchId || !confirm('Şube silinirse bu şube tüm kullanıcılardan kaldırılır. Devam edilsin mi?')) return;
    await axios.delete(`${getApiUrl()}/admin/branches/${selectedBranchId}`, authHeaders);
    resetBranchForm();
    await refreshAfterSave('Şube silindi.');
  };

  const assignBranch = async () => {
    if (!selectedUserId || !assignBranchId) {
      showMessage('Atama için kullanıcı ve şube seçin.');
      return;
    }
    await axios.post(
      `${getApiUrl()}/admin/users/${selectedUserId}/branches/assign`,
      { branch_id: assignBranchId },
      authHeaders,
    );
    setAssignBranchId('');
    await refreshAfterSave('Şube kullanıcıya atandı.');
  };

  const unassignBranch = async (branchId: number) => {
    if (!selectedUserId) return;
    await axios.delete(`${getApiUrl()}/admin/users/${selectedUserId}/branches/${branchId}`, authHeaders);
    await refreshAfterSave('Şube kullanıcıdan kaldırıldı.');
  };

  const selectUserBranch = async (branchId: number) => {
    if (!selectedUser) return;
    const index = (selectedUser.branches || []).findIndex((branch) => branch.id === branchId);
    if (index < 0) return;
    await axios.put(`${getApiUrl()}/admin/users/${selectedUser.id}`, { selected_branch: index }, authHeaders);
    await refreshAfterSave('Varsayılan şube seçildi.');
  };

  const toggleReport = (id: string) => {
    setReportsForm((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-950">
      <main className="mx-auto max-w-7xl px-4 py-6 pt-24 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-normal">Admin Yönetimi</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Önce kullanıcıyı veya şubeyi kaydedin; sonra kullanıcı ekranından şube atayın.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchData().catch(console.error)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Yenile
            </button>
            <button onClick={() => router.back()} className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900">
              Geri
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-4 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800">
            {message}
          </div>
        )}

        <div className="mb-5 grid rounded-md border bg-white p-1 shadow-sm sm:inline-grid sm:grid-cols-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`inline-flex items-center justify-center gap-2 rounded px-6 py-3 text-sm font-bold ${activeTab === 'users' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Users className="h-4 w-4" />
            Kullanıcılar
            <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === 'users' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{users.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`inline-flex items-center justify-center gap-2 rounded px-6 py-3 text-sm font-bold ${activeTab === 'branches' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Building className="h-4 w-4" />
            Şubeler
            <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === 'branches' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{branches.length}</span>
          </button>
        </div>

        {loading ? (
          <div className="rounded-md border bg-white p-12 text-center font-semibold text-slate-500">Yükleniyor...</div>
        ) : activeTab === 'users' ? (
          <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
            <section className="min-h-0 rounded-md border bg-white shadow-sm lg:max-h-[calc(100vh-250px)] lg:overflow-hidden">
              <div className="border-b p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Kullanıcılar</h2>
                  <button onClick={resetUserForm} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
                    <UserPlus className="h-4 w-4" />
                    Yeni
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-md border px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input className="w-full outline-none" placeholder="Kullanıcı ara" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} />
                </div>
                <div className="mt-3 rounded-md border bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Toplu süre</div>
                  <div className="grid gap-2">
                    <input
                      className="w-full rounded-md border px-3 py-2 text-sm font-semibold"
                      type="number"
                      min={1}
                      value={bulkDays}
                      onChange={(event) => setBulkDays(parseInteger(event.target.value, 30))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => extendUsers('selected')}
                        disabled={saving || checkedUserIds.length === 0}
                        className="rounded-md bg-indigo-600 px-2 py-2 text-xs font-bold text-white disabled:opacity-40"
                      >
                        Seçililere ekle
                      </button>
                      <button
                        onClick={() => extendUsers('all')}
                        disabled={saving || users.length === 0}
                        className="rounded-md bg-slate-900 px-2 py-2 text-xs font-bold text-white disabled:opacity-40"
                      >
                        Tümüne ekle
                      </button>
                    </div>
                    <div className="text-xs font-semibold text-slate-500">{checkedUserIds.length} kullanıcı seçili</div>
                  </div>
                </div>
              </div>
              <div className="p-2 lg:max-h-[calc(100vh-365px)] lg:overflow-y-auto">
                {filteredUsers.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectUser(item)}
                    className={`mb-2 w-full rounded-md border p-3 text-left transition ${selectedUserId === item.id ? 'border-indigo-400 bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <div className="flex gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={checkedUserIds.includes(item.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleCheckedUser(item.id)}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-bold">{item.email || 'E-posta yok'}</div>
                        <div className="mt-1 text-xs font-medium text-slate-500">
                          {(item.branches || []).length} şube atanmış {item.is_admin ? '• Admin' : ''}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-5 lg:sticky lg:top-24">
              <div className="rounded-md border bg-white shadow-sm">
                <div className="border-b p-4">
                  <h2 className="flex items-center gap-2 text-lg font-bold"><Users className="h-5 w-5 text-indigo-600" /> Kullanıcı Bilgileri</h2>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-600">
                    E-posta
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-slate-950" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
                  </label>
                  <label className="text-sm font-semibold text-slate-600">
                    Şifre {selectedUserId ? '(boş bırakılırsa değişmez)' : ''}
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-slate-950" type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
                  </label>
                  {selectedUserId ? (
                    <label className="text-sm font-semibold text-slate-600">
                      Bitiş tarihi
                      <input className="mt-1 w-full rounded-md border px-3 py-2 text-slate-950" type="date" value={userForm.expiry_date} onChange={(event) => setUserForm({ ...userForm, expiry_date: event.target.value })} />
                    </label>
                  ) : (
                    <label className="text-sm font-semibold text-slate-600">
                      Süre (gün)
                      <input className="mt-1 w-full rounded-md border px-3 py-2 text-slate-950" type="number" value={userForm.expiry_days} onChange={(event) => setUserForm({ ...userForm, expiry_days: parseInteger(event.target.value, 30) })} />
                    </label>
                  )}
                  <label className="mt-7 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={userForm.is_admin} onChange={(event) => setUserForm({ ...userForm, is_admin: event.target.checked })} />
                    Admin yetkisi
                  </label>
                </div>
                <div className="flex justify-between border-t p-4">
                  <button onClick={deleteUser} disabled={!selectedUserId} className="inline-flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-40">
                    <Trash2 className="h-4 w-4" />
                    Sil
                  </button>
                  <button onClick={saveUser} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                    <Save className="h-4 w-4" />
                    {selectedUserId ? 'Kullanıcıyı Kaydet' : 'Kullanıcı Oluştur'}
                  </button>
                </div>
              </div>

              {selectedUserId && (
                <div className="rounded-md border bg-white shadow-sm">
                  <div className="border-b p-4">
                    <h2 className="flex items-center gap-2 text-lg font-bold"><Link2 className="h-5 w-5 text-indigo-600" /> Şube Atamaları</h2>
                  </div>
                  <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_auto]">
                    <select className="rounded-md border px-3 py-2 font-semibold" value={assignBranchId} onChange={(event) => setAssignBranchId(parseInteger(event.target.value, 0) || '')}>
                      <option value="">Şube seçin</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id || ''}>
                          {branch.name || branch.db_host} - {branch.db_host}:{branch.db_port}
                        </option>
                      ))}
                    </select>
                    <button onClick={assignBranch} className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-bold text-white">
                      <Check className="h-4 w-4" />
                      Ata
                    </button>
                  </div>
                  <div className="grid gap-2 p-4">
                    {(selectedUser?.branches || []).map((branch, index) => (
                      <div key={branch.id} className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-bold">{branch.name}</div>
                          <div className="text-xs font-semibold text-slate-500">{branch.db_host}:{branch.db_port} / {branch.db_name}</div>
                        </div>
                        <div className="flex gap-2">
                          {selectedUser?.selected_branch === index ? (
                            <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Varsayılan</span>
                          ) : (
                            <button onClick={() => branch.id && selectUserBranch(branch.id)} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold text-white">Varsayılan yap</button>
                          )}
                          <button onClick={() => branch.id && unassignBranch(branch.id)} className="rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Kaldır</button>
                        </div>
                      </div>
                    ))}
                    {!selectedUser?.branches?.length && <div className="text-sm font-semibold text-slate-400">Henüz atanmış şube yok.</div>}
                  </div>
                </div>
              )}

              <details className="rounded-md border bg-white shadow-sm">
                <summary className="flex cursor-pointer items-center gap-2 p-4 text-lg font-bold">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  Rapor Yetkileri
                </summary>
                <div className="grid gap-2 border-t p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {AVAILABLE_REPORTS.map((report) => (
                    <label key={report.id} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <input type="checkbox" checked={reportsForm.includes(report.id)} onChange={() => toggleReport(report.id)} />
                      {report.label}
                    </label>
                  ))}
                </div>
              </details>
            </section>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
            <section className="min-h-0 rounded-md border bg-white shadow-sm lg:max-h-[calc(100vh-250px)] lg:overflow-hidden">
              <div className="border-b p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Şube Havuzu</h2>
                  <button onClick={resetBranchForm} className="rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white">Yeni Şube</button>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-md border px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input className="w-full outline-none" placeholder="Şube, IP, DB adı ara" value={branchQuery} onChange={(event) => setBranchQuery(event.target.value)} />
                </div>
              </div>
              <div className="grid gap-2 p-2 lg:max-h-[calc(100vh-365px)] lg:overflow-y-auto">
                {filteredBranches.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectBranch(item)}
                    className={`rounded-md border p-3 text-left transition ${selectedBranchId === item.id ? 'border-teal-400 bg-teal-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <div className="font-bold">{item.name || item.db_host}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-500">{item.db_host}:{item.db_port} / {item.db_name} ({item.db_user})</div>
                    <div className="mt-1 text-xs text-slate-500">Kasalar: {formatKasalar(item)} | Kapanış: {parseInteger(item.closing_hour, 6)} | Sahip: {item.owner_email || '-'}</div>
                  </button>
                ))}
              </div>
            </section>

            <aside className="rounded-md border bg-white shadow-sm lg:sticky lg:top-24">
              <div className="border-b p-4">
                <h2 className="flex items-center gap-2 text-lg font-bold"><Building className="h-5 w-5 text-teal-600" /> Şube Bilgileri</h2>
              </div>
              <div className="grid gap-3 p-4">
                <label className="text-sm font-semibold text-slate-600">Şube adı<input className="mt-1 w-full rounded-md border px-3 py-2" value={branchForm.name} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} /></label>
                <div className="grid grid-cols-[1fr_92px] gap-2">
                  <label className="text-sm font-semibold text-slate-600">IP / Host<input className="mt-1 w-full rounded-md border px-3 py-2" value={branchForm.db_host} onChange={(event) => setBranchForm({ ...branchForm, db_host: event.target.value })} /></label>
                  <label className="text-sm font-semibold text-slate-600">Port<input className="mt-1 w-full rounded-md border px-3 py-2" type="number" value={branchForm.db_port} onChange={(event) => setBranchForm({ ...branchForm, db_port: parseInteger(event.target.value, 5432) })} /></label>
                </div>
                <label className="text-sm font-semibold text-slate-600">Veritabanı adı<input className="mt-1 w-full rounded-md border px-3 py-2" value={branchForm.db_name} onChange={(event) => setBranchForm({ ...branchForm, db_name: event.target.value })} /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm font-semibold text-slate-600">DB kullanıcı<input className="mt-1 w-full rounded-md border px-3 py-2" value={branchForm.db_user} onChange={(event) => setBranchForm({ ...branchForm, db_user: event.target.value })} /></label>
                  <label className="text-sm font-semibold text-slate-600">DB şifre<input className="mt-1 w-full rounded-md border px-3 py-2" type="password" value={branchForm.db_password} onChange={(event) => setBranchForm({ ...branchForm, db_password: event.target.value })} /></label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm font-semibold text-slate-600">Kasalar<input className="mt-1 w-full rounded-md border px-3 py-2" value={branchForm.kasalar_input || ''} onChange={(event) => setBranchForm({ ...branchForm, kasalar_input: event.target.value, kasa_no: normalizeKasalar(event.target.value, branchForm.kasa_no)[0] ?? 1 })} /></label>
                  <label className="text-sm font-semibold text-slate-600">Kapanış<input className="mt-1 w-full rounded-md border px-3 py-2" type="number" min={0} max={23} value={branchForm.closing_hour} onChange={(event) => setBranchForm({ ...branchForm, closing_hour: parseInteger(event.target.value, 6) })} /></label>
                </div>
              </div>
              <div className="flex justify-between border-t p-4">
                <button onClick={deleteBranch} disabled={!selectedBranchId} className="inline-flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-40">
                  <Trash2 className="h-4 w-4" />
                  Sil
                </button>
                <button onClick={saveBranch} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                  <Save className="h-4 w-4" />
                  {selectedBranchId ? 'Şubeyi Kaydet' : 'Şube Oluştur'}
                </button>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
