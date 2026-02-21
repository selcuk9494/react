'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/utils/api';

export default function AdminManagePage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | 'new'>('new');
  const [formUser, setFormUser] = useState({ email: '', password: '', is_admin: false, expiry_date: '' });
  const [formBranches, setFormBranches] = useState<Array<any>>([]);
  const [formAllowedReports, setFormAllowedReports] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const AVAILABLE_REPORTS = [
    { id: 'open_orders', label: 'Açık Adisyon (Dashboard)' },
    { id: 'closed_orders', label: 'Kapalı Adisyon (Dashboard)' },
    { id: 'stock_entry', label: 'Günlük Stok Girişi' },
    { id: 'live_stock', label: 'Canlı Stok Takip' },
    { id: 'product_sales', label: 'Ürün Satışları' },
    { id: 'personnel', label: 'Personel Performans' },
    { id: 'payment_types', label: 'Ödeme Tipleri' },
    { id: 'hourly_sales', label: 'Saatlik Satış' },
    { id: 'cancels', label: 'İptaller' },
    { id: 'discounts', label: 'İndirimler' },
    { id: 'debts', label: 'Borca Atılanlar' },
    { id: 'courier', label: 'Kurye Takip' },
    { id: 'unpayable', label: 'Ödenmezler' },
    { id: 'unsold_cancels', label: 'Satılmadan İptaller' },
  ];

  useEffect(() => {
    if (!token) return;
    if (user && !user['is_admin']) {
      router.push('/dashboard');
      return;
    }
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${getApiUrl()}/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [token, user]);

  const selectedUser = useMemo(() => {
    if (selectedUserId === 'new') return null;
    return users.find((u) => u.id === selectedUserId) || null;
  }, [selectedUserId, users]);

  useEffect(() => {
    if (selectedUser) {
      setFormUser({
        email: selectedUser.email || '',
        password: '',
        is_admin: !!selectedUser.is_admin,
        expiry_date: selectedUser.expiry_date || ''
      });
      setFormBranches((selectedUser.branches || []).map((b: any) => ({ ...b })));
      // If null, assume ALL are allowed
      setFormAllowedReports(selectedUser.allowed_reports || AVAILABLE_REPORTS.map(r => r.id));
    } else {
      setFormUser({ email: '', password: '', is_admin: false, expiry_date: '' });
      setFormBranches([]);
      // Default new user: All allowed
      setFormAllowedReports(AVAILABLE_REPORTS.map(r => r.id));
    }
  }, [selectedUser]);

  const toggleReport = (id: string) => {
    setFormAllowedReports(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const addBranchRow = () => {
    setFormBranches([...formBranches, { id: null, name: '', db_host: '', db_port: 5432, db_name: '', db_user: '', db_password: '', kasa_no: 1 }]);
  };

  const updateBranchRow = (idx: number, patch: any) => {
    const arr = [...formBranches];
    arr[idx] = { ...arr[idx], ...patch };
    setFormBranches(arr);
  };

  const removeBranchRow = (idx: number) => {
    const arr = [...formBranches];
    arr.splice(idx, 1);
    setFormBranches(arr);
  };

  const refreshUsers = async () => {
    const res = await axios.get(`${getApiUrl()}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setUsers(res.data);
  };

  const saveAll = async () => {
    if (!token) return;
    setSaving(true);
    setFormError('');
    if (!formUser.email || !/\S+@\S+\.\S+/.test(formUser.email)) {
      setFormError('Geçerli bir e-posta girin');
      setSaving(false);
      return;
    }
    for (const b of formBranches) {
      if (!b.name || !b.db_host || !b.db_name || !b.db_user || !b.db_password) {
        setFormError('Şube satırlarında tüm zorunlu alanları doldurun');
        setSaving(false);
        return;
      }
    }
    try {
      if (selectedUserId === 'new') {
        const created = await axios.post(`${getApiUrl()}/admin/users`, {
          email: formUser.email,
          password: formUser.password,
          is_admin: formUser.is_admin,
          expiry_days: formUser.expiry_date ? undefined : 30,
          allowed_reports: formAllowedReports
        }, { headers: { Authorization: `Bearer ${token}` } });
        const uid = created.data?.id;
        for (const b of formBranches) {
          await axios.post(`${getApiUrl()}/admin/users/${uid}/branches`, {
            name: b.name, db_host: b.db_host, db_port: b.db_port, db_name: b.db_name, db_user: b.db_user, db_password: b.db_password, kasa_no: b.kasa_no
          }, { headers: { Authorization: `Bearer ${token}` } });
        }
      } else if (selectedUser) {
        await axios.put(`${getApiUrl()}/admin/users/${selectedUser.id}`, {
          email: formUser.email,
          is_admin: formUser.is_admin,
          expiry_date: formUser.expiry_date || undefined,
          allowed_reports: formAllowedReports
        }, { headers: { Authorization: `Bearer ${token}` } });
        if (formUser.password && formUser.password.trim().length > 0) {
          await axios.post(`${getApiUrl()}/admin/users/${selectedUser.id}/password`, {
            password: formUser.password
          }, { headers: { Authorization: `Bearer ${token}` } });
        }
        for (const b of formBranches) {
          if (b.id) {
            await axios.put(`${getApiUrl()}/admin/users/${selectedUser.id}/branches/${b.id}`, {
              name: b.name, db_host: b.db_host, db_port: b.db_port, db_name: b.db_name, db_user: b.db_user, db_password: b.db_password, kasa_no: b.kasa_no
            }, { headers: { Authorization: `Bearer ${token}` } });
          } else {
            await axios.post(`${getApiUrl()}/admin/users/${selectedUser.id}/branches`, {
              name: b.name, db_host: b.db_host, db_port: b.db_port, db_name: b.db_name, db_user: b.db_user, db_password: b.db_password, kasa_no: b.kasa_no
            }, { headers: { Authorization: `Bearer ${token}` } });
          }
        }
      }
      await refreshUsers();
      alert('Kaydedildi');
    } catch (e) {
      console.error(e);
      setFormError('Kaydetme sırasında hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pt-24">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin — Tek Form Yönetimi</h1>
          <button onClick={() => router.back()} className="px-3 py-2 rounded bg-gray-200 text-gray-900">Geri</button>
        </div>

        <div className="bg-white rounded-xl p-4 shadow border space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Kullanıcı Seç</label>
              <select className="w-full border rounded px-3 py-2" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value as any)}>
                <option value="new">Yeni Kullanıcı</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-800 mb-1">E-posta</label>
              <input className="w-full border rounded px-3 py-2" placeholder="E-posta" value={formUser.email} onChange={e => setFormUser({ ...formUser, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Şifre</label>
              <input className="w-full border rounded px-3 py-2" placeholder="Şifre" type="password" value={formUser.password} onChange={e => setFormUser({ ...formUser, password: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Bitiş Tarihi</label>
              <input className="w-full border rounded px-3 py-2" placeholder="YYYY-MM-DD" value={formUser.expiry_date} onChange={e => setFormUser({ ...formUser, expiry_date: e.target.value })} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formUser.is_admin} onChange={e => setFormUser({ ...formUser, is_admin: e.target.checked })} />
                Admin
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow border space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Erişilebilir Raporlar</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {AVAILABLE_REPORTS.map(report => (
              <label key={report.id} className="flex items-center gap-2 border p-2 rounded hover:bg-gray-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formAllowedReports.includes(report.id)} 
                  onChange={() => toggleReport(report.id)} 
                />
                <span className="text-sm text-gray-800">{report.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Şubeler</h2>
            <button className="bg-indigo-600 text-white rounded px-3 py-2" onClick={addBranchRow}>Şube Satırı Ekle</button>
          </div>
          {formError && <div className="text-sm text-red-600">{formError}</div>}
          <div className="space-y-3">
            {formBranches.map((b, idx) => (
              <div key={idx} className="border rounded p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                  <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="Şube Adı" value={b.name} onChange={e => updateBranchRow(idx, { name: e.target.value })} />
                  <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB Host" value={b.db_host} onChange={e => updateBranchRow(idx, { db_host: e.target.value })} />
                  <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB Port" type="number" value={b.db_port} onChange={e => updateBranchRow(idx, { db_port: parseInt(e.target.value || '5432', 10) })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                  <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB Name" value={b.db_name} onChange={e => updateBranchRow(idx, { db_name: e.target.value })} />
                  <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB User" value={b.db_user} onChange={e => updateBranchRow(idx, { db_user: e.target.value })} />
                  <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB Password" type="password" value={b.db_password} onChange={e => updateBranchRow(idx, { db_password: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                  <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="Kasa No" type="number" value={b.kasa_no || 1} onChange={e => updateBranchRow(idx, { kasa_no: parseInt(e.target.value || '1', 10) })} />
                </div>
                <div className="flex justify-end">
                  <button className="px-3 py-1 rounded bg-red-100" onClick={() => removeBranchRow(idx)}>Satırı Sil</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button className="bg-indigo-600 text-white rounded px-4 py-2" onClick={saveAll} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </main>
    </div>
  );
}
