import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import DateFilterComponent from '../components/DateFilterComponent';

export default function CashReportScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ 
    totals: { toplam: 0 }, 
    rows: [], 
    period: { start: '', end: '' } 
  });
  const [period, setPeriod] = useState('today');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [lang, setLang] = useState('tr');
  const fetchControllerRef = useRef(null);
  const reqIdRef = useRef(0);
  const prevKeyRef = useRef('');

  const T = {
    tr: {
      title: 'Kasa Raporu',
      today: 'Bugün',
      yesterday: 'Dün',
      week: 'Hafta',
      month: 'Ay',
      custom: 'Özel',
      total: 'Toplam Satış',
      cashNo: 'Kasa No',
      tc: 'İşlem Sayısı',
      amount: 'Tutar',
      noData: 'Kayıt bulunamadı',
      error: 'Veri yüklenemedi',
    },
    en: {
      title: 'Cash Report',
      today: 'Today',
      yesterday: 'Yesterday',
      week: 'Week',
      month: 'Month',
      custom: 'Custom',
      total: 'Total Sales',
      cashNo: 'Cash No',
      tc: 'Trans. Count',
      amount: 'Amount',
      noData: 'No records found',
      error: 'Failed to load data',
    }
  }[lang];

  useEffect(() => {
    const init = async () => {
      const storedLang = await AsyncStorage.getItem('language');
      if (storedLang) setLang(storedLang);
      fetchData();
    };
    init();
  }, [period, startDate, endDate]);

  const handleApplyCustomDate = () => {
    setPeriod('custom');
    fetchData();
  };

  const fetchData = async () => {
    let myId = 0;
    let controller = null;
    try {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
      }
      myId = ++reqIdRef.current;
      controller = new AbortController();
      fetchControllerRef.current = controller;

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const key = `${period}|${period === 'custom' ? `${startStr}|${endStr}` : ''}`;
      if (prevKeyRef.current !== key) {
        setData({ totals: { toplam: 0 }, rows: [], period: { start: '', end: '' } });
        prevKeyRef.current = key;
      }

      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const userRaw = await AsyncStorage.getItem('user');
      let branchId = null;
      if (userRaw) {
        const user = JSON.parse(userRaw);
        branchId = user?.selected_branch_id || user?.branches?.[user?.selected_branch || 0]?.id;
      }
      
      let url = `${API_URL}/reports/cash-report?period=${period}`;
      if (branchId) url += `&branchId=${branchId}`;
      if (period === 'custom') {
        url += `&start_date=${startStr}&end_date=${endStr}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!controller.signal.aborted && reqIdRef.current === myId) {
        setData(response.data);
      }
    } catch (e) {
      if (e?.name === 'AbortError' || e?.code === 'ERR_CANCELED') {
        return;
      }
      console.error(e);
      Alert.alert('Hata', T.error);
    } finally {
      if (controller && !controller.signal.aborted && reqIdRef.current === myId) {
        setLoading(false);
      }
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-US', { 
      style: 'currency', 
      currency: 'TRY' 
    }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      // Eğer veritabanından ISO formatında (2021-02-25T...) geliyorsa doğrudan Date nesnesi oluşturulabilir
      // Ancak görseldeki gibi "2016-01-23" şeklinde sade geliyorsa yine Date nesnesi kabul eder.
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        // Geçersiz tarihse string'i temizle ve döndür
        return String(dateStr).split('T')[0];
      }
      return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
    } catch (e) { 
      return String(dateStr); 
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{T.title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
          {['today', 'yesterday', 'week', 'month', 'custom'].map(p => (
            <TouchableOpacity 
              key={p} 
              onPress={() => setPeriod(p)}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{T[p]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
        <ActivityIndicator size="large" color="#0f766e" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.content}>
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{T.total}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(data?.totals?.toplam)}</Text>
            </View>
            <Text style={styles.periodInfo}>
              {formatDate(data?.period?.start)} - {formatDate(data?.period?.end)}
            </Text>
          </View>

          {/* List */}
          {data?.rows?.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="info" size={40} color="#cbd5e1" />
              <Text style={styles.emptyText}>{T.noData}</Text>
            </View>
          ) : (
            data.rows.map((row, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemIcon}>
                  <Feather name="database" size={20} color="#0f766e" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemDate}>{formatDate(row.tarih)}</Text>
                  <Text style={styles.itemSub}>{T.cashNo}: {row.kasa} • {T.tc}: {row.tc || 0}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemAmount}>{formatCurrency(parseFloat(row.tutar))}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#0f766e', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 15 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  periodScroll: { marginTop: 15, paddingHorizontal: 15 },
  content: { flex: 1, padding: 15 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 15, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  summaryValue: { color: '#0f172a', fontSize: 22, fontWeight: '800' },
  periodInfo: { color: '#94a3b8', fontSize: 12, marginTop: 10 },
  itemCard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  itemIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemInfo: { flex: 1 },
  itemDate: { color: '#1e293b', fontSize: 15, fontWeight: '700' },
  itemSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  itemRight: { alignItems: 'flex-end' },
  itemAmount: { color: '#059669', fontSize: 16, fontWeight: '800' },
  emptyBox: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#94a3b8', marginTop: 10, fontSize: 15 },
});
