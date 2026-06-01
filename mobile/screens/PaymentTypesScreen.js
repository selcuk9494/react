import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, FlatList, TouchableOpacity, ScrollView, Dimensions, Alert } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { PieChart } from 'react-native-chart-kit';
import DateFilterComponent from '../components/DateFilterComponent';

const screenWidth = Dimensions.get('window').width;

export default function PaymentTypesScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState('today');
  const [lang, setLang] = useState('tr');
  const [user, setUser] = useState(null);
  const fetchControllerRef = useRef(null);
  const reqIdRef = useRef(0);
  const prevPeriodRef = useRef(period);
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  
  // Translation object
  const T = {
    title: lang === 'tr' ? 'Ödeme Tipleri' : 'Payment Types',
    totalPayments: lang === 'tr' ? 'TOPLAM ÖDEME' : 'TOTAL PAYMENTS',
    transactions: lang === 'tr' ? 'İşlem' : 'Transactions',
    distribution: lang === 'tr' ? 'Dağılım' : 'Distribution',
    details: lang === 'tr' ? 'Detaylar' : 'Details',
    noData: lang === 'tr' ? 'Veri bulunamadı' : 'No data found',
    countTransactions: lang === 'tr' ? 'Adet İşlem' : 'Transactions'
  };
  
  // Custom Date States
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, [period]);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('language');
      setLang(stored || 'tr');
      const userRaw = await AsyncStorage.getItem('user');
      if (userRaw) {
        setUser(JSON.parse(userRaw));
      }
    })();
  }, []);

  const isReportAllowed = (reportId) => {
    if (!user) return false;
    if (user.is_admin) return true;
    if (user.allowed_reports === null || user.allowed_reports === undefined) return true;
    return Array.isArray(user.allowed_reports) && user.allowed_reports.includes(reportId);
  };

  const canDrilldown = useMemo(() => isReportAllowed('payment_types_detail'), [user]);

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
      
      let url = `${API_URL}/reports/payment-types?period=${period}`;
      if (branchId) {
        url += `&branchId=${branchId}`;
      }
      if (period === 'custom') {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        url = `${API_URL}/reports/payment-types?period=custom&start_date=${startStr}&end_date=${endStr}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!controller.signal.aborted && reqIdRef.current === myId) {
        setData(response.data);
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

  const totalAmount = data.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const overallCount =
    data && data.length > 0 && Number.isFinite(Number(data[0]?.overall_count))
      ? Number(data[0].overall_count)
      : data.reduce((acc, curr) => acc + (curr.count || 0), 0);

  const chartColors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  const chartData = data.map((item, index) => ({
    name: item.payment_name,
    population: item.total,
    color: chartColors[index % chartColors.length],
    legendFontColor: '#7F7F7F',
    legendFontSize: 12,
  }));

  const renderItem = ({ item, index }) => {
    const color = chartColors[index % chartColors.length];
    const percent = totalAmount > 0 ? Math.round((item.total / totalAmount) * 100) : 0;

    const handlePress = () => {
      if (!canDrilldown) {
        Alert.alert(
          lang === 'tr' ? 'Yetki Gerekli' : 'Permission Required',
          lang === 'tr'
            ? 'Ödeme tipi detaylarını görüntüleme yetkiniz yok.'
            : 'You do not have permission to view payment type details.',
        );
        return;
      }
      const params = {
        type: 'closed',
        paymentTypeMode: true,
        otip: item.otip,
        paymentName: item.payment_name,
        period,
      };
      if (period === 'custom') {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        params.start_date = startStr;
        params.end_date = endStr;
      }
      navigation.navigate('Orders', params);
    };

    const card = (
      <View style={[styles.card, { borderColor: `${color}40`, opacity: canDrilldown ? 1 : 0.9 }]}>
        <View style={styles.cardContent}>
          <View style={[styles.iconBox, { backgroundColor: `${color}20` }]}>
             <MaterialCommunityIcons name="credit-card-outline" size={24} color={color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.paymentName}>{item.payment_name}</Text>
            <Text style={styles.transactionCount}>{item.count} {T.transactions}</Text>
            
            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${percent}%`, backgroundColor: color }]} />
            </View>
          </View>
          <View style={styles.amountInfo}>
             <Text style={[styles.amountText, { color: '#10b981' }]}>{formatCurrency(item.total)}</Text>
             <View style={styles.percentBadge}>
                <Text style={styles.percentText}>%{percent}</Text>
             </View>
          </View>
        </View>
      </View>
    );

    return (
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress}>
        {card}
      </TouchableOpacity>
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
            <Text style={styles.headerTitle}>{T.title}</Text>
            <View style={{width: 24}} /> 
         </View>
         
         <View style={styles.summaryContent}>
            {loading ? (
              <View style={styles.summarySkeleton} />
            ) : (
              <>
                <Text style={styles.summaryLabel}>{T.totalPayments}</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalAmount)}</Text>
                <Text style={styles.summarySub}>{`${overallCount} ${T.countTransactions}`}</Text>
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
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#10b981" style={{marginTop: 50}} />
      ) : (
        <ScrollView style={styles.contentScroll}>
            {data.length > 0 ? (
                <>
                    <View style={styles.chartContainer}>
                        <Text style={styles.sectionTitle}>{T.distribution}</Text>
                        <PieChart
                            data={chartData}
                            width={screenWidth - 32}
                            height={220}
                            chartConfig={{
                                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                            }}
                            accessor={"population"}
                            backgroundColor={"transparent"}
                            paddingLeft={"15"}
                            center={[10, 0]}
                            absolute
                        />
                    </View>

                    <Text style={[styles.sectionTitle, { marginLeft: 16, marginTop: 16 }]}>{T.details}</Text>
                    <FlatList
                        data={data}
                        renderItem={renderItem}
                        keyExtractor={(item, index) => index.toString()}
                        scrollEnabled={false}
                        contentContainerStyle={styles.listContent}
                    />
                </>
            ) : (
                <View style={styles.emptyContainer}>
                    <Feather name="alert-circle" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyText}>{T.noData}</Text>
                </View>
            )}
            <View style={{height: 40}} />
        </ScrollView>
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
    backgroundColor: '#10b981',
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#10b981',
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
    width: 180,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(209, 250, 229, 0.6)',
  },
  summaryLabel: {
    color: '#d1fae5',
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
  summarySub: {
    color: '#ecfdf5',
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  periodTextActive: {
    color: '#fff',
  },
  contentScroll: {
    flex: 1,
  },
  chartContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
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
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardInfo: {
    flex: 1,
  },
  paymentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  transactionCount: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  amountInfo: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  percentBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  percentText: {
    color: '#4f46e5',
    fontSize: 10,
    fontWeight: '700',
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
