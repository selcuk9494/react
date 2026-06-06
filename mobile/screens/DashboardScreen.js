import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator, ScrollView, RefreshControl, Dimensions, Platform, Modal, TouchableWithoutFeedback, Linking, TextInput, KeyboardAvoidingView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import axios from 'axios';
import { API_URL, WEB_URL } from '../config';
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
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: '#1e293b',
              textAlign: 'center',
            }}
          >
            {centerText}
          </Text>
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
  const reqIdRef = useRef(0);
  const prevPeriodRef = useRef(period);
  const prevBranchRef = useRef(selectedBranch);
  const lastProfileFetchRef = useRef(0);

  // Custom Date States
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [lang, setLang] = useState('tr');
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '', password: '', phone: '' });
  const [avatarTheme, setAvatarTheme] = useState(0);
  const [tempAvatarTheme, setTempAvatarTheme] = useState(0);

  useEffect(() => {
    const loadLang = async () => {
      const stored = await AsyncStorage.getItem('language');
      if (stored) setLang(stored);
    };
    loadLang();
  }, []);

  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const T = {
    tr: {
      welcome: 'Hoşgeldin',
      online: 'Online',
      offline: 'Offline',
      totalRevenue: 'TOPLAM CİRO',
      totalFooter: 'Açık + Kapalı Toplam',
      debtBadge: '💰 Borca Atılan:',
      today: 'Bugün',
      yesterday: 'Dün',
      week: 'Bu Hafta',
      last7days: 'Son 7 Gün',
      month: 'Bu Ay',
      lastmonth: 'Geçen Ay',
      custom: 'Özel Tarih',
      apply: 'Uygula',
      stockManagement: 'Stok Yönetimi',
      stockEntryTitle: 'Stok Girişi',
      stockEntryDesc: 'Günlük giriş yap',
      liveStockTitle: 'Canlı Stok',
      liveStockDesc: 'Anlık durum',
      otherReports: 'Diğer Raporlar',
      openOrders: 'Açık Adisyon',
      closedOrders: 'Kapalı Adisyon',
      branchSelectTitle: 'Şube Seçiniz',
      dateRangeTitle: 'Tarih Aralığı Seç',
      startDateLabel: 'Başlangıç Tarihi:',
      endDateLabel: 'Bitiş Tarihi:',
      reportProductSalesTitle: 'Ürün Satışları',
      reportProductSalesDesc: 'Ürün bazlı rapor',
      reportPersonnelTitle: 'Personel',
      reportPersonnelDesc: 'Performans raporu',
      reportPaymentTypesTitle: 'Ödeme Tipleri',
      reportPaymentTypesDesc: 'Nakit, Kredi Kartı vb.',
      reportCashTitle: 'Kasa Raporu',
      reportCashDesc: 'Kasa toplamları',
      reportHourlySalesTitle: 'Saatlik Satış',
      reportHourlySalesDesc: 'Saatlik yoğunluk',
      reportCancelsTitle: 'İptaller',
      reportCancelsDesc: 'İptal edilen ürünler',
      reportDiscountsTitle: 'İndirimler',
      reportDiscountsDesc: 'Yapılan indirimler',
      reportProductPricesTitle: 'Ürün Fiyatları',
      reportProductPricesDesc: 'Fiyat güncelle',
      reportDebtsTitle: 'Borca Atılanlar',
      reportDebtsDesc: 'Veresiye listesi',
      reportCourierTitle: 'Kurye Takip',
      reportCourierDesc: 'Teslimat süreleri',
      reportUnpayableTitle: 'Ödenmezler',
      reportUnpayableDesc: 'Ödenmez listesi',
      adminSectionTitle: 'Yönetim',
      adminUsersTitle: 'Kullanıcılar',
      adminUsersDesc: 'Ekle / düzenle',
      adminBranchesTitle: 'Şubeler',
      adminBranchesDesc: 'Bağlantı ayarları',
      adminManageTitle: 'Genel',
      adminManageDesc: 'Kullanıcı + şube',
      orderCount: 'adet adisyon',
      order: 'Adisyon',
      package: 'Paket',
      fastSale: 'Hızlı Satış',
      connectionError: 'Bağlantı kurulamadı. Şubeye erişilemiyor.',
      selectBranch: 'Şube Seçiniz',
      error: 'Hata',
      adminError: 'Admin sayfası açılamadı.',
      profileError: 'Kullanıcı bilgileri alınamadı.',
      sessionError: 'Oturum bulunamadı',
      info: 'Bilgi',
      branchError: 'Şube değiştirilemedi.',
    },
    en: {
      welcome: 'Welcome',
      online: 'Online',
      offline: 'Offline',
      totalRevenue: 'TOTAL REVENUE',
      totalFooter: 'Open + Closed Total',
      debtBadge: '💰 On Credit:',
      today: 'Today',
      yesterday: 'Yesterday',
      week: 'This Week',
      last7days: 'Last 7 Days',
      month: 'This Month',
      lastmonth: 'Last Month',
      custom: 'Custom Date',
      apply: 'Apply',
      stockManagement: 'Stock Management',
      stockEntryTitle: 'Stock Entry',
      stockEntryDesc: 'Daily entry',
      liveStockTitle: 'Live Stock',
      liveStockDesc: 'Real-time status',
      otherReports: 'Other Reports',
      openOrders: 'Open Orders',
      closedOrders: 'Closed Orders',
      branchSelectTitle: 'Select Branch',
      dateRangeTitle: 'Select Date Range',
      startDateLabel: 'Start Date:',
      endDateLabel: 'End Date:',
      accountTitle: 'My Account',
      fullNameLabel: 'Full Name',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      phoneLabel: 'Phone',
      save: 'Save',
      cancel: 'Cancel',
      profileUpdated: 'Profile updated',
      profileUpdateFailed: 'Profile update failed',
      reportProductSalesTitle: 'Product Sales',
      reportProductSalesDesc: 'Product based report',
      reportPersonnelTitle: 'Personnel',
      reportPersonnelDesc: 'Staff performance',
      reportPaymentTypesTitle: 'Payment Types',
      reportPaymentTypesDesc: 'Cash, Card etc.',
      reportCashTitle: 'Cash Report',
      reportCashDesc: 'Cash drawer totals',
      reportHourlySalesTitle: 'Hourly Sales',
      reportHourlySalesDesc: 'Sales by hour',
      reportCancelsTitle: 'Cancels',
      reportCancelsDesc: 'Cancelled items',
      reportDiscountsTitle: 'Discounts',
      reportDiscountsDesc: 'Applied discounts',
      reportProductPricesTitle: 'Product Prices',
      reportProductPricesDesc: 'Update prices',
      reportDebtsTitle: 'Debts',
      reportDebtsDesc: 'Customer credit list',
      reportCourierTitle: 'Courier Tracking',
      reportCourierDesc: 'Delivery times',
      reportUnpayableTitle: 'Unpayables',
      reportUnpayableDesc: 'Unpaid orders',
      adminSectionTitle: 'Admin',
      adminUsersTitle: 'Users',
      adminUsersDesc: 'Add / edit users',
      adminBranchesTitle: 'Branches',
      adminBranchesDesc: 'Branch connections',
      adminManageTitle: 'General',
      adminManageDesc: 'User + branch',
      orderCount: 'orders',
      order: 'Order',
      package: 'Package',
      fastSale: 'Fast Sale',
      connectionError: 'Connection failed. Branch is not reachable.',
      selectBranch: 'Select Branch',
      error: 'Error',
      adminError: 'Admin page could not be opened.',
      profileError: 'User profile could not be loaded.',
      sessionError: 'Session not found',
      info: 'Info',
      branchError: 'Branch could not be changed.',
    }
  }[lang];

  if (lang === 'tr') {
    T.accountTitle = 'Hesabım';
    T.fullNameLabel = 'Ad Soyad';
    T.emailLabel = 'E-posta';
    T.passwordLabel = 'Şifre';
    T.phoneLabel = 'Telefon';
    T.save = 'Kaydet';
    T.cancel = 'Vazgeç';
    T.profileUpdated = 'Profil güncellendi';
    T.profileUpdateFailed = 'Profil güncellenemedi';
    T.avatarColor = 'Avatar Rengi';
  } else {
    T.avatarColor = 'Avatar Color';
  }

  useEffect(() => {
    (async () => {
      const storedTheme = await AsyncStorage.getItem('avatarTheme');
      if (storedTheme !== null) {
        const idx = Number(storedTheme);
        if (!isNaN(idx)) {
          setAvatarTheme(idx);
        }
      }
    })();
  }, []);

  const getAvatarColors = (themeIndex) => {
    if (themeIndex === 1) return ['#3b82f6', '#2563eb'];
    if (themeIndex === 2) return ['#8b5cf6', '#7c3aed'];
    return ['#10b981', '#0d9488'];
  };

  const getInitials = (name, email) => {
    const source = (name && name.trim()) || (email && email.split('@')[0]) || 'FR';
    const parts = source.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
  };

  useEffect(() => {
    if (!user) {
      fetchUserProfile();
    } else {
        console.log('User data in DashboardScreen:', user);
        console.log('User allowed_reports:', user.allowed_reports);
        console.log('User is_admin:', user.is_admin);
        initializeUserBranches(user);
        fetchDashboardData();
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      const now = Date.now();
      if (now - lastProfileFetchRef.current < 30000) return;
      lastProfileFetchRef.current = now;
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;
        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const userData = response.data;
        setUser(userData);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
      } catch (e) {
        console.error(e);
      }
    });
    return unsubscribe;
  }, [navigation]);

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
    if (WEB_URL) return String(WEB_URL).replace(/\/+$/, '');
    if (!API_URL) return '';
    return API_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');
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
      Alert.alert(T.error, T.adminError);
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
      console.log('User data loaded:', userData);
      setUser(userData);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      initializeUserBranches(userData);
      fetchDashboardData();
    } catch (error) {
      console.error(error);
      Alert.alert(T.error, T.profileError);
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
    
    const myId = ++reqIdRef.current;
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    const periodChanged = prevPeriodRef.current !== period;
    const branchChanged = prevBranchRef.current !== selectedBranch;
    if (periodChanged || branchChanged) {
      setDashboardData(null);
      setIsOffline(false);
      prevPeriodRef.current = period;
      prevBranchRef.current = selectedBranch;
    }
    
    try {
        if (showLoading) setIsLoadingData(true);
        
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        let url = `${API_URL}/dashboard?period=${period}`;
        
        // Handle custom date range
        if (period === 'custom') {
            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];
            url = `${API_URL}/dashboard?period=custom&start_date=${startStr}&end_date=${endStr}`;
        }

        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
        });
        
        // Only update if this request wasn't cancelled
        if (!controller.signal.aborted && reqIdRef.current === myId) {
          setDashboardData(response.data);
          setIsOffline(false);
        }
    } catch (error) {
        // Ignore abort errors
        if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
          return;
        }
        console.error("Dashboard Data Error:", error);
        if (!controller.signal.aborted && reqIdRef.current === myId) {
          setIsOffline(true);
          setDashboardData(null);
        }
    } finally {
        if (!controller.signal.aborted && reqIdRef.current === myId) {
          setIsLoadingData(false);
        }
    }
  };

  const saveProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert(T.info, T.sessionError);
        return;
      }
      if (user?.is_admin && user?.id) {
        await axios.put(
          `${API_URL}/admin/users/${user.id}`,
          {
            email: profileForm.email,
            full_name: profileForm.full_name,
            phone: profileForm.phone,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (profileForm.password && profileForm.password.trim().length > 0) {
          await axios.post(
            `${API_URL}/admin/users/${user.id}/password`,
            { password: profileForm.password },
            { headers: { Authorization: `Bearer ${token}` } },
          );
        }
      } else {
        await axios.put(
          `${API_URL}/auth/profile`,
          {
            email: profileForm.email,
            full_name: profileForm.full_name,
            phone: profileForm.phone,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (profileForm.password && profileForm.password.trim().length > 0) {
          await axios.post(
            `${API_URL}/auth/password`,
            { password: profileForm.password },
            { headers: { Authorization: `Bearer ${token}` } },
          );
        }
      }
      Alert.alert(T.info, T.profileUpdated);
      setAvatarTheme(tempAvatarTheme);
      await AsyncStorage.setItem('avatarTheme', String(tempAvatarTheme));
      setProfileModalVisible(false);
      await fetchUserProfile();
    } catch (e) {
      console.error(e);
      Alert.alert(T.error, T.profileUpdateFailed);
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
    setDashboardData(null);
    setIsOffline(false);
    setIsLoadingData(true);
    setPeriod('custom');
  };

  const handlePeriodChange = (newPeriod) => {
    if (newPeriod === 'custom') {
        setShowDateModal(true);
    } else {
        setDashboardData(null);
        setIsOffline(false);
        setIsLoadingData(true);
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
      Alert.alert(T.error, T.branchError);
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
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'TRY' }).format(value || 0);
  };

  const isReportAllowed = (reportId) => {
    if (!user) return false;
    // If admin, allow all
    if (user.is_admin) return true;
    // If allowed_reports is null/undefined, allow all (default)
    // IMPORTANT: null means ALL ALLOWED. Empty array [] means NONE ALLOWED.
    if (user.allowed_reports === null || user.allowed_reports === undefined) return true;
    // If allowed_reports is array, check inclusion
    const hasPermission = user.allowed_reports.includes(reportId);
    console.log(`Report permission check - User: ${user.email}, Report: ${reportId}, Allowed reports:`, user.allowed_reports, `Has permission: ${hasPermission}`);
    return hasPermission;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const currentBranchName = branches[selectedBranch]?.name || T.selectBranch;
  
  // Calculate Grand Total
  const baseTotal = (dashboardData?.kapali_adisyon_toplam || 0) + (period === 'today' ? (dashboardData?.acik_adisyon_toplam || 0) : 0);
  const grandTotal = baseTotal + (dashboardData?.borca_atilan_toplam || 0);
  const showPlaceholders = isLoadingData;

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
                    colors={getAvatarColors(avatarTheme)}
                    style={styles.logoContainer}
                >
                    <Text style={styles.logoText}>{getInitials(user?.full_name, user?.email)}</Text>
                </LinearGradient>
                <View>
                    <Text style={styles.welcomeLabel}>{T.welcome}</Text>
                    <Text style={styles.userEmail}>{user?.email?.split('@')[0]}</Text>
                </View>
            </View>
            <View style={styles.headerActions}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[styles.langButton, lang === 'tr' && styles.langButtonActive]}
                    onPress={async () => { setLang('tr'); await AsyncStorage.setItem('language', 'tr'); }}
                  >
                    <Text style={[styles.langText, lang === 'tr' && styles.langTextActive]}>TR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.langButton, lang === 'en' && styles.langButtonActive]}
                    onPress={async () => { setLang('en'); await AsyncStorage.setItem('language', 'en'); }}
                  >
                    <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>EN</Text>
                  </TouchableOpacity>
                </View>
              <TouchableOpacity
                onPress={() => {
                  setProfileForm({
                    full_name: user?.full_name || '',
                    email: user?.email || '',
                    password: '',
                    phone: user?.phone || ''
                  });
                  setTempAvatarTheme(avatarTheme);
                  setProfileModalVisible(true);
                }}
                style={styles.settingsButton}
              >
                <Feather name="user" size={20} color="#9ca3af" />
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
                  {isOffline ? T.offline : T.online}
                </Text>
            </View>
        </View>

        {/* Date Filter Scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateFilterScroll} contentContainerStyle={styles.dateFilterContent}>
            {[
                { id: 'today', label: T.today, icon: '📅' },
                { id: 'yesterday', label: T.yesterday, icon: '⏪' },
                { id: 'week', label: T.week, icon: '📆' },
                { id: 'last7days', label: T.last7days, icon: '7️⃣' },
                { id: 'month', label: T.month, icon: '📊' },
                { id: 'lastmonth', label: T.lastmonth, icon: '📉' },
                { id: 'custom', label: T.custom, icon: '🔍' },
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

      <Modal
        visible={profileModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setProfileModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 20} style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{T.accountTitle}</Text>
                  <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
                    <Feather name="x" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled">
                <View style={{ gap: 12 }}>
                  <View>
                    <Text style={styles.profileLabel}>{T.fullNameLabel}</Text>
                    <TextInput
                      style={styles.profileInput}
                      placeholder={T.fullNameLabel}
                      value={profileForm.full_name}
                      onChangeText={(v) => setProfileForm((p) => ({ ...p, full_name: v }))}
                    />
                  </View>
                  <View>
                    <Text style={styles.profileLabel}>{T.emailLabel}</Text>
                    <TextInput
                      style={styles.profileInput}
                      placeholder={T.emailLabel}
                      value={profileForm.email}
                      onChangeText={(v) => setProfileForm((p) => ({ ...p, email: v }))}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                  <View>
                    <Text style={styles.profileLabel}>{T.phoneLabel}</Text>
                    <TextInput
                      style={styles.profileInput}
                      placeholder={T.phoneLabel}
                      value={profileForm.phone}
                      onChangeText={(v) => setProfileForm((p) => ({ ...p, phone: v }))}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <View>
                    <Text style={styles.profileLabel}>{T.avatarColor}</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={[
                          styles.avatarSwatch,
                          { backgroundColor: '#10b981', borderColor: tempAvatarTheme === 0 ? '#0f766e' : '#e5e7eb' },
                        ]}
                        onPress={() => setTempAvatarTheme(0)}
                      />
                      <TouchableOpacity
                        style={[
                          styles.avatarSwatch,
                          { backgroundColor: '#2563eb', borderColor: tempAvatarTheme === 1 ? '#1d4ed8' : '#e5e7eb' },
                        ]}
                        onPress={() => setTempAvatarTheme(1)}
                      />
                      <TouchableOpacity
                        style={[
                          styles.avatarSwatch,
                          { backgroundColor: '#7c3aed', borderColor: tempAvatarTheme === 2 ? '#6d28d9' : '#e5e7eb' },
                        ]}
                        onPress={() => setTempAvatarTheme(2)}
                      />
                    </View>
                  </View>
                  <View>
                    <Text style={styles.profileLabel}>{T.passwordLabel}</Text>
                    <TextInput
                      style={styles.profileInput}
                      placeholder={T.passwordLabel}
                      value={profileForm.password}
                      onChangeText={(v) => setProfileForm((p) => ({ ...p, password: v }))}
                      secureTextEntry
                    />
                  </View>
                </View>
                </ScrollView>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                  <TouchableOpacity style={styles.profileCancelButton} onPress={() => setProfileModalVisible(false)}>
                    <Text style={styles.profileCancelText}>{T.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.profileSaveButton} onPress={saveProfile}>
                    <Text style={styles.profileSaveText}>{T.save}</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ScrollView 
        style={styles.contentScroll} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isOffline && !isLoadingData && (
          <View style={styles.offlineAlert}>
            <Feather name="alert-triangle" size={16} color="#b91c1c" />
            <Text style={styles.offlineAlertText}>{T.connectionError}</Text>
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
                <Text style={styles.badgeText}>{T.totalRevenue}</Text>
            </View>
            <Text style={styles.mainCardValue}>
              {showPlaceholders ? '...' : formatCurrency(grandTotal)}
            </Text>
            <View style={styles.mainCardFooter}>
                <View style={styles.footerDot} />
                <Text style={styles.footerText}>{T.totalFooter}</Text>
                <View style={styles.footerDot} />
            </View>
            {!!dashboardData?.borca_atilan_toplam && dashboardData.borca_atilan_toplam > 0 && (
                <View style={styles.debtBadge}>
                    <Text style={styles.debtText}>{T.debtBadge} {formatCurrency(dashboardData.borca_atilan_toplam)}</Text>
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
                            <Text style={[styles.statTitle, { color: '#c2410c' }]}>{T.openOrders}</Text>
                        </View>
                        <View style={styles.cardMainRow}>
                            <View style={styles.cardValueSection}>
                                <Text style={[styles.statValue, { color: '#ea580c' }]}>
                                  {showPlaceholders ? '...' : formatCurrency(dashboardData?.acik_adisyon_toplam)}
                                </Text>
                                <Text style={styles.statCount}>
                                  {showPlaceholders ? '...' : (dashboardData?.acik_adisyon_adet || 0)} {T.orderCount}
                                </Text>
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
                    
                    {!showPlaceholders && !!dashboardData && (
                    <View style={styles.breakdownContainer}>
                      <View style={styles.breakdownCircleRow}>
                        <TouchableOpacity
                          style={[
                            styles.breakdownCircle,
                            { backgroundColor: '#ffedd5', borderColor: '#fdba74' },
                          ]}
                          onPress={() => navigation.navigate('Orders', { type: 'open', adtur: 0 })}
                        >
                          <Text style={[styles.breakdownCircleLabel, { color: '#ea580c' }]}>
                            {T.order}
                          </Text>
                          <Text style={styles.breakdownCircleValue}>
                            {formatCurrency(dashboardData?.dagilim?.adisyon.acik_toplam)}
                          </Text>
                          <View style={styles.breakdownCircleStats}>
                            <Text style={[styles.breakdownCircleStatText, { color: '#c2410c' }]}>
                              %{dashboardData?.acik_adisyon_toplam > 0
                                ? Math.round(
                                    (dashboardData?.dagilim?.adisyon.acik_toplam /
                                      dashboardData?.acik_adisyon_toplam) *
                                      100,
                                  )
                                : 0}
                            </Text>
                            <Text style={[styles.breakdownCircleStatText, { color: '#c2410c' }]}>
                              {dashboardData?.dagilim?.adisyon.acik_adet || 0} {T.orderCount}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {(dashboardData?.dagilim?.paket.acik_toplam || 0) > 0 && (
                          <TouchableOpacity
                            style={[
                              styles.breakdownCircle,
                              { backgroundColor: '#fef3c7', borderColor: '#facc15' },
                            ]}
                            onPress={() => navigation.navigate('Orders', { type: 'open', adtur: 1 })}
                          >
                            <Text style={[styles.breakdownCircleLabel, { color: '#b45309' }]}>
                            {T.package}
                          </Text>
                          <Text style={styles.breakdownCircleValue}>
                            {formatCurrency(dashboardData?.dagilim?.paket.acik_toplam)}
                          </Text>
                          <View style={styles.breakdownCircleStats}>
                            <Text style={[styles.breakdownCircleStatText, { color: '#b45309' }]}>
                              %{dashboardData?.acik_adisyon_toplam > 0
                                ? Math.round(
                                    (dashboardData?.dagilim?.paket.acik_toplam /
                                      dashboardData?.acik_adisyon_toplam) *
                                      100,
                                  )
                                : 0}
                            </Text>
                            <Text style={[styles.breakdownCircleStatText, { color: '#b45309' }]}>
                              {dashboardData?.dagilim?.paket.acik_adet || 0} {T.orderCount}
                            </Text>
                          </View>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    )}
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
                        <Text style={[styles.statTitle, { color: '#047857' }]}>{T.closedOrders}</Text>
                    </View>
                    <View style={styles.cardMainRow}>
                        <View style={styles.cardValueSection}>
                            <Text style={[styles.statValue, { color: '#059669' }]}>
                              {showPlaceholders ? '...' : formatCurrency(dashboardData?.kapali_adisyon_toplam)}
                            </Text>
                            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
                                <Text style={styles.statCount}>
                                  {showPlaceholders ? '...' : (dashboardData?.kapali_adisyon_adet || 0)} {T.orderCount}
                                </Text>
                                {!showPlaceholders && (dashboardData?.kapali_iskonto_toplam || 0) > 0 && (
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

                {!showPlaceholders && !!dashboardData && (
                <View style={styles.breakdownContainer}>
                  <View style={styles.breakdownCircleRow}>
                    <TouchableOpacity
                        style={[
                          styles.breakdownCircle,
                          { backgroundColor: '#dcfce7', borderColor: '#4ade80' },
                        ]}
                        onPress={() => navigation.navigate('Orders', { type: 'closed', adtur: 0 })}
                      >
                        <Text style={[styles.breakdownCircleLabel, { color: '#059669' }]}>
                          {T.order}
                        </Text>
                        <Text style={styles.breakdownCircleValue}>
                          {formatCurrency(dashboardData?.dagilim?.adisyon.kapali_toplam)}
                        </Text>
                        <View style={styles.breakdownCircleStats}>
                          <Text style={[styles.breakdownCircleStatText, { color: '#047857' }]}>
                            %{dashboardData?.kapali_adisyon_toplam > 0
                              ? Math.round(
                                  (dashboardData?.dagilim?.adisyon.kapali_toplam /
                                    dashboardData?.kapali_adisyon_toplam) *
                                    100,
                                )
                              : 0}
                          </Text>
                          <Text style={[styles.breakdownCircleStatText, { color: '#047857' }]}>
                            {dashboardData?.dagilim?.adisyon.kapali_adet || 0} {T.orderCount}
                          </Text>
                        </View>
                      </TouchableOpacity>

                    {(dashboardData?.dagilim?.paket.kapali_toplam || 0) > 0 && (
                      <TouchableOpacity
                        style={[
                          styles.breakdownCircle,
                          { backgroundColor: '#fef3c7', borderColor: '#fb923c' },
                        ]}
                        onPress={() => navigation.navigate('Orders', { type: 'closed', adtur: 1 })}
                      >
                          <Text style={[styles.breakdownCircleLabel, { color: '#b45309' }]}>
                            {T.package}
                          </Text>
                          <Text style={styles.breakdownCircleValue}>
                            {formatCurrency(dashboardData?.dagilim?.paket.kapali_toplam)}
                          </Text>
                          <View style={styles.breakdownCircleStats}>
                            <Text style={[styles.breakdownCircleStatText, { color: '#b45309' }]}>
                              %{dashboardData?.kapali_adisyon_toplam > 0
                                ? Math.round(
                                    (dashboardData?.dagilim?.paket.kapali_toplam /
                                      dashboardData?.kapali_adisyon_toplam) *
                                      100,
                                  )
                                : 0}
                            </Text>
                            <Text style={[styles.breakdownCircleStatText, { color: '#b45309' }]}>
                              {dashboardData?.dagilim?.paket.kapali_adet || 0} {T.orderCount}
                            </Text>
                          </View>
                      </TouchableOpacity>
                    )}
                  </View>

                  {(dashboardData?.dagilim?.hizli?.kapali_toplam || 0) > 0 && (
                    <TouchableOpacity 
                        style={[styles.breakdownItem, { backgroundColor: '#fff', borderColor: '#fbcfe8', marginTop: 8 }]}
                        onPress={() => navigation.navigate('Orders', { type: 'closed', adtur: 3 })}
                    >
                        <View style={styles.breakdownRow}>
                            <View style={[styles.miniIcon, { backgroundColor: '#fdf2f8' }]}><Text>⚡</Text></View>
                            <View style={{flex: 1}}>
                                <Text style={[styles.breakdownLabel, { color: '#db2777' }]}>{T.fastSale}</Text>
                                <Text style={styles.breakdownValue}>{formatCurrency(dashboardData?.dagilim?.hizli?.kapali_toplam || 0)}</Text>
                                <View style={styles.inlineStatRow}>
                                    <View style={[styles.inlineStatPill, { backgroundColor: '#fdf2f8', borderColor: '#fbcfe8' }]}>
                                        <Text style={[styles.inlineStatText, { color: '#be185d' }]}>
                                            %{dashboardData?.kapali_adisyon_toplam > 0 ? Math.round(((dashboardData?.dagilim?.hizli?.kapali_toplam || 0) / dashboardData?.kapali_adisyon_toplam) * 100) : 0}
                                        </Text>
                                    </View>
                                    <View style={[styles.inlineStatPill, { backgroundColor: '#fdf2f8', borderColor: '#fbcfe8' }]}>
                                        <Text style={[styles.inlineStatText, { color: '#be185d' }]}>
                                            {dashboardData?.dagilim?.hizli?.kapali_adet || 0} {T.orderCount}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <Feather name="chevron-right" size={16} color="#ec4899" />
                        </View>
                    </TouchableOpacity>
                    )}
                </View>
                )}
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
                <Text style={styles.sectionTitle}>{T.stockManagement}</Text>
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
                        <Text style={styles.stockCardTitle}>{T.stockEntryTitle}</Text>
                        <Text style={styles.stockCardDesc}>{T.stockEntryDesc}</Text>
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
                        <Text style={styles.stockCardTitle}>{T.liveStockTitle}</Text>
                        <Text style={styles.stockCardDesc}>{T.liveStockDesc}</Text>
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
                <Text style={styles.sectionTitle}>{T.otherReports}</Text>
            </View>

            <View style={styles.gridContainer}>
                {isReportAllowed('product_sales') && (
                <ReportCard 
                    title={T.reportProductSalesTitle}
                    desc={T.reportProductSalesDesc}
                    icon="pie-chart" 
                    colors={['#f97316', '#f59e0b']} 
                    onPress={() => navigation.navigate('ProductSales')} 
                />
                )}
                {isReportAllowed('personnel') && (
                <ReportCard 
                    title={T.reportPersonnelTitle}
                    desc={T.reportPersonnelDesc}
                    icon="users" 
                    colors={['#8b5cf6', '#7c3aed']} 
                    onPress={() => navigation.navigate('Personnel')} 
                />
                )}
                {isReportAllowed('payment_types') && (
                <ReportCard 
                    title={T.reportPaymentTypesTitle}
                    desc={T.reportPaymentTypesDesc}
                    icon="credit-card" 
                    colors={['#3b82f6', '#0ea5e9']} 
                    onPress={() => navigation.navigate('PaymentTypes')} 
                />
                )}
                {isReportAllowed('cash_report') && (
                <ReportCard 
                    title={T.reportCashTitle}
                    desc={T.reportCashDesc}
                    icon="dollar-sign" 
                    colors={['#10b981', '#0ea5e9']} 
                    onPress={() => navigation.navigate('CashReport')} 
                />
                )}
                {isReportAllowed('hourly_sales') && (
                <ReportCard 
                    title={T.reportHourlySalesTitle}
                    desc={T.reportHourlySalesDesc}
                    icon="trending-up" 
                    colors={['#ef4444', '#f43f5e']} 
                    onPress={() => navigation.navigate('HourlySales')} 
                />
                )}
                {isReportAllowed('cancels') && (
                <ReportCard 
                    title={T.reportCancelsTitle}
                    desc={T.reportCancelsDesc}
                    icon="x-circle" 
                    colors={['#ec4899', '#f43f5e']} 
                    onPress={() => navigation.navigate('Cancels')} 
                />
                )}
                {isReportAllowed('discounts') && (
                 <ReportCard 
                    title={T.reportDiscountsTitle}
                    desc={T.reportDiscountsDesc}
                    icon="tag" 
                    colors={['#10b981', '#16a34a']} 
                    onPress={() => navigation.navigate('Discount')} 
                />
                )}
                {isReportAllowed('product_prices') && (
                <ReportCard
                    title={T.reportProductPricesTitle}
                    desc={T.reportProductPricesDesc}
                    icon="tag"
                    colors={['#10b981', '#0ea5e9']}
                    onPress={() => openAdminPage('/product-prices')}
                />
                )}
                {isReportAllowed('debts') && (
                <ReportCard 
                    title={T.reportDebtsTitle}
                    desc={T.reportDebtsDesc}
                    icon="user-minus" 
                    colors={['#f59e0b', '#d97706']} 
                    onPress={() => navigation.navigate('Debts')} 
                />
                )}
                {isReportAllowed('courier') && (
                <ReportCard 
                    title={T.reportCourierTitle}
                    desc={T.reportCourierDesc}
                    icon="truck" 
                    colors={['#3b82f6', '#2563eb']} 
                    onPress={() => navigation.navigate('Courier')} 
                />
                )}
                {isReportAllowed('unpayable') && (
                <ReportCard 
                    title={T.reportUnpayableTitle}
                    desc={T.reportUnpayableDesc}
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
                <Text style={styles.sectionTitle}>{T.adminSectionTitle}</Text>
            </View>

            <View style={styles.gridContainer}>
                <ReportCard 
                    title={T.adminUsersTitle}
                    desc={T.adminUsersDesc}
                    icon="users" 
                    colors={['#4f46e5', '#7c3aed']} 
                    onPress={() => openAdminPage('/admin/users')} 
                />
                <ReportCard 
                    title={T.adminBranchesTitle}
                    desc={T.adminBranchesDesc}
                    icon="map-pin" 
                    colors={['#0d9488', '#14b8a6']} 
                    onPress={() => openAdminPage('/admin/branches')} 
                />
                <ReportCard 
                    title={T.adminManageTitle}
                    desc={T.adminManageDesc}
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
                            <Text style={styles.modalTitle}>{T.branchSelectTitle}</Text>
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
                            <Text style={styles.modalTitle}>{T.dateRangeTitle}</Text>
                            <TouchableOpacity onPress={() => setShowDateModal(false)}>
                                <Feather name="x" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.datePickerContainer}>
                            <Text style={styles.dateLabel}>{T.startDateLabel}</Text>
                            {Platform.OS === 'android' ? (
                                <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateButton}>
                                    <Text style={styles.dateButtonText}>{startDate.toLocaleDateString(locale)}</Text>
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
                            <Text style={styles.dateLabel}>{T.endDateLabel}</Text>
                             {Platform.OS === 'android' ? (
                                <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateButton}>
                                    <Text style={styles.dateButtonText}>{endDate.toLocaleDateString(locale)}</Text>
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
                            applyCustomDate();
                        }}>
                            <Text style={styles.applyButtonText}>{T.apply}</Text>
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
  langButtonActive: {
    backgroundColor: '#ef4444',
  },
  langTextActive: {
    color: '#fff',
  },
  settingsButton: {
    padding: 6,
  },
  profileLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 6,
  },
  profileInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  profileCancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  profileCancelText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 14,
  },
  profileSaveButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#10b981',
  },
  profileSaveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  avatarSwatch: {
    width: 36,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
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
    maxHeight: '90%',
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
  breakdownCircleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  breakdownCircle: {
    flex: 1,
    minHeight: 80,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  breakdownCircleLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  breakdownCircleValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  breakdownCircleStats: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  breakdownCircleStatText: {
    fontSize: 11,
    fontWeight: '700',
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
