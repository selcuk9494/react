import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Modal, Platform, TouchableWithoutFeedback } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';

export default function DateFilterComponent({
  period,
  setPeriod,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onApplyCustomDate,
}) {
  const [showDateModal, setShowDateModal] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handlePeriodChange = (newPeriod) => {
    if (newPeriod === 'custom') {
      setShowDateModal(true);
    } else {
      setPeriod(newPeriod);
    }
  };

  const handleApplyCustom = () => {
    setShowDateModal(false);
    onApplyCustomDate();
  };

  return (
    <View style={styles.container}>
      {/* Date Filter Scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateFilterScroll} contentContainerStyle={styles.dateFilterContent}>
        {[
          { id: 'today', label: 'Bugün', icon: '📅' },
          { id: 'yesterday', label: 'Dün', icon: '⏪' },
          { id: 'week', label: 'Bu Hafta', icon: '📆' },
          { id: 'last7days', label: 'Son 7 Gün', icon: '7️⃣' },
          { id: 'month', label: 'Bu Ay', icon: '📊' },
          { id: 'lastmonth', label: 'Geçen Ay', icon: '📉' },
          { id: 'custom', label: 'Özel Tarih', icon: '🔍' },
        ].map((p) => (
          <TouchableOpacity
            key={p.id}
            onPress={() => handlePeriodChange(p.id)}
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
                      style={{ width: 120 }}
                    />
                  )}
                  {showStartPicker && Platform.OS === 'android' && (
                    <DateTimePicker
                      value={startDate}
                      mode="date"
                      display="default"
                      onChange={(e, d) => {
                        setShowStartPicker(false);
                        if (d) setStartDate(d);
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
                      style={{ width: 120 }}
                    />
                  )}
                  {showEndPicker && Platform.OS === 'android' && (
                    <DateTimePicker
                      value={endDate}
                      mode="date"
                      display="default"
                      onChange={(e, d) => {
                        setShowEndPicker(false);
                        if (d) setEndDate(d);
                      }}
                    />
                  )}
                </View>

                <TouchableOpacity style={styles.applyButton} onPress={handleApplyCustom}>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
