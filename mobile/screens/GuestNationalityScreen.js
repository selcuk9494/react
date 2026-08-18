import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Feather } from '@expo/vector-icons';
import { API_URL } from '../config';
import DateFilterComponent from '../components/DateFilterComponent';
import ReportExportActions from '../components/ReportExportActions';

const toDate = (date) => date.toISOString().slice(0, 10);
const currency = (value) => new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
}).format(Number(value || 0));

export default function GuestNationalityScreen({ navigation }) {
  const [period, setPeriod] = useState('today');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async (selectedPeriod = period) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const params = { period: selectedPeriod };
      if (selectedPeriod === 'custom') {
        params.start_date = toDate(startDate);
        params.end_date = toDate(endDate);
      }
      const response = await axios.get(`${API_URL}/reports/guest-nationality`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data?.data || []);
    } catch (error) {
      console.error('Guest nationality report error:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== 'custom') fetchData();
  }, [period]);

  const rows = useMemo(() => {
    const grouped = new Map();
    data.forEach((item) => {
      const nationality = item.country_name || item.country_code || 'Belirtilmemiş';
      const row = grouped.get(nationality) || {
        nationality,
        person_count: 0,
        order_count: 0,
        total_amount: 0,
      };
      row.person_count += Number(item.person_count || 0);
      row.order_count += 1;
      row.total_amount += Number(item.total_amount || 0);
      grouped.set(nationality, row);
    });
    const totalPeople = Array.from(grouped.values()).reduce((sum, row) => sum + row.person_count, 0);
    const needle = search.trim().toLocaleLowerCase('tr-TR');
    return Array.from(grouped.values())
      .map((row) => ({ ...row, percentage: totalPeople ? row.person_count * 100 / totalPeople : 0 }))
      .filter((row) => !needle || row.nationality.toLocaleLowerCase('tr-TR').includes(needle))
      .sort((a, b) => b.person_count - a.person_count);
  }, [data, search]);

  const totalPeople = rows.reduce((sum, row) => sum + row.person_count, 0);
  const totalOrders = rows.reduce((sum, row) => sum + row.order_count, 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.total_amount, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>Kişi ve Uyruk Raporu</Text>
      </View>
      <DateFilterComponent
        period={period}
        setPeriod={setPeriod}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onApplyCustomDate={() => { setPeriod('custom'); fetchData('custom'); }}
      />
      <ReportExportActions
        title="Kişi ve Uyruk Raporu"
        rows={rows}
        columns={[
          { key: 'nationality', label: 'Milliyet' },
          { key: 'person_count', label: 'Kişi Sayısı' },
          { key: 'order_count', label: 'Adisyon Sayısı' },
          { key: 'total_amount', label: 'Adisyon Toplamı', format: currency },
          { key: 'percentage', label: 'Kişi Oranı', format: (value) => `%${Number(value || 0).toFixed(1)}` },
        ]}
      />
      <View style={styles.summary}>
        <View style={styles.summaryItem}><Text style={styles.summaryLabel}>Kişi</Text><Text style={styles.summaryValue}>{totalPeople}</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryLabel}>Adisyon</Text><Text style={styles.summaryValue}>{totalOrders}</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryLabel}>Milliyet</Text><Text style={styles.summaryValue}>{rows.length}</Text></View>
      </View>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Adisyon Toplamı</Text>
        <Text style={styles.totalValue}>{currency(totalAmount)}</Text>
      </View>
      <View style={styles.searchBox}>
        <Feather name="search" size={17} color="#94a3b8" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Milliyet ara" style={styles.input} />
      </View>
      {loading ? <ActivityIndicator style={styles.loader} size="large" color="#4f46e5" /> : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.nationality}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Kayıt bulunamadı.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.nationality}>{item.nationality}</Text>
                <Text style={styles.amount}>{currency(item.total_amount)}</Text>
              </View>
              <View style={styles.metrics}>
                <Text style={styles.metric}><Text style={styles.metricStrong}>{item.person_count}</Text> kişi</Text>
                <Text style={styles.metric}><Text style={styles.metricStrong}>{item.order_count}</Text> adisyon</Text>
                <Text style={styles.metric}>%{item.percentage.toFixed(1)}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  title: { marginLeft: 12, fontSize: 19, fontWeight: '900', color: '#0f172a' },
  summary: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  summaryItem: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryLabel: { fontSize: 11, color: '#64748b' },
  summaryValue: { fontSize: 21, fontWeight: '900', color: '#0f172a', marginTop: 3 },
  totalCard: { marginHorizontal: 16, marginTop: 8, backgroundColor: '#ecfdf5', borderRadius: 14, padding: 13, flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: '#047857', fontWeight: '700' },
  totalValue: { color: '#047857', fontWeight: '900' },
  searchBox: { flexDirection: 'row', alignItems: 'center', margin: 16, marginBottom: 6, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  input: { flex: 1, paddingVertical: 11, marginLeft: 8, color: '#0f172a' },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingTop: 8, paddingBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nationality: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  amount: { fontSize: 16, fontWeight: '900', color: '#047857' },
  metrics: { flexDirection: 'row', gap: 18, marginTop: 10 },
  metric: { color: '#64748b', fontSize: 13 },
  metricStrong: { color: '#4f46e5', fontWeight: '900' },
  empty: { textAlign: 'center', color: '#64748b', paddingTop: 40 },
});
