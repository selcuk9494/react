import { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import { Feather } from '@expo/vector-icons';

const AVAILABLE_REPORTS = [
  { id: 'open_orders', label: 'Açık Adisyon' },
  { id: 'closed_orders', label: 'Kapalı Adisyon' },
  { id: 'stock_entry', label: 'Günlük Stok Girişi' },
  { id: 'live_stock', label: 'Canlı Stok' },
  { id: 'product_prices', label: 'Ürün Fiyatları' },
  { id: 'product_sales', label: 'Ürün Satışları' },
  { id: 'personnel', label: 'Personel' },
  { id: 'payment_types', label: 'Ödeme Tipleri' },
  { id: 'payment_types_detail', label: 'Ödeme Tipleri (Detay)' },
  { id: 'hourly_sales', label: 'Saatlik Satış' },
  { id: 'cancels', label: 'İptaller' },
  { id: 'discounts', label: 'İskontolar' },
  { id: 'debts', label: 'Borca Atılanlar' },
  { id: 'courier', label: 'Kurye Takip' },
  { id: 'unpayable', label: 'Ödenmezler' },
  { id: 'unsold_cancels', label: 'Satılmadan İptaller' },
];

const parseInteger = (value, fallback) => {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeKasalar = (value, fallback = 1) => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s;]+/)
      : typeof value === 'number'
        ? [value]
        : [];
  const parsed = Array.from(
    new Set(
      rawValues
        .map((item) => parseInteger(item, NaN))
        .filter((item) => Number.isFinite(item)),
    ),
  );
  if (parsed.length > 0) return parsed;
  return Number.isFinite(fallback) ? [fallback] : [1];
};

const formatKasalar = (value, fallback = 1) =>
  normalizeKasalar(value, fallback).join(', ');

const toBranchPayload = (branch) => {
  const kasalar = normalizeKasalar(
    branch.kasalar_input ?? branch.kasalar ?? branch.kasa_no,
    parseInteger(branch.kasa_no, 1),
  );
  return {
    name: branch.name,
    db_host: branch.db_host,
    db_port: parseInteger(branch.db_port, 5432),
    db_name: branch.db_name,
    db_user: branch.db_user,
    db_password: branch.db_password,
    kasa_no: kasalar[0] ?? 1,
    kasalar,
    closing_hour: parseInteger(branch.closing_hour, 6),
  };
};

