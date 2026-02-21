'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/utils/api';

export default function AdminBranchesPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    if (user && !user['is_admin']) {
      router.push('/dashboard');
      return;
    }
    const fetchBranches = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${getApiUrl()}/branches`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBranches(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchBranches();
  }, [token, user]);

  const refresh = async () => {
    const res = await axios.get(`${getApiUrl()}/branches`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setBranches(res.data);
  };

  const handleUpdate = async (b: any) => {
    const name = prompt('Şube adı', b.name) || b.name;
    const db_host = prompt('DB Host', b.db_host) || b.db_host;
    const db_port = parseInt(prompt('DB Port', String(b.db_port)) || String(b.db_port), 10);
    const db_name = prompt('DB Name', b.db_name) || b.db_name;
    const db_user = prompt('DB User', b.db_user) || b.db_user;
    const db_password = prompt('DB Password', b.db_password) || b.db_password;
    const kasa_no = parseInt(prompt('Kasa No', String(b.kasa_no || 1)) || String(b.kasa_no || 1), 10);
    await axios.put(`${getApiUrl()}/branches/${b.id}`, {
      name, db_host, db_port, db_name, db_user, db_password, kasa_no
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await refresh();
  };

  const handleDelete = async (branchId: number) => {
    if (!confirm('Şube silinsin mi?')) return;
    await axios.delete(`${getApiUrl()}/branches/${branchId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pt-24">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Paneli — Şube Yönetimi</h1>
          <button onClick={() => router.back()} className="px-3 py-2 rounded bg-gray-200 text-gray-900">Geri</button>
        </div>
        <div className="mb-2">
          <button className="bg-indigo-600 text-white rounded px-4 py-2" onClick={() => router.push('/branches/new')}>Yeni Şube</button>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="space-y-2">
            {branches.map(b => (
              <div key={b.id} className="bg-white rounded-xl p-4 shadow border flex items-center justify-between">
                <div>
                  <div className="font-semibold">{b.name}</div>
                  <div className="text-xs text-gray-500">{b.db_host}:{b.db_port} / {b.db_name} ({b.db_user})</div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 rounded bg-gray-100" onClick={() => handleUpdate(b)}>Düzenle</button>
                  <button className="px-3 py-1 rounded bg-red-100" onClick={() => handleDelete(b.id)}>Sil</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
