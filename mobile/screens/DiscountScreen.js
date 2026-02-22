import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, FlatList, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import DateFilterComponent from '../components/DateFilterComponent';

const screenWidth = Dimensions.get('window').width;

export default function DiscountScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState('today');
  
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
      
      let url = `${API_URL}/reports/discount?period=${period}`;
      if (period === 'custom') {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        url = `${API_URL}/reports/discount?period=custom&start_date=${startStr}&end_date=${endStr}`;
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

  const totalDiscount = data.reduce((acc, curr) => {
    const discount = curr.iskonto || curr.total_discount || curr.discount || 0;
    return acc + (parseFloat(discount) || 0);
  }, 0);

  const renderItem = ({ item, index }) => {
    const discountAmount = item.iskonto || item.discount || 0;
    const orderAmount = item.tutar || item.total || 0;
    const orderNo = item.adsno || item.order_no || index + 1;
    const customerName = item.customer_name || item.mustid || 'Müşteri';
    const orderDate = item.tarih || item.date || '';
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
            <Text style={styles.dateText}>{orderDate}</Text>
            <Text style={styles.totalText}>Tutar: {formatCurrency(parseFloat(orderAmount))}</Text>
          </View>
          <View style={styles.amountInfo}>
             <Text style={styles.discountLabel}>İndirim</Text>
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
            <Text style={styles.headerTitle}>İndirimler</Text>
            <View style={{width: 24}} /> 
         </View>
         
         <View style={styles.summaryContent}>
            {loading ? (
              <View style={styles.summarySkeleton} />
            ) : (
              <>
                <Text style={styles.summaryLabel}>TOPLAM İNDİRİM</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalDiscount)}</Text>
                <Text style={styles.summarySub}>{`${data.length} Kayıt`}</Text>
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
                    <Text style={styles.emptyText}>Veri bulunamadı</Text>
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
