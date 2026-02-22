import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ScrollView,
  Platform,
  Animated,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

const formatDate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
      headers: { Authorization: `Bearer ${token}` }
    });
    user = response.data;
    await AsyncStorage.setItem('user', JSON.stringify(user));
  }

  return { token, user };
};

export default function LiveStockScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('Tümü');
  const [sortBy, setSortBy] = useState('sales');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [showStockEntryOnly, setShowStockEntryOnly] = useState(false);
  const [filterSold, setFilterSold] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterOutOfStock, setFilterOutOfStock] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [iosTempDate, setIosTempDate] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const CRITICAL_THRESHOLD = 5;

  const fetchData = useCallback(async () => {
    try {
      const { token, user } = await getAuthContext();
      if (!token || !user) return;
      const branchId =
        user?.selected_branch_id ||
        user?.branches?.[user?.selected_branch || 0]?.id;

      if (!branchId) return;

      const todayStr = formatDate(new Date());
      const selectedStr = formatDate(selectedDate);
      const isToday = selectedStr === todayStr;

      let url = `${API_URL}/stock/live?branchId=${branchId}`;
      if (!isToday) {
        url += `&date=${selectedStr}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setData(response.data.items || []);
      setLastUpdate(new Date());
      setConnectionError(false);
    } catch (error) {
      console.error(error);
      setConnectionError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const todayStr = formatDate(new Date());
    const selectedStr = formatDate(selectedDate);
    const isToday = selectedStr === todayStr;

    if (isToday) {
      intervalRef.current = setInterval(() => {
        fetchData();
      }, 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, selectedDate]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

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

    if (searchQuery) {
      result = result.filter(item =>
        item.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedGroup !== 'Tümü') {
      result = result.filter(item => item.group === selectedGroup);
    }

    if (showStockEntryOnly) {
      result = result.filter(item => item.hasStockEntry);
    }

    const hasStatusFilter =
      filterSold || filterOpen || showCriticalOnly || filterOutOfStock;

    if (hasStatusFilter) {
      result = result.filter(item => {
        const sold = item.sold || 0;
        const open = item.open || 0;
        const remaining = item.remaining || 0;
        const hasStockEntry = item.hasStockEntry;
        const isOutOfStock = remaining <= 0 && hasStockEntry;
        const isCritical =
          remaining <= CRITICAL_THRESHOLD && remaining > 0 && hasStockEntry;

        const matchSold = filterSold && sold > 0;
        const matchOpen = filterOpen && open > 0;
        const matchCritical = showCriticalOnly && (isCritical || isOutOfStock);
        const matchOutOfStock = filterOutOfStock && isOutOfStock;

        return matchSold || matchOpen || matchCritical || matchOutOfStock;
      });
    }

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
  }, [
    data,
    searchQuery,
    selectedGroup,
    sortBy,
    showCriticalOnly,
    showStockEntryOnly,
    filterSold,
    filterOpen,
    filterOutOfStock,
  ]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const renderItem = useCallback(({ item }) => {
    const totalSold = (item.sold || 0) + (item.open || 0);
    const remaining = item.remaining || 0;
    const hasStockEntry = item.hasStockEntry;
    const isOutOfStock = remaining <= 0 && hasStockEntry;
    const isCritical = remaining <= CRITICAL_THRESHOLD && remaining > 0 && hasStockEntry;
    const isLow = remaining <= CRITICAL_THRESHOLD * 2 && remaining > CRITICAL_THRESHOLD && hasStockEntry;

    return (
      <View style={[
        styles.cardItem, 
        isOutOfStock && styles.cardCritical,
        isCritical && styles.cardWarning,
        !hasStockEntry && styles.cardNoStock
      ]}>
        {/* Top Row: Name + Remaining */}
        <View style={styles.cardTopRow}>
          <View style={styles.cardNameSection}>
            {isOutOfStock && <Feather name="x-circle" size={14} color="#dc2626" style={{marginRight: 4}} />}
            {isCritical && <Feather name="alert-triangle" size={14} color="#ea580c" style={{marginRight: 4}} />}
            <View style={{flex: 1}}>
              <View style={styles.cardNameRow}>
                <Text style={[styles.cardName, isOutOfStock && styles.textRed, isCritical && styles.textOrange, !hasStockEntry && styles.textMuted]} numberOfLines={1}>
                  {item.name}
                </Text>
                {hasStockEntry && (
                  <View style={styles.stockBadge}>
                    <Text style={styles.stockBadgeText}>STOK</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardGroup}>{item.group || 'Diğer'}</Text>
            </View>
          </View>
          <View style={[
            styles.remainingBadge, 
            isOutOfStock ? styles.remainingRed : isCritical ? styles.remainingOrange : isLow ? styles.remainingYellow : hasStockEntry ? styles.remainingGreen : styles.remainingGray
          ]}>
            <Text style={[
              styles.remainingText,
              isOutOfStock || isCritical ? styles.remainingTextWhite : hasStockEntry ? styles.remainingTextDark : styles.textMuted
            ]}>
              {hasStockEntry ? remaining : '-'}
            </Text>
          </View>
        </View>
        
        {/* Bottom Row: Stats */}
        <View style={styles.cardStatsRow}>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatLabel}>Giriş</Text>
            <Text style={[styles.cardStatValue, !hasStockEntry && styles.textMuted]}>{hasStockEntry ? (item.initial || 0) : '-'}</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatLabel}>Satılan</Text>
            <Text style={[styles.cardStatValue, styles.textGreen]}>{item.sold || 0}</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatLabel}>Açık</Text>
            <Text style={[styles.cardStatValue, styles.textAmber]}>{item.open || 0}</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatLabel}>Toplam</Text>
            <Text style={[styles.cardStatValue, styles.textIndigo]}>{totalSold}</Text>
          </View>
        </View>
      </View>
    );
  }, []);

  const todayStr = formatDate(new Date());
  const selectedStr = formatDate(selectedDate);
  const isToday = selectedStr === todayStr;
  const dateLabel = isToday
    ? 'Bugün'
    : selectedDate.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

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

      {connectionError && (
        <View style={styles.offlineAlert}>
          <Feather name="alert-triangle" size={16} color="#b91c1c" />
          <Text style={styles.offlineAlertText}>Bağlantı kurulamadı. Şubeye erişilemiyor.</Text>
        </View>
      )}

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

      <View style={styles.dateFilterContainer}>
        <TouchableOpacity
          style={styles.dateFilterButton}
          onPress={() => {
            if (Platform.OS === 'ios') {
              setIosTempDate(selectedDate);
              setShowDatePicker(true);
            } else {
              setShowDatePicker(true);
            }
          }}
        >
          <Feather
            name="calendar"
            size={14}
            color="#0369a1"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.dateFilterText}>{dateLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <TouchableOpacity
          style={[
            styles.statCard,
            { backgroundColor: '#ecfdf5' },
            filterSold && styles.statCardActive,
          ]}
          onPress={() => setFilterSold(!filterSold)}
        >
          <Feather name="trending-up" size={18} color="#10b981" />
          <Text style={[styles.statValue, { color: '#059669' }]}>{stats.totalSold}</Text>
          <Text style={styles.statLabel}>Satılan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statCard,
            { backgroundColor: '#fff7ed' },
            filterOpen && styles.statCardActive,
          ]}
          onPress={() => setFilterOpen(!filterOpen)}
        >
          <Feather name="clock" size={18} color="#f97316" />
          <Text style={[styles.statValue, { color: '#ea580c' }]}>{stats.totalOpen}</Text>
          <Text style={styles.statLabel}>Açık</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statCard,
            { backgroundColor: '#fef2f2' },
            showCriticalOnly && styles.statCardActive,
          ]}
          onPress={() => setShowCriticalOnly(!showCriticalOnly)}
        >
          <Feather name="alert-circle" size={18} color="#ef4444" />
          <Text style={[styles.statValue, { color: '#dc2626' }]}>{stats.criticalCount}</Text>
          <Text style={styles.statLabel}>Kritik</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statCard,
            { backgroundColor: '#fef2f2' },
            filterOutOfStock && styles.statCardActive,
          ]}
          onPress={() => setFilterOutOfStock(!filterOutOfStock)}
        >
          <Feather name="x" size={18} color="#991b1b" />
          <Text style={[styles.statValue, { color: '#991b1b' }]}>{stats.outOfStock}</Text>
          <Text style={styles.statLabel}>Tükenen</Text>
        </TouchableOpacity>
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

      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            if (event.type === 'set' && date) {
              setSelectedDate(date);
            }
            setShowDatePicker(false);
          }}
          maximumDate={new Date()}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Tarih Seç</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Feather name="x" size={24} color="#333" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.datePickerContainer}>
                    <Text style={styles.dateLabel}>Tarih:</Text>
                    <DateTimePicker
                      value={iosTempDate}
                      mode="date"
                      display="default"
                      onChange={(event, date) => {
                        if (date) {
                          setIosTempDate(date);
                        }
                      }}
                      maximumDate={new Date()}
                      style={{ width: 120 }}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.applyButton}
                    onPress={() => {
                      setSelectedDate(iosTempDate);
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={styles.applyButtonText}>Uygula</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

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
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingBottom: 10,
    paddingHorizontal: 14,
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
    paddingHorizontal: 14,
    paddingVertical: 6,
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
  offlineAlert: {
    marginHorizontal: 14,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineAlertText: {
    marginLeft: 8,
    color: '#b91c1c',
    fontSize: 12,
  },
  alertBanner: {
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  alertGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  alertDesc: {
    color: '#fecaca',
    fontSize: 11,
    marginTop: 2,
  },
  dateFilterContainer: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  dateFilterButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  dateFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dateLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  applyButton: {
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 6,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statCardActive: {
    borderColor: '#0ea5e9',
    backgroundColor: '#e0f2fe',
  },
  statValue: {
    fontSize: 18,
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
    marginHorizontal: 14,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 44,
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
    marginTop: 10,
    paddingRight: 14,
  },
  groupContent: {
    paddingLeft: 14,
    paddingRight: 6,
  },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    fontSize: 12,
  },
  groupChipTextActive: {
    color: '#fff',
  },
  criticalBtn: {
    width: 36,
    height: 36,
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
    paddingHorizontal: 8,
    height: 36,
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
    fontSize: 11,
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
  // Card Styles
  cardItem: {
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginVertical: 2,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardCritical: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  cardWarning: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  cardNoStock: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardNameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    flexShrink: 1,
  },
  cardGroup: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  remainingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  remainingRed: {
    backgroundColor: '#ef4444',
  },
  remainingOrange: {
    backgroundColor: '#f97316',
  },
  remainingYellow: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  remainingGreen: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  remainingGray: {
    backgroundColor: '#f1f5f9',
  },
  remainingText: {
    fontSize: 14,
    fontWeight: '800',
  },
  remainingTextWhite: {
    color: '#fff',
  },
  remainingTextDark: {
    color: '#166534',
  },
  cardStatsRow: {
    flexDirection: 'row',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cardStat: {
    flex: 1,
    alignItems: 'center',
  },
  cardStatLabel: {
    fontSize: 9,
    color: '#94a3b8',
    marginBottom: 2,
  },
  cardStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  textGreen: {
    color: '#10b981',
  },
  textAmber: {
    color: '#f59e0b',
  },
  textIndigo: {
    color: '#6366f1',
  },
  textRed: {
    color: '#dc2626',
  },
  textOrange: {
    color: '#ea580c',
  },
  listContent: {
    paddingTop: 8,
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
