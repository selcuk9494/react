import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, FlatList, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import DateFilterComponent from '../components/DateFilterComponent';
import ReportExportActions from '../components/ReportExportActions';

const screenWidth = Dimensions.get('window').width;

export default function PersonnelScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState('today');
  const [lang, setLang] = useState('tr');
  const fetchControllerRef = useRef(null);
  const reqIdRef = useRef(0);
  const prevPeriodRef = useRef(period);
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  
  // Custom Date States
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  useEffect(() => {
    const getLang = async () => {
      const storedLang = await AsyncStorage.getItem('language');
      if (storedLang) {
        setLang(storedLang);
      }
    };
    getLang();
  }, []);

  useEffect(() => {
    fetchData();
  }, [period, lang]);

  const fetchData = async () => {
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    const myId = ++reqIdRef.current;
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    if (prevPeriodRef.current !== period) {
      setData([]);
      prevPeriodRef.current = period;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userRaw = await AsyncStorage.getItem('user');
      let branchId = null;
      if (userRaw) {
        const user = JSON.parse(userRaw);
        branchId = user?.selected_branch_id || user?.branches?.[user?.selected_branch || 0]?.id;
      }
      
      let url = `${API_URL}/reports/performance?period=${period}`;
      if (branchId) {
        url += `&branchId=${branchId}`;
      }
      if (period === 'custom') {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        url = `${API_URL}/reports/performance?period=custom&start_date=${startStr}&end_date=${endStr}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      // Handle different data structures
      let perfData = [];
      if (Array.isArray(response.data)) {
        perfData = response.data;
      } else if (response.data && response.data.waiters) {
        perfData = response.data.waiters;
      }
      if (!controller.signal.aborted && reqIdRef.current === myId) {
        setData(perfData);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return;
      }
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

  const formatCurrency = (val) => {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'TRY' }).format(val || 0);
  };

  const totalSales = data.reduce((acc, curr) => acc + (curr.total || 0), 0);

  const T = {
    personnelPerformance: lang === 'tr' ? 'Personel Performans' : 'Personnel Performance',
    totalSales: lang === 'tr' ? 'TOPLAM SATIŞ' : 'TOTAL SALES',
    personnel: lang === 'tr' ? 'Personel' : 'Personnel',
    orders: lang === 'tr' ? 'Adet Sipariş' : 'Orders',
    noDataFound: lang === 'tr' ? 'Veri bulunamadı' : 'No data found',
  };

  const renderItem = ({ item, index }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.rankCircle}>
             <Text style={styles.rankText}>{index + 1}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.personnelName}>{item.waiter_name || item.name || T.personnel}</Text>
            <Text style={styles.orderCount}>{item.order_count || item.count || 0} {T.orders}</Text>
          </View>
          <View style={styles.amountInfo}>
             <Text style={styles.amountText}>{formatCurrency(item.total)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Summary */}
      <View style={styles.summaryContainer}>
         <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{T.personnelPerformance}</Text>
            <View style={{width: 24}} /> 
         </View>
         
         <View style={styles.summaryContent}>
            {loading ? (
              <View style={styles.summarySkeleton} />
            ) : (
              <>
            <Text style={styles.summaryLabel}>{T.totalSales}</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalSales)}</Text>
              </>
            )}
         </View>
      </View>

      {/* Filter */}
      <View style={styles.filterContainer}>
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
      </View>
      <ReportExportActions
        title={T.personnelPerformance}
        rows={data}
        columns={[
          { key: 'waiter_name', label: T.personnelPerformance, format: (value, row) => value || row.name || row.personnel_name || '-' },
          { key: 'order_count', label: 'Adisyon', format: (value, row) => value || row.count || 0 },
          { key: 'total', label: T.totalSales, format: (value) => formatCurrency(Number(value || 0)) },
        ]}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#8b5cf6" style={{marginTop: 50}} />
      ) : (
        <FlatList
            data={data}
            renderItem={renderItem}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <Feather name="users" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyText}>{T.noDataFound}</Text>
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
  summaryContainer: {
    backgroundColor: '#8b5cf6',
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#8b5cf6',
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
  summaryContent: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  summarySkeleton: {
    width: 140,
    height: 26,
    borderRadius: 999,
    backgroundColor: 'rgba(129, 140, 248, 0.35)',
  },
  summaryLabel: {
    color: '#ddd6fe',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 1,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 4,
  },
  filterContainer: {
    padding: 16,
    paddingBottom: 8,
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
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
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
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rankText: {
    color: '#7c3aed',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cardInfo: {
    flex: 1,
  },
  personnelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  orderCount: {
    fontSize: 12,
    color: '#64748b',
  },
  amountInfo: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
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
