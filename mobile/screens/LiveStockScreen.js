import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, FlatList, TouchableOpacity, RefreshControl, TextInput, ScrollView } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather } from '@expo/vector-icons';

export default function LiveStockScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState(['Tümü']);
  const [selectedGroup, setSelectedGroup] = useState('Tümü');
  const [sortBy, setSortBy] = useState('sales'); // 'sales' | 'remaining'
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchData();
    
    // Auto refresh every 30 seconds
    intervalRef.current = setInterval(fetchData, 30000);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = JSON.parse(await AsyncStorage.getItem('user'));
      const branchId = userData.selected_branch_id;

      if (!branchId) return;

      const response = await axios.get(`${API_URL}/stock/live?branchId=${branchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const items = response.data.items || [];
      setData(items);
      
      // Extract groups
      const uniqueGroups = ['Tümü', ...new Set(items.map(i => i.group).filter(Boolean))];
      setGroups(uniqueGroups);
      
      applyFilters(items, searchQuery, selectedGroup, sortBy);
      
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = (items, query, group, sort) => {
    let filtered = [...items];

    // Search
    if (query) {
        filtered = filtered.filter(item => 
            item.name.toLowerCase().includes(query.toLowerCase())
        );
    }

    // Group
    if (group !== 'Tümü') {
        filtered = filtered.filter(item => item.group === group);
    }

    // Sort
    if (sort === 'sales') {
        filtered.sort((a, b) => (b.sold + b.open) - (a.sold + a.open));
    } else if (sort === 'remaining') {
        filtered.sort((a, b) => a.remaining - b.remaining);
    }

    setFilteredData(filtered);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    applyFilters(data, text, selectedGroup, sortBy);
  };

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    applyFilters(data, searchQuery, group, sortBy);
  };

  const toggleSort = () => {
    const newSort = sortBy === 'sales' ? 'remaining' : 'sales';
    setSortBy(newSort);
    applyFilters(data, searchQuery, selectedGroup, newSort);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderItem = ({ item }) => {
    const totalSold = item.sold + item.open;
    const remaining = item.remaining;
    
    const isLow = remaining < 5;
    const isCritical = remaining <= 0;

    return (
      <View style={styles.row}>
        <View style={styles.nameCol}>
            <Text style={styles.nameText}>{item.name}</Text>
            <Text style={styles.groupText}>{item.group}</Text>
        </View>
        <View style={styles.valCol}>
            <Text style={styles.valText}>{item.initial}</Text>
        </View>
        <View style={styles.valCol}>
            <Text style={styles.soldText}>{item.sold}</Text>
        </View>
        <View style={styles.valCol}>
            <Text style={styles.openText}>{item.open}</Text>
        </View>
        <View style={styles.valCol}>
            <Text style={styles.totalText}>{totalSold}</Text>
        </View>
        <View style={styles.valCol}>
            <View style={[
                styles.badge, 
                isCritical ? styles.bgRed : isLow ? styles.bgOrange : styles.bgGreen
            ]}>
                <Text style={[
                    styles.badgeText,
                    isCritical ? styles.textRed : isLow ? styles.textOrange : styles.textGreen
                ]}>{remaining}</Text>
            </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Canlı Stok Takip</Text>
        <TouchableOpacity onPress={toggleSort} style={styles.sortButton}>
            <Feather name={sortBy === 'sales' ? 'trending-up' : 'bar-chart-2'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Ürün ara..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {/* Group Filters */}
      <View style={styles.groupContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupContent}>
            {groups.map((group, index) => (
                <TouchableOpacity 
                    key={index} 
                    style={[styles.groupChip, selectedGroup === group && styles.groupChipActive]}
                    onPress={() => handleGroupSelect(group)}
                >
                    <Text style={[styles.groupChipText, selectedGroup === group && styles.groupChipTextActive]}>
                        {group}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
      </View>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.headerText, styles.nameCol]}>Ürün</Text>
        <Text style={[styles.headerText, styles.valCol]}>Giriş</Text>
        <Text style={[styles.headerText, styles.valCol]}>Kapalı</Text>
        <Text style={[styles.headerText, styles.valCol]}>Açık</Text>
        <Text style={[styles.headerText, styles.valCol]}>Top.</Text>
        <Text style={[styles.headerText, styles.valCol]}>Kalan</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0ea5e9" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredData}
          renderItem={renderItem}
          keyExtractor={item => item.name}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Henüz stok girişi yapılmamış.</Text>
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
    backgroundColor: '#0ea5e9',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sortButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  groupContainer: {
    marginBottom: 8,
  },
  groupContent: {
    paddingHorizontal: 16,
  },
  groupChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  groupChipActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  groupChipText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 13,
  },
  groupChipTextActive: {
    color: '#fff',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#e0f2fe',
    borderBottomWidth: 1,
    borderBottomColor: '#bae6fd',
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
  },
  nameCol: {
    flex: 3,
    paddingRight: 4,
  },
  valCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  groupText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  valText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  soldText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
  },
  openText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
  },
  totalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  bgRed: { backgroundColor: '#fef2f2' },
  bgOrange: { backgroundColor: '#fff7ed' },
  bgGreen: { backgroundColor: '#ecfdf5' },
  textRed: { color: '#dc2626' },
  textOrange: { color: '#ea580c' },
  textGreen: { color: '#059669' },
  listContent: {
    paddingBottom: 40,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
  },
});