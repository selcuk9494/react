'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import { getApiUrl } from '@/utils/api';

export default function NewBranchPage() {
  const { token } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    db_host: '',
    db_port: '5432',
    db_name: 'fasrest',
    db_user: 'begum',
    db_password: 'KORDO',
    kasa_no: '1'
  });
  const [kasalar, setKasalar] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !token) return;
    const idParam = new URLSearchParams(window.location.search).get('id');
    if (!idParam) return;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return;
    setEditingId(id);
    (async () => {
      try {
        const res = await axios.get(`${getApiUrl()}/branches`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const found = (res.data || []).find((b: any) => b.id === id);
        if (found) {
          setFormData({
            name: found.name || '',
            db_host: found.db_host || '',
            db_port: String(found.db_port || '5432'),
            db_name: found.db_name || 'fasrest',
            db_user: found.db_user || 'begum',
            db_password: found.db_password || 'KORDO',
            kasa_no: String(found.kasa_no || '1'),
          });
          setKasalar((found.kasalar || []).filter((k: any) => typeof k === 'number'));
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        db_port: parseInt(formData.db_port),
        kasa_no: parseInt(formData.kasa_no),
        kasalar,
      };
      if (editingId) {
        await axios.put(`${getApiUrl()}/branches/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${getApiUrl()}/branches`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      router.push('/dashboard');
      setTimeout(() => window.location.href = '/dashboard', 100);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Şube eklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <button 
          onClick={() => router.back()} 
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {t('back')}
        </button>

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900">{editingId ? 'Şube Düzenle' : 'Yeni Şube Ekle'}</h2>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700">Şube Adı</label>
              <input
                type="text"
                name="name"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Veritabanı Sunucusu (Host)</label>
                <input
                  type="text"
                  name="db_host"
                  required
                  placeholder="localhost veya IP"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={formData.db_host}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Port</label>
                <input
                  type="number"
                  name="db_port"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={formData.db_port}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Kasa No</label>
                <input
                  type="number"
                  name="kasa_no"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={formData.kasa_no}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Veritabanı Adı</label>
              <input
                type="text"
                name="db_name"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.db_name}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Ek Kasa Numaraları</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Örn: 2,3,4"
                  id="extra-kasa-input-new"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.currentTarget;
                      const values = input.value.split(',')
                        .map(v => parseInt(v.trim()))
                        .filter(v => !isNaN(v));
                      if (values.length > 0) {
                        const merged = Array.from(new Set([...kasalar, ...values]));
                        setKasalar(merged);
                        input.value = '';
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                  onClick={() => {
                    const input = document.getElementById('extra-kasa-input-new') as HTMLInputElement | null;
                    if (!input) return;
                    const values = input.value.split(',')
                      .map(v => parseInt(v.trim()))
                      .filter(v => !isNaN(v));
                    if (values.length > 0) {
                      const merged = Array.from(new Set([...kasalar, ...values]));
                      setKasalar(merged);
                      input.value = '';
                    }
                  }}
                >
                  Ekle
                </button>
              </div>
              {kasalar.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {kasalar.map((k, idx) => (
                    <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold">
                      Kasa {k}
                      <button
                        type="button"
                        className="ml-1 text-indigo-500 hover:text-indigo-700"
                        onClick={() => setKasalar(kasalar.filter((x, i) => i !== idx))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Kaydediliyor...' : editingId ? 'Şubeyi Kaydet' : 'Şube Ekle'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
