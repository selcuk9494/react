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
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ email: string; is_admin: boolean; expiry_date?: string; password?: string }>({ email: '', is_admin: false });
  const [addingBranchFor, setAddingBranchFor] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState({ name: '', db_host: '', db_port: 5432, db_name: '', db_user: '', db_password: '', kasa_no: 1 });
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null);
  const [editingBranchForm, setEditingBranchForm] = useState({ name: '', db_host: '', db_port: 5432, db_name: '', db_user: '', db_password: '', kasa_no: 1 });
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);
  const [deleteConfirmBranchId, setDeleteConfirmBranchId] = useState<number | null>(null);
  const [savingSelectedBranchUserId, setSavingSelectedBranchUserId] = useState<string | null>(null);

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
    await axios.delete(`${getApiUrl()}/admin/users/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setDeleteConfirmUserId(null);
    await refresh();
  };

  const startEditUser = (u: AdminUser) => {
    setEditingUserId(u.id);
    setEditForm({ email: u.email, is_admin: !!u.is_admin, expiry_date: u.expiry_date || '' });
  };
  const saveEditUser = async (u: AdminUser) => {
    if (!editForm.email || !/\S+@\S+\.\S+/.test(editForm.email)) return;
    await axios.put(`${getApiUrl()}/admin/users/${u.id}`, { email: editForm.email, is_admin: editForm.is_admin, expiry_date: editForm.expiry_date || undefined }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (editForm.password && editForm.password.trim().length > 0) {
      await axios.post(`${getApiUrl()}/admin/users/${u.id}/password`, { password: editForm.password }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }
    setEditingUserId(null);
    setEditForm({ email: '', is_admin: false, expiry_date: '', password: '' });
    await refresh();
  };

  const handleAddBranch = async (userId: string) => {
    if (!branchForm.name || !branchForm.db_host || !branchForm.db_name || !branchForm.db_user || !branchForm.db_password) return;
    await axios.post(`${getApiUrl()}/admin/users/${userId}/branches`, branchForm, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setAddingBranchFor(null);
    setBranchForm({ name: '', db_host: '', db_port: 5432, db_name: '', db_user: '', db_password: '', kasa_no: 1 });
    await refresh();
  };

  const handleUpdateBranch = async (userId: string) => {
    if (editingBranchId === null) return;
    if (!editingBranchForm.name || !editingBranchForm.db_host || !editingBranchForm.db_name || !editingBranchForm.db_user || !editingBranchForm.db_password) return;
    await axios.put(`${getApiUrl()}/admin/users/${userId}/branches/${editingBranchId}`, editingBranchForm, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setEditingBranchId(null);
    await refresh();
  };

  const handleDeleteBranch = async (userId: string, branchId: number) => {
    await axios.delete(`${getApiUrl()}/admin/users/${userId}/branches/${branchId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setDeleteConfirmBranchId(null);
    await refresh();
  };

  const handleSelectBranch = async (userId: string, index: number) => {
    setSavingSelectedBranchUserId(userId);
    try {
      await axios.put(`${getApiUrl()}/admin/users/${userId}`, { selected_branch: index }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await refresh();
    } finally {
      setSavingSelectedBranchUserId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pt-24">
        <h1 className="text-2xl font-bold">Admin Paneli — Kullanıcı Yönetimi</h1>

        <div className="bg-white rounded-xl p-4 shadow border">
          <h2 className="text-lg font-semibold mb-3">Yeni Kullanıcı Ekle</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="E-posta" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
              <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="Şifre" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
              <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="Süre (gün)" type="number" value={newUser.expiry_days} onChange={e => setNewUser({ ...newUser, expiry_days: parseInt(e.target.value || '30', 10) })} />
              <label className="flex items-center gap-2 text-gray-800">
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
                    {editingUserId === u.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                          <input className="border rounded px-3 py-2" placeholder="E-posta" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                          <input className="border rounded px-3 py-2" placeholder="Şifre (opsiyonel)" type="password" value={editForm.password || ''} onChange={e => setEditForm({ ...editForm, password: e.target.value })} />
                          <input className="border rounded px-3 py-2" placeholder="Bitiş Tarihi (YYYY-MM-DD)" value={editForm.expiry_date || ''} onChange={e => setEditForm({ ...editForm, expiry_date: e.target.value })} />
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={editForm.is_admin} onChange={e => setEditForm({ ...editForm, is_admin: e.target.checked })} />
                            Admin
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={() => saveEditUser(u)}>Kaydet</button>
                          <button className="px-3 py-1 rounded bg-gray-100" onClick={() => { setEditingUserId(null); setEditForm({ email: '', is_admin: false, expiry_date: '', password: '' }); }}>İptal</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold text-gray-900">{u.email}</div>
                        <div className="text-sm text-gray-700">
                          Gün kalan: {u.days_left ?? '-'} | Bitiş: {u.expiry_date ? new Date(u.expiry_date).toLocaleDateString('tr-TR') : '-'}
                        </div>
                        <div className="text-xs text-gray-700">Admin: {u.is_admin ? 'Evet' : 'Hayır'}</div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {editingUserId === u.id ? (
                      <button className="px-3 py-1 rounded bg-gray-200 text-gray-900" onClick={() => { setEditingUserId(null); setEditForm({ email: '', is_admin: false, expiry_date: '', password: '' }); }}>Düzenlemeyi Kapat</button>
                    ) : (
                      <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={() => startEditUser(u)}>Düzenle</button>
                    )}
                    {deleteConfirmUserId === u.id ? (
                      <>
                        <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={() => handleDelete(u.id)}>Eminim, Sil</button>
                        <button className="px-3 py-1 rounded bg-gray-200 text-gray-900" onClick={() => setDeleteConfirmUserId(null)}>Vazgeç</button>
                      </>
                    ) : (
                      <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={() => setDeleteConfirmUserId(u.id)}>Sil</button>
                    )}
                    {addingBranchFor === u.id ? (
                      <button className="px-3 py-1 rounded bg-gray-200 text-gray-900" onClick={() => { setAddingBranchFor(null); }}>Şube Ekleme İptal</button>
                    ) : (
                      <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={() => { setAddingBranchFor(u.id); }}>Şube Ekle</button>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="font-semibold mb-2 text-gray-900">Şubeler</div>
                  <div className="space-y-2">
                    {(u.branches || []).map((b: any) => (
                      <div key={b.id} className="border rounded p-3 flex items-center justify-between">
                        {editingBranchId === b.id ? (
                          <div className="w-full">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                              <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="Şube Adı" value={editingBranchForm.name} onChange={e => setEditingBranchForm({ ...editingBranchForm, name: e.target.value })} />
                              <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB Host" value={editingBranchForm.db_host} onChange={e => setEditingBranchForm({ ...editingBranchForm, db_host: e.target.value })} />
                              <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB Port" type="number" value={editingBranchForm.db_port} onChange={e => setEditingBranchForm({ ...editingBranchForm, db_port: parseInt(e.target.value || '5432', 10) })} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                              <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB Name" value={editingBranchForm.db_name} onChange={e => setEditingBranchForm({ ...editingBranchForm, db_name: e.target.value })} />
                              <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB User" value={editingBranchForm.db_user} onChange={e => setEditingBranchForm({ ...editingBranchForm, db_user: e.target.value })} />
                              <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB Password" type="password" value={editingBranchForm.db_password} onChange={e => setEditingBranchForm({ ...editingBranchForm, db_password: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                              <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="Kasa No" type="number" value={editingBranchForm.kasa_no} onChange={e => setEditingBranchForm({ ...editingBranchForm, kasa_no: parseInt(e.target.value || '1', 10) })} />
                            </div>
                            <div className="flex gap-2">
                              <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={() => handleUpdateBranch(u.id)}>Kaydet</button>
                              <button className="px-3 py-1 rounded bg-gray-200 text-gray-900" onClick={() => { setEditingBranchId(null); }}>İptal</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <div className="font-medium text-gray-900">{b.name}</div>
                              <div className="text-xs text-gray-700">{b.db_host}:{b.db_port} / {b.db_name} ({b.db_user})</div>
                            </div>
                            <div className="flex gap-2 items-center">
                              <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={() => { setEditingBranchId(b.id); setEditingBranchForm({ name: b.name, db_host: b.db_host, db_port: b.db_port, db_name: b.db_name, db_user: b.db_user, db_password: b.db_password, kasa_no: b.kasa_no || 1 }); }}>Düzenle</button>
                              {typeof u.selected_branch === 'number' && (u.branches || []).indexOf(b) === u.selected_branch ? (
                                <span className="px-3 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">Seçili</span>
                              ) : (
                                <button className="px-3 py-1 rounded bg-emerald-600 text-white" disabled={savingSelectedBranchUserId === u.id} onClick={() => handleSelectBranch(u.id, (u.branches || []).indexOf(b))}>
                                  {savingSelectedBranchUserId === u.id ? 'Seçiliyor...' : 'Seç'}
                                </button>
                              )}
                              {deleteConfirmBranchId === b.id ? (
                                <>
                                  <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={() => handleDeleteBranch(u.id, b.id)}>Eminim, Sil</button>
                                  <button className="px-3 py-1 rounded bg-gray-200 text-gray-900" onClick={() => setDeleteConfirmBranchId(null)}>Vazgeç</button>
                                </>
                              ) : (
                                <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={() => setDeleteConfirmBranchId(b.id)}>Sil</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {addingBranchFor === u.id && (
                    <div className="mt-3 border rounded p-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                        <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="Şube Adı" value={branchForm.name} onChange={e => setBranchForm({ ...branchForm, name: e.target.value })} />
                        <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB Host" value={branchForm.db_host} onChange={e => setBranchForm({ ...branchForm, db_host: e.target.value })} />
                        <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB Port" type="number" value={branchForm.db_port} onChange={e => setBranchForm({ ...branchForm, db_port: parseInt(e.target.value || '5432', 10) })} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                        <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB Name" value={branchForm.db_name} onChange={e => setBranchForm({ ...branchForm, db_name: e.target.value })} />
                        <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB User" value={branchForm.db_user} onChange={e => setBranchForm({ ...branchForm, db_user: e.target.value })} />
                        <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="DB Password" type="password" value={branchForm.db_password} onChange={e => setBranchForm({ ...branchForm, db_password: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                        <input className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="Kasa No" type="number" value={branchForm.kasa_no} onChange={e => setBranchForm({ ...branchForm, kasa_no: parseInt(e.target.value || '1', 10) })} />
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={() => handleAddBranch(u.id)}>Kaydet</button>
                        <button className="px-3 py-1 rounded bg-gray-200 text-gray-900" onClick={() => setAddingBranchFor(null)}>İptal</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
