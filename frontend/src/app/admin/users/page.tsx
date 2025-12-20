'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/utils/api';

interface AdminUser {
  id: string;
  email: string;
  is_admin?: boolean;
  selected_branch?: number;
  expiry_date?: string;
  days_left?: number;
  branches?: any[];
}

export default function AdminUsersPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', expiry_days: 30, is_admin: false });

  useEffect(() => {
    if (!token) return;
    if (user && !user?.['is_admin']) {
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

  const refresh = async () => {
    const res = await axios.get(`${getApiUrl()}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setUsers(res.data);
  };

  const handleCreateUser = async () => {
    try {
      setCreating(true);
      const res = await axios.post(`${getApiUrl()}/admin/users`, newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewUser({ email: '', password: '', expiry_days: 30, is_admin: false });
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Kullanıcı silinsin mi?')) return;
    await axios.delete(`${getApiUrl()}/admin/users/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await refresh();
  };

  const handleExtend = async (id: string) => {
    const daysStr = prompt('Kaç gün uzatılacak?', '30');
    if (!daysStr) return;
    const days = parseInt(daysStr, 10);
    await axios.post(`${getApiUrl()}/admin/users/${id}/extend`, { days }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await refresh();
  };

  const handlePassword = async (id: string) => {
    const pass = prompt('Yeni şifre girin');
    if (!pass) return;
    await axios.post(`${getApiUrl()}/admin/users/${id}/password`, { password: pass }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    alert('Şifre güncellendi');
  };

  const handleToggleAdmin = async (u: AdminUser) => {
    await axios.put(`${getApiUrl()}/admin/users/${u.id}`, { is_admin: !u.is_admin }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await refresh();
  };

  const handleEmail = async (u: AdminUser) => {
    const email = prompt('Yeni e-posta', u.email);
    if (!email) return;
    await axios.put(`${getApiUrl()}/admin/users/${u.id}`, { email }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await refresh();
  };

  const handleAddBranch = async (userId: string) => {
    const name = prompt('Şube adı');
    if (!name) return;
    const db_host = prompt('DB Host');
    if (!db_host) return;
    const db_port = parseInt(prompt('DB Port', '5432') || '5432', 10);
    const db_name = prompt('DB Name');
    if (!db_name) return;
    const db_user = prompt('DB User');
    if (!db_user) return;
    const db_password = prompt('DB Password');
    if (!db_password) return;
    const kasa_no = parseInt(prompt('Kasa No', '1') || '1', 10);
    await axios.post(`${getApiUrl()}/admin/users/${userId}/branches`, {
      name, db_host, db_port, db_name, db_user, db_password, kasa_no
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await refresh();
  };

  const handleUpdateBranch = async (userId: string, branch: any) => {
    const name = prompt('Şube adı', branch.name) || branch.name;
    const db_host = prompt('DB Host', branch.db_host) || branch.db_host;
    const db_port = parseInt(prompt('DB Port', String(branch.db_port)) || String(branch.db_port), 10);
    const db_name = prompt('DB Name', branch.db_name) || branch.db_name;
    const db_user = prompt('DB User', branch.db_user) || branch.db_user;
    const db_password = prompt('DB Password', branch.db_password) || branch.db_password;
    const kasa_no = parseInt(prompt('Kasa No', String(branch.kasa_no || 1)) || String(branch.kasa_no || 1), 10);
    await axios.put(`${getApiUrl()}/admin/users/${userId}/branches/${branch.id}`, {
      name, db_host, db_port, db_name, db_user, db_password, kasa_no
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await refresh();
  };

  const handleDeleteBranch = async (userId: string, branchId: number) => {
    if (!confirm('Şube silinsin mi?')) return;
    await axios.delete(`${getApiUrl()}/admin/users/${userId}/branches/${branchId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pt-24">
        <h1 className="text-2xl font-bold">Admin Paneli — Kullanıcı Yönetimi</h1>

        <div className="bg-white rounded-xl p-4 shadow border">
          <h2 className="text-lg font-semibold mb-3">Yeni Kullanıcı Ekle</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input className="border rounded px-3 py-2" placeholder="E-posta" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Şifre" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Süre (gün)" type="number" value={newUser.expiry_days} onChange={e => setNewUser({ ...newUser, expiry_days: parseInt(e.target.value || '30', 10) })} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={newUser.is_admin} onChange={e => setNewUser({ ...newUser, is_admin: e.target.checked })} />
              Admin
            </label>
            <button className="bg-indigo-600 text-white rounded px-4 py-2" onClick={handleCreateUser} disabled={creating}>
              {creating ? 'Ekleniyor...' : 'Ekle'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {users.map(u => (
              <div key={u.id} className="bg-white rounded-xl p-4 shadow border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{u.email}</div>
                    <div className="text-sm text-gray-500">
                      Gün kalan: {u.days_left ?? '-'} | Bitiş: {u.expiry_date ? new Date(u.expiry_date).toLocaleDateString('tr-TR') : '-'}
                    </div>
                    <div className="text-xs text-gray-500">Admin: {u.is_admin ? 'Evet' : 'Hayır'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 rounded bg-gray-100" onClick={() => handleEmail(u)}>E-posta</button>
                    <button className="px-3 py-1 rounded bg-gray-100" onClick={() => handleToggleAdmin(u)}>{u.is_admin ? 'Admin Kaldır' : 'Admin Yap'}</button>
                    <button className="px-3 py-1 rounded bg-blue-100" onClick={() => handlePassword(u.id)}>Şifre</button>
                    <button className="px-3 py-1 rounded bg-emerald-100" onClick={() => handleExtend(u.id)}>Süre Uzat</button>
                    <button className="px-3 py-1 rounded bg-red-100" onClick={() => handleDelete(u.id)}>Sil</button>
                    <button className="px-3 py-1 rounded bg-indigo-200" onClick={() => handleAddBranch(u.id)}>Şube Ekle</button>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="font-semibold mb-2">Şubeler</div>
                  <div className="space-y-2">
                    {(u.branches || []).map((b: any) => (
                      <div key={b.id} className="border rounded p-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{b.name}</div>
                          <div className="text-xs text-gray-500">{b.db_host}:{b.db_port} / {b.db_name} ({b.db_user})</div>
                        </div>
                        <div className="flex gap-2">
                          <button className="px-3 py-1 rounded bg-gray-100" onClick={() => handleUpdateBranch(u.id, b)}>Düzenle</button>
                          <button className="px-3 py-1 rounded bg-red-100" onClick={() => handleDeleteBranch(u.id, b.id)}>Sil</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

