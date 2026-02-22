import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, FlatList, TouchableOpacity, ScrollView, Dimensions, TextInput } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

const screenWidth = Dimensions.get('window').width;

export default function OrdersScreen({ navigation, route }) {
  const orderType = route.params?.type || 'open'; // 'open' or 'closed'
  const isClosed = orderType === 'closed';
  const adturParam = route.params?.adtur;
  
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [filterMasa, setFilterMasa] = useState('');
  const [adturFilter, setAdturFilter] = useState(adturParam ? String(adturParam) : 'all');
  const [period, setPeriod] = useState(isClosed ? 'today' : 'all'); // 'today', 'all', 'custom'

  useEffect(() => {
    fetchOrders(1);
  }, [period, orderType]);

  const fetchOrders = async (pageNum = 1, append = false) => {
    if (append) {
        setLoadingMore(true);
    } else {
        setLoading(true);
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const endpoint = isClosed ? '/reports/closed-orders' : '/reports/open-orders';
      
      // Build query params
      let params = new URLSearchParams();
      params.append('page', pageNum.toString());
      params.append('limit', '20');
      
      // Period param
      if (isClosed) {
          params.append('period', period);
      } else {
          // Open orders endpoint uses 'period' differently (today vs all)
          params.append('period', period === 'today' ? 'today' : 'all');
      }

      const response = await axios.get(`${API_URL}${endpoint}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const responseData = response.data.data || response.data;
      const meta = response.data;

      if (append) {
        setOrders(prev => [...prev, ...responseData]);
      } else {
        setOrders(responseData);
      }
      
      setTotalPages(meta.total_pages || 1);
      setPage(pageNum);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders(1);
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
        fetchOrders(page + 1, true);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filterMasa) {
        const search = filterMasa.toLowerCase();
        const masaMatch = order.masa_no?.toString().toLowerCase().includes(search);
        const idMatch = (order.adsno || order.id)?.toString().toLowerCase().includes(search);
        if (!masaMatch && !idMatch) return false;
    }
    
    if (adturFilter !== 'all') {
        const selectedType = Number(adturFilter);

        if (isClosed) {
          const actualType = typeof order.adtur !== 'undefined' && order.adtur !== null
            ? Number(order.adtur)
            : -1;
          if (actualType !== selectedType) return false;
        } else {
          const pickType = (o) => {
            if (typeof o.adtur !== 'undefined' && o.adtur !== null) return Number(o.adtur);
            if (typeof o.sipyer !== 'undefined' && o.sipyer !== null) {
              const s = Number(o.sipyer);
              if (s === 2) return 1;
              return 0;
            }
            return -1;
          };
          const a = pickType(order);
          if (selectedType === 0 && a !== 0) return false;
          if (selectedType === 1 && a !== 1) return false;
          if (selectedType === 3 && a !== 3) return false;
        }
    }

    return true;
  });

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  const getOrderTypeLabel = (order) => {
    const fromAdtur = () => {
      if (typeof order.adtur === 'undefined' || order.adtur === null) return null;
      const t = Number(order.adtur);
      if (t === 1) return { label: 'Paket', color: '#fbbf24', bg: '#fffbeb' };
      if (t === 3) return { label: 'Hızlı Satış', color: '#ec4899', bg: '#fdf2f8' };
      return { label: 'Adisyon', color: '#10b981', bg: '#ecfdf5' };
    };

    if (isClosed) {
      const byAdtur = fromAdtur();
      if (byAdtur) return byAdtur;

      if (order.type_label) {
        const text = String(order.type_label).toLowerCase();
        if (text.includes('paket')) return { label: order.type_label, color: '#fbbf24', bg: '#fffbeb' };
        if (text.includes('hızlı')) return { label: order.type_label, color: '#ec4899', bg: '#fdf2f8' };
        return { label: order.type_label, color: '#10b981', bg: '#ecfdf5' };
      }

      return { label: 'Adisyon', color: '#10b981', bg: '#ecfdf5' };
    } else {
      const byAdtur = fromAdtur();
      if (byAdtur) return byAdtur;

      if (order.type_label) {
        const text = String(order.type_label).toLowerCase();
        if (text.includes('paket')) return { label: order.type_label, color: '#fbbf24', bg: '#fffbeb' };
        if (text.includes('hızlı')) return { label: order.type_label, color: '#ec4899', bg: '#fdf2f8' };
        return { label: order.type_label, color: '#10b981', bg: '#ecfdf5' };
      }

      if (typeof order.sipyer !== 'undefined' && order.sipyer !== null) {
        const s = Number(order.sipyer);
        if (s === 2) return { label: 'Paket', color: '#fbbf24', bg: '#fffbeb' };
        return { label: 'Adisyon', color: '#10b981', bg: '#ecfdf5' };
      }

      return { label: 'Adisyon', color: '#10b981', bg: '#ecfdf5' };
    }
  };

  const renderItem = ({ item }) => {
    const typeInfo = getOrderTypeLabel(item);
    
    return (
      <TouchableOpacity 
        style={[styles.card, { borderColor: isClosed ? '#d1fae5' : '#ffedd5' }]}
        onPress={() => navigation.navigate('OrderDetail', { id: item.adsno || item.id, type: isClosed ? 'closed' : 'open' })}
      >
        <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
                <View style={[styles.iconBox, { backgroundColor: isClosed ? '#10b981' : '#f97316' }]}>
                    <Text style={{fontSize: 16}}>{isClosed ? '✅' : '🟠'}</Text>
                </View>
                <View>
                    <Text style={styles.orderId}>#{item.adsno || item.id}</Text>
                    <View style={[styles.typeBadge, { backgroundColor: typeInfo.bg }]}>
                        <Text style={[styles.typeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
                    </View>
                </View>
            </View>
            <View style={styles.headerRight}>
                <Text style={[styles.amountText, { color: isClosed ? '#059669' : '#c2410c' }]}>
                    {formatCurrency(item.tutar)}
                </Text>
            </View>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.detailsRow}>
            {item.masa_no && (
                <View style={styles.detailItem}>
                    <Feather name="map-pin" size={14} color="#94a3b8" />
                    <Text style={styles.detailText}>Masa: {item.masa_no}</Text>
                </View>
            )}
            {item.garson_adi && (
                <View style={styles.detailItem}>
                    <Feather name="user" size={14} color="#94a3b8" />
                    <Text style={styles.detailText}>{item.garson_adi}</Text>
                </View>
            )}
        </View>

        {(item.acilis_saati) && (
             <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                    <Feather name="clock" size={14} color="#94a3b8" />
                    <Text style={styles.detailText}>
                        {formatTime(item.acilis_saati)} 
                        {item.kapanis_saati ? ` - ${formatTime(item.kapanis_saati)}` : ''}
                    </Text>
                </View>
                {item.tarih && (
                    <View style={styles.detailItem}>
                         <Feather name="calendar" size={14} color="#94a3b8" />
                         <Text style={styles.detailText}>{item.tarih.split(' ')[0]}</Text>
                    </View>
                )}
            </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: isClosed ? '#10b981' : '#f97316' }]}>
         <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isClosed ? 'Kapalı Adisyonlar' : 'Açık Adisyonlar'}</Text>
            <View style={{width: 24}} /> 
         </View>
      </View>

      <View style={styles.controlsContainer}>
        {/* Search & Filter Inputs */}
        <View style={styles.filterRow}>
            <View style={styles.searchBox}>
                <Feather name="search" size={18} color="#94a3b8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Masa / No Ara"
                    value={filterMasa}
                    onChangeText={setFilterMasa}
                />
            </View>
        </View>
        
        <View style={styles.filterRow}>
            {/* Period Filter (Only show appropriate options) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
                {(isClosed ? ['today', 'yesterday', 'week', 'month'] : ['today', 'all']).map((p) => (
                    <TouchableOpacity 
                        key={p} 
                        onPress={() => setPeriod(p)}
                        style={[
                            styles.periodButton, 
                            period === p && { backgroundColor: isClosed ? '#10b981' : '#f97316', borderColor: isClosed ? '#10b981' : '#f97316' }
                        ]}
                    >
                        <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                            {p === 'today' ? 'Bugün' : p === 'yesterday' ? 'Dün' : p === 'week' ? 'Bu Hafta' : p === 'month' ? 'Bu Ay' : 'Tümü'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        <View style={styles.filterRow}>
             {(isClosed ? ['all', '0', '1', '3'] : ['all', '0', '1']).map((t) => (
                <TouchableOpacity 
                    key={t}
                    onPress={() => setAdturFilter(t)}
                    style={[
                        styles.typeButton, 
                        adturFilter === t && { backgroundColor: '#e2e8f0', borderColor: '#cbd5e1' }
                    ]}
                >
                    <Text style={[styles.typeText, adturFilter === t && { color: '#1e293b' }]}>
                        {t === 'all' ? 'Tümü' : t === '0' ? 'Adisyon' : t === '1' ? 'Paket' : 'Hızlı Satış'}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
      </View>

      {loading && !refreshing && page === 1 ? (
        <ActivityIndicator size="large" color={isClosed ? '#10b981' : '#f97316'} style={{marginTop: 50}} />
      ) : (
        <FlatList
            data={filteredOrders}
            renderItem={renderItem}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#94a3b8" /> : null}
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <Feather name="inbox" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyText}>Adisyon bulunamadı</Text>
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
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    color: '#fff',
  },
  controlsContainer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#1e293b',
  },
  periodScroll: {
    flexDirection: 'row',
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  periodTextActive: {
    color: '#fff',
  },
  typeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  detailText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 10,
    color: '#94a3b8',
    fontSize: 16,
  },
});
