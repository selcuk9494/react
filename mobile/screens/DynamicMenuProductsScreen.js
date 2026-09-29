import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { API_URL } from '../config';
import DateFilterComponent from '../components/DateFilterComponent';
import ReportExportActions from '../components/ReportExportActions';

export default function DynamicMenuProductsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeMenu, setIncludeMenu] = useState(false);
  const [lang, setLang] = useState('tr');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const fetchControllerRef = useRef(null);
  const reqIdRef = useRef(0);
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';

  const T = {
    title: lang === 'tr' ? 'Dinamik Menü Ürün Raporu' : 'Dynamic Menu Product Report',
    total: lang === 'tr' ? 'ÜRÜN TOPLAMI / CİRO' : 'PRODUCT TOTAL / REVENUE',
    search: lang === 'tr' ? 'PLU, ürün veya grup ara...' : 'Search PLU, product or group...',
    empty: lang === 'tr' ? 'Kayıt bulunamadı' : 'No records found',
    qty: lang === 'tr' ? 'adet' : 'qty',
    products: lang === 'tr' ? 'ürün' : 'products',
    menuOn: lang === 'tr' ? 'Dinamik menü ürünleri gösteriliyor' : 'Dynamic menu products visible',
    menuOff: lang === 'tr' ? 'Dinamik menü ürünleri gizli' : 'Dynamic menu products hidden',
    menuHint:
      lang === 'tr'
        ? 'Menü tutarı içindeki ürünlere yazılır. Ciro değişmez; filtre yalnızca menü adlarını gizler.'
        : 'Menu amounts are written onto the items inside. Revenue stays the same; the filter only hides menu names.',
    menuBadge: lang === 'tr' ? 'Dinamik menü' : 'Dynamic menu',
    noGroup: lang === 'tr' ? 'Grup yok' : 'No group',
  };

  useEffect(() => {
    const getLang = async () => {
      const storedLang = await AsyncStorage.getItem('language');
      if (storedLang) setLang(storedLang);
    };
    getLang();
  }, []);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    const myId = ++reqIdRef.current;
    const controller = new AbortController();
    fetchControllerRef.current = controller;
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const params = new URLSearchParams({
        period,
        include_menu: '1',
      });
      if (period === 'custom') {
        params.set('start_date', startDate.toISOString().split('T')[0]);
        params.set('end_date', endDate.toISOString().split('T')[0]);
      }
      const response = await axios.get(`${API_URL}/reports/dynamic-menu-products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!controller.signal.aborted && reqIdRef.current === myId) {
        setData(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') return;
      console.error(error);
      if (!controller.signal.aborted && reqIdRef.current === myId) {
        setData([]);
      }
    } finally {
      if (!controller.signal.aborted && reqIdRef.current === myId) {
        setLoading(false);
      }
    }
  };

  const handleApplyCustomDate = () => {
    setPeriod('custom');
    fetchData();
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'TRY' }).format(val || 0);

  const isMenuName = (item) => {
    const name = String(item.product_name || '').trim();
    return Boolean(item.is_dynamic_menu) || name.startsWith('*') || name.endsWith('*');
  };

  const isBarePluName = (item) => {
    const name = String(item.product_name || '').trim();
    const plu = String(item.plu ?? '').trim();
    return !name || name === plu;
  };

  const productTitle = (item) =>
    isBarePluName(item) ? (lang === 'tr' ? 'Ürün kartı yok' : 'No product card') : item.product_name;

  const searchedData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (item) =>
        String(item.product_name || '').toLowerCase().includes(q) ||
        String(item.group_name || '').toLowerCase().includes(q) ||
        String(item.plu ?? '').toLowerCase().includes(q),
    );
  }, [data, searchQuery]);

  const filteredData = useMemo(() => {
    return includeMenu
      ? searchedData
      : searchedData.filter((item) => !isMenuName(item));
  }, [searchedData, includeMenu]);

  const totalAmount = searchedData.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
  const totalQty = filteredData.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
  const hiddenMenuRows = includeMenu ? [] : searchedData.filter((item) => isMenuName(item));
  const hiddenMenuTotal = hiddenMenuRows.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
  const hiddenMenuQty = hiddenMenuRows.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
  const exportRows = [
    ...filteredData.map((item) => ({
      ...item,
      product_name: productTitle(item),
    })),
    ...(hiddenMenuTotal > 0.009
      ? [
          {
            plu: '',
            product_name: lang === 'tr' ? 'Dinamik menü tutarı' : 'Dynamic menu amount',
            group_name: '',
            price: hiddenMenuQty > 0 ? hiddenMenuTotal / hiddenMenuQty : 0,
            quantity: hiddenMenuQty,
            total: hiddenMenuTotal,
          },
        ]
      : []),
    {
      plu: '',
      product_name: lang === 'tr' ? 'TOPLAM' : 'TOTAL',
      group_name: '',
      price: '',
      quantity: totalQty + hiddenMenuQty,
      total: totalAmount,
    },
  ];

  const exportColumns = [
    { key: 'plu', label: 'PLU' },
    { key: 'product_name', label: lang === 'tr' ? 'Ürün Adı' : 'Product' },
    { key: 'group_name', label: lang === 'tr' ? 'Grup' : 'Group' },
    {
      key: 'price',
      label: lang === 'tr' ? 'Fiyat' : 'Price',
    },
    { key: 'quantity', label: lang === 'tr' ? 'Satış Adeti' : 'Qty' },
    {
      key: 'total',
      label: lang === 'tr' ? 'Toplam' : 'Total',
    },
  ];

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.pluBadge}>
          <Text style={styles.pluText}>PLU {item.plu}</Text>
        </View>
        {!!(item.is_dynamic_menu || isMenuName(item)) && (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{T.menuBadge}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.productName}>{productTitle(item)}</Text>
          <Text style={styles.groupName}>
            {isBarePluName(item)
              ? lang === 'tr'
                ? 'Satış kaydında var, ürün listesinde yok'
                : 'On the ticket, missing from the product list'
              : item.group_name || T.noGroup}
          </Text>
          <Text style={styles.metaText}>
            {Number(item.quantity) || 0} {T.qty} • {formatCurrency(item.price)}
          </Text>
        </View>
        <Text style={styles.amount}>{formatCurrency(item.total)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{T.title}</Text>
          <View style={{ width: 24 }} />
        </View>
        {loading ? (
          <View style={styles.summarySkeleton} />
        ) : (
          <>
            <Text style={styles.summaryLabel}>{T.total}</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalAmount)}</Text>
            <Text style={styles.summarySub}>
              {filteredData.length} {T.products} • {totalQty} {T.qty}
            </Text>
          </>
        )}
      </View>

      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Feather name="search" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder={T.search}
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
          lang={lang}
        />
        <TouchableOpacity
          style={[styles.toggle, includeMenu ? styles.toggleOn : styles.toggleOff]}
          onPress={() => setIncludeMenu((prev) => !prev)}
        >
          <Text style={[styles.toggleText, includeMenu && styles.toggleTextOn]}>
            {includeMenu ? T.menuOn : T.menuOff}
          </Text>
        </TouchableOpacity>
        <Text style={styles.hint}>{T.menuHint}</Text>
        <ReportExportActions title={T.title} rows={exportRows} columns={exportColumns} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredData}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.plu}-${index}`}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>{T.empty}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#7c3aed',
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', textAlign: 'center', flex: 1 },
  summaryLabel: {
    color: '#ede9fe',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  summaryValue: { color: '#fff', fontSize: 30, fontWeight: '900', textAlign: 'center' },
  summarySub: { color: '#ddd6fe', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  summarySkeleton: {
    alignSelf: 'center',
    width: 180,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(237, 233, 254, 0.4)',
  },
  controls: { padding: 16, paddingBottom: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: '#1e293b' },
  toggle: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  toggleOff: { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
  toggleOn: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  toggleText: { textAlign: 'center', fontWeight: '700', color: '#5b21b6', fontSize: 13 },
  toggleTextOn: { color: '#fff' },
  hint: { marginTop: 8, fontSize: 11, color: '#64748b', lineHeight: 16 },
  listContent: { padding: 16, paddingTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pluBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pluText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  menuBadge: {
    backgroundColor: '#ede9fe',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  menuBadgeText: { fontSize: 11, fontWeight: '700', color: '#6d28d9' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  productName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  groupName: { fontSize: 12, color: '#64748b', marginTop: 2 },
  metaText: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '800', color: '#6d28d9' },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { marginTop: 10, color: '#94a3b8', fontSize: 16 },
});
