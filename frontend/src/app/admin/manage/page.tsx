'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/utils/api';
import {
  Building,
  Check,
  Database,
  KeyRound,
  Link2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';

type AdminUser = {
  id: string;
  email: string;
  is_admin?: boolean;
  selected_branch?: number;
  expiry_date?: string;
  days_left?: number;
  branches?: Branch[];
  allowed_reports?: string[] | null;
};

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
  normalizeKasalar(branch.kasalar ?? branch.kasalar_input ?? branch.kasa_no, branch.kasa_no || 1).join(', ');

const branchPayload = (branch: Branch) => {
  const kasalar = normalizeKasalar(branch.kasalar_input ?? branch.kasalar ?? branch.kasa_no, parseInteger(branch.kasa_no, 1));
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
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [branchQuery, setBranchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('');
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    expiry_days: 30,
    expiry_date: '',
    is_admin: false,
  });
  const [branchForm, setBranchForm] = useState<Branch>(emptyBranch);
  const [reportsForm, setReportsForm] = useState<string[]>(AVAILABLE_REPORTS.map((report) => report.id));

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

  const resetUserForm = () => {
    setSelectedUserId('');
    setUserForm({ email: '', password: '', expiry_days: 30, expiry_date: '', is_admin: false });
    setReportsForm(AVAILABLE_REPORTS.map((report) => report.id));
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

  const refreshAfterSave = async (successMessage: string) => {
    await fetchData();
    setMessage(successMessage);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const saveUser = async () => {
    if (!token || saving) return;
    if (!/\S+@\S+\.\S+/.test(userForm.email)) {
      setMessage('Geçerli bir e-posta girin.');
      return;
    }
    if (!selectedUserId && !userForm.password.trim()) {
      setMessage('Yeni kullanıcı için şifre zorunlu.');
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
        await refreshAfterSave('Kullanıcı oluşturuldu. Şimdi şube atayabilirsiniz.');
      }
    } catch (error) {
      console.error(error);
      setMessage('Kullanıcı kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const saveBranch = async () => {
    if (!token || saving) return;
    const payload = branchPayload(branchForm);
    if (!payload.name || !payload.db_host || !payload.db_name || !payload.db_user || !payload.db_password) {
      setMessage('Şube için tüm bağlantı alanlarını doldurun.');
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
        await refreshAfterSave('Şube kaydedildi. Kullanıcıya atayabilirsiniz.');
      }
    } catch (error) {
      console.error(error);
      setMessage('Şube kaydedilemedi.');
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

  const assignSelectedBranch = async () => {
    if (!selectedUserId || !selectedBranchId) {
      setMessage('Atama için kullanıcı ve şube seçin.');
      return;
    }
    await axios.post(
      `${getApiUrl()}/admin/users/${selectedUserId}/branches/assign`,
      { branch_id: selectedBranchId },
      authHeaders,
    );
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
      <main className="mx-auto max-w-[1500px] px-4 py-6 pt-24 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-normal">Admin Yönetimi</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Kullanıcıyı ayrı, şubeyi ayrı kaydedin; sonra tekil şubeyi kullanıcıya atayın.
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

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-md border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-500"><span>Kullanıcı</span><Users className="h-5 w-5 text-indigo-500" /></div>
            <div className="mt-2 text-3xl font-bold">{users.length}</div>
          </div>
          <div className="rounded-md border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-500"><span>Tekil şube</span><Building className="h-5 w-5 text-teal-500" /></div>
            <div className="mt-2 text-3xl font-bold">{branches.length}</div>
          </div>
          <div className="rounded-md border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-500"><span>Seçili kullanıcı</span><ShieldCheck className="h-5 w-5 text-emerald-500" /></div>
            <div className="mt-2 truncate text-lg font-bold">{selectedUser?.email || '-'}</div>
          </div>
          <div className="rounded-md border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-500"><span>Seçili şube</span><Database className="h-5 w-5 text-amber-500" /></div>
            <div className="mt-2 truncate text-lg font-bold">{selectedBranch?.name || '-'}</div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-md border bg-white p-12 text-center font-semibold text-slate-500">Yükleniyor...</div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[360px_minmax(420px,1fr)_420px]">
            <section className="rounded-md border bg-white shadow-sm">
              <div className="border-b p-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-bold"><Users className="h-5 w-5 text-indigo-600" /> Kullanıcılar</h2>
                  <button onClick={resetUserForm} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
                    <UserPlus className="h-4 w-4" />
                    Yeni
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-md border px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input className="w-full outline-none" placeholder="Kullanıcı ara" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} />
                </div>
              </div>
              <div className="max-h-[650px] overflow-auto p-2">
                {filteredUsers.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectUser(item)}
                    className={`mb-2 w-full rounded-md border p-3 text-left transition ${selectedUserId === item.id ? 'border-indigo-400 bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-bold">{item.email}</div>
                        <div className="mt-1 text-xs font-medium text-slate-500">
                          {(item.branches || []).length} şube atanmış
                        </div>
                      </div>
                      {item.is_admin && <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-bold text-white">Admin</span>}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-5">
              <div className="rounded-md border bg-white shadow-sm">
                <div className="border-b p-4">
                  <h2 className="flex items-center gap-2 text-lg font-bold"><KeyRound className="h-5 w-5 text-indigo-600" /> Kullanıcı Kaydı</h2>
                </div>
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-600">
                    E-posta
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-slate-950" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
                  </label>
                  <label className="text-sm font-semibold text-slate-600">
                    Şifre {selectedUserId ? '(opsiyonel)' : ''}
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

              <div className="rounded-md border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b p-4">
                  <h2 className="flex items-center gap-2 text-lg font-bold"><Building className="h-5 w-5 text-teal-600" /> Şube Havuzu</h2>
                  <button onClick={resetBranchForm} className="rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white">Yeni Şube</button>
                </div>
                <div className="border-b p-4">
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input className="w-full outline-none" placeholder="Şube, IP, DB adı ara" value={branchQuery} onChange={(event) => setBranchQuery(event.target.value)} />
                  </div>
                </div>
                <div className="max-h-[310px] overflow-auto p-2">
                  {filteredBranches.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectBranch(item)}
                      className={`mb-2 w-full rounded-md border p-3 text-left transition ${selectedBranchId === item.id ? 'border-teal-400 bg-teal-50' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <div className="font-bold">{item.name}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">{item.db_host}:{item.db_port} / {item.db_name} ({item.db_user})</div>
                      <div className="mt-1 text-xs text-slate-500">Kasalar: {formatKasalar(item)} | Kapanış: {parseInteger(item.closing_hour, 6)} | Sahip: {item.owner_email || '-'}</div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-md border bg-white shadow-sm">
                <div className="border-b p-4">
                  <h2 className="flex items-center gap-2 text-lg font-bold"><Database className="h-5 w-5 text-amber-600" /> Şube Kaydı</h2>
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
              </div>

              <div className="rounded-md border bg-white shadow-sm">
                <div className="border-b p-4">
                  <h2 className="flex items-center gap-2 text-lg font-bold"><Link2 className="h-5 w-5 text-indigo-600" /> Kullanıcıya Şube Ata</h2>
                </div>
                <div className="space-y-3 p-4">
                  <div className="rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                    Kullanıcı: <span className="text-slate-950">{selectedUser?.email || 'Seçilmedi'}</span><br />
                    Şube: <span className="text-slate-950">{selectedBranch?.name || 'Seçilmedi'}</span>
                  </div>
                  <button onClick={assignSelectedBranch} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-bold text-white">
                    <Check className="h-4 w-4" />
                    Seçili Şubeyi Ata
                  </button>
                </div>
                <div className="border-t p-4">
                  <div className="mb-2 text-sm font-bold text-slate-700">Atanmış Şubeler</div>
                  <div className="space-y-2">
                    {(selectedUser?.branches || []).map((branch, index) => (
                      <div key={branch.id} className="rounded-md border p-3">
                        <div className="font-bold">{branch.name}</div>
                        <div className="text-xs font-semibold text-slate-500">{branch.db_host}:{branch.db_port} / {branch.db_name}</div>
                        <div className="mt-2 flex gap-2">
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
              </div>

              <div className="rounded-md border bg-white shadow-sm">
                <div className="border-b p-4">
                  <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Yetkiler</h2>
                </div>
                <div className="grid max-h-[360px] gap-2 overflow-auto p-4">
                  {AVAILABLE_REPORTS.map((report) => (
                    <label key={report.id} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <input type="checkbox" checked={reportsForm.includes(report.id)} onChange={() => toggleReport(report.id)} />
                      {report.label}
                    </label>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
