import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator, ScrollView, RefreshControl, Dimensions, Platform, Modal, TouchableWithoutFeedback, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import axios from 'axios';
import { API_URL } from '../config';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Circle, G } from 'react-native-svg';

const screenWidth = Dimensions.get('window').width;

// DonutChart Component - Görsel görseldeki gibi
const DonutChart = ({ size = 80, strokeWidth = 12, data, centerText }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
  let currentAngle = -90; // Start from top
  
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#f0f0f0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Data segments */}
        {data.map((item, index) => {
          if (!item.value || total === 0) return null;
          const percentage = item.value / total;
          const strokeDasharray = `${circumference * percentage} ${circumference * (1 - percentage)}`;
          const rotation = currentAngle;
          currentAngle += percentage * 360;
          
          return (
            <Circle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              stroke={item.color}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={0}
              strokeLinecap="round"
              rotation={rotation}
              origin={`${center}, ${center}`}
            />
          );
        })}
      </Svg>
      {centerText && (
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#1e293b' }}>{centerText}</Text>
        </View>
      )}
    </View>
  );
};

export default function DashboardScreen({ navigation, route }) {
  const [user, setUser] = useState(route.params?.user || null);
  const [loading, setLoading] = useState(!route.params?.user);
  const [refreshing, setRefreshing] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [changingBranch, setChangingBranch] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [period, setPeriod] = useState('today');
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const fetchControllerRef = useRef(null);

  // Custom Date States
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

  useEffect(() => {
    if (!user) {
      fetchUserProfile();
    } else {
        initializeUserBranches(user);
        fetchDashboardData();
    }
  }, [user]);

  // Period change effect
  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const initializeUserBranches = (userData) => {
    if (userData.branches) {
        setBranches(userData.branches);
        if (userData.branches.length > 0) {
            if (typeof userData.selected_branch === 'number' && userData.branches[userData.selected_branch]) {
                 setSelectedBranch(userData.selected_branch);
            } else {
                 setSelectedBranch(0);
            }
        }
    }
  };

  const getWebBaseUrl = () => {
    if (!API_URL) return '';
    return API_URL.replace(/\/api\/?$/, '');
  };

  const openAdminPage = (path) => {
    if (path === '/admin/branches') {
      navigation.navigate('AdminBranches');
      return;
    }
    if (path === '/admin/users') {
      navigation.navigate('AdminUsers');
      return;
    }
    if (path === '/admin/manage') {
      navigation.navigate('AdminManage');
      return;
    }
    const baseUrl = getWebBaseUrl();
    if (!baseUrl) return;
    const url = `${baseUrl}${path}`;
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open admin page', err);
      Alert.alert('Hata', 'Admin sayfası açılamadı.');
    });
  };

  const fetchUserProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = response.data;
      setUser(userData);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      initializeUserBranches(userData);
      fetchDashboardData();
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', 'Kullanıcı bilgileri alınamadı.');
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async (showLoading = true) => {
    // Cancel previous request if exists
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    fetchControllerRef.current = controller;
    
    try {
        if (showLoading) setIsLoadingData(true);
        
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        let url = `${API_URL}/dashboard?period=${period}`;
        
        // Handle custom date range
        if (period === 'custom') {
            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];
            url = `${API_URL}/dashboard?period=custom&startDate=${startStr}&endDate=${endStr}`;
        }

        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
        });
        
        // Only update if this request wasn't cancelled
        if (!controller.signal.aborted) {
          setDashboardData(response.data);
          setIsOffline(false);
        }
    } catch (error) {
        // Ignore abort errors
        if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
          return;
        }
        console.error("Dashboard Data Error:", error);
        if (!controller.signal.aborted) {
          setIsOffline(true);
          setDashboardData(null);
        }
    } finally {
        if (!controller.signal.aborted) {
          setIsLoadingData(false);
        }
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

  const applyCustomDate = () => {
    setShowDateModal(false);
    setPeriod('custom');
  };

  const handlePeriodChange = (newPeriod) => {
    if (newPeriod === 'custom') {
        setShowDateModal(true);
    } else {
        setPeriod(newPeriod);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchUserProfile(), fetchDashboardData(false)]).then(() => {
        setRefreshing(false);
    });
  }, [period]);

  const handleBranchChange = async (branchIndex) => {
    if (branchIndex === selectedBranch) return;
    
    // Validate branchIndex
    const index = Number(branchIndex);
    if (isNaN(index) || index < 0 || index >= branches.length) {
      console.warn("Invalid branch index:", branchIndex);
      return;
    }

    setChangingBranch(true);
    setBranchModalVisible(false);
    try {
      const token = await AsyncStorage.getItem('token');
      
      await axios.post(`${API_URL}/auth/select-branch`, { index: index }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSelectedBranch(index);
      
      // Wait a bit to ensure backend update is processed before refetching
      setTimeout(() => {
          fetchUserProfile(); 
      }, 500);
      
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', 'Şube değiştirilemedi.');
    } finally {
      setChangingBranch(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e) {
      console.error(e);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value || 0);
  };

  const isReportAllowed = (reportId) => {
    if (!user) return false;
    // If admin, allow all
    if (user.is_admin) return true;
    // If allowed_reports is null/undefined, allow all (default)
    // IMPORTANT: null means ALL ALLOWED. Empty array [] means NONE ALLOWED.
    if (user.allowed_reports === null || user.allowed_reports === undefined) return true;
    // If allowed_reports is array, check inclusion
    return user.allowed_reports.includes(reportId);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const currentBranchName = branches[selectedBranch]?.name || 'Şube Seçiniz';
  
  // Calculate Grand Total
  const baseTotal = (dashboardData?.kapali_adisyon_toplam || 0) + (period === 'today' ? (dashboardData?.acik_adisyon_toplam || 0) : 0);
  const grandTotal = baseTotal + (dashboardData?.borca_atilan_toplam || 0);

  // Chart Data Preparation
  const openOrdersChartData = [
    { name: 'Adisyon', population: dashboardData?.dagilim?.adisyon.acik_toplam || 0, color: '#f97316', legendFontColor: '#7F7F7F', legendFontSize: 10 },
    { name: 'Paket', population: dashboardData?.dagilim?.paket.acik_toplam || 0, color: '#fbbf24', legendFontColor: '#7F7F7F', legendFontSize: 10 },
  ];

  const closedOrdersChartData = [
    { name: 'Adisyon', population: dashboardData?.dagilim?.adisyon.kapali_toplam || 0, color: '#10b981', legendFontColor: '#7F7F7F', legendFontSize: 10 },
    { name: 'Paket', population: dashboardData?.dagilim?.paket.kapali_toplam || 0, color: '#fbbf24', legendFontColor: '#7F7F7F', legendFontSize: 10 },
    { name: 'Hızlı', population: dashboardData?.dagilim?.hizli?.kapali_toplam || 0, color: '#ec4899', legendFontColor: '#7F7F7F', legendFontSize: 10 },
  ];

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
            <View style={styles.userInfo}>
                <LinearGradient
                    colors={['#10b981', '#0d9488']}
                    style={styles.logoContainer}
                >
                    <Text style={styles.logoText}>FR</Text>
                </LinearGradient>
                <View>
                    <Text style={styles.welcomeLabel}>Hoşgeldin</Text>
                    <Text style={styles.userEmail}>{user?.email?.split('@')[0]}</Text>
                </View>
            </View>
            <View style={styles.headerActions}>
                <TouchableOpacity style={styles.langButton}>
                    <Text style={styles.langText}>TR</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLogout} style={styles.settingsButton}>
                    <Feather name="log-out" size={20} color="#9ca3af" />
                </TouchableOpacity>
            </View>
        </View>

        <View style={styles.branchRow}>
            {changingBranch ? (
                 <ActivityIndicator size="small" color="#10b981" />
            ) : (
                <TouchableOpacity 
                    style={styles.branchSelector}
                    onPress={() => setBranchModalVisible(true)}
                >
                     <Feather name="map-pin" size={14} color="#059669" />
                     <Text style={styles.branchSelectorText}>
                        {currentBranchName}
                     </Text>
                     <Feather name="chevron-down" size={14} color="#059669" style={{marginLeft: 'auto'}} />
                </TouchableOpacity>
            )}
            
            <View style={[
              styles.statusBadge,
              isOffline && styles.statusBadgeOffline
            ]}>
                <View style={[
                  styles.statusDot,
                  isOffline && styles.statusDotOffline
                ]} />
                <Text style={[
                  styles.statusText,
                  isOffline && styles.statusTextOffline
                ]}>
                  {isOffline ? 'Offline' : 'Online'}
                </Text>
            </View>
        </View>

        {/* Date Filter Scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateFilterScroll} contentContainerStyle={styles.dateFilterContent}>
            {[
                { id: 'today', label: 'Bugün', icon: '📅' },
                { id: 'yesterday', label: 'Dün', icon: '⏪' },
                { id: 'week', label: 'Bu Hafta', icon: '📆' },
                { id: 'last7days', label: 'Son 7 Gün', icon: '7️⃣' },
                { id: 'month', label: 'Bu Ay', icon: '📊' },
                { id: 'last_month', label: 'Geçen Ay', icon: '📉' },
                { id: 'custom', label: 'Özel Tarih', icon: '🔍' },
            ].map((p) => (
                <TouchableOpacity
                    key={p.id}
                    onPress={() => p.id === 'custom' ? setShowDateModal(true) : setPeriod(p.id)}
                    style={[
                        styles.dateFilterButton,
                        period === p.id && styles.dateFilterButtonActive
                    ]}
                >
                    <Text style={styles.dateFilterIcon}>{p.icon}</Text>
                    <Text style={[
                        styles.dateFilterText,
                        period === p.id && styles.dateFilterTextActive
                    ]}>{p.label}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
      </View>

      <ScrollView 
        style={styles.contentScroll} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isOffline && !isLoadingData && (
          <View style={styles.offlineAlert}>
            <Feather name="alert-triangle" size={16} color="#b91c1c" />
            <Text style={styles.offlineAlertText}>Veri alınamadı. Şube kapalı olabilir.</Text>
          </View>
        )}
        {/* Main Summary Card */}
        <LinearGradient
            colors={['#10b981', '#14b8a6', '#0891b2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mainCard}
        >
            <View style={styles.mainCardBadge}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>TOPLAM CİRO</Text>
            </View>
            <Text style={styles.mainCardValue}>
              {isLoadingData && !dashboardData ? '...' : formatCurrency(grandTotal)}
            </Text>
            <View style={styles.mainCardFooter}>
                <View style={styles.footerDot} />
                <Text style={styles.footerText}>Açık + Kapalı Toplam</Text>
                <View style={styles.footerDot} />
            </View>
            {!!dashboardData?.borca_atilan_toplam && dashboardData.borca_atilan_toplam > 0 && (
                <View style={styles.debtBadge}>
                    <Text style={styles.debtText}>💰 Borca Atılan: {formatCurrency(dashboardData.borca_atilan_toplam)}</Text>
                </View>
            )}
        </LinearGradient>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
            {/* Open Orders (Only Today) */}
            {period === 'today' && isReportAllowed('open_orders') && (
                <View style={[styles.statCard, { borderColor: '#ffedd5', backgroundColor: '#fffbeb' }]}>
                    <TouchableOpacity onPress={() => navigation.navigate('Orders', { type: 'open' })}>
                        <View style={styles.statHeader}>
                            <View style={[styles.iconBox, { backgroundColor: '#f97316' }]}>
                                <Text style={{fontSize: 16}}>🟠</Text>
                            </View>
                            <Text style={[styles.statTitle, { color: '#c2410c' }]}>Açık Adisyon</Text>
                        </View>
                        <View style={styles.cardMainRow}>
                            <View style={styles.cardValueSection}>
                                <Text style={[styles.statValue, { color: '#ea580c' }]}>{formatCurrency(dashboardData?.acik_adisyon_toplam)}</Text>
                                <Text style={styles.statCount}>{dashboardData?.acik_adisyon_adet || 0} adet adisyon</Text>
                            </View>
                            <DonutChart 
                                size={70} 
                                strokeWidth={10}
                                data={[
                                    { value: dashboardData?.dagilim?.adisyon.acik_toplam || 0, color: '#f97316' },
                                    { value: dashboardData?.dagilim?.paket.acik_toplam || 0, color: '#fbbf24' },
                                ]}
                            />
                        </View>
                    </TouchableOpacity>
                    
                    {/* Breakdown Items */}
                     <View style={styles.breakdownContainer}>
                        <TouchableOpacity 
                            style={[styles.breakdownItem, { backgroundColor: '#fff', borderColor: '#fed7aa' }]}
                            onPress={() => navigation.navigate('Orders', { type: 'open', adtur: 0 })}
                        >
                            <View style={styles.breakdownRow}>
                                <View style={[styles.miniIcon, { backgroundColor: '#fff7ed' }]}><Text>🍽️</Text></View>
                                <View style={{flex: 1}}>
                                    <Text style={[styles.breakdownLabel, { color: '#ea580c' }]}>Adisyon</Text>
                                    <Text style={styles.breakdownValue}>{formatCurrency(dashboardData?.dagilim?.adisyon.acik_toplam)}</Text>
                                    <View style={styles.inlineStatRow}>
                                        <View style={[styles.inlineStatPill, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                                            <Text style={[styles.inlineStatText, { color: '#c2410c' }]}>
                                                %{dashboardData?.acik_adisyon_toplam > 0 ? Math.round((dashboardData?.dagilim?.adisyon.acik_toplam / dashboardData?.acik_adisyon_toplam) * 100) : 0}
                                            </Text>
                                        </View>
                                        <View style={[styles.inlineStatPill, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                                            <Text style={[styles.inlineStatText, { color: '#c2410c' }]}>
                                                {dashboardData?.dagilim?.adisyon.acik_adet || 0} adet
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <Feather name="chevron-right" size={16} color="#f97316" />
                            </View>
                        </TouchableOpacity>

                        {(dashboardData?.dagilim?.paket.acik_toplam || 0) > 0 && (
                            <TouchableOpacity 
                                style={[styles.breakdownItem, { backgroundColor: '#fff', borderColor: '#fde68a', marginTop: 8 }]}
                                onPress={() => navigation.navigate('Orders', { type: 'open', adtur: 1 })}
                            >
                                <View style={styles.breakdownRow}>
                                    <View style={[styles.miniIcon, { backgroundColor: '#fffbeb' }]}><Text>📦</Text></View>
                                    <View style={{flex: 1}}>
                                        <Text style={[styles.breakdownLabel, { color: '#b45309' }]}>Paket</Text>
                                        <Text style={styles.breakdownValue}>{formatCurrency(dashboardData?.dagilim?.paket.acik_toplam)}</Text>
                                        <View style={styles.inlineStatRow}>
                                            <View style={[styles.inlineStatPill, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                                                <Text style={[styles.inlineStatText, { color: '#b45309' }]}>
                                                    %{dashboardData?.acik_adisyon_toplam > 0 ? Math.round((dashboardData?.dagilim?.paket.acik_toplam / dashboardData?.acik_adisyon_toplam) * 100) : 0}
                                                </Text>
                                            </View>
                                            <View style={[styles.inlineStatPill, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                                                <Text style={[styles.inlineStatText, { color: '#b45309' }]}>
                                                    {dashboardData?.dagilim?.paket.acik_adet || 0} adet
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    <Feather name="chevron-right" size={16} color="#fbbf24" />
                                </View>
                            </TouchableOpacity>
                        )}
                     </View>
                </View>
            )}

            {/* Closed Orders */}
            {isReportAllowed('closed_orders') && (
            <View style={[styles.statCard, { borderColor: '#d1fae5', backgroundColor: '#ecfdf5' }]}>
                <TouchableOpacity onPress={() => navigation.navigate('Orders', { type: 'closed' })}>
                    <View style={styles.statHeader}>
                        <View style={[styles.iconBox, { backgroundColor: '#10b981' }]}>
                                <Text style={{fontSize: 16}}>✅</Text>
                        </View>
                        <Text style={[styles.statTitle, { color: '#047857' }]}>Kapalı Adisyon</Text>
                    </View>
                    <View style={styles.cardMainRow}>
                        <View style={styles.cardValueSection}>
                            <Text style={[styles.statValue, { color: '#059669' }]}>{formatCurrency(dashboardData?.kapali_adisyon_toplam)}</Text>
                            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
                                <Text style={styles.statCount}>{dashboardData?.kapali_adisyon_adet || 0} adet adisyon</Text>
                                {(dashboardData?.kapali_iskonto_toplam || 0) > 0 && (
                                    <View style={styles.discountBadge}>
                                        <Feather name="tag" size={10} color="#fff" />
                                        <Text style={styles.discountText}>-{formatCurrency(dashboardData?.kapali_iskonto_toplam)}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <DonutChart 
                            size={70} 
                            strokeWidth={10}
                            data={[
                                { value: dashboardData?.dagilim?.adisyon.kapali_toplam || 0, color: '#10b981' },
                                { value: dashboardData?.dagilim?.paket.kapali_toplam || 0, color: '#fbbf24' },
                                { value: dashboardData?.dagilim?.hizli?.kapali_toplam || 0, color: '#ec4899' },
                            ]}
                        />
                    </View>
                </TouchableOpacity>

                {/* Breakdown */}
                <View style={styles.breakdownContainer}>
                    {/* Adisyon */}
                    <TouchableOpacity 
                        style={[styles.breakdownItem, { backgroundColor: '#fff', borderColor: '#a7f3d0' }]}
                        onPress={() => navigation.navigate('Orders', { type: 'closed', adtur: 0 })}
                    >
                        <View style={styles.breakdownRow}>
                            <View style={[styles.miniIcon, { backgroundColor: '#ecfdf5' }]}><Text>🍽️</Text></View>
                            <View style={{flex: 1}}>
                                <Text style={[styles.breakdownLabel, { color: '#059669' }]}>Adisyon</Text>
                                <Text style={styles.breakdownValue}>{formatCurrency(dashboardData?.dagilim?.adisyon.kapali_toplam)}</Text>
                                <View style={styles.inlineStatRow}>
                                    <View style={[styles.inlineStatPill, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                                        <Text style={[styles.inlineStatText, { color: '#047857' }]}>
                                            %{dashboardData?.kapali_adisyon_toplam > 0 ? Math.round((dashboardData?.dagilim?.adisyon.kapali_toplam / dashboardData?.kapali_adisyon_toplam) * 100) : 0}
                                        </Text>
                                    </View>
                                    <View style={[styles.inlineStatPill, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                                        <Text style={[styles.inlineStatText, { color: '#047857' }]}>
                                            {dashboardData?.dagilim?.adisyon.kapali_adet || 0} adet
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <Feather name="chevron-right" size={16} color="#10b981" />
                        </View>
                    </TouchableOpacity>

                    {/* Hızlı Satış - Sadece varsa göster */}
                    {(dashboardData?.dagilim?.hizli?.kapali_toplam || 0) > 0 && (
                    <TouchableOpacity 
                        style={[styles.breakdownItem, { backgroundColor: '#fff', borderColor: '#fbcfe8', marginTop: 8 }]}
                        onPress={() => navigation.navigate('Orders', { type: 'closed', adtur: 3 })}
                    >
                        <View style={styles.breakdownRow}>
                            <View style={[styles.miniIcon, { backgroundColor: '#fdf2f8' }]}><Text>⚡</Text></View>
                            <View style={{flex: 1}}>
                                <Text style={[styles.breakdownLabel, { color: '#db2777' }]}>Hızlı Satış</Text>
                                <Text style={styles.breakdownValue}>{formatCurrency(dashboardData?.dagilim?.hizli?.kapali_toplam || 0)}</Text>
                                <View style={styles.inlineStatRow}>
                                    <View style={[styles.inlineStatPill, { backgroundColor: '#fdf2f8', borderColor: '#fbcfe8' }]}>
                                        <Text style={[styles.inlineStatText, { color: '#be185d' }]}>
                                            %{dashboardData?.kapali_adisyon_toplam > 0 ? Math.round(((dashboardData?.dagilim?.hizli?.kapali_toplam || 0) / dashboardData?.kapali_adisyon_toplam) * 100) : 0}
                                        </Text>
                                    </View>
                                    <View style={[styles.inlineStatPill, { backgroundColor: '#fdf2f8', borderColor: '#fbcfe8' }]}>
                                        <Text style={[styles.inlineStatText, { color: '#be185d' }]}>
                                            {dashboardData?.dagilim?.hizli?.kapali_adet || 0} adet
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <Feather name="chevron-right" size={16} color="#ec4899" />
                        </View>
                    </TouchableOpacity>
                    )}

                    {/* Paket - Sadece varsa göster */}
                    {(dashboardData?.dagilim?.paket.kapali_toplam || 0) > 0 && (
                        <TouchableOpacity 
                            style={[styles.breakdownItem, { backgroundColor: '#fff', borderColor: '#fde68a', marginTop: 8 }]}
                            onPress={() => navigation.navigate('Orders', { type: 'closed', adtur: 1 })}
                        >
                            <View style={styles.breakdownRow}>
                                <View style={[styles.miniIcon, { backgroundColor: '#fffbeb' }]}><Text>📦</Text></View>
                                <View style={{flex: 1}}>
                                    <Text style={[styles.breakdownLabel, { color: '#b45309' }]}>Paket</Text>
                                    <Text style={styles.breakdownValue}>{formatCurrency(dashboardData?.dagilim?.paket.kapali_toplam)}</Text>
                                    <View style={styles.inlineStatRow}>
                                        <View style={[styles.inlineStatPill, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                                            <Text style={[styles.inlineStatText, { color: '#b45309' }]}>
                                                %{dashboardData?.kapali_adisyon_toplam > 0 ? Math.round((dashboardData?.dagilim?.paket.kapali_toplam / dashboardData?.kapali_adisyon_toplam) * 100) : 0}
                                            </Text>
                                        </View>
                                        <View style={[styles.inlineStatPill, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                                            <Text style={[styles.inlineStatText, { color: '#b45309' }]}>
                                                {dashboardData?.dagilim?.paket.kapali_adet || 0} adet
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <Feather name="chevron-right" size={16} color="#fbbf24" />
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            )}
        </View>

        {/* Stock Management Section */}
        {(isReportAllowed('stock_entry') || isReportAllowed('live_stock')) && (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: '#0ea5e9' }]}>
                    <Feather name="box" size={16} color="#fff" />
                </View>
                <Text style={styles.sectionTitle}>Stok Yönetimi</Text>
            </View>

            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                {isReportAllowed('stock_entry') && (
                <TouchableOpacity 
                    style={[styles.stockCard, { marginRight: 8 }]}
                    onPress={() => navigation.navigate('StockEntry')}
                >
                    <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.stockIconBox}>
                        <Feather name="edit-3" size={20} color="#fff" />
                    </LinearGradient>
                    <View>
                        <Text style={styles.stockCardTitle}>Günlük Giriş</Text>
                        <Text style={styles.stockCardDesc}>Stok girişi yap</Text>
                    </View>
                </TouchableOpacity>
                )}

                {isReportAllowed('live_stock') && (
                <TouchableOpacity 
                    style={[styles.stockCard, { marginLeft: 8 }]}
                    onPress={() => navigation.navigate('LiveStock')}
                >
                     <LinearGradient colors={['#06b6d4', '#0891b2']} style={styles.stockIconBox}>
                        <Feather name="activity" size={20} color="#fff" />
                    </LinearGradient>
                    <View>
                        <Text style={styles.stockCardTitle}>Canlı Takip</Text>
                        <Text style={styles.stockCardDesc}>Anlık stok durumu</Text>
                    </View>
                </TouchableOpacity>
                )}
            </View>
        </View>
        )}

        {/* Other Reports Grid */}
        <View style={styles.reportsSection}>
            <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBox}>
                    <Feather name="bar-chart-2" size={16} color="#fff" />
                </View>
                <Text style={styles.sectionTitle}>Diğer Raporlar</Text>
            </View>

            <View style={styles.gridContainer}>
                {isReportAllowed('product_sales') && (
                <ReportCard 
                    title="Ürün Satışları" 
                    desc="Ürün bazlı satış raporu" 
                    icon="pie-chart" 
                    colors={['#f97316', '#f59e0b']} 
                    onPress={() => navigation.navigate('ProductSales')} 
                />
                )}
                {isReportAllowed('personnel') && (
                <ReportCard 
                    title="Personel" 
                    desc="Personel performansı" 
                    icon="users" 
                    colors={['#8b5cf6', '#7c3aed']} 
                    onPress={() => navigation.navigate('Personnel')} 
                />
                )}
                {isReportAllowed('payment_types') && (
                <ReportCard 
                    title="Ödeme Tipleri" 
                    desc="Nakit, Kredi Kartı vb." 
                    icon="credit-card" 
                    colors={['#3b82f6', '#0ea5e9']} 
                    onPress={() => navigation.navigate('PaymentTypes')} 
                />
                )}
                {isReportAllowed('hourly_sales') && (
                <ReportCard 
                    title="Saatlik Satış" 
                    desc="Saat bazlı yoğunluk" 
                    icon="trending-up" 
                    colors={['#ef4444', '#f43f5e']} 
                    onPress={() => navigation.navigate('HourlySales')} 
                />
                )}
                {isReportAllowed('cancels') && (
                <ReportCard 
                    title="İptaller" 
                    desc="İptal edilen ürünler" 
                    icon="x-circle" 
                    colors={['#ec4899', '#f43f5e']} 
                    onPress={() => navigation.navigate('Cancels')} 
                />
                )}
                {isReportAllowed('discounts') && (
                 <ReportCard 
                    title="İndirimler" 
                    desc="Yapılan iskontolar" 
                    icon="tag" 
                    colors={['#10b981', '#16a34a']} 
                    onPress={() => navigation.navigate('Discount')} 
                />
                )}
                {isReportAllowed('debts') && (
                <ReportCard 
                    title="Borca Atılanlar" 
                    desc="Veresiye listesi" 
                    icon="user-minus" 
                    colors={['#f59e0b', '#d97706']} 
                    onPress={() => navigation.navigate('Debts')} 
                />
                )}
                {isReportAllowed('courier') && (
                <ReportCard 
                    title="Kurye Takip" 
                    desc="Paket servis süreleri" 
                    icon="truck" 
                    colors={['#3b82f6', '#2563eb']} 
                    onPress={() => navigation.navigate('Courier')} 
                />
                )}
                {isReportAllowed('unpayable') && (
                <ReportCard 
                    title="Ödenmezler" 
                    desc="Ödenmeyen adisyonlar" 
                    icon="slash" 
                    colors={['#ef4444', '#b91c1c']} 
                    onPress={() => navigation.navigate('Unpayable')} 
                />
                )}
            </View>
        </View>

        {user?.is_admin && (
        <View style={styles.reportsSection}>
            <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: '#6366f1' }]}>
                    <Feather name="shield" size={16} color="#fff" />
                </View>
                <Text style={styles.sectionTitle}>Admin</Text>
            </View>

            <View style={styles.gridContainer}>
                <ReportCard 
                    title="Admin — Kullanıcılar" 
                    desc="Kullanıcı ekle / düzenle" 
                    icon="users" 
                    colors={['#4f46e5', '#7c3aed']} 
                    onPress={() => openAdminPage('/admin/users')} 
                />
                <ReportCard 
                    title="Admin — Şubeler" 
                    desc="Şube bağlantıları" 
                    icon="map-pin" 
                    colors={['#0d9488', '#14b8a6']} 
                    onPress={() => openAdminPage('/admin/branches')} 
                />
                <ReportCard 
                    title="Admin — Tek Form" 
                    desc="Kullanıcı + şube yönetimi" 
                    icon="settings" 
                    colors={['#f59e0b', '#ea580c']} 
                    onPress={() => openAdminPage('/admin/manage')} 
                />
            </View>
        </View>
        )}

        <View style={{height: 40}} />
      </ScrollView>
      
      <StatusBar style="auto" />

      {/* Branch Selection Modal */}
      <Modal
        visible={branchModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBranchModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setBranchModalVisible(false)}>
            <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Şube Seçiniz</Text>
                            <TouchableOpacity onPress={() => setBranchModalVisible(false)}>
                                <Feather name="x" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalList}>
                            {branches.map((branch, index) => (
                                <TouchableOpacity 
                                    key={index} 
                                    style={[
                                        styles.modalItem,
                                        selectedBranch === index && styles.modalItemActive
                                    ]}
                                    onPress={() => handleBranchChange(index)}
                                >
                                    <Feather 
                                        name="map-pin" 
                                        size={16} 
                                        color={selectedBranch === index ? '#10b981' : '#666'} 
                                        style={{marginRight: 10}}
                                    />
                                    <Text style={[
                                        styles.modalItemText,
                                        selectedBranch === index && styles.modalItemTextActive
                                    ]}>{branch.name}</Text>
                                    {selectedBranch === index && (
                                        <Feather name="check" size={16} color="#10b981" style={{marginLeft: 'auto'}} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableWithoutFeedback>
            </View>
        </TouchableWithoutFeedback>
      </Modal>
      {/* Custom Date Modal */}
      <Modal
        visible={showDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDateModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowDateModal(false)}>
            <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Tarih Aralığı Seç</Text>
                            <TouchableOpacity onPress={() => setShowDateModal(false)}>
                                <Feather name="x" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.datePickerContainer}>
                            <Text style={styles.dateLabel}>Başlangıç Tarihi:</Text>
                            {Platform.OS === 'android' ? (
                                <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateButton}>
                                    <Text style={styles.dateButtonText}>{startDate.toLocaleDateString('tr-TR')}</Text>
                                </TouchableOpacity>
                            ) : (
                                <DateTimePicker
                                    value={startDate}
                                    mode="date"
                                    display="default"
                                    onChange={(e, d) => d && setStartDate(d)}
                                    style={{width: 120}}
                                />
                            )}
                            {showStartPicker && Platform.OS === 'android' && (
                                <DateTimePicker
                                    value={startDate}
                                    mode="date"
                                    display="default"
                                    onChange={(e, d) => {
                                        setShowStartPicker(false);
                                        if(d) setStartDate(d);
                                    }}
                                />
                            )}
                        </View>

                        <View style={styles.datePickerContainer}>
                            <Text style={styles.dateLabel}>Bitiş Tarihi:</Text>
                             {Platform.OS === 'android' ? (
                                <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateButton}>
                                    <Text style={styles.dateButtonText}>{endDate.toLocaleDateString('tr-TR')}</Text>
                                </TouchableOpacity>
                            ) : (
                                <DateTimePicker
                                    value={endDate}
                                    mode="date"
                                    display="default"
                                    onChange={(e, d) => d && setEndDate(d)}
                                    style={{width: 120}}
                                />
                            )}
                            {showEndPicker && Platform.OS === 'android' && (
                                <DateTimePicker
                                    value={endDate}
                                    mode="date"
                                    display="default"
                                    onChange={(e, d) => {
                                        setShowEndPicker(false);
                                        if(d) setEndDate(d);
                                    }}
                                />
                            )}
                        </View>

                        <TouchableOpacity style={styles.applyButton} onPress={() => {
                            setPeriod('custom');
                            setShowDateModal(false);
                            fetchDashboardData();
                        }}>
                            <Text style={styles.applyButtonText}>Uygula</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableWithoutFeedback>
            </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const ReportCard = ({ title, desc, icon, colors, onPress }) => (
    <TouchableOpacity style={styles.reportCard} onPress={onPress}>
        <LinearGradient colors={colors} style={styles.reportIconBox}>
            <Feather name={icon} size={20} color="#fff" />
        </LinearGradient>
        <Text style={styles.reportTitle}>{title}</Text>
        <Text style={styles.reportDesc} numberOfLines={1}>{desc}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 40 : 60,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  welcomeLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  langButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  langText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  settingsButton: {
    padding: 6,
  },
  branchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  branchSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flex: 1,
    marginRight: 10,
    height: 36,
  },
  picker: {
    flex: 1,
    marginLeft: -8, // Adjust for default picker padding
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }], // Scale down a bit
  },
  branchSelectorText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  modalItemActive: {
    backgroundColor: '#ecfdf5',
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalItemTextActive: {
    color: '#10b981',
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  statusBadgeOffline: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  statusDotOffline: {
    backgroundColor: '#ef4444',
  },
  statusTextOffline: {
    color: '#b91c1c',
  },
  offlineAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#fee2e2',
    marginBottom: 12,
  },
  offlineAlertText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#b91c1c',
    fontWeight: '500',
  },
  dateFilterScroll: {
    paddingLeft: 16,
  },
  dateFilterContent: {
    paddingRight: 24,
    paddingBottom: 4,
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  dateFilterButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  dateFilterIcon: {
    marginRight: 6,
    fontSize: 12,
  },
  dateFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  dateFilterTextActive: {
    color: '#fff',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  mainCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    marginBottom: 20,
  },
  mainCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  mainCardValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  mainCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginHorizontal: 8,
  },
  footerText: {
    color: '#ecfdf5',
    fontSize: 13,
    fontWeight: '500',
  },
  debtBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  debtText: {
    color: '#78350f',
    fontWeight: '700',
    fontSize: 12,
  },
  statsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  stockCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  stockIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stockCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  stockCardDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  statCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  discountBadge: {
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f43f5e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 2,
  },
  breakdownContainer: {
    marginTop: 16,
  },
  breakdownItem: {
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  breakdownLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1f2937',
  },
  inlineStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  inlineStatPill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  inlineStatText: {
    fontSize: 10,
    fontWeight: '700',
  },
  breakdownCount: {
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  cardMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  cardValueSection: {
    flex: 1,
    marginRight: 12,
  },
  breakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 54,
  },
  countBadgePercent: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  countBadgeLabel: {
    fontSize: 9,
    fontWeight: '600',
  },
  percentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  percentText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  reportsSection: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  reportCard: {
    width: (screenWidth - 48) / 2, // 2 columns with padding
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  reportIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  reportDesc: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dateLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  dateButton: {
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  applyButton: {
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
