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
  const [mode, setMode] = useState<'direct' | 'pair'>('direct');
  const [pairCode, setPairCode] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    db_host: '',
    db_port: '5432',
    db_name: 'fasrest',
    db_user: 'begum',
    db_password: 'KORDO',
    kasa_no: '1',
    kasa_name: '',
    closing_hour: '6',
  });
  const [kasalar, setKasalar] = useState<{ kasa_no: number; name: string }[]>([]);
  const [extraKasaNo, setExtraKasaNo] = useState('');
  const [extraKasaName, setExtraKasaName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const buildKasaPayload = () => {
    const primary = parseInt(formData.kasa_no, 10) || 1;
    return [
      { kasa_no: primary, name: formData.kasa_name.trim() || null },
      ...kasalar.map((k) => ({
        kasa_no: k.kasa_no,
        name: k.name.trim() || null,
      })),
    ];
  };

  const addExtraKasa = () => {
    const no = parseInt(extraKasaNo, 10);
    if (!Number.isFinite(no) || no <= 0) return;
    if (no === (parseInt(formData.kasa_no, 10) || 1)) return;
    const name = extraKasaName.trim();
    const without = kasalar.filter((k) => k.kasa_no !== no);
    setKasalar(
      [...without, { kasa_no: no, name }].sort((a, b) => a.kasa_no - b.kasa_no),
    );
    setExtraKasaNo('');
    setExtraKasaName('');
  };

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
          headers: { Authorization: `Bearer ${token}` },
        });
        const found = (res.data || []).find((b: any) => b.id === id);
        if (found) {
          const primary = Number(found.kasa_no) || 1;
          let listRaw: any = found.kasa_list;
          if (typeof listRaw === 'string') {
            try {
              listRaw = JSON.parse(listRaw);
            } catch {
              listRaw = [];
            }
          }
          const entries: { kasa_no: number; name: string }[] = [];
          if (Array.isArray(listRaw) && listRaw.length > 0) {
            for (const item of listRaw) {
              const no = Number(item?.kasa_no ?? item);
              if (!Number.isFinite(no) || no <= 0) continue;
              const nm =
                item != null && typeof item === 'object' && item.name
                  ? String(item.name).trim()
                  : '';
              entries.push({ kasa_no: no, name: nm });
            }
          } else {
            for (const k of found.kasalar || []) {
              const no = Number(k);
              if (Number.isFinite(no) && no > 0) {
                entries.push({ kasa_no: no, name: '' });
              }
            }
          }
          if (!entries.some((e) => e.kasa_no === primary)) {
            entries.unshift({ kasa_no: primary, name: '' });
          }
          const primaryEntry = entries.find((e) => e.kasa_no === primary);
          setFormData({
            name: found.name || '',
            db_host: found.db_host || '',
            db_port: String(found.db_port || '5432'),
            db_name: found.db_name || 'fasrest',
            db_user: found.db_user || 'begum',
            db_password: found.db_password || 'KORDO',
            kasa_no: String(primary),
            kasa_name: primaryEntry?.name || '',
            closing_hour: String(
              typeof found.closing_hour === 'number' && !isNaN(found.closing_hour)
                ? found.closing_hour
                : 6,
            ),
          });
          setKasalar(entries.filter((e) => e.kasa_no !== primary));
          if (found.connection_mode === 'agent' || String(found.db_host || '').startsWith('agent:')) {
            setMode('pair');
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [token]);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post(
        `${getApiUrl()}/branches/pair`,
        {
          code: pairCode.trim(),
          name: formData.name || undefined,
          kasa_no: parseInt(formData.kasa_no, 10) || 1,
          kasa_name: formData.kasa_name.trim() || null,
          closing_hour: parseInt(formData.closing_hour || '6', 10),
          kasalar: buildKasaPayload(),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      router.push('/dashboard');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 100);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kod ile bağlama başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        db_port: parseInt(formData.db_port),
        kasa_no: parseInt(formData.kasa_no),
        kasa_name: formData.kasa_name.trim() || null,
        closing_hour: parseInt(formData.closing_hour || '6'),
        kasalar: buildKasaPayload(),
      };
      if (editingId) {
        await axios.put(`${getApiUrl()}/branches/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${getApiUrl()}/branches`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      router.push('/dashboard');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 100);
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
            <h2 className="text-2xl font-bold text-gray-900">
              {editingId ? 'Şube Düzenle' : 'Yeni Şube Ekle'}
            </h2>
          </div>

          {!editingId && (
            <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setMode('direct')}
                className={`rounded-md py-2 text-sm font-medium ${
                  mode === 'direct' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                }`}
              >
                IP ile
              </button>
              <button
                type="button"
                onClick={() => setMode('pair')}
                className={`rounded-md py-2 text-sm font-medium ${
                  mode === 'pair' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                }`}
              >
                Kod ile bağla
              </button>
            </div>
          )}

          {mode === 'pair' && !editingId ? (
            <form className="space-y-6" onSubmit={handlePair}>
              <p className="text-sm text-gray-600">
                POS bilgisayarına <strong>FR Rapor Bridge</strong> kurun. Masaüstündeki veya{' '}
                <code className="text-xs">C:\ProgramData\FrRaporBridge\PAIR-CODE.txt</code>{' '}
                dosyasındaki kodu aşağıya yazın. Statik IP gerekmez.
              </p>
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
              <div>
                <label className="block text-sm font-medium text-gray-700">Eşleme Kodu</label>
                <input
                  type="text"
                  required
                  placeholder="ABC-123"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 uppercase tracking-widest focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={pairCode}
                  onChange={(e) => setPairCode(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700">Kapanış Saati</label>
                  <input
                    type="number"
                    name="closing_hour"
                    min={0}
                    max={23}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.closing_hour}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Kasa Adı</label>
                <input
                  type="text"
                  name="kasa_name"
                  maxLength={100}
                  placeholder="Örn: Salon"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={formData.kasa_name}
                  onChange={handleChange}
                />
              </div>
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Bağlanıyor...' : 'Kod ile bağla'}
              </button>
            </form>
          ) : (
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
                  <label className="block text-sm font-medium text-gray-700">
                    Veritabanı Sunucusu (Host)
                  </label>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700">Kapanış Saati (Saat)</label>
                  <input
                    type="number"
                    name="closing_hour"
                    min={0}
                    max={23}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.closing_hour}
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
                <label className="block text-sm font-medium text-gray-700">Ana Kasa Adı</label>
                <input
                  type="text"
                  name="kasa_name"
                  maxLength={100}
                  placeholder="Örn: Salon, Paket"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={formData.kasa_name}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Ek Kasalar</label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    className="w-full sm:w-24 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="No"
                    value={extraKasaNo}
                    onChange={(e) => setExtraKasaNo(e.target.value)}
                  />
                  <input
                    type="text"
                    maxLength={100}
                    className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Kasa adı"
                    value={extraKasaName}
                    onChange={(e) => setExtraKasaName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addExtraKasa();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                    onClick={addExtraKasa}
                  >
                    Ekle
                  </button>
                </div>
                {kasalar.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {kasalar.map((k, idx) => (
                      <div
                        key={k.kasa_no}
                        className="flex items-center gap-2 rounded-md border border-indigo-100 bg-indigo-50/60 px-2 py-1.5"
                      >
                        <span className="text-xs font-bold text-indigo-700 shrink-0">
                          #{k.kasa_no}
                        </span>
                        <input
                          type="text"
                          maxLength={100}
                          className="flex-1 min-w-0 rounded border border-indigo-100 bg-white px-2 py-1 text-sm"
                          placeholder="Kasa adı"
                          value={k.name}
                          onChange={(e) => {
                            const next = [...kasalar];
                            next[idx] = { ...next[idx], name: e.target.value };
                            setKasalar(next);
                          }}
                        />
                        <button
                          type="button"
                          className="text-indigo-500 hover:text-indigo-700 font-bold px-1"
                          onClick={() => setKasalar(kasalar.filter((_, i) => i !== idx))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
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
          )}
        </div>
      </div>
    </div>
  );
}
