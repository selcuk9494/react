import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, FlatList, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateFilterComponent from '../components/DateFilterComponent';
import ReportExportActions from '../components/ReportExportActions';

const screenWidth = Dimensions.get('window').width;
const START_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
  const value = `${String(hour).padStart(2, '0')}:00`;
  return { label: value, value };
});
const END_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
  const value = `${String(hour).padStart(2, '0')}:59`;
  return { label: value, value };
});

export default function DiscountScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState('today');
  const [lang, setLang] = useState('tr');
  const fetchControllerRef = useRef(null);
  const reqIdRef = useRef(0);
  const prevPeriodRef = useRef(period);
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  
  // Translation object
  const T = {
    title: lang === 'tr' ? 'İndirimler' : 'Discounts',
    totalDiscount: lang === 'tr' ? 'TOPLAM İNDİRİM' : 'TOTAL DISCOUNT',
    records: lang === 'tr' ? 'Kayıt' : 'Records',
    discount: lang === 'tr' ? 'İndirim' : 'Discount',
    amount: lang === 'tr' ? 'Tutar' : 'Amount',
    customer: lang === 'tr' ? 'Müşteri' : 'Customer',
    noData: lang === 'tr' ? 'Veri bulunamadı' : 'No data found'
  };
  
  // Custom Date States
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    fetchData();
  }, [period, startTime, endTime]);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('language');
      setLang(stored || 'tr');
    })();
  }, []);

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
      
      let url = `${API_URL}/reports/discount?period=${period}`;
      if (branchId) {
        url += `&branchId=${branchId}`;
      }
      if (period === 'custom') {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        url = `${API_URL}/reports/discount?period=custom&start_date=${startStr}&end_date=${endStr}`;
      }
      if (startTime) {
        url += `&start_time=${encodeURIComponent(startTime)}`;
      }
      if (endTime) {
        url += `&end_time=${encodeURIComponent(endTime)}`;
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

  const totalDiscount = data.reduce((acc, curr) => {
    const discount = curr.iskonto || curr.total_discount || curr.discount || 0;
    return acc + (parseFloat(discount) || 0);
  }, 0);
  const exportColumns = [
    { key: 'adsno', label: 'Adisyon No' },
    { key: 'customer_name', label: T.customer },
    { key: 'tarih', label: 'Tarih' },
    { key: 'kapanis_saati', label: 'Kapanış' },
    { key: 'tutar', label: T.amount, format: (value) => formatCurrency(Number(value || 0)) },
    { key: 'iskonto', label: T.discount, format: (value) => formatCurrency(Number(value || 0)) },
  ];

  const renderItem = ({ item, index }) => {
    const discountAmount = item.iskonto || item.discount || 0;
    const orderAmount = item.tutar || item.total || 0;
    const orderNo = item.adsno || item.order_no || index + 1;
    const customerName = item.customer_name || item.mustid || T.customer;
    const orderDate = item.tarih || item.date || '';
    const closingTime = item.kapanis_saati ? String(item.kapanis_saati).slice(0, 5) : '';
    const orderId = item.adsno || item.order_no;

    return (
      <TouchableOpacity
        style={styles.card}
        disabled={!orderId}
        onPress={() => {
          if (!orderId) return;
          navigation.navigate('OrderDetail', {
            id: orderId,
            type: 'closed',
          });
        }}
      >
        <View style={styles.cardContent}>
          <View style={styles.iconBox}>
             <Text style={styles.orderNo}>{orderNo}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.customerName}>{customerName}</Text>
            <Text style={styles.dateText}>{closingTime ? `${orderDate} • ${closingTime}` : orderDate}</Text>
            <Text style={styles.totalText}>{T.amount}: {formatCurrency(parseFloat(orderAmount))}</Text>
          </View>
          <View style={styles.amountInfo}>
             <Text style={styles.discountLabel}>{T.discount}</Text>
             <Text style={styles.amountText}>{formatCurrency(parseFloat(discountAmount))}</Text>
          </View>
        </View>
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
                <Text style={styles.summaryLabel}>{T.totalDiscount}</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalDiscount)}</Text>
                <Text style={styles.summarySub}>{`${data.length} ${T.records}`}</Text>
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
      <ReportExportActions title={T.title} columns={exportColumns} rows={data} />
      <View style={styles.timeFilterContainer}>
        <View style={styles.timeField}>
          <Text style={styles.timeLabel}>Başlangıç</Text>
          <View style={styles.timePickerContainer}>
            <Picker
              selectedValue={startTime}
              onValueChange={setStartTime}
              style={styles.timePicker}
              itemStyle={styles.timePickerItem}
            >
              <Picker.Item label="Tümü" value="" />
              {START_HOUR_OPTIONS.map((option) => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.timeField}>
          <Text style={styles.timeLabel}>Bitiş</Text>
          <View style={styles.timePickerContainer}>
            <Picker
              selectedValue={endTime}
              onValueChange={setEndTime}
              style={styles.timePicker}
              itemStyle={styles.timePickerItem}
            >
              <Picker.Item label="Tümü" value="" />
              {END_HOUR_OPTIONS.map((option) => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
          </View>
        </View>
        {(startTime || endTime) && (
          <TouchableOpacity style={styles.clearTimeButton} onPress={() => { setStartTime(''); setEndTime(''); }}>
            <Text style={styles.clearTimeText}>Temizle</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#f97316" style={{marginTop: 50}} />
      ) : (
        <FlatList
            data={data}
            renderItem={renderItem}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <Feather name="tag" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyText}>{T.noData}</Text>
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
    backgroundColor: '#f97316', // Orange
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#f97316',
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
    width: 160,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(254, 243, 199, 0.6)',
  },
  summaryLabel: {
    color: '#ffedd5',
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
    color: '#fff7ed',
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  timeFilterContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  timeField: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  timePickerContainer: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  timePicker: {
    height: 42,
    color: '#1e293b',
  },
  timePickerItem: {
    fontSize: 13,
    color: '#1e293b',
  },
  clearTimeButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearTimeText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: 'bold',
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
    backgroundColor: '#f97316',
    borderColor: '#f97316',
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
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  orderNo: {
    color: '#c2410c',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cardInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  totalText: {
    fontSize: 12,
    color: '#64748b',
  },
  amountInfo: {
    alignItems: 'flex-end',
  },
  discountLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 2,
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ea580c',
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
