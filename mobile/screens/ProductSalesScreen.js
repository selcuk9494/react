import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, FlatList, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather } from '@expo/vector-icons';
import DateFilterComponent from '../components/DateFilterComponent';
import ReportExportActions from '../components/ReportExportActions';

export default function ProductSalesScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productOrders, setProductOrders] = useState([]);
  const [productOrdersLoading, setProductOrdersLoading] = useState(false);
  const [sortBy, setSortBy] = useState('total');
  const [sortDir, setSortDir] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState('today');
  
  // Custom Date States
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, [period, selectedGroupIds, selectedProduct]);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchProductOrders();
  }, [period, selectedProduct]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      
      const params = new URLSearchParams({ period });
      if (period === 'custom') {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        params.set('start_date', startStr);
        params.set('end_date', endStr);
      }
      if (selectedGroupIds.length) params.set('group_ids', selectedGroupIds.join(','));
      if (selectedProduct?.plu) params.set('plu', String(selectedProduct.plu));

      const response = await axios.get(`${API_URL}/reports/product-sales?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${API_URL}/reports/product-groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchProductOrders = async () => {
    if (!selectedProduct?.plu) {
      setProductOrders([]);
      return;
    }

    setProductOrdersLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const params = new URLSearchParams({
        plu: String(selectedProduct.plu),
        period,
      });
      if (period === 'custom') {
        params.set('start_date', startDate.toISOString().split('T')[0]);
        params.set('end_date', endDate.toISOString().split('T')[0]);
      }

      const response = await axios.get(`${API_URL}/reports/product-sales/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProductOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error(error);
      setProductOrders([]);
      Alert.alert('Hata', 'Ürüne ait adisyonlar alınamadı.');
    } finally {
      setProductOrdersLoading(false);
    }
  };

  const handleApplyCustomDate = () => {
    setPeriod('custom');
    fetchData();
  };

  const asNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const filteredData = data.filter(item => {
    const q = searchQuery.toLowerCase();
    return item.product_name?.toLowerCase().includes(q) || String(item.plu || '').includes(q);
  });

  const sortedData = useMemo(() => {
    const rows = [...filteredData];
    rows.sort((a, b) => {
      const aVal = sortBy === 'quantity' ? asNumber(a.quantity) : asNumber(a.total);
      const bVal = sortBy === 'quantity' ? asNumber(b.quantity) : asNumber(b.total);
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return rows;
  }, [filteredData, sortBy, sortDir]);

  const totalSales = filteredData.reduce((acc, curr) => acc + asNumber(curr.total), 0);
  const totalQty = filteredData.reduce((acc, curr) => acc + asNumber(curr.quantity), 0);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);
  };

  const toggleGroup = (id) => {
    setSelectedGroupIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const openOrderDetail = (order) => {
    navigation.navigate('OrderDetail', {
      id: order.adsno,
      type: order.status || 'closed',
      adtur: order.adtur,
    });
  };

  const renderProductOrders = () => {
    if (!selectedProduct?.plu) return null;

    return (
      <View style={styles.ordersPanel}>
        <View style={styles.ordersHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ordersTitle}>Satıldığı Adisyonlar</Text>
            <Text style={styles.ordersSubtitle}>{selectedProduct.product_name || `PLU ${selectedProduct.plu}`}</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setSelectedProduct(null);
              setProductOrders([]);
            }}
          >
            <Feather name="x" size={18} color="#475569" />
          </TouchableOpacity>
        </View>

        {productOrdersLoading ? (
          <ActivityIndicator size="small" color="#4f46e5" style={{ marginVertical: 18 }} />
        ) : productOrders.length === 0 ? (
          <Text style={styles.emptyOrdersText}>Bu ürün için adisyon bulunamadı.</Text>
        ) : (
          productOrders.map((order, idx) => (
            <TouchableOpacity
              key={`${order.status}-${order.adsno}-${order.adtur}-${idx}`}
              style={styles.orderRow}
              onPress={() => openOrderDetail(order)}
            >
              <View style={[styles.orderNoBadge, order.status === 'open' && styles.orderNoBadgeOpen]}>
                <Text style={styles.orderNoText}>#{order.adsno}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderTitle}>
                  {order.masano ? `Masa ${order.masano}` : 'Adisyon'} • {order.status === 'open' ? 'Açık' : 'Kapalı'}
                </Text>
                <Text style={styles.orderMeta}>
                  {order.tarih || '-'} {order.saat ? `• ${String(order.saat).slice(0, 5)}` : ''} • {asNumber(order.quantity)} adet
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.orderAmount}>{formatCurrency(order.total)}</Text>
                <Text style={styles.orderDetailText}>Detay</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };

  const renderItem = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.card, selectedProduct?.plu === item.plu && styles.cardSelected]}
      onPress={() => item.plu && setSelectedProduct({ plu: item.plu, product_name: item.product_name })}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{index + 1}</Text>
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.product_name}</Text>
          <Text style={styles.productMeta}>
            {asNumber(item.quantity)} Adet • {totalSales > 0 ? ((asNumber(item.total) / totalSales) * 100).toFixed(1) : '0.0'}% Pay
          </Text>
          {item.group_name ? <Text style={styles.groupName}>{item.group_name}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.totalAmount}>{formatCurrency(item.total)}</Text>
          <Text style={styles.detailHint}>Adisyonlar</Text>
        </View>
      </View>
      <View style={styles.progressBarBg}>
        <View 
          style={[
            styles.progressBarFill, 
            { width: `${totalSales > 0 ? Math.min(100, (asNumber(item.total) / totalSales) * 100) : 0}%` }
          ]} 
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Ürün Satışları</Text>
            <View style={{width: 24}} /> 
        </View>
        <View style={styles.summaryRow}>
            {loading ? (
              <View style={styles.summarySkeletonRow}>
                <View style={styles.summarySkeleton} />
                <View style={styles.summarySkeleton} />
              </View>
            ) : (
              <>
                <View>
                    <Text style={styles.summaryLabel}>Toplam Satış</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(totalSales)}</Text>
                </View>
                <View style={{alignItems: 'flex-end'}}>
                    <Text style={styles.summaryLabel}>Toplam Adet</Text>
                    <Text style={styles.summaryValue}>{totalQty}</Text>
                </View>
              </>
            )}
        </View>
      </View>

      {/* Search & Filter */}
      <View style={styles.filterContainer}>
        <View style={styles.searchBox}>
            <Feather name="search" size={20} color="#9ca3af" />
            <TextInput 
                style={styles.searchInput}
                placeholder="Ürün ara..."
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
        </View>
        <DateFilterComponent
          period={period}
          setPeriod={setPeriod}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          onApplyCustomDate={handleApplyCustomDate}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll} contentContainerStyle={styles.groupScrollContent}>
          <TouchableOpacity
            style={[styles.chip, selectedGroupIds.length === 0 && styles.chipActive]}
            onPress={() => setSelectedGroupIds([])}
          >
            <Text style={[styles.chipText, selectedGroupIds.length === 0 && styles.chipTextActive]}>Tümü</Text>
          </TouchableOpacity>
          {groups.map((group) => {
            const active = selectedGroupIds.includes(group.id);
            return (
              <TouchableOpacity
                key={group.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleGroup(group.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{group.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'total' && styles.sortButtonActive]}
            onPress={() => setSortBy('total')}
          >
            <Text style={[styles.sortText, sortBy === 'total' && styles.sortTextActive]}>Tutar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'quantity' && styles.sortButtonActive]}
            onPress={() => setSortBy('quantity')}
          >
            <Text style={[styles.sortText, sortBy === 'quantity' && styles.sortTextActive]}>Adet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortIconButton} onPress={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}>
            <Feather name="repeat" size={16} color="#475569" />
          </TouchableOpacity>
          {selectedProduct?.plu ? (
            <TouchableOpacity style={styles.clearProductButton} onPress={() => setSelectedProduct(null)}>
              <Text style={styles.clearProductText}>PLU {selectedProduct.plu} temizle</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <ReportExportActions
        title="Ürün Satışları"
        rows={sortedData}
        columns={[
          { key: 'product_name', label: 'Ürün' },
          { key: 'group_name', label: 'Grup' },
          { key: 'plu', label: 'PLU' },
          { key: 'quantity', label: 'Adet', format: (value) => asNumber(value) },
          { key: 'total', label: 'Toplam', format: (value) => formatCurrency(asNumber(value)) },
        ]}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={sortedData}
          renderItem={renderItem}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderProductOrders}
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
  summaryContainer: {
    backgroundColor: '#4f46e5',
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summarySkeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  summarySkeleton: {
    width: 120,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(239, 246, 255, 0.5)',
  },
  summaryLabel: {
    color: '#e0e7ff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  filterContainer: {
    padding: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  periodScroll: {
    flexDirection: 'row',
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  periodButtonActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  periodTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardSelected: {
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    color: '#4f46e5',
    fontWeight: '700',
    fontSize: 14,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  productMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  groupName: {
    fontSize: 11,
    color: '#4f46e5',
    fontWeight: '700',
    marginTop: 2,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  detailHint: {
    fontSize: 10,
    color: '#4f46e5',
    fontWeight: '700',
    marginTop: 3,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4f46e5',
    borderRadius: 3,
  },
  groupScroll: {
    marginTop: 12,
  },
  groupScrollContent: {
    paddingRight: 12,
  },
  chip: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  chipTextActive: {
    color: '#fff',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  sortButton: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    marginRight: 8,
  },
  sortButtonActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  sortText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  sortTextActive: {
    color: '#4f46e5',
  },
  sortIconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearProductButton: {
    marginLeft: 8,
    height: 36,
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
  },
  clearProductText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  ordersPanel: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  ordersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ordersTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#312e81',
  },
  ordersSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyOrdersText: {
    textAlign: 'center',
    color: '#64748b',
    fontWeight: '700',
    paddingVertical: 18,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 10,
  },
  orderNoBadge: {
    minWidth: 48,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  orderNoBadgeOpen: {
    backgroundColor: '#f97316',
  },
  orderNoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  orderTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  orderMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 3,
  },
  orderAmount: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
  },
  orderDetailText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#4f46e5',
    marginTop: 2,
  },
});
