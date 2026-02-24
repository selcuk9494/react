import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function CashReportScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ totals: { nakit: 0, kredi_karti: 0, yemek_karti: 0, diger: 0, toplam: 0 }, rows: [], period: { start: '', end: '' } });
  const [period, setPeriod] = useState('today');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    fetchData();
  }, [period, startDate, endDate]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      let url = `${API_URL}/reports/cash-report?period=${period}`;
      if (period === 'custom') {
        const s = startDate.toISOString().split('T')[0];
        const e = endDate.toISOString().split('T')[0];
        url = `${API_URL}/reports/cash-report?period=custom&start_date=${s}&end_date=${e}`;
      }
      const response = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setData(response.data || { totals: { nakit: 0, kredi_karti: 0, yemek_karti: 0, diger: 0, toplam: 0 }, rows: [], period: { start: '', end: '' } });
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event, selectedDate, type) => {
    if (type === 'start') {
      setShowStartPicker(Platform.OS === 'ios');
      if (selectedDate) setStartDate(selectedDate);
    } else {
      setShowEndPicker(Platform.OS === 'ios');
      if (selectedDate) setEndDate(selectedDate);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Kasa Raporu</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.periodRow}>
          {[
            { id: 'today', label: 'Bugün' },
            { id: 'yesterday', label: 'Dün' },
            { id: 'week', label: 'Hafta' },
            { id: 'last7days', label: 'Son 7' },
            { id: 'month', label: 'Ay' },
            { id: 'lastmonth', label: 'Geçen Ay' },
            { id: 'custom', label: 'Özel' },
          ].map((p) => (
            <TouchableOpacity key={p.id} onPress={() => setPeriod(p.id)} style={[styles.periodButton, period === p.id && styles.periodButtonActive]}>
              <Text style={[styles.periodText, period === p.id && styles.periodTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {period === 'custom' && (
          <View style={styles.customRow}>
            <TouchableOpacity style={styles.dateBox} onPress={() => setShowStartPicker(true)}>
              <Feather name="calendar" size={16} color="#fff" />
              <Text style={styles.dateText}>{startDate.toISOString().split('T')[0]}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateBox} onPress={() => setShowEndPicker(true)}>
              <Feather name="calendar" size={16} color="#fff" />
              <Text style={styles.dateText}>{endDate.toISOString().split('T')[0]}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {showStartPicker && (
        <DateTimePicker value={startDate} mode="date" display="default" onChange={(e, d) => onDateChange(e, d, 'start')} />
      )}
      {showEndPicker && (
        <DateTimePicker value={endDate} mode="date" display="default" onChange={(e, d) => onDateChange(e, d, 'end')} />
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Toplamlar</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Nakit</Text>
              <Text style={styles.value}>{formatCurrency(data.totals.nakit)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Kredi Kartı</Text>
              <Text style={styles.value}>{formatCurrency(data.totals.kredi_karti)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Yemek Kartı</Text>
              <Text style={styles.value}>{formatCurrency(data.totals.yemek_karti)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Diğer</Text>
              <Text style={styles.value}>{formatCurrency(data.totals.diger)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={[styles.label, { fontWeight: '700' }]}>Toplam</Text>
              <Text style={[styles.value, { color: '#059669', fontWeight: '700' }]}>{formatCurrency(data.totals.toplam)}</Text>
            </View>
            <Text style={styles.periodTextInfo}>{`${data.period.start} → ${data.period.end}`}</Text>
          </View>

          {data.rows.map((item, idx) => (
            <View key={idx} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.iconCircle}>
                  <Feather name="dollar-sign" size={18} color="#0f766e" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.aciklama || 'İşlem'}</Text>
                  <Text style={styles.itemSub}>{item.tarih}</Text>
                </View>
                <Text style={styles.itemAmount}>{formatCurrency(parseFloat(item.tutar || item.toplam || 0))}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#0f766e', paddingTop: Platform.OS === 'android' ? 40 : 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#0ea5e9' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  backButton: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#0ea5e9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  periodRow: { flexDirection: 'row', paddingHorizontal: 16 },
  periodButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#115e59', marginRight: 8 },
  periodButtonActive: { backgroundColor: '#10b981' },
  periodText: { color: '#e5e7eb', fontSize: 12, fontWeight: '600' },
  periodTextActive: { color: '#fff' },
  customRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 8 },
  dateBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#115e59', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginRight: 8 },
  dateText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  contentInner: { padding: 16 },
  summaryCard: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#d1fae5', borderRadius: 12, padding: 16, marginBottom: 12 },
  summaryTitle: { color: '#047857', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  label: { color: '#0f766e', fontSize: 13 },
  value: { color: '#1f2937', fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#d1fae5', marginVertical: 8 },
  periodTextInfo: { color: '#64748b', fontSize: 11, marginTop: 8 },
  itemCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginBottom: 10 },
  itemHeader: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  itemTitle: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  itemSub: { color: '#64748b', fontSize: 12 },
  itemAmount: { color: '#059669', fontSize: 14, fontWeight: '700' },
});
