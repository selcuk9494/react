import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, FlatList, TouchableOpacity, ScrollView, Dimensions, TextInput } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather } from '@expo/vector-icons';
import DateFilterComponent from '../components/DateFilterComponent';

const screenWidth = Dimensions.get('window').width;

export default function DebtsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom Date States
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      
      let url = `${API_URL}/reports/debts?period=${period}`;
      if (period === 'custom') {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        url = `${API_URL}/reports/debts?period=custom&start_date=${startStr}&end_date=${endStr}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCustomDate = () => {
    setPeriod('custom');
    fetchData();
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);
  };

  const filteredData = data.filter(item => 
    (item.musteri_fullname || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDebt = filteredData.reduce((acc, curr) => acc + (Number(curr.borc) || 0), 0);

  const renderItem = ({ item }) => (
    <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('OrderDetail', { id: item.adsno, type: 'closed' })}
    >
      <View style={styles.cardContent}>
        <View style={styles.iconBox}>
           <Feather name="user" size={20} color="#f59e0b" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.customerName}>{item.musteri_fullname || 'Müşteri'}</Text>
          <Text style={styles.metaText}>{item.tarih} • {item.saat}</Text>
          <Text style={styles.subText}>Personel: {item.personel_adi || item.pers_id}</Text>
        </View>
        <View style={styles.amountInfo}>
           <Text style={styles.amountText}>{formatCurrency(item.borc)}</Text>
           <Text style={styles.adsNo}>#{item.adsno}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Borca Atılanlar</Text>
            <View style={{width: 24}} /> 
         </View>
         
         <View style={styles.summaryContent}>
            {loading ? (
              <View style={styles.summarySkeleton} />
            ) : (
              <>
                <Text style={styles.summaryLabel}>TOPLAM BORÇ</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalDebt)}</Text>
                <Text style={styles.summarySub}>{`${filteredData.length} Kayıt`}</Text>
              </>
            )}
         </View>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.searchBox}>
            <Feather name="search" size={18} color="#94a3b8" />
            <TextInput
                style={styles.searchInput}
                placeholder="Müşteri ara..."
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
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#f59e0b" style={{marginTop: 50}} />
      ) : (
        <FlatList
            data={filteredData}
            renderItem={renderItem}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <Feather name="file-text" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyText}>Kayıt bulunamadı</Text>
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
    backgroundColor: '#f59e0b',
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#f59e0b',
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
    color: '#fef3c7',
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
    color: '#fffbeb',
    fontSize: 14,
    fontWeight: '600',
  },
  controlsContainer: {
    padding: 16,
    paddingBottom: 8,
  },
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  periodButtonActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
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
    backgroundColor: '#fffbeb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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
  metaText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  subText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  amountInfo: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d97706',
  },
  adsNo: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
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
