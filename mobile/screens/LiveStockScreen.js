import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { 
  StyleSheet, Text, View, ActivityIndicator, FlatList, 
  TouchableOpacity, RefreshControl, TextInput, ScrollView, Platform, Animated 
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function LiveStockScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('Tümü');
  const [sortBy, setSortBy] = useState('sales');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [showStockEntryOnly, setShowStockEntryOnly] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const CRITICAL_THRESHOLD = 5;

  useEffect(() => {
    fetchData();
    
    // 5 saniyede bir güncelleme
    intervalRef.current = setInterval(fetchData, 5000);
    
    // Pulse animation for live indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = JSON.parse(await AsyncStorage.getItem('user'));
      const branchId = userData?.selected_branch_id;

      if (!branchId) return;

      const response = await axios.get(`${API_URL}/stock/live?branchId=${branchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setData(response.data.items || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Grupları çıkar
  const groups = useMemo(() => {
    return ['Tümü', ...new Set(data.map(i => i.group).filter(Boolean))];
  }, [data]);

  // İstatistikler
  const stats = useMemo(() => {
    const totalSold = data.reduce((sum, item) => sum + (item.sold || 0), 0);
    const totalOpen = data.reduce((sum, item) => sum + (item.open || 0), 0);
    const criticalCount = data.filter(item => item.remaining <= CRITICAL_THRESHOLD && item.hasStockEntry).length;
    const outOfStock = data.filter(item => item.remaining <= 0 && item.hasStockEntry).length;
    const stockEntryCount = data.filter(item => item.hasStockEntry).length;
    return { totalSold, totalOpen, criticalCount, outOfStock, stockEntryCount };
  }, [data]);

  // Filtrelenmiş data
  const filteredData = useMemo(() => {
    let result = [...data];

    // Arama
    if (searchQuery) {
      result = result.filter(item => 
        item.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Grup
    if (selectedGroup !== 'Tümü') {
      result = result.filter(item => item.group === selectedGroup);
    }

    // Kritik filtresi
    if (showCriticalOnly) {
      result = result.filter(item => item.remaining <= CRITICAL_THRESHOLD && item.hasStockEntry);
    }

    // Stok girişi yapılanlar filtresi
    if (showStockEntryOnly) {
      result = result.filter(item => item.hasStockEntry);
    }

    // Sıralama
    if (sortBy === 'sales') {
      result.sort((a, b) => (b.sold + b.open) - (a.sold + a.open));
    } else if (sortBy === 'remaining') {
      result.sort((a, b) => a.remaining - b.remaining);
    } else if (sortBy === 'critical') {
      result.sort((a, b) => {
        const aIsCritical = a.remaining <= CRITICAL_THRESHOLD ? 0 : 1;
        const bIsCritical = b.remaining <= CRITICAL_THRESHOLD ? 0 : 1;
        if (aIsCritical !== bIsCritical) return aIsCritical - bIsCritical;
        return a.remaining - b.remaining;
      });
    }

    return result;
  }, [data, searchQuery, selectedGroup, sortBy, showCriticalOnly, showStockEntryOnly]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const renderItem = useCallback(({ item }) => {
    const totalSold = (item.sold || 0) + (item.open || 0);
    const remaining = item.remaining || 0;
    const hasStockEntry = item.hasStockEntry;
    const isOutOfStock = remaining <= 0 && hasStockEntry;
    const isCritical = remaining <= CRITICAL_THRESHOLD && remaining > 0 && hasStockEntry;
    const isLow = remaining <= CRITICAL_THRESHOLD * 2 && remaining > CRITICAL_THRESHOLD && hasStockEntry;

    return (
      <View style={[
        styles.row, 
        isOutOfStock && styles.rowCritical,
        isCritical && styles.rowWarning,
        !hasStockEntry && styles.rowNoStock
      ]}>
        <View style={styles.nameCol}>
          <View style={styles.nameRow}>
            {isOutOfStock && <Feather name="x-circle" size={14} color="#dc2626" style={{marginRight: 4}} />}
            {isCritical && <Feather name="alert-triangle" size={14} color="#ea580c" style={{marginRight: 4}} />}
            <Text style={[styles.nameText, isOutOfStock && styles.textRed, isCritical && styles.textOrange, !hasStockEntry && styles.textMuted]} numberOfLines={1}>
              {item.name}
            </Text>
            {hasStockEntry && (
              <View style={styles.stockBadge}>
                <Text style={styles.stockBadgeText}>STOK</Text>
              </View>
            )}
          </View>
          <Text style={styles.groupText}>{item.group || 'Diğer'}</Text>
        </View>
        <View style={styles.valCol}>
          <Text style={[styles.initialText, !hasStockEntry && styles.textMuted]}>
            {hasStockEntry ? (item.initial || 0) : '-'}
          </Text>
        </View>
        <View style={styles.valCol}>
          <Text style={styles.soldText}>{item.sold || 0}</Text>
        </View>
        <View style={styles.valCol}>
          <Text style={styles.openText}>{item.open || 0}</Text>
        </View>
        <View style={styles.valCol}>
          <Text style={styles.totalText}>{totalSold}</Text>
        </View>
        <View style={styles.valColLast}>
          {hasStockEntry ? (
            <View style={[
              styles.badge, 
              isOutOfStock ? styles.badgeRed : isCritical ? styles.badgeOrange : isLow ? styles.badgeYellow : styles.badgeGreen
            ]}>
              <Text style={[
                styles.badgeText,
                isOutOfStock ? styles.badgeTextRed : isCritical ? styles.badgeTextOrange : isLow ? styles.badgeTextYellow : styles.badgeTextGreen
              ]}>{remaining}</Text>
            </View>
          ) : (
            <Text style={styles.textMuted}>-</Text>
          )}
        </View>
      </View>
    );
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#06b6d4', '#0891b2']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Animated.View style={[styles.liveIndicator, { opacity: pulseAnim }]} />
          <Feather name="activity" size={20} color="#fff" style={{marginRight: 8}} />
          <Text style={styles.headerTitle}>Canlı Stok Takip</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Live Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.statusText}>Her 5 saniyede güncellenir</Text>
        </View>
        {lastUpdate && (
          <Text style={styles.lastUpdateText}>
            Son: {lastUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Text>
        )}
      </View>

      {/* Critical Alert */}
      {stats.criticalCount > 0 && (
        <TouchableOpacity 
          style={styles.alertBanner}
          onPress={() => {
            setShowCriticalOnly(true);
            setSortBy('critical');
          }}
        >
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.alertGradient}>
            <Feather name="alert-triangle" size={20} color="#fff" />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Kritik Stok Uyarısı!</Text>
              <Text style={styles.alertDesc}>
                {stats.outOfStock > 0 && `${stats.outOfStock} ürün tükendi! `}
                {stats.criticalCount} ürün kritik seviyede
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#ecfdf5' }]}>
          <Feather name="trending-up" size={18} color="#10b981" />
          <Text style={[styles.statValue, { color: '#059669' }]}>{stats.totalSold}</Text>
          <Text style={styles.statLabel}>Satılan</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fff7ed' }]}>
          <Feather name="clock" size={18} color="#f97316" />
          <Text style={[styles.statValue, { color: '#ea580c' }]}>{stats.totalOpen}</Text>
          <Text style={styles.statLabel}>Açık</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fef2f2' }]}>
          <Feather name="alert-circle" size={18} color="#ef4444" />
          <Text style={[styles.statValue, { color: '#dc2626' }]}>{stats.criticalCount}</Text>
          <Text style={styles.statLabel}>Kritik</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fef2f2' }]}>
          <Feather name="x" size={18} color="#991b1b" />
          <Text style={[styles.statValue, { color: '#991b1b' }]}>{stats.outOfStock}</Text>
          <Text style={styles.statLabel}>Tükenen</Text>
        </View>
      </View>

      {/* Search & Filters */}
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

      {/* Filters Row */}
      <View style={styles.filtersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupContent}>
          {groups.map((group, index) => (
            <TouchableOpacity 
              key={index} 
              style={[styles.groupChip, selectedGroup === group && styles.groupChipActive]}
              onPress={() => setSelectedGroup(group)}
            >
              <Text style={[styles.groupChipText, selectedGroup === group && styles.groupChipTextActive]}>
                {group}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity 
          style={[styles.stockEntryBtn, showStockEntryOnly && styles.stockEntryBtnActive]}
          onPress={() => setShowStockEntryOnly(!showStockEntryOnly)}
        >
          <Feather name="package" size={14} color={showStockEntryOnly ? '#fff' : '#3b82f6'} />
          <Text style={[styles.stockEntryBtnText, showStockEntryOnly && styles.stockEntryBtnTextActive]}>
            {stats.stockEntryCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.criticalBtn, showCriticalOnly && styles.criticalBtnActive]}
          onPress={() => setShowCriticalOnly(!showCriticalOnly)}
        >
          <Feather name="bell" size={16} color={showCriticalOnly ? '#fff' : '#ef4444'} />
        </TouchableOpacity>
      </View>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.headerText, styles.nameCol]}>Ürün</Text>
        <Text style={[styles.headerText, styles.valCol]}>Giriş</Text>
        <Text style={[styles.headerText, styles.valCol]}>Satılan</Text>
        <Text style={[styles.headerText, styles.valCol]}>Açık</Text>
        <Text style={[styles.headerText, styles.valCol]}>Top.</Text>
        <Text style={[styles.headerText, styles.valColLast]}>Kalan</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Veriler yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          renderItem={renderItem}
          keyExtractor={item => item.name}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0ea5e9']} />
          }
          initialNumToRender={20}
          maxToRenderPerBatch={15}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="package" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>Henüz stok girişi yapılmamış</Text>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => navigation.navigate('StockEntry')}
              >
                <Text style={styles.emptyButtonText}>Stok Girişi Yap</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
    marginRight: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  refreshButton: {
    padding: 4,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f9ff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0f2fe',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#0369a1',
  },
  lastUpdateText: {
    fontSize: 11,
    color: '#64748b',
  },
  alertBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  alertGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  alertDesc: {
    color: '#fecaca',
    fontSize: 12,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#1e293b',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingRight: 16,
  },
  groupContent: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  groupChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  groupChipActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  groupChipText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 13,
  },
  groupChipTextActive: {
    color: '#fff',
  },
  criticalBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    justifyContent: 'center',
    alignItems: 'center',
  },
  criticalBtnActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  stockEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginRight: 8,
  },
  stockEntryBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  stockEntryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
    marginLeft: 4,
  },
  stockEntryBtnTextActive: {
    color: '#fff',
  },
  stockBadge: {
    marginLeft: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#dbeafe',
    borderRadius: 4,
  },
  stockBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  rowNoStock: {
    backgroundColor: '#f8fafc',
  },
  textMuted: {
    color: '#94a3b8',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#e0f2fe',
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#bae6fd',
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
  },
  rowCritical: {
    backgroundColor: '#fef2f2',
  },
  rowWarning: {
    backgroundColor: '#fff7ed',
  },
  nameCol: {
    flex: 3,
    paddingRight: 6,
  },
  valCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valColLast: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  textRed: {
    color: '#dc2626',
  },
  textOrange: {
    color: '#ea580c',
  },
  groupText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  initialText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  soldText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
  },
  openText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f97316',
  },
  totalText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 32,
    alignItems: 'center',
  },
  badgeRed: { backgroundColor: '#fecaca' },
  badgeOrange: { backgroundColor: '#fed7aa' },
  badgeYellow: { backgroundColor: '#fef08a' },
  badgeGreen: { backgroundColor: '#bbf7d0' },
  badgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  badgeTextRed: { color: '#dc2626' },
  badgeTextOrange: { color: '#ea580c' },
  badgeTextYellow: { color: '#ca8a04' },
  badgeTextGreen: { color: '#16a34a' },
  listContent: {
    paddingBottom: 40,
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
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
