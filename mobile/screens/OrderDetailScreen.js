import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, ScrollView, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function OrderDetailScreen({ navigation, route }) {
  const { id, type = 'closed', adtur, fromCancels = false } = route.params;
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState(null);

  useEffect(() => {
    fetchOrderDetail();
  }, [id, type]);

  const fetchOrderDetail = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      // İptal listesinden geliyorsa önce closed dene, boş gelirse open dene
      let url = `${API_URL}/reports/order-detail/${id}?order_type=${type}`;
      if (adtur !== undefined) {
        url += `&adtur=${adtur}`;
      }
      
      console.log('Fetching order detail:', url);
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let data = response.data;
      
      // Eğer iptal listesinden geliyorsa ve items boş veya undefined ise, diğer type'ı dene
      if (fromCancels && (!data?.items || data.items.length === 0)) {
        const alternativeType = type === 'closed' ? 'open' : 'closed';
        const altUrl = `${API_URL}/reports/order-detail/${id}?order_type=${alternativeType}`;
        console.log('Trying alternative type:', altUrl);
        
        try {
          const altResponse = await axios.get(altUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (altResponse.data?.items && altResponse.data.items.length > 0) {
            data = altResponse.data;
          }
        } catch (altError) {
          console.log('Alternative type failed:', altError.message);
        }
      }
      
      setOrderData(data);
    } catch (error) {
      console.error('Order detail error:', error);
      Alert.alert('Hata', 'Adisyon detayları alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!orderData) return;

    let message = `*Adisyon Detayı*\n`;
    message += `Adisyon No: #${orderData.adsno || id}\n`;
    message += `Tarih: ${formatDate(orderData.tarih)}\n`;
    message += `Masa: ${orderData.masa_no === 0 ? 'Paket' : `Masa ${orderData.masa_no}`}\n`;
    message += `------------------\n`;
    
    orderData.items.forEach(item => {
        message += `${(item.quantity ?? item.miktar) || 1}x ${item.product_name || item.urun_adi} - ${formatCurrency((item.total ?? item.toplam) || 0)}\n`;
    });
    
    message += `------------------\n`;
    message += `*Toplam: ${formatCurrency(getTotalPaid())}*`;

    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Hata', 'WhatsApp açılamadı.');
    });
  };

  const handleSharePDF = async () => {
    if (!orderData) return;

    const html = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; }
            .info { margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
            .table { width: 100%; border-collapse: collapse; }
            .table th, .table td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; }
            .total { margin-top: 20px; text-align: right; font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Adisyon #${orderData.adsno || id}</div>
            <div>${formatDate(orderData.tarih)} - ${formatTime(orderData.acilis_saati)}</div>
          </div>
          
          <div class="info">
            <div><strong>Masa:</strong> ${orderData.masa_no === 0 ? 'Paket' : `Masa ${orderData.masa_no}`}</div>
            <div><strong>Garson:</strong> ${orderData.garson || orderData.garson_adi || '-'}</div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>Miktar</th>
                <th>Ürün</th>
                <th>Fiyat</th>
                <th>Tutar</th>
              </tr>
            </thead>
            <tbody>
              ${orderData.items.map(item => `
                <tr>
                  <td>${(item.quantity ?? item.miktar) || 1}</td>
                  <td>${item.product_name || item.urun_adi}</td>
                  <td>${formatCurrency((item.price ?? item.birim_fiyat) || 0)}</td>
                  <td>${formatCurrency((item.total ?? item.toplam) || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total">
            Toplam: ${formatCurrency(getTotalPaid())}
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', 'PDF oluşturulamadı.');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  };

  const getItemsSubtotal = () => {
    if (!orderData || !orderData.items || !Array.isArray(orderData.items)) return 0;
    return orderData.items.reduce((sum, item) => {
      const itemTotal = item.total || item.toplam || 0;
      return sum + Number(itemTotal);
    }, 0);
  };

  const getTotalPaid = () => {
    return Number(orderData?.toplam_tutar || 0);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Feather name="arrow-left" size={24} color="#334155" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Adisyon Detayı</Text>
            
            <View style={styles.headerActions}>
                <TouchableOpacity onPress={handleShareWhatsApp} style={styles.actionButton}>
                    <FontAwesome5 name="whatsapp" size={22} color="#25D366" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSharePDF} style={styles.actionButton}>
                    <MaterialCommunityIcons name="file-pdf-box" size={24} color="#ef4444" />
                </TouchableOpacity>
            </View>
         </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Info Card */}
        <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
                <View>
                    <Text style={styles.label}>Adisyon No</Text>
                    <Text style={styles.orderNo}>#{orderData?.adsno || id}</Text>
                    {orderData?.adtur !== undefined && (
                        <View style={styles.typeBadge}>
                            <Text style={styles.typeText}>
                                {orderData.adtur===0 ? 'Adisyon' : (orderData.adtur===1 ? 'Paket' : (orderData.adtur===3 ? 'Hızlı Satış' : 'Diğer'))}
                            </Text>
                        </View>
                    )}
                </View>
                {orderData?.type_label && (
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{orderData.type_label}</Text>
                    </View>
                )}
            </View>

            <View style={styles.grid}>
                {orderData?.masa_no !== undefined && orderData?.masa_no !== 99999 && (
                    <View style={styles.gridItem}>
                        <Feather name="map-pin" size={16} color="#818cf8" />
                        <View style={styles.gridTextContainer}>
                            <Text style={styles.gridLabel}>Masa</Text>
                            <Text style={styles.gridValue}>{orderData.masa_no === 0 ? 'Paket' : `Masa ${orderData.masa_no}`}</Text>
                        </View>
                    </View>
                )}
                
                {orderData?.tarih && (
                    <View style={styles.gridItem}>
                        <Feather name="calendar" size={16} color="#818cf8" />
                        <View style={styles.gridTextContainer}>
                            <Text style={styles.gridLabel}>Tarih</Text>
                            <Text style={styles.gridValue}>{formatDate(orderData.tarih)}</Text>
                        </View>
                    </View>
                )}

                {(orderData?.garson || orderData?.garson_adi) && (
                    <View style={styles.gridItem}>
                        <Feather name="user" size={16} color="#818cf8" />
                        <View style={styles.gridTextContainer}>
                            <Text style={styles.gridLabel}>Garson</Text>
                            <Text style={styles.gridValue}>{orderData.garson || orderData.garson_adi}</Text>
                        </View>
                    </View>
                )}

                {orderData?.acilis_saati && (
                    <View style={styles.gridItem}>
                        <Feather name="clock" size={16} color="#818cf8" />
                        <View style={styles.gridTextContainer}>
                            <Text style={styles.gridLabel}>Açılış</Text>
                            <Text style={styles.gridValue}>{formatTime(orderData.acilis_saati)}</Text>
                        </View>
                    </View>
                )}
            </View>
        </View>

        {/* Products List */}
        <View style={styles.productsSection}>
            <View style={styles.sectionHeader}>
                <Feather name="shopping-bag" size={20} color="#4f46e5" />
                <Text style={styles.sectionTitle}>Ürünler</Text>
                <View style={styles.countBadge}>
                    <Text style={styles.countText}>{orderData?.items?.length || 0} ürün</Text>
                </View>
            </View>

            {orderData?.items?.map((item, index) => {
                const sturu = item.sturu ?? 0;
                const isIptal = sturu === 4;
                const isIkram = sturu === 1;
                const isIade = sturu === 2;

                let statusStyle = {};
                let statusText = null;
                
                if (isIptal) {
                    statusStyle = { borderColor: '#fca5a5', backgroundColor: '#fef2f2' };
                    statusText = 'İPTAL';
                } else if (isIkram) {
                    statusStyle = { borderColor: '#93c5fd', backgroundColor: '#eff6ff' };
                    statusText = 'İKRAM';
                } else if (isIade) {
                    statusStyle = { borderColor: '#fdba74', backgroundColor: '#fff7ed' };
                    statusText = 'İADE';
                }

                return (
                    <View key={index} style={[styles.productCard, statusStyle]}>
                        <View style={styles.productHeader}>
                            <Text style={[styles.productName, isIptal && styles.strikethrough]}>
                                {item.product_name || item.urun_adi || 'Ürün'}
                            </Text>
                            {statusText && (
                                <View style={[styles.statusTag, 
                                    isIptal ? styles.bgRed : isIkram ? styles.bgBlue : styles.bgOrange
                                ]}>
                                    <Text style={[styles.statusTagText,
                                        isIptal ? styles.textRed : isIkram ? styles.textBlue : styles.textOrange
                                    ]}>{statusText}</Text>
                                </View>
                            )}
                        </View>
                        
                        <View style={styles.productDetails}>
                            <View style={styles.qtyPrice}>
                                <Text style={styles.qty}>{(item.quantity ?? item.miktar) || 1}x</Text>
                                <Text style={styles.price}>{formatCurrency((item.price ?? item.birim_fiyat) || 0)}</Text>
                            </View>
                            <Text style={[styles.total, isIptal && styles.strikethrough]}>
                                {formatCurrency((item.total ?? item.toplam) || 0)}
                            </Text>
                        </View>

                        {(item.ack1 || item.ack2 || item.ack3 || (item.notes && item.notes.length > 0)) && (
                            <View style={styles.notesContainer}>
                                <Text style={styles.notesTitle}>Notlar:</Text>
                                {item.ack1 && <Text style={styles.noteText}>• {item.ack1}</Text>}
                                {item.ack2 && <Text style={styles.noteText}>• {item.ack2}</Text>}
                                {item.ack3 && <Text style={styles.noteText}>• {item.ack3}</Text>}
                                {item.notes && item.notes.map((note, i) => (
                                    <Text key={i} style={styles.noteText}>• {note}</Text>
                                ))}
                            </View>
                        )}
                    </View>
                );
            })}
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ara Toplam</Text>
                <Text style={styles.summaryValue}>{formatCurrency(getItemsSubtotal())}</Text>
            </View>
            
            {orderData?.toplam_iskonto > 0 && (
                <View style={[styles.summaryRow, styles.discountRow]}>
                    <Text style={styles.discountLabel}>İndirim</Text>
                    <Text style={styles.discountValue}>-{formatCurrency(orderData.toplam_iskonto)}</Text>
                </View>
            )}
            
            <View style={styles.divider} />
            
            <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Toplam Tutar</Text>
                <Text style={styles.totalValue}>{formatCurrency(getTotalPaid())}</Text>
            </View>
        </View>
        
        <View style={{height: 40}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
  },
  content: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#4f46e5',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  label: {
    color: '#c7d2fe',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  orderNo: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  typeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  gridItem: {
    width: '50%',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridTextContainer: {
    marginLeft: 8,
  },
  gridLabel: {
    color: '#c7d2fe',
    fontSize: 10,
  },
  gridValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  productsSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginLeft: 8,
    marginRight: 8,
  },
  countBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countText: {
    color: '#4338ca',
    fontSize: 12,
    fontWeight: '600',
  },
  productCard: {
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
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  bgRed: { backgroundColor: '#fef2f2', borderColor: '#fee2e2' },
  bgBlue: { backgroundColor: '#eff6ff', borderColor: '#dbeafe' },
  bgOrange: { backgroundColor: '#fff7ed', borderColor: '#ffedd5' },
  textRed: { color: '#b91c1c' },
  textBlue: { color: '#1d4ed8' },
  textOrange: { color: '#c2410c' },
  strikethrough: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  productDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  qtyPrice: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qty: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    marginRight: 8,
  },
  price: {
    fontSize: 14,
    color: '#64748b',
  },
  total: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  notesContainer: {
    marginTop: 12,
    backgroundColor: '#fffbeb',
    padding: 8,
    borderRadius: 8,
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 2,
  },
  noteText: {
    fontSize: 11,
    color: '#b45309',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  discountRow: {
    backgroundColor: '#ecfdf5',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountLabel: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '600',
  },
  discountValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    margin: -20,
    marginTop: 0,
    padding: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },
});
