import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { API_URL } from '../config';

const getAuthContext = async () => {
  const token = await AsyncStorage.getItem('token');
  if (!token) return { token: null, user: null };

  let user = null;
  const userRaw = await AsyncStorage.getItem('user');
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch (e) {
      user = null;
    }
  }

  if (!user) {
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    user = response.data;
    await AsyncStorage.setItem('user', JSON.stringify(user));
  }

  return { token, user };
};

export default function ProductPricesScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('Tümü');
  const [priceMap, setPriceMap] = useState({});
  const initialPriceMapRef = useRef({});
  const inputRefs = useRef({});
  const listRef = useRef(null);

  const canEditPrices = useCallback((user) => {
    if (!user) return false;
    if (user.is_admin) return true;
    if (user.allowed_reports === null || user.allowed_reports === undefined) return true;
    return Array.isArray(user.allowed_reports) && user.allowed_reports.includes('product_prices');
  }, []);

  const getDraftKey = useCallback((user, branchId) => {
    const uid = user?.email ? String(user.email).trim().toLowerCase() : user?.id ? String(user.id) : 'unknown';
    const bid = branchId ? String(branchId) : 'unknown';
    return `product_prices_draft:${uid}:${bid}`;
  }, []);

  const fetchPrices = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setRefreshing(true);

      const { token, user } = await getAuthContext();
      if (!token || !user) {
        Alert.alert('Hata', 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      if (!canEditPrices(user)) {
        setItems([]);
        setPriceMap({});
        initialPriceMapRef.current = {};
        return;
      }

      const branchId = user?.selected_branch_id || user?.branches?.[user?.selected_branch || 0]?.id;
      if (!branchId) {
        Alert.alert('Hata', 'Lütfen önce bir şube seçin.');
        navigation.goBack();
        return;
      }

      const response = await axios.get(`${API_URL}/stock/product-prices?branchId=${branchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list = Array.isArray(response.data) ? response.data : [];
      setItems(list);
      setTimeout(() => {
        if (listRef.current && typeof listRef.current.scrollTo === 'function') {
          listRef.current.scrollTo({ y: 0, animated: false });
        }
      }, 0);

      const nextMap = {};
      for (const p of list) {
        const raw = typeof p.fiyat === 'number' ? String(p.fiyat) : p.fiyat === null ? '' : String(p.fiyat);
        nextMap[String(p.id)] = raw;
      }
      initialPriceMapRef.current = nextMap;

      const draftKey = getDraftKey(user, branchId);
      let merged = { ...nextMap };
      try {
        const raw = await AsyncStorage.getItem(draftKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const draftPrices = parsed?.prices && typeof parsed.prices === 'object' ? parsed.prices : null;
          if (draftPrices) {
            for (const [k, v] of Object.entries(draftPrices)) {
              if (Object.prototype.hasOwnProperty.call(merged, k)) {
                merged[k] = String(v ?? '');
              }
            }
          }
        }
      } catch (e) {}

      setPriceMap(merged);
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', error?.response?.data?.message || 'Fiyat listesi alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canEditPrices, getDraftKey, navigation]);

  useEffect(() => {
    fetchPrices(false);
  }, [fetchPrices]);

  useEffect(() => {
    if (listRef.current && typeof listRef.current.scrollTo === 'function') {
      listRef.current.scrollTo({ y: 0, animated: false });
    }
  }, [selectedGroup]);

  useEffect(() => {
    const showSub = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideSub = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showSub, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideSub, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const groups = useMemo(() => {
    const uniqueGroups = [...new Set(items.map((p) => p.grup2 || 'Diğer').filter(Boolean))];
    return ['Tümü', ...uniqueGroups.sort((a, b) => String(a).localeCompare(String(b), 'tr'))];
  }, [items]);

  const filteredItems = useMemo(() => {
    let filtered = items;
    const q = String(searchQuery || '').trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((p) => String(p.urun_adi || '').toLowerCase().includes(q));
    }
    if (selectedGroup !== 'Tümü') {
      filtered = filtered.filter((p) => (p.grup2 || 'Diğer') === selectedGroup);
    }
    return filtered;
  }, [items, searchQuery, selectedGroup]);

  const sections = useMemo(() => {
    const grouped = {};
    for (const p of filteredItems) {
      const g = p.grup2 || 'Diğer';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(p);
    }
    return Object.entries(grouped).map(([title, data]) => ({
      title,
      data: data.sort((a, b) => String(a.urun_adi || '').localeCompare(String(b.urun_adi || ''), 'tr')),
    }));
  }, [filteredItems]);

  const flatIds = useMemo(() => filteredItems.map((p) => p.id), [filteredItems]);

  const handlePriceChange = useCallback((id, text) => {
    const normalized = String(text || '').replace(',', '.');
    if (normalized !== '' && !/^\d*(\.\d{0,2})?$/.test(normalized)) return;
    setPriceMap((prev) => ({ ...prev, [String(id)]: normalized }));
  }, []);

  const changedItems = useMemo(() => {
    const base = initialPriceMapRef.current || {};
    const out = [];
    for (const p of items) {
      const key = String(p.id);
      const cur = String(priceMap[key] ?? '').trim();
      const prev = String(base[key] ?? '').trim();
      if (cur === prev) continue;
      if (cur === '') continue;
      const val = Number(cur);
      if (!Number.isFinite(val) || val < 0) continue;
      out.push({ plu: Number(p.id), fiyat: val });
    }
    return out;
  }, [items, priceMap]);

  const focusNextInput = useCallback((id) => {
    const idx = flatIds.indexOf(id);
    const nextId = idx >= 0 ? flatIds[idx + 1] : null;
    if (!nextId) return;
    const ref = inputRefs.current[String(nextId)];
    if (ref && typeof ref.focus === 'function') {
      ref.focus();
    }
  }, [flatIds]);

  const saveDraft = useCallback(async () => {
    try {
      const { user } = await getAuthContext();
      if (!user) return;
      if (!canEditPrices(user)) return;

      const branchId = user?.selected_branch_id || user?.branches?.[user?.selected_branch || 0]?.id;
      const draftKey = getDraftKey(user, branchId);
      const base = initialPriceMapRef.current || {};
      const prices = {};
      for (const [k, v] of Object.entries(priceMap)) {
        const cur = String(v ?? '').trim();
        const prev = String(base[k] ?? '').trim();
        if (cur && cur !== prev) prices[k] = cur;
      }
      if (Object.keys(prices).length === 0) {
        Alert.alert('Bilgi', 'Taslağa kaydedilecek değişiklik yok.');
        return;
      }
      await AsyncStorage.setItem(draftKey, JSON.stringify({ updatedAt: Date.now(), prices }));
      Alert.alert('Bilgi', 'Taslak kaydedildi.');
    } catch (e) {
      Alert.alert('Hata', 'Taslak kaydedilemedi.');
    }
  }, [canEditPrices, getDraftKey, priceMap]);

  const sendPrices = useCallback(async () => {
    if (changedItems.length === 0) return;
    setSaving(true);
    try {
      const { token, user } = await getAuthContext();
      if (!token || !user) {
        Alert.alert('Hata', 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }
      if (!canEditPrices(user)) {
        Alert.alert('Hata', 'Bu işlem için yetkiniz yok.');
        return;
      }

      const branchId = user?.selected_branch_id || user?.branches?.[user?.selected_branch || 0]?.id;
      if (!branchId) {
        Alert.alert('Hata', 'Lütfen önce bir şube seçin.');
        return;
      }

      await axios.put(`${API_URL}/stock/product-prices?branchId=${branchId}`, { items: changedItems }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const draftKey = getDraftKey(user, branchId);
      try {
        await AsyncStorage.removeItem(draftKey);
      } catch (e) {}

      await fetchPrices(true);
      Alert.alert('Bilgi', 'Fiyatlar başarıyla gönderildi.');
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', error?.response?.data?.message || 'Fiyatlar güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }, [canEditPrices, changedItems, fetchPrices, getDraftKey, navigation]);

  const renderRow = useCallback((p) => {
    const key = String(p.id);
    const value = priceMap[key] ?? '';
    const hasChange = String(value).trim() !== String(initialPriceMapRef.current?.[key] ?? '').trim();
    return (
      <View key={key} style={[styles.itemRow, hasChange && styles.itemRowChanged]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.itemName} numberOfLines={2}>{p.urun_adi}</Text>
          {typeof p.onceki_fiyat === 'number' ? (
            <Text style={styles.prevPrice}>Önceki: {p.onceki_fiyat}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.priceBox}
          activeOpacity={0.9}
          onPress={() => {
            const ref = inputRefs.current[key];
            if (ref && typeof ref.focus === 'function') {
              ref.focus();
            }
            if (!keyboardVisible) setKeyboardVisible(true);
          }}
        >
          <TextInput
            ref={(el) => { inputRefs.current[key] = el; }}
            style={[styles.priceInput, !hasChange && styles.priceInputIdle]}
            keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
            value={String(value)}
            onChangeText={(text) => handlePriceChange(p.id, text)}
            returnKeyType="next"
            onSubmitEditing={() => focusNextInput(p.id)}
            blurOnSubmit={false}
            selectTextOnFocus={true}
            onFocus={() => {
              if (!keyboardVisible) setKeyboardVisible(true);
            }}
          />
          <Text style={styles.currency}>₺</Text>
        </TouchableOpacity>
      </View>
    );
  }, [focusNextInput, handlePriceChange, keyboardVisible, priceMap]);

  const content = (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Ürün Fiyatları</Text>
          {!keyboardVisible && <Text style={styles.headerSub}>Hızlı fiyat güncelle</Text>}
        </View>
        <TouchableOpacity
          style={[styles.fetchBtn, refreshing && styles.fetchBtnDisabled]}
          disabled={refreshing}
          onPress={() => fetchPrices(true)}
        >
          <Feather name="refresh-cw" size={16} color="#065f46" />
          <Text style={styles.fetchBtnText}>Şubeden çek</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Feather name="search" size={16} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Ürün ara..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={16} color="#64748b" />
          </TouchableOpacity>
        ) : null}
      </View>

      {!keyboardVisible && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.groupScroll}
          contentContainerStyle={styles.groupScrollContent}
        >
          {groups.map((g) => {
            const active = selectedGroup === g;
            return (
              <TouchableOpacity
                key={g}
                style={[styles.groupChip, active && styles.groupChipActive]}
                onPress={() => setSelectedGroup(g)}
              >
                <Text style={[styles.groupChipText, active && styles.groupChipTextActive]}>{g}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Ürünler yükleniyor...</Text>
        </View>
      ) : (
        <ScrollView
          key={`list:${selectedGroup}:${searchQuery}`}
          ref={listRef}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: keyboardVisible ? 64 : 96 }}
        >
          {sections.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Ürün bulunamadı</Text>
              <Text style={styles.emptyDesc}>Arama kriterlerinize uygun ürün yok.</Text>
            </View>
          ) : (
            sections.map((s) => (
              <View key={s.title} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{s.title}</Text>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>{s.data.length} ürün</Text>
                  </View>
                </View>
                <View>
                  {s.data.map(renderRow)}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
      style={styles.container}
    >
      <View style={{ flex: 1 }}>
        {content}
        {!keyboardVisible ? (
          <View style={styles.bottomBar}>
            <Text style={styles.changedText}>{changedItems.length} değişiklik</Text>
            <View style={styles.bottomBtns}>
              <TouchableOpacity
                style={[styles.draftBtn, saving && styles.btnDisabled]}
                onPress={saveDraft}
                disabled={saving}
              >
                <Text style={styles.draftBtnText}>Taslak</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, (saving || changedItems.length === 0) && styles.btnDisabled]}
                onPress={sendPrices}
                disabled={saving || changedItems.length === 0}
              >
                <LinearGradient colors={['#10b981', '#0ea5e9']} style={styles.sendBtnGradient}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.sendBtnText}>Fiyat Gönder</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.bottomBarCompact}>
            <Text style={styles.changedText}>{changedItems.length}</Text>
            <TouchableOpacity
              style={[styles.sendBtn, (saving || changedItems.length === 0) && styles.btnDisabled]}
              onPress={sendPrices}
              disabled={saving || changedItems.length === 0}
            >
              <LinearGradient colors={['#10b981', '#0ea5e9']} style={styles.sendBtnGradientCompact}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendBtnText}>Gönder</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 44 : 56,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  fetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  fetchBtnDisabled: {
    opacity: 0.6,
  },
  fetchBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46',
    marginLeft: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 8,
  },
  groupScroll: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  groupScrollContent: {
    paddingRight: 16,
  },
  groupChip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 10,
    justifyContent: 'center',
  },
  groupChipActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  groupChipText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#475569',
  },
  groupChipTextActive: {
    color: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
  },
  sectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  sectionBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#334155',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  itemRowChanged: {
    backgroundColor: '#f0fdf4',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  prevPrice: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceInput: {
    width: 90,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#10b981',
    backgroundColor: '#fff',
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  priceInputIdle: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  currency: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
  },
  emptyBox: {
    marginHorizontal: 16,
    marginTop: 30,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  emptyDesc: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 22 : 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  changedText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#334155',
  },
  bottomBtns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  draftBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    justifyContent: 'center',
    marginRight: 10,
  },
  draftBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#334155',
  },
  sendBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  sendBtnGradient: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  sendBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fff',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  bottomBarCompact: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 14 : 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sendBtnGradientCompact: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 92,
  },
});
