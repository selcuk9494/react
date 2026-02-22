import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import { Feather } from '@expo/vector-icons';

export default function AdminBranchesScreen({ navigation }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      const response = await axios.get(`${API_URL}/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBranches(response.data || []);
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', 'Şube listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin — Şubeler</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
        >
          {branches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="map-pin" size={40} color="#cbd5e1" />
              <Text style={styles.emptyText}>Şube bulunamadı</Text>
            </View>
          ) : (
            branches.map((b) => (
              <View key={b.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconCircle}>
                    <Feather name="map-pin" size={18} color="#0f766e" />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.branchName}>{b.name}</Text>
                    <Text style={styles.branchConn}>
                      {b.db_host}:{b.db_port} / {b.db_name} ({b.db_user})
                    </Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  {typeof b.kasa_no !== 'undefined' && b.kasa_no !== null && (
                    <View style={[styles.metaPill, { backgroundColor: '#ecfdf5' }]}>
                      <Text style={[styles.metaText, { color: '#047857' }]}>
                        Kasa: {b.kasa_no}
                      </Text>
                    </View>
                  )}
                  {typeof b.closing_hour !== 'undefined' &&
                    b.closing_hour !== null && (
                      <View
                        style={[
                          styles.metaPill,
                          { backgroundColor: '#eff6ff' },
                        ]}
                      >
                        <Text style={[styles.metaText, { color: '#1d4ed8' }]}>
                          Kapanış: {b.closing_hour}:00
                        </Text>
                      </View>
                    )}
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
  container: {
    flex: 1,
    backgroundColor: '#eef2ff',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 14,
    backgroundColor: '#4f46e5',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
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
    color: '#eef2ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardHeaderText: {
    flex: 1,
  },
  branchName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  branchConn: {
    marginTop: 2,
    fontSize: 11,
    color: '#6b7280',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 6,
    marginTop: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

