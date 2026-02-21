import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';

import ProductSalesScreen from './screens/ProductSalesScreen';
import PaymentTypesScreen from './screens/PaymentTypesScreen';
import PersonnelScreen from './screens/PersonnelScreen';
import HourlySalesScreen from './screens/HourlySalesScreen';
import CancelsScreen from './screens/CancelsScreen';
import DiscountScreen from './screens/DiscountScreen';

import OrdersScreen from './screens/OrdersScreen';
import OrderDetailScreen from './screens/OrderDetailScreen';
import DebtsScreen from './screens/DebtsScreen';
import CourierScreen from './screens/CourierScreen';
import UnpayableScreen from './screens/UnpayableScreen';
import StockEntryScreen from './screens/StockEntryScreen';
import LiveStockScreen from './screens/LiveStockScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState('Login');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const rememberMe = await AsyncStorage.getItem('remember_me');
        if (rememberMe === 'false') {
            await AsyncStorage.removeItem('token');
            // initialRoute remains 'Login'
        } else {
            const token = await AsyncStorage.getItem('token');
            if (token) {
              setInitialRoute('Dashboard');
            }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    checkToken();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="Dashboard" 
            component={DashboardScreen} 
            options={{ 
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="ProductSales" 
            component={ProductSalesScreen} 
            options={{ 
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="PaymentTypes" 
            component={PaymentTypesScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="Personnel" 
            component={PersonnelScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="HourlySales" 
            component={HourlySalesScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="Cancels" 
            component={CancelsScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="Discount" 
            component={DiscountScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="Orders" 
            component={OrdersScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="OrderDetail" 
            component={OrderDetailScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="Debts" 
            component={DebtsScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="Courier" 
            component={CourierScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="Unpayable" 
            component={UnpayableScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="StockEntry" 
            component={StockEntryScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="LiveStock" 
            component={LiveStockScreen} 
            options={{ headerShown: false }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
