import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  StyleSheet, Text, View, ActivityIndicator, FlatList, TextInput, 
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform, 
  SectionList, Animated 
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function StockEntryScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState([]);
  const [stockInputs, setStockInputs] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('Tümü');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setRefreshing(true);
      
      const token = await AsyncStorage.getItem('token');
      const userData = JSON.parse(await AsyncStorage.getItem('user'));
      const branchId = userData?.selected_branch_id;

      if (!branchId) {
        Alert.alert('Hata', 'Lütfen önce bir şube seçin.');
        navigation.goBack();
        return;
      }

      const response = await axios.get(`${API_URL}/stock/products?branchId=${branchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProducts(response.data || []);
    } catch (error) {
      console.error(error);
      if (!showRefreshIndicator) {
        Alert.alert('Hata', 'Ürün listesi alınamadı.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchProducts(true);
  };

  // Ürün gruplarını çıkar
  const groups = useMemo(() => {
    const uniqueGroups = [...new Set(products.map(p => p.grup2 || 'Diğer').filter(Boolean))];
    return ['Tümü', ...uniqueGroups.sort()];
  }, [products]);

  // Filtrelenmiş ve gruplandırılmış ürünler
  const filteredSections = useMemo(() => {
    let filtered = products;
    
    // Arama filtresi
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.urun_adi?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Grup filtresi
    if (selectedGroup !== 'Tümü') {
      filtered = filtered.filter(p => (p.grup2 || 'Diğer') === selectedGroup);
    }

    // Gruplara ayır
    const grouped = {};
    filtered.forEach(p => {
      const group = p.grup2 || 'Diğer';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(p);
    });

    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [products, searchQuery, selectedGroup]);

  // Girilen ürün sayısı
  const enteredCount = useMemo(() => {
    return Object.values(stockInputs).filter(v => v !== '' && parseInt(v) > 0).length;
  }, [stockInputs]);

  const handleStockChange = useCallback((productName, value) => {
    if (value && !/^\d*$/.test(value)) return;
    setStockInputs(prev => ({
      ...prev,
      [productName]: value
    }));
  }, []);

  const handleIncrement = useCallback((productName) => {
    setStockInputs(prev => {
      const current = parseInt(prev[productName] || '0');
      return { ...prev, [productName]: String(current + 1) };
    });
  }, []);

  const handleDecrement = useCallback((productName) => {
    setStockInputs(prev => {
      const current = parseInt(prev[productName] || '0');
      if (current <= 0) return prev;
      return { ...prev, [productName]: String(current - 1) };
    });
  }, []);

  const handleSave = async () => {
    const entries = Object.entries(stockInputs)
      .filter(([_, qty]) => qty !== '' && !isNaN(qty) && parseInt(qty) >= 0)
      .map(([name, qty]) => ({
        productName: name,
        quantity: parseInt(qty)
      }));

    if (entries.length === 0) {
      Alert.alert('Uyarı', 'Lütfen en az bir ürün için stok girin.');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = JSON.parse(await AsyncStorage.getItem('user'));
      const branchId = userData?.selected_branch_id;

      await axios.post(`${API_URL}/stock/entry?branchId=${branchId}`, { items: entries }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSaveSuccess(true);
      setTimeout(() => {
        navigation.navigate('LiveStock');
      }, 1500);
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', error?.response?.data?.message || 'Stok kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = useCallback(({ item }) => {
    const hasValue = stockInputs[item.urun_adi] && parseInt(stockInputs[item.urun_adi]) > 0;
    
    return (
      <View style={[styles.itemContainer, hasValue && styles.itemContainerActive]}>
        <Text style={[styles.itemName, hasValue && styles.itemNameActive]} numberOfLines={2}>
          {item.urun_adi}
        </Text>
        <View style={styles.inputRow}>
          <TouchableOpacity 
            style={styles.counterBtn} 
            onPress={() => handleDecrement(item.urun_adi)}
          >
            <Feather name="minus" size={18} color="#64748b" />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, hasValue && styles.inputActive]}
            placeholder="0"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            value={stockInputs[item.urun_adi] || ''}
            onChangeText={(text) => handleStockChange(item.urun_adi, text)}
          />
          <TouchableOpacity 
            style={[styles.counterBtn, styles.counterBtnPlus]} 
            onPress={() => handleIncrement(item.urun_adi)}
          >
            <Feather name="plus" size={18} color="#3b82f6" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [stockInputs, handleStockChange, handleIncrement, handleDecrement]);

  const renderSectionHeader = useCallback(({ section: { title, data } }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionDot} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionCount}>{data.length} ürün</Text>
      </View>
    </View>
  ), []);

  if (saveSuccess) {
    return (
      <View style={styles.successContainer}>
        <LinearGradient colors={['#10b981', '#14b8a6']} style={styles.successIcon}>
          <Feather name="check" size={48} color="#fff" />
        </LinearGradient>
        <Text style={styles.successTitle}>Stok Kaydedildi!</Text>
        <Text style={styles.successDesc}>Canlı takip sayfasına yönlendiriliyorsunuz...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      {/* Header */}
      <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Feather name="package" size={20} color="#fff" style={{marginRight: 8}} />
          <Text style={styles.headerTitle}>Günlük Stok Girişi</Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} disabled={refreshing} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color="#fff" style={refreshing ? {opacity: 0.5} : {}} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{enteredCount}</Text>
          <Text style={styles.statLabel}>Girilen</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{products.length}</Text>
          <Text style={styles.statLabel}>Toplam Ürün</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Ürün ara..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={20} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Group Filters */}
      <View style={styles.groupContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={groups}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.groupContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.groupChip, selectedGroup === item && styles.groupChipActive]}
              onPress={() => setSelectedGroup(item)}
            >
              <Text style={[styles.groupChipText, selectedGroup === item && styles.groupChipTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Ürünler yükleniyor...</Text>
        </View>
      ) : (
        <SectionList
          sections={filteredSections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id?.toString() || item.urun_adi}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          initialNumToRender={20}
          maxToRenderPerBatch={15}
          windowSize={10}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="package" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>Ürün bulunamadı</Text>
            </View>
          }
        />
      )}

      {/* Footer Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[
            styles.saveButton, 
            enteredCount === 0 && styles.saveButtonDisabled,
            saving && styles.saveButtonDisabled
          ]} 
          onPress={handleSave}
          disabled={saving || enteredCount === 0}
        >
          <LinearGradient 
            colors={enteredCount > 0 ? ['#10b981', '#059669'] : ['#cbd5e1', '#94a3b8']} 
            style={styles.saveButtonGradient}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="save" size={20} color="#fff" style={{marginRight: 8}} />
                <Text style={styles.saveButtonText}>
                  {enteredCount > 0 ? `${enteredCount} Ürünü Kaydet` : 'Ürün Seçin'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    paddingTop: Platform.OS === 'android' ? 45 : 55,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -8,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    height: 50,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#1e293b',
  },
  groupContainer: {
    marginTop: 12,
  },
  groupContent: {
    paddingHorizontal: 16,
  },
  groupChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  groupChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  groupChipText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 14,
  },
  groupChipTextActive: {
    color: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f1f5f9',
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sectionCount: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 120,
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  itemContainerActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
    marginRight: 12,
  },
  itemNameActive: {
    color: '#1d4ed8',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnPlus: {
    backgroundColor: '#eff6ff',
  },
  input: {
    backgroundColor: '#f8fafc',
    width: 64,
    height: 40,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#334155',
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  inputActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#fff',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  saveButton: {},
  saveButtonDisabled: {
    opacity: 0.8,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 15,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 12,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 8,
  },
  successDesc: {
    fontSize: 15,
    color: '#4ade80',
  },
});