export default function AdminManageScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('new');
  const [formUser, setFormUser] = useState({
    email: '',
    password: '',
    is_admin: false,
    expiry_date: '',
  });
  const [formBranches, setFormBranches] = useState([]);
  const [formAllowedReports, setFormAllowedReports] = useState(
    AVAILABLE_REPORTS.map((r) => r.id),
  );
  const [saving, setSaving] = useState(false);

  const renderField = (label, inputProps, hint) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} {...inputProps} />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );

  useEffect(() => {
    fetchUsers();
  }, []);

  const getToken = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      throw new Error('No token');
    }
    return token;
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Hata', 'Kullanıcı listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

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
        expiry_date: selectedUser.expiry_date || '',
      });
      setFormBranches(
        (selectedUser.branches || []).map((b) => ({
          ...b,
          kasa_no: normalizeKasalar(b.kasalar ?? b.kasa_no, b.kasa_no ?? 1)[0] ?? 1,
          kasalar_input: formatKasalar(b.kasalar ?? b.kasa_no, b.kasa_no ?? 1),
        })),
      );
      setFormAllowedReports(
        selectedUser.allowed_reports || AVAILABLE_REPORTS.map((r) => r.id),
      );
    } else {
      setFormUser({
        email: '',
        password: '',
        is_admin: false,
        expiry_date: '',
      });
      setFormBranches([]);
      setFormAllowedReports(AVAILABLE_REPORTS.map((r) => r.id));
    }
  }, [selectedUser]);

  const updateBranchField = (index, field, value) => {
    setFormBranches((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addBranchRow = () => {
    setFormBranches((prev) => [
      ...prev,
      {
        name: '',
        db_host: '',
        db_port: 5432,
        db_name: '',
        db_user: '',
        db_password: '',
        kasa_no: 1,
        kasalar_input: '1',
        closing_hour: 6,
      },
    ]);
  };

  const removeBranchRow = (index) => {
    setFormBranches((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleReport = (id) => {
    setFormAllowedReports((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const saveAll = async () => {
    try {
      const token = await getToken();
      if (!formUser.email || !/\S+@\S+\.\S+/.test(formUser.email)) {
        Alert.alert('Uyarı', 'Geçerli bir e-posta girin.');
        return;
      }
      for (const b of formBranches) {
        if (
          !b.name ||
          !b.db_host ||
          !b.db_name ||
          !b.db_user ||
          !b.db_password
        ) {
          Alert.alert(
            'Uyarı',
            'Şube satırlarında tüm zorunlu alanları doldurun.',
          );
          return;
        }
        if (
          normalizeKasalar(
            b.kasalar_input ?? b.kasalar ?? b.kasa_no,
            parseInteger(b.kasa_no, 1),
          ).length === 0
        ) {
          Alert.alert('Uyarı', 'Her şube için en az bir kasa numarası girin.');
          return;
        }
      }
      setSaving(true);

      if (selectedUserId === 'new') {
        const created = await axios.post(
          `${API_URL}/admin/users`,
          {
            email: formUser.email,
            password: formUser.password,
            is_admin: formUser.is_admin,
            expiry_days: formUser.expiry_date ? undefined : 30,
            allowed_reports: formAllowedReports,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const uid = created.data?.id;
        if (uid) {
          for (const b of formBranches) {
            await axios.post(
              `${API_URL}/admin/users/${uid}/branches`,
              toBranchPayload(b),
              { headers: { Authorization: `Bearer ${token}` } },
            );
          }
        }
      } else if (selectedUser) {
        await axios.put(
          `${API_URL}/admin/users/${selectedUser.id}`,
          {
            email: formUser.email,
            is_admin: formUser.is_admin,
            expiry_date: formUser.expiry_date || undefined,
            allowed_reports: formAllowedReports,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (formUser.password && formUser.password.trim().length > 0) {
          await axios.post(
            `${API_URL}/admin/users/${selectedUser.id}/password`,
            { password: formUser.password },
            { headers: { Authorization: `Bearer ${token}` } },
          );
        }
        for (const b of formBranches) {
          if (b.id) {
            await axios.put(
              `${API_URL}/admin/users/${selectedUser.id}/branches/${b.id}`,
              toBranchPayload(b),
              { headers: { Authorization: `Bearer ${token}` } },
            );
          } else {
            await axios.post(
              `${API_URL}/admin/users/${selectedUser.id}/branches`,
              toBranchPayload(b),
              { headers: { Authorization: `Bearer ${token}` } },
            );
          }
        }
      }

      await fetchUsers();
      Alert.alert('Bilgi', 'Kaydedildi.');
    } catch (e) {
      console.error(e);
      Alert.alert('Hata', 'Kaydetme sırasında hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin — Tek Form</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
        >
          <View style={styles.userSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.userChip,
                  selectedUserId === 'new' && styles.userChipActive,
                ]}
                onPress={() => setSelectedUserId('new')}
              >
                <Feather
                  name="user-plus"
                  size={14}
                  color={selectedUserId === 'new' ? '#fff' : '#4b5563'}
                />
                <Text
                  style={[
                    styles.userChipText,
                    selectedUserId === 'new' && styles.userChipTextActive,
                  ]}
                >
                  Yeni Kullanıcı
                </Text>
              </TouchableOpacity>
              {users.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={[
                    styles.userChip,
                    selectedUserId === u.id && styles.userChipActive,
                  ]}
                  onPress={() => setSelectedUserId(u.id)}
                >
                  <Text
                    style={[
                      styles.userChipText,
                      selectedUserId === u.id && styles.userChipTextActive,
                    ]}
                  >
                    {u.email}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Kullanıcı Bilgileri</Text>
            {renderField('E-posta', {
              placeholder: 'ornek@firma.com',
              value: formUser.email,
              onChangeText: (v) => setFormUser({ ...formUser, email: v }),
              autoCapitalize: 'none',
              keyboardType: 'email-address',
            })}
            {renderField(
              'Şifre',
              {
                placeholder: selectedUser
                  ? 'Yeni şifre (opsiyonel)'
                  : 'Şifre (zorunlu)',
                value: formUser.password,
                onChangeText: (v) =>
                  setFormUser({ ...formUser, password: v }),
                secureTextEntry: true,
              },
              selectedUser ? 'Boş bırakırsan mevcut şifre korunur.' : null,
            )}
            {renderField(
              'Bitiş Tarihi',
              {
                placeholder: 'YYYY-MM-DD',
                value: formUser.expiry_date,
                onChangeText: (v) =>
                  setFormUser({ ...formUser, expiry_date: v }),
              },
              'İstersen boş bırakabilirsin.',
            )}
            <Text style={styles.fieldLabel}>Yetki</Text>
            <TouchableOpacity
              style={[
                styles.switchPill,
                formUser.is_admin && styles.switchPillActive,
              ]}
              onPress={() =>
                setFormUser({ ...formUser, is_admin: !formUser.is_admin })
              }
            >
              <Feather
                name="shield"
                size={14}
                color={formUser.is_admin ? '#fff' : '#4b5563'}
              />
              <Text
                style={[
                  styles.switchPillText,
                  formUser.is_admin && styles.switchPillTextActive,
                ]}
              >
                Admin
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Şubeler</Text>
              <TouchableOpacity style={styles.addRowButton} onPress={addBranchRow}>
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.addRowButtonText}>Şube Ekle</Text>
              </TouchableOpacity>
            </View>
            {formBranches.length === 0 && (
              <Text style={styles.emptyHint}>Henüz şube eklenmedi.</Text>
            )}
            {formBranches.map((b, index) => (
              <View key={index} style={styles.branchRow}>
                {renderField('Şube Adı', {
                  placeholder: 'Örn. Döner Point',
                  value: b.name,
                  onChangeText: (v) => updateBranchField(index, 'name', v),
                })}
                {renderField('Veritabanı Host', {
                  placeholder: 'Örn. 46.106.200.237',
                  value: b.db_host,
                  onChangeText: (v) => updateBranchField(index, 'db_host', v),
                })}
                {renderField('Veritabanı Adı', {
                  placeholder: 'DB adı',
                  value: b.db_name,
                  onChangeText: (v) => updateBranchField(index, 'db_name', v),
                })}
                {renderField('Veritabanı Kullanıcı', {
                  placeholder: 'DB kullanıcı',
                  value: b.db_user,
                  onChangeText: (v) => updateBranchField(index, 'db_user', v),
                })}
                {renderField('Veritabanı Şifre', {
                  placeholder: 'DB şifre',
                  value: b.db_password,
                  onChangeText: (v) =>
                    updateBranchField(index, 'db_password', v),
                  secureTextEntry: true,
                })}
                {renderField('Kasalar', {
                  placeholder: 'Örn. 1,2,3',
                  value:
                    b.kasalar_input ?? formatKasalar(b.kasalar ?? b.kasa_no, 1),
                  onChangeText: (v) => {
                    const kasalar = normalizeKasalar(v, parseInteger(b.kasa_no, 1));
                    updateBranchField(index, 'kasalar_input', v);
                    updateBranchField(index, 'kasalar', kasalar);
                    updateBranchField(index, 'kasa_no', kasalar[0] ?? 1);
                  },
                }, 'Birden fazla kasa varsa virgülle ayır: 1,2,3')}
                {renderField('Kapanış Saati', {
                  placeholder: '0-23',
                  value: String(b.closing_hour ?? 6),
                  keyboardType: 'number-pad',
                  onChangeText: (v) =>
                    updateBranchField(
                      index,
                      'closing_hour',
                      parseInteger(v, 6),
                    ),
                })}
                <TouchableOpacity
                  style={styles.removeRowButton}
                  onPress={() => removeBranchRow(index)}
                >
                  <Feather name="trash-2" size={14} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rapor İzinleri</Text>
            <View style={styles.reportsGrid}>
              {AVAILABLE_REPORTS.map((r) => {
                const active = formAllowedReports.includes(r.id);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.reportChip,
                      active && styles.reportChipActive,
                    ]}
                    onPress={() => toggleReport(r.id)}
                  >
                    <Text
                      style={[
                        styles.reportChipText,
                        active && styles.reportChipTextActive,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveAll}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 14,
    backgroundColor: '#4f46e5',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#eef2ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userSelector: {
    marginBottom: 12,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginRight: 8,
  },
  userChipActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  userChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
    marginLeft: 4,
  },
  userChipTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    marginBottom: 8,
    fontSize: 14,
    color: '#111827',
  },
  fieldGroup: {
    marginBottom: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: -4,
    marginBottom: 8,
  },
  switchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignSelf: 'flex-start',
  },
  switchPillActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  switchPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
    marginLeft: 6,
  },
  switchPillTextActive: {
    color: '#fff',
  },
  branchRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
  },
  removeRowButton: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  addRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#10b981',
  },
  addRowButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
  },
  emptyHint: {
    fontSize: 12,
    color: '#6b7280',
  },
  reportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reportChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  reportChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  reportChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4b5563',
  },
  reportChipTextActive: {
    color: '#fff',
  },
  saveButton: {
    marginTop: 12,
    marginBottom: 20,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#4f46e5',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
