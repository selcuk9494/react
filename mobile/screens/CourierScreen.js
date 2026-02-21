import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, FlatList, TouchableOpacity, ScrollView, Dimensions, TextInput } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { PieChart, BarChart } from 'react-native-chart-kit';
import DateFilterComponent from '../components/DateFilterComponent';

const screenWidth = Dimensions.get('window').width;

export default function CourierScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState('today');
  const [courierFilter, setCourierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, open, closed
  const [viewMode, setViewMode] = useState('trips'); // trips, couriers
  
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
      
      let url = `${API_URL}/reports/courier-tracking?period=${period}`;
      if (period === 'custom') {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        url = `${API_URL}/reports/courier-tracking?period=custom&startDate=${startStr}&endDate=${endStr}`;
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

  const getDuration = (row) => {
    if (!row.tarih || !row.cikis) return 0;
    const start = new Date(`${row.tarih.split('T')[0]}T${row.cikis}`);
    let end = row.donus ? new Date(`${row.tarih.split('T')[0]}T${row.donus}`) : new Date();
    
    // Handle date crossing (e.g. start 23:50, end 00:10)
    if (end < start) end.setDate(end.getDate() + 1);
    
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / 60000);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    return timeStr.substring(0, 5);
  };

  const filteredData = data.filter(item => {
    const matchesCourier = (item.kurye || '').toLowerCase().includes(courierFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter;
    return matchesCourier && matchesStatus;
  });

  const openCount = filteredData.filter(i => i.status === 'open').length;
  const closedCount = filteredData.filter(i => i.status === 'closed').length;

  // Chart Data Preparation
  const pieData = [
    { name: 'Yolda', population: openCount, color: '#3b82f6', legendFontColor: '#7F7F7F', legendFontSize: 12 },
    { name: 'Döndü', population: closedCount, color: '#10b981', legendFontColor: '#7F7F7F', legendFontSize: 12 },
  ].filter(i => i.population > 0);

  // Group by Courier for stats
  const courierStats = {};
  filteredData.forEach(item => {
      const name = item.kurye || 'Bilinmeyen';
      if (!courierStats[name]) {
          courierStats[name] = { count: 0, totalDuration: 0, open: 0, closed: 0, items: [] };
      }
      courierStats[name].count++;
      courierStats[name].totalDuration += getDuration(item);
      if (item.status === 'open') courierStats[name].open++;
      else courierStats[name].closed++;
      courierStats[name].items.push(item);
  });

  const courierLabels = Object.keys(courierStats);
  const courierAvgDurations = courierLabels.map(name => 
      courierStats[name].count > 0 ? Math.round(courierStats[name].totalDuration / courierStats[name].count) : 0
  );

  const barData = {
      labels: courierLabels.length > 0 ? courierLabels : ['-'],
      datasets: [{ data: courierAvgDurations.length > 0 ? courierAvgDurations : [0] }]
  };

  const renderItem = ({ item }) => {
    const duration = getDuration(item);
    const isLate = duration > 30;
    const isOpen = item.status === 'open';

    return (
      <View style={[styles.card, isLate && styles.cardLate]}>
        <View style={styles.cardHeader}>
            <View style={[styles.iconBox, isOpen ? styles.bgBlue : styles.bgGreen]}>
                <MaterialCommunityIcons name="bike" size={20} color={isOpen ? '#2563eb' : '#059669'} />
            </View>
            <View style={styles.cardInfo}>
                <Text style={styles.courierName}>{item.kurye || 'Kurye'}</Text>
                <Text style={styles.adsNo}>Adisyon #{item.adsno}</Text>
            </View>
            <View style={[styles.statusBadge, isOpen ? styles.bgBlue : styles.bgGreen]}>
                <Text style={[styles.statusText, isOpen ? styles.textBlue : styles.textGreen]}>
                    {isOpen ? 'Yolda' : 'Döndü'}
                </Text>
            </View>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.timeRow}>
            <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>Çıkış</Text>
                <Text style={styles.timeValue}>{formatTime(item.cikis)}</Text>
            </View>
            <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>Dönüş</Text>
                <Text style={styles.timeValue}>{formatTime(item.donus)}</Text>
            </View>
            <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>Süre</Text>
                <Text style={[styles.timeValue, isLate && styles.textRed]}>{duration} dk</Text>
            </View>
        </View>
      </View>
    );
  };

  const renderCourierGroup = ({ item }) => {
      const name = item;
      const stats = courierStats[name];
      const avg = stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0;
      
      return (
          <View style={styles.groupCard}>
              <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{name}</Text>
                  <View style={styles.groupBadges}>
                      <View style={[styles.miniBadge, { backgroundColor: '#dbeafe' }]}>
                          <Text style={[styles.miniBadgeText, { color: '#1e40af' }]}>{stats.open} Yolda</Text>
                      </View>
                      <View style={[styles.miniBadge, { backgroundColor: '#d1fae5' }]}>
                          <Text style={[styles.miniBadgeText, { color: '#065f46' }]}>{stats.closed} Döndü</Text>
                      </View>
                  </View>
              </View>
              <View style={styles.groupStats}>
                  <Text style={styles.groupStatText}>{stats.count} Sefer</Text>
                  <Text style={styles.groupStatText}>Ort. {avg} dk</Text>
              </View>
              {/* Show items inside group (limited or expandable - for now just list first 3) */}
              {stats.items.slice(0, 3).map((subItem, idx) => {
                   const duration = getDuration(subItem);
                   const isLate = duration > 30;
                   return (
                       <View key={idx} style={[styles.subItemRow, isLate && { backgroundColor: '#fef2f2' }]}>
                           <Text style={styles.subItemText}>#{subItem.adsno}</Text>
                           <Text style={styles.subItemText}>{formatTime(subItem.cikis)} - {formatTime(subItem.donus)}</Text>
                           <Text style={[styles.subItemText, isLate && { color: '#dc2626', fontWeight: 'bold' }]}>{duration} dk</Text>
                       </View>
                   )
              })}
              {stats.items.length > 3 && (
                  <Text style={styles.moreText}>+ {stats.items.length - 3} kayıt daha...</Text>
              )}
          </View>
      )
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Kurye Takip</Text>
            <View style={{width: 24}} /> 
         </View>
         
         <View style={styles.viewModeContainer}>
            <TouchableOpacity 
                style={[styles.viewModeButton, viewMode === 'trips' && styles.viewModeActive]} 
                onPress={() => setViewMode('trips')}
            >
                <Text style={[styles.viewModeText, viewMode === 'trips' && styles.viewModeTextActive]}>Detay Liste</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.viewModeButton, viewMode === 'couriers' && styles.viewModeActive]} 
                onPress={() => setViewMode('couriers')}
            >
                <Text style={[styles.viewModeText, viewMode === 'couriers' && styles.viewModeTextActive]}>Kurye Bazlı</Text>
            </TouchableOpacity>
         </View>
      </View>

      <View style={styles.controlsContainer}>
         <View style={styles.searchBox}>
            <Feather name="search" size={18} color="#94a3b8" />
            <TextInput
                style={styles.searchInput}
                placeholder="Kurye ara..."
                value={courierFilter}
                onChangeText={setCourierFilter}
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
        <ActivityIndicator size="large" color="#3b82f6" style={{marginTop: 50}} />
      ) : (
        <ScrollView style={styles.scrollContainer}>
             {/* Charts Section */}
             {filteredData.length > 0 && (
                 <View style={styles.chartsContainer}>
                     <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.chartCard}>
                            <Text style={styles.chartTitle}>Durum Dağılımı</Text>
                            <PieChart
                                data={pieData}
                                width={screenWidth * 0.8}
                                height={180}
                                chartConfig={{ color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})` }}
                                accessor={"population"}
                                backgroundColor={"transparent"}
                                paddingLeft={"15"}
                                absolute
                            />
                        </View>
                        <View style={[styles.chartCard, { marginLeft: 10 }]}>
                            <Text style={styles.chartTitle}>Ortalama Süreler (dk)</Text>
                            <BarChart
                                data={barData}
                                width={Math.max(screenWidth * 0.8, courierLabels.length * 60)}
                                height={180}
                                yAxisLabel=""
                                chartConfig={{
                                    backgroundColor: "#fff",
                                    backgroundGradientFrom: "#fff",
                                    backgroundGradientTo: "#fff",
                                    decimalPlaces: 0,
                                    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                                    barPercentage: 0.7,
                                }}
                                style={{ marginVertical: 8, borderRadius: 16 }}
                            />
                        </View>
                     </ScrollView>
                 </View>
             )}

            {viewMode === 'trips' ? (
                <View style={styles.listContent}>
                    {filteredData.map((item, index) => (
                        <View key={index.toString()}>{renderItem({item})}</View>
                    ))}
                    {filteredData.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="bike" size={48} color="#cbd5e1" />
                            <Text style={styles.emptyText}>Kayıt bulunamadı</Text>
                        </View>
                    )}
                </View>
            ) : (
                <View style={styles.listContent}>
                     {courierLabels.map((name, index) => (
                         <View key={index.toString()}>{renderCourierGroup({item: name})}</View>
                     ))}
                      {courierLabels.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="account-search" size={48} color="#cbd5e1" />
                            <Text style={styles.emptyText}>Kurye bulunamadı</Text>
                        </View>
                    )}
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
  header: {
    backgroundColor: '#3b82f6',
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  viewModeActive: {
    backgroundColor: '#fff',
  },
  viewModeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dbeafe',
  },
  viewModeTextActive: {
    color: '#2563eb',
    fontWeight: 'bold',
  },
  controlsContainer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#1e293b',
  },
  filtersScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  activeFilter: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  activeFilterText: {
    color: '#fff',
  },
  scrollContainer: {
    flex: 1,
  },
  chartsContainer: {
    padding: 16,
    paddingBottom: 0,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
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
  cardLate: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bgBlue: { backgroundColor: '#eff6ff', borderColor: '#dbeafe' },
  bgGreen: { backgroundColor: '#ecfdf5', borderColor: '#d1fae5' },
  cardInfo: {
    flex: 1,
  },
  courierName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  adsNo: {
    fontSize: 12,
    color: '#64748b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  textBlue: { color: '#1d4ed8' },
  textGreen: { color: '#047857' },
  textRed: { color: '#b91c1c' },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeItem: {
    alignItems: 'center',
    flex: 1,
  },
  timeLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  groupBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  groupStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  groupStatText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  subItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  subItemText: {
    fontSize: 12,
    color: '#475569',
  },
  moreText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
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
