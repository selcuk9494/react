import React, { useEffect, useMemo, useState } from 'react';
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
  { id: 'product_sales', label: 'Ürün Satışları' },
  { id: 'personnel', label: 'Personel' },
  { id: 'payment_types', label: 'Ödeme Tipleri' },
  { id: 'hourly_sales', label: 'Saatlik Satış' },
  { id: 'cancels', label: 'İptaller' },
  { id: 'discounts', label: 'İskontolar' },
  { id: 'debts', label: 'Borca Atılanlar' },
  { id: 'courier', label: 'Kurye Takip' },
  { id: 'unpayable', label: 'Ödenmezler' },
  { id: 'unsold_cancels', label: 'Satılmadan İptaller' },
];

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
              {
                name: b.name,
                db_host: b.db_host,
                db_port: b.db_port,
                db_name: b.db_name,
                db_user: b.db_user,
                db_password: b.db_password,
                kasa_no: b.kasa_no,
                closing_hour:
                  typeof b.closing_hour === 'number' &&
                  Number.isFinite(b.closing_hour)
                    ? b.closing_hour
                    : 6,
              },
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
              {
                name: b.name,
                db_host: b.db_host,
                db_port: b.db_port,
                db_name: b.db_name,
                db_user: b.db_user,
                db_password: b.db_password,
                kasa_no: b.kasa_no,
                closing_hour:
                  typeof b.closing_hour === 'number' &&
                  Number.isFinite(b.closing_hour)
                    ? b.closing_hour
                    : 6,
              },
              { headers: { Authorization: `Bearer ${token}` } },
            );
          } else {
            await axios.post(
              `${API_URL}/admin/users/${selectedUser.id}/branches`,
              {
                name: b.name,
                db_host: b.db_host,
                db_port: b.db_port,
                db_name: b.db_name,
                db_user: b.db_user,
                db_password: b.db_password,
                kasa_no: b.kasa_no,
              },
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
            <TextInput
              style={styles.input}
              placeholder="E-posta"
              value={formUser.email}
              onChangeText={(v) => setFormUser({ ...formUser, email: v })}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder={
                selectedUser ? 'Yeni şifre (opsiyonel)' : 'Şifre (zorunlu)'
              }
              value={formUser.password}
              onChangeText={(v) => setFormUser({ ...formUser, password: v })}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Bitiş Tarihi (YYYY-MM-DD)"
              value={formUser.expiry_date}
              onChangeText={(v) =>
                setFormUser({ ...formUser, expiry_date: v })
              }
            />
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
                <TextInput
                  style={styles.input}
                  placeholder="Şube Adı"
                  value={b.name}
                  onChangeText={(v) => updateBranchField(index, 'name', v)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="DB Host"
                  value={b.db_host}
                  onChangeText={(v) => updateBranchField(index, 'db_host', v)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="DB Adı"
                  value={b.db_name}
                  onChangeText={(v) => updateBranchField(index, 'db_name', v)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="DB Kullanıcı"
                  value={b.db_user}
                  onChangeText={(v) => updateBranchField(index, 'db_user', v)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="DB Şifre"
                  value={b.db_password}
                  onChangeText={(v) =>
                    updateBranchField(index, 'db_password', v)
                  }
                  secureTextEntry
                />
                <TextInput
                  style={styles.input}
                  placeholder="Kasa No"
                  value={String(b.kasa_no ?? 1)}
                  keyboardType="number-pad"
                  onChangeText={(v) =>
                    updateBranchField(
                      index,
                      'kasa_no',
                      parseInt(v || '1', 10),
                    )
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Kapanış Saati (0-23)"
                  value={String(b.closing_hour ?? 6)}
                  keyboardType="number-pad"
                  onChangeText={(v) =>
                    updateBranchField(
                      index,
                      'closing_hour',
                      parseInt(v || '6', 10),
                    )
                  }
                />
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

