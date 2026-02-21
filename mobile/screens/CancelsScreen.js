import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, FlatList, TouchableOpacity, ScrollView, Dimensions, TextInput } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { PieChart } from 'react-native-chart-kit';
import DateFilterComponent from '../components/DateFilterComponent';

const screenWidth = Dimensions.get('window').width;

export default function CancelsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState('today');
  const [filterType, setFilterType] = useState('all');
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
      
      let url = `${API_URL}/reports/cancelled-items?period=${period}`;
      if (period === 'custom') {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        url = `${API_URL}/reports/cancelled-items?period=custom&startDate=${startStr}&endDate=${endStr}`;
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

  const filteredData = data
    .filter(item => (item.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(item => filterType === 'all' ? true : item.type === filterType)
    .sort((a, b) => b.quantity - a.quantity);

  const totalCancelled = data.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

  // Prepare Pie Data for Types
  const typeAgg = { iptal: 0, iade: 0, ikram: 0 };
  data.forEach(item => {
    if (typeAgg[item.type] !== undefined) {
        typeAgg[item.type] += item.quantity;
    }
  });

  const pieData = [
    { name: 'İptal', population: typeAgg.iptal, color: '#EF4444', legendFontColor: '#7F7F7F', legendFontSize: 12 },
    { name: 'İade', population: typeAgg.iade, color: '#F59E0B', legendFontColor: '#7F7F7F', legendFontSize: 12 },
    { name: 'İkram', population: typeAgg.ikram, color: '#10B981', legendFontColor: '#7F7F7F', legendFontSize: 12 },
  ].filter(item => item.population > 0);

  const renderItem = ({ item }) => {
    const color = item.type === 'iptal' ? '#EF4444' : item.type === 'iade' ? '#F59E0B' : '#10B981';
    
    return (
      <TouchableOpacity 
        style={[styles.card, { borderLeftColor: color }]}
        onPress={() => {
            if (item.adsno) {
                navigation.navigate('OrderDetail', { id: item.adsno, type: 'closed' });
            } else {
                alert('Adisyon numarası bulunamadı');
            }
        }}
        disabled={!item.adsno}
      >
        <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: `${color}20` }]}>
                <Feather name="x-circle" size={20} color={color} />
            </View>
            <View style={styles.cardInfo}>
                <Text style={styles.productName}>{item.product_name}</Text>
                <Text style={styles.metaText}>
                    {item.quantity} Adet • {item.waiter_name}
                </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${color}20` }]}>
                <Text style={[styles.badgeText, { color: color }]}>{item.type.toUpperCase()}</Text>
            </View>
        </View>
        {item.reason && (
            <View style={styles.reasonBox}>
                <Feather name="info" size={14} color="#94a3b8" />
                <Text style={styles.reasonText}>{item.reason}</Text>
            </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>İptal & İade</Text>
            <View style={{width: 24}} /> 
         </View>
         
         <View style={styles.summaryContent}>
            <Text style={styles.summaryValue}>{totalCancelled}</Text>
            <Text style={styles.summaryLabel}>TOPLAM İŞLEM</Text>
         </View>
      </View>

      <View style={styles.controlsContainer}>
        {/* Period Filter */}
        <DateFilterComponent
          period={period}
          setPeriod={setPeriod}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          onApplyCustomDate={handleApplyCustomDate}
        />

        {/* Type Filter */}
        <View style={styles.typeFilterContainer}>
            {['all', 'iptal', 'iade', 'ikram'].map((t) => (
                <TouchableOpacity 
                    key={t}
                    onPress={() => setFilterType(t)}
                    style={[styles.typeButton, filterType === t && styles.typeButtonActive]}
                >
                    <Text style={[styles.typeText, filterType === t && styles.typeTextActive]}>
                        {t === 'all' ? 'Tümü' : t === 'iptal' ? 'İptal' : t === 'iade' ? 'İade' : 'İkram'}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
            <Feather name="search" size={20} color="#94a3b8" />
            <TextInput
                style={styles.searchInput}
                placeholder="Ürün ara..."
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#EF4444" style={{marginTop: 50}} />
      ) : (
        <FlatList
            ListHeaderComponent={
                pieData.length > 0 ? (
                    <View style={styles.chartContainer}>
                        <PieChart
                            data={pieData}
                            width={screenWidth - 32}
                            height={200}
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
                ) : null
            }
            data={filteredData}
            renderItem={renderItem}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <Feather name="check-circle" size={48} color="#cbd5e1" />
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
    backgroundColor: '#EF4444',
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
  summaryValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    marginBottom: 2,
  },
  summaryLabel: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  controlsContainer: {
    padding: 16,
    paddingBottom: 0,
  },
  periodScroll: {
    flexDirection: 'row',
    marginBottom: 12,
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
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  periodTextActive: {
    color: '#fff',
  },
  typeFilterContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeButtonActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  typeTextActive: {
    color: '#b91c1c',
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
    color: '#1f2937',
  },
  listContent: {
    padding: 16,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
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
  cardInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  reasonBox: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
  },
  reasonText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#64748b',
    flex: 1,
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
