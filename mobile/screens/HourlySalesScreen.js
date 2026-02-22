import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import DateFilterComponent from '../components/DateFilterComponent';

const screenWidth = Dimensions.get('window').width;

export default function HourlySalesScreen({ navigation }) {
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
      
      let url = `${API_URL}/reports/sales-chart?period=${period}`;
      if (period === 'custom') {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        url = `${API_URL}/reports/sales-chart?period=custom&start_date=${startStr}&end_date=${endStr}`;
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

  // Prepare Chart Data
  const chartLabels = data.map(item => {
    // Format label based on period
    const date = item.date || item.tarih;
    if (!date) return '';
    if (period === 'today' || period === 'yesterday') {
        return date.split(' ')[1]?.substring(0, 5) || date; // HH:mm
    }
    return date.split('-').slice(1).join('/'); // MM/DD
  });
  
  const chartValues = data.map(item => item.total || item.toplam || 0);

  const chartData = {
    labels: chartLabels.length > 0 ? chartLabels : ['-'],
    datasets: [
      {
        data: chartValues.length > 0 ? chartValues : [0]
      }
    ]
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Feather name="arrow-left" size={24} color="#334155" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Satış Grafiği</Text>
            <View style={{width: 24}} /> 
         </View>
      </View>

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
        <ActivityIndicator size="large" color="#ef4444" style={{marginTop: 50}} />
      ) : (
        <ScrollView style={styles.content}>
            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Satış Trendi</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <BarChart
                        data={chartData}
                        width={Math.max(screenWidth - 48, chartLabels.length * 50)}
                        height={300}
                        yAxisLabel="₺"
                        chartConfig={{
                            backgroundColor: "#fff",
                            backgroundGradientFrom: "#fff",
                            backgroundGradientTo: "#fff",
                            decimalPlaces: 0,
                            color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                            style: {
                                borderRadius: 16
                            },
                            barPercentage: 0.7,
                        }}
                        style={{
                            marginVertical: 8,
                            borderRadius: 16
                        }}
                        verticalLabelRotation={30}
                    />
                </ScrollView>
            </View>
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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
  },
  filterContainer: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  periodScroll: {
    flexDirection: 'row',
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  periodButtonActive: {
    backgroundColor: '#ef4444',
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  periodTextActive: {
    color: '#fff',
  },
  content: {
    padding: 16,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 20,
    marginLeft: 10,
  },
});
