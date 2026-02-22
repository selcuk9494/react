import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

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

export default function AdminUsersScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    expiry_days: 30,
    is_admin: false,
    allowed_reports: AVAILABLE_REPORTS.map((r) => r.id),
  });
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({
    email: '',
    password: '',
    is_admin: false,
    expiry_date: '',
  });
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [expiryPickerDate, setExpiryPickerDate] = useState(new Date());

  const [allBranches, setAllBranches] = useState([]);
  const [addingBranchFor, setAddingBranchFor] = useState(null);
  const [branchForm, setBranchForm] = useState({
    name: '',
    db_host: '',
    db_port: 5432,
    db_name: '',
    db_user: '',
    db_password: '',
    kasa_no: 1,
    closing_hour: 6,
  });
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [editingBranchForm, setEditingBranchForm] = useState({
    name: '',
    db_host: '',
    db_port: 5432,
    db_name: '',
    db_user: '',
    db_password: '',
    kasa_no: 1,
    closing_hour: 6,
  });
  const [deleteConfirmBranchId, setDeleteConfirmBranchId] = useState(null);
  const [assigningFor, setAssigningFor] = useState(null);
  const [assignBranchId, setAssignBranchId] = useState(null);

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
      const br = await axios.get(`${API_URL}/admin/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllBranches(br.data || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Hata', 'Kullanıcı listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!newUser.email || !/\S+@\S+\.\S+/.test(newUser.email)) {
        Alert.alert('Uyarı', 'Geçerli bir e-posta girin.');
        return;
      }
      if (!newUser.password) {
        Alert.alert('Uyarı', 'Şifre girin.');
        return;
      }
      setCreating(true);
      const token = await getToken();
      await axios.post(`${API_URL}/admin/users`, newUser, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNewUser({
        email: '',
        password: '',
        expiry_days: 30,
        is_admin: false,
        allowed_reports: AVAILABLE_REPORTS.map((r) => r.id),
      });
      await fetchUsers();
    } catch (e) {
      console.error(e);
      Alert.alert('Hata', 'Kullanıcı oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  };

  const startEditUser = (u) => {
    setEditingUserId(u.id);
    setEditForm({
      email: u.email || '',
      password: '',
      is_admin: !!u.is_admin,
      expiry_date: u.expiry_date || '',
    });
  };

  const saveEditUser = async (u) => {
    try {
      if (!editForm.email || !/\S+@\S+\.\S+/.test(editForm.email)) {
        Alert.alert('Uyarı', 'Geçerli bir e-posta girin.');
        return;
      }
      const token = await getToken();
      await axios.put(
        `${API_URL}/admin/users/${u.id}`,
        {
          email: editForm.email,
          is_admin: editForm.is_admin,
          expiry_date: editForm.expiry_date || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (editForm.password && editForm.password.trim().length > 0) {
        await axios.post(
          `${API_URL}/admin/users/${u.id}/password`,
          { password: editForm.password },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      }
      setEditingUserId(null);
      setEditForm({
        email: '',
        password: '',
        is_admin: false,
        expiry_date: '',
      });
      await fetchUsers();
    } catch (e) {
      console.error(e);
      Alert.alert('Hata', 'Kullanıcı güncellenemedi.');
    }
  };

  const handleDeleteUser = async (u) => {
    Alert.alert('Onay', 'Kullanıcı silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken();
            await axios.delete(`${API_URL}/admin/users/${u.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            await fetchUsers();
          } catch (e) {
            console.error(e);
            Alert.alert('Hata', 'Kullanıcı silinemedi.');
          }
        },
      },
    ]);
  };

  const toggleNewUserReport = (id) => {
    setNewUser((prev) => ({
      ...prev,
      allowed_reports: prev.allowed_reports.includes(id)
        ? prev.allowed_reports.filter((r) => r !== id)
        : [...prev.allowed_reports, id],
    }));
  };

  const formatDateYMD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleChangeExpiryDate = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowExpiryPicker(false);
    }
    if (selectedDate) {
      setExpiryPickerDate(selectedDate);
      const ymd = formatDateYMD(selectedDate);
      setEditForm((prev) => ({
        ...prev,
        expiry_date: ymd,
      }));
    }
  };

  const handleAddBranch = async (userId) => {
    try {
      if (
        !branchForm.name ||
        !branchForm.db_host ||
        !branchForm.db_name ||
        !branchForm.db_user ||
        !branchForm.db_password
      ) {
        Alert.alert('Uyarı', 'Şube alanlarının tümünü doldurun.');
        return;
      }
      const token = await getToken();
      await axios.post(
        `${API_URL}/admin/users/${userId}/branches`,
        branchForm,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setAddingBranchFor(null);
      setBranchForm({
        name: '',
        db_host: '',
        db_port: 5432,
        db_name: '',
        db_user: '',
        db_password: '',
        kasa_no: 1,
        closing_hour: 6,
      });
      await fetchUsers();
    } catch (e) {
      console.error(e);
      Alert.alert('Hata', 'Şube eklenemedi.');
    }
  };

  const handleUpdateBranch = async (userId) => {
    try {
      if (editingBranchId === null) return;
      if (
        !editingBranchForm.name ||
        !editingBranchForm.db_host ||
        !editingBranchForm.db_name ||
        !editingBranchForm.db_user ||
        !editingBranchForm.db_password
      ) {
        Alert.alert('Uyarı', 'Şube alanlarının tümünü doldurun.');
        return;
      }
      const token = await getToken();
      await axios.put(
        `${API_URL}/admin/users/${userId}/branches/${editingBranchId}`,
        editingBranchForm,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setEditingBranchId(null);
      await fetchUsers();
    } catch (e) {
      console.error(e);
      Alert.alert('Hata', 'Şube güncellenemedi.');
    }
  };

  const handleDeleteBranch = async (userId, branchId) => {
    try {
      const token = await getToken();
      await axios.delete(
        `${API_URL}/admin/users/${userId}/branches/${branchId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setDeleteConfirmBranchId(null);
      await fetchUsers();
    } catch (e) {
      console.error(e);
      Alert.alert('Hata', 'Şube silinemedi.');
    }
  };

  const handleAssignBranch = async (userId) => {
    try {
      if (!assignBranchId) {
        Alert.alert('Uyarı', 'Atanacak şubeyi seçin.');
        return;
      }
      const token = await getToken();
      await axios.post(
        `${API_URL}/admin/users/${userId}/branches/assign`,
        { branch_id: assignBranchId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setAssigningFor(null);
      setAssignBranchId(null);
      await fetchUsers();
    } catch (e) {
      console.error(e);
      Alert.alert('Hata', 'Şube atanamadı.');
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
          <Text style={styles.headerTitle}>Admin — Kullanıcılar</Text>
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
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Yeni Kullanıcı Ekle</Text>
            <View style={styles.formRow}>
              <TextInput
                style={styles.input}
                placeholder="E-posta"
                value={newUser.email}
                onChangeText={(v) => setNewUser({ ...newUser, email: v })}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder="Şifre"
                value={newUser.password}
                onChangeText={(v) => setNewUser({ ...newUser, password: v })}
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                placeholder="Süre (gün)"
                value={String(newUser.expiry_days)}
                onChangeText={(v) =>
                  setNewUser({
                    ...newUser,
                    expiry_days: parseInt(v || '30', 10),
                  })
                }
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.switchRow}>
              <TouchableOpacity
                style={[
                  styles.switchPill,
                  newUser.is_admin && styles.switchPillActive,
                ]}
                onPress={() =>
                  setNewUser({ ...newUser, is_admin: !newUser.is_admin })
                }
              >
                <Feather
                  name="shield"
                  size={14}
                  color={newUser.is_admin ? '#fff' : '#4b5563'}
                />
                <Text
                  style={[
                    styles.switchPillText,
                    newUser.is_admin && styles.switchPillTextActive,
                  ]}
                >
                  Admin
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreateUser}
                disabled={creating}
              >
                <Text style={styles.saveButtonText}>
                  {creating ? 'Ekleniyor...' : 'Ekle'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.reportsContainer}>
              <Text style={styles.sectionLabel}>Rapor İzinleri</Text>
              <View style={styles.reportsGrid}>
                {AVAILABLE_REPORTS.map((r) => {
                  const active = newUser.allowed_reports.includes(r.id);
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[
                        styles.reportChip,
                        active && styles.reportChipActive,
                      ]}
                      onPress={() => toggleNewUserReport(r.id)}
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
          </View>

          {users.map((u) => {
            const isEditing = editingUserId === u.id;
            return (
              <View key={u.id} style={styles.card}>
                <View style={styles.userHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {u.email?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userEmail}>{u.email}</Text>
                    <Text style={styles.userMeta}>
                      Admin: {u.is_admin ? 'Evet' : 'Hayır'}
                    </Text>
                    <Text style={styles.userMeta}>
                      Bitiş:{' '}
                      {u.expiry_date
                        ? new Date(u.expiry_date).toLocaleDateString('tr-TR')
                        : '-'}
                    </Text>
                    {(u.branches || []).length > 0 && (
                      <Text style={styles.userMeta}>
                        Şubeler:{' '}
                        {(u.branches || [])
                          .map((b) => b.name)
                          .join(', ')}
                      </Text>
                    )}
                  </View>
                  <View style={styles.userActions}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() =>
                        isEditing ? setEditingUserId(null) : startEditUser(u)
                      }
                    >
                      <Feather
                        name={isEditing ? 'x' : 'edit-2'}
                        size={18}
                        color="#4b5563"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleDeleteUser(u)}
                    >
                      <Feather name="trash-2" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {isEditing && (
                  <View style={styles.editSection}>
                    <TextInput
                      style={styles.input}
                      placeholder="E-posta"
                      value={editForm.email}
                      onChangeText={(v) =>
                        setEditForm({ ...editForm, email: v })
                      }
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Yeni Şifre (opsiyonel)"
                      value={editForm.password}
                      onChangeText={(v) =>
                        setEditForm({ ...editForm, password: v })
                      }
                      secureTextEntry
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Bitiş Tarihi (GG.AA.YYYY)"
                      value={
                        editForm.expiry_date
                          ? new Date(
                              editForm.expiry_date,
                            ).toLocaleDateString('tr-TR')
                          : ''
                      }
                      editable={false}
                    />
                    <TouchableOpacity
                      style={styles.dateOverlay}
                      onPress={() => {
                        const baseDate = editForm.expiry_date
                          ? new Date(editForm.expiry_date)
                          : new Date();
                        setExpiryPickerDate(baseDate);
                        setShowExpiryPicker(true);
                      }}
                    >
                      <Feather name="calendar" size={16} color="#6b7280" />
                      <Text style={styles.dateOverlayText}>
                        Tarih seçmek için dokun
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.switchRow}>
                      <TouchableOpacity
                        style={[
                          styles.switchPill,
                          editForm.is_admin && styles.switchPillActive,
                        ]}
                        onPress={() =>
                          setEditForm({
                            ...editForm,
                            is_admin: !editForm.is_admin,
                          })
                        }
                      >
                        <Feather
                          name="shield"
                          size={14}
                          color={editForm.is_admin ? '#fff' : '#4b5563'}
                        />
                        <Text
                          style={[
                            styles.switchPillText,
                            editForm.is_admin && styles.switchPillTextActive,
                          ]}
                        >
                          Admin
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.saveButton}
                        onPress={() => saveEditUser(u)}
                      >
                        <Text style={styles.saveButtonText}>Kaydet</Text>
                      </TouchableOpacity>
                    </View>

                    {showExpiryPicker && (
                      <DateTimePicker
                        value={expiryPickerDate}
                        mode="date"
                        display="default"
                        onChange={handleChangeExpiryDate}
                      />
                    )}

                    <View style={styles.sectionBranches}>
                      <Text style={styles.sectionLabel}>Şubeler</Text>
                      {(u.branches || []).map((b) => (
                        <View key={b.id} style={styles.branchRow}>
                          {editingBranchId === b.id ? (
                            <View style={{ flex: 1 }}>
                              <TextInput
                                style={styles.input}
                                placeholder="Şube Adı"
                                value={editingBranchForm.name}
                                onChangeText={(v) =>
                                  setEditingBranchForm((prev) => ({
                                    ...prev,
                                    name: v,
                                  }))
                                }
                              />
                              <TextInput
                                style={styles.input}
                                placeholder="DB Host"
                                value={editingBranchForm.db_host}
                                onChangeText={(v) =>
                                  setEditingBranchForm((prev) => ({
                                    ...prev,
                                    db_host: v,
                                  }))
                                }
                              />
                              <TextInput
                                style={styles.input}
                                placeholder="DB Port"
                                keyboardType="number-pad"
                                value={String(editingBranchForm.db_port)}
                                onChangeText={(v) =>
                                  setEditingBranchForm((prev) => ({
                                    ...prev,
                                    db_port: parseInt(v || '5432', 10),
                                  }))
                                }
                              />
                              <TextInput
                                style={styles.input}
                                placeholder="DB Adı"
                                value={editingBranchForm.db_name}
                                onChangeText={(v) =>
                                  setEditingBranchForm((prev) => ({
                                    ...prev,
                                    db_name: v,
                                  }))
                                }
                              />
                              <TextInput
                                style={styles.input}
                                placeholder="DB Kullanıcı"
                                value={editingBranchForm.db_user}
                                onChangeText={(v) =>
                                  setEditingBranchForm((prev) => ({
                                    ...prev,
                                    db_user: v,
                                  }))
                                }
                              />
                              <TextInput
                                style={styles.input}
                                placeholder="DB Şifre"
                                secureTextEntry
                                value={editingBranchForm.db_password}
                                onChangeText={(v) =>
                                  setEditingBranchForm((prev) => ({
                                    ...prev,
                                    db_password: v,
                                  }))
                                }
                              />
                              <TextInput
                                style={styles.input}
                                placeholder="Kasa No"
                                keyboardType="number-pad"
                                value={String(editingBranchForm.kasa_no || 1)}
                                onChangeText={(v) =>
                                  setEditingBranchForm((prev) => ({
                                    ...prev,
                                    kasa_no: parseInt(v || '1', 10),
                                  }))
                                }
                              />
                              <TextInput
                                style={styles.input}
                                placeholder="Kapanış Saati (0-23)"
                                keyboardType="number-pad"
                                value={String(
                                  editingBranchForm.closing_hour ?? 6,
                                )}
                                onChangeText={(v) =>
                                  setEditingBranchForm((prev) => ({
                                    ...prev,
                                    closing_hour: parseInt(v || '6', 10),
                                  }))
                                }
                              />
                              <View style={styles.branchActionsRow}>
                                <TouchableOpacity
                                  style={styles.saveButton}
                                  onPress={() => handleUpdateBranch(u.id)}
                                >
                                  <Text style={styles.saveButtonText}>
                                    Şubeyi Kaydet
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.cancelButton}
                                  onPress={() => setEditingBranchId(null)}
                                >
                                  <Text style={styles.cancelButtonText}>
                                    İptal
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.branchName}>{b.name}</Text>
                                <Text style={styles.branchMeta}>
                                  {b.db_host}:{b.db_port} / {b.db_name} (
                                  {b.db_user})
                                </Text>
                              </View>
                              <View style={styles.branchButtons}>
                                <TouchableOpacity
                                  style={styles.iconButton}
                                  onPress={() => {
                                    setEditingBranchId(b.id);
                                    setEditingBranchForm({
                                      name: b.name,
                                      db_host: b.db_host,
                                      db_port: b.db_port,
                                      db_name: b.db_name,
                                      db_user: b.db_user,
                                      db_password: b.db_password,
                                      kasa_no: b.kasa_no || 1,
                                      closing_hour:
                                        typeof b.closing_hour === 'number' &&
                                        Number.isFinite(b.closing_hour)
                                          ? b.closing_hour
                                          : 6,
                                    });
                                  }}
                                >
                                  <Feather
                                    name="edit-2"
                                    size={16}
                                    color="#4b5563"
                                  />
                                </TouchableOpacity>
                                {deleteConfirmBranchId === b.id ? (
                                  <>
                                    <TouchableOpacity
                                      style={styles.iconButton}
                                      onPress={() =>
                                        handleDeleteBranch(u.id, b.id)
                                      }
                                    >
                                      <Feather
                                        name="check"
                                        size={16}
                                        color="#ef4444"
                                      />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.iconButton}
                                      onPress={() =>
                                        setDeleteConfirmBranchId(null)
                                      }
                                    >
                                      <Feather
                                        name="x"
                                        size={16}
                                        color="#6b7280"
                                      />
                                    </TouchableOpacity>
                                  </>
                                ) : (
                                  <TouchableOpacity
                                    style={styles.iconButton}
                                    onPress={() =>
                                      setDeleteConfirmBranchId(b.id)
                                    }
                                  >
                                    <Feather
                                      name="trash-2"
                                      size={16}
                                      color="#ef4444"
                                    />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </>
                          )}
                        </View>
                      ))}

                      {assigningFor === u.id && (
                        <View style={styles.assignContainer}>
                          <Text style={styles.sectionLabel}>
                            Varolan Şubeyi Ata
                          </Text>
                          <View style={styles.assignRow}>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                            >
                              {allBranches.map((b) => (
                                <TouchableOpacity
                                  key={b.id}
                                  style={[
                                    styles.branchChip,
                                    assignBranchId === b.id &&
                                      styles.branchChipActive,
                                  ]}
                                  onPress={() => setAssignBranchId(b.id)}
                                >
                                  <Text
                                    style={[
                                      styles.branchChipText,
                                      assignBranchId === b.id &&
                                        styles.branchChipTextActive,
                                    ]}
                                  >
                                    {b.name}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                          <View style={styles.branchActionsRow}>
                            <TouchableOpacity
                              style={styles.saveButton}
                              onPress={() => handleAssignBranch(u.id)}
                            >
                              <Text style={styles.saveButtonText}>Ata</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.cancelButton}
                              onPress={() => {
                                setAssigningFor(null);
                                setAssignBranchId(null);
                              }}
                            >
                              <Text style={styles.cancelButtonText}>
                                İptal
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {addingBranchFor === u.id && (
                        <View style={styles.assignContainer}>
                          <Text style={styles.sectionLabel}>Yeni Şube</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Şube Adı"
                            value={branchForm.name}
                            onChangeText={(v) =>
                              setBranchForm((prev) => ({
                                ...prev,
                                name: v,
                              }))
                            }
                          />
                          <TextInput
                            style={styles.input}
                            placeholder="DB Host"
                            value={branchForm.db_host}
                            onChangeText={(v) =>
                              setBranchForm((prev) => ({
                                ...prev,
                                db_host: v,
                              }))
                            }
                          />
                          <TextInput
                            style={styles.input}
                            placeholder="DB Port"
                            keyboardType="number-pad"
                            value={String(branchForm.db_port)}
                            onChangeText={(v) =>
                              setBranchForm((prev) => ({
                                ...prev,
                                db_port: parseInt(v || '5432', 10),
                              }))
                            }
                          />
                          <TextInput
                            style={styles.input}
                            placeholder="DB Adı"
                            value={branchForm.db_name}
                            onChangeText={(v) =>
                              setBranchForm((prev) => ({
                                ...prev,
                                db_name: v,
                              }))
                            }
                          />
                          <TextInput
                            style={styles.input}
                            placeholder="DB Kullanıcı"
                            value={branchForm.db_user}
                            onChangeText={(v) =>
                              setBranchForm((prev) => ({
                                ...prev,
                                db_user: v,
                              }))
                            }
                          />
                          <TextInput
                            style={styles.input}
                            placeholder="DB Şifre"
                            secureTextEntry
                            value={branchForm.db_password}
                            onChangeText={(v) =>
                              setBranchForm((prev) => ({
                                ...prev,
                                db_password: v,
                              }))
                            }
                          />
                          <TextInput
                            style={styles.input}
                            placeholder="Kasa No"
                            keyboardType="number-pad"
                            value={String(branchForm.kasa_no)}
                            onChangeText={(v) =>
                              setBranchForm((prev) => ({
                                ...prev,
                                kasa_no: parseInt(v || '1', 10),
                              }))
                            }
                          />
                          <TextInput
                            style={styles.input}
                            placeholder="Kapanış Saati (0-23)"
                            keyboardType="number-pad"
                            value={String(branchForm.closing_hour)}
                            onChangeText={(v) =>
                              setBranchForm((prev) => ({
                                ...prev,
                                closing_hour: parseInt(v || '6', 10),
                              }))
                            }
                          />
                          <View style={styles.branchActionsRow}>
                            <TouchableOpacity
                              style={styles.saveButton}
                              onPress={() => handleAddBranch(u.id)}
                            >
                              <Text style={styles.saveButtonText}>
                                Şubeyi Kaydet
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.cancelButton}
                              onPress={() => setAddingBranchFor(null)}
                            >
                              <Text style={styles.cancelButtonText}>
                                İptal
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      <View style={styles.branchToggleRow}>
                        <TouchableOpacity
                          style={styles.chipButton}
                          onPress={() =>
                            setAddingBranchFor(
                              addingBranchFor === u.id ? null : u.id,
                            )
                          }
                        >
                          <Feather
                            name="plus"
                            size={14}
                            color="#4f46e5"
                          />
                          <Text style={styles.chipButtonText}>Şube Ekle</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.chipButton}
                          onPress={() =>
                            setAssigningFor(assigningFor === u.id ? null : u.id)
                          }
                        >
                          <Feather
                            name="link"
                            size={14}
                            color="#f59e0b"
                          />
                          <Text style={styles.chipButtonText}>
                            Varolan Şubeyi Ata
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  formRow: {
    flexDirection: 'column',
    gap: 8,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
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
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#10b981',
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  reportsContainer: {
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 4,
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
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4f46e5',
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  userMeta: {
    fontSize: 11,
    color: '#6b7280',
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 6,
  },
  editSection: {
    marginTop: 10,
  },
  dateOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateOverlayText: {
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 6,
  },
  sectionBranches: {
    marginTop: 12,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  branchActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  branchName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  branchMeta: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  branchButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignContainer: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  assignRow: {
    marginVertical: 6,
  },
  branchChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginRight: 6,
  },
  branchChipActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  branchChipText: {
    fontSize: 12,
    color: '#4b5563',
  },
  branchChipTextActive: {
    color: '#fff',
  },
  branchToggleRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
  },
  chipButtonText: {
    fontSize: 12,
    color: '#374151',
    marginLeft: 4,
    fontWeight: '600',
  },
});
