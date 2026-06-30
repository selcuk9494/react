import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const getValue = (row, column) => {
  const raw = row?.[column.key];
  return column.format ? column.format(raw, row) : raw;
};

const slugify = (value) => String(value || 'rapor')
  .toLowerCase()
  .replace(/ğ/g, 'g')
  .replace(/ü/g, 'u')
  .replace(/ş/g, 's')
  .replace(/ı/g, 'i')
  .replace(/ö/g, 'o')
  .replace(/ç/g, 'c')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'rapor';

export default function ReportExportActions({ title, columns, rows = [] }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeColumns = Array.isArray(columns) ? columns : [];

  const exportCsv = async () => {
    try {
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        Alert.alert('Hata', 'Bu cihazda dosya paylaşımı kullanılamıyor.');
        return;
      }

      const csv = [
        safeColumns.map((column) => `"${String(column.label).replace(/"/g, '""')}"`).join(','),
        ...safeRows.map((row) =>
          safeColumns.map((column) => `"${String(getValue(row, column) ?? '').replace(/"/g, '""')}"`).join(','),
        ),
      ].join('\r\n');
      const uri = `${FileSystem.cacheDirectory}${slugify(title)}-${Date.now()}.csv`;
      const excelCompatibleCsv = `\uFEFF${csv}`;
      await FileSystem.writeAsStringAsync(uri, excelCompatibleCsv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: `${title} Excel`,
      });
    } catch (error) {
      console.error('CSV export error:', error);
      Alert.alert('Hata', 'Excel aktarımı oluşturulamadı.');
    }
  };

  const exportPdf = async () => {
    try {
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        Alert.alert('Hata', 'Bu cihazda dosya paylaşımı kullanılamıyor.');
        return;
      }

      const body = safeRows.map((row) => `
        <tr>${safeColumns.map((column) => `<td>${escapeHtml(getValue(row, column))}</td>`).join('')}</tr>
      `).join('');
      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Helvetica, Arial, sans-serif; padding: 20px; color: #111827; }
              h1 { font-size: 20px; margin-bottom: 16px; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; }
              th, td { border: 1px solid #d1d5db; padding: 7px; text-align: left; }
              th { background: #f3f4f6; }
            </style>
          </head>
          <body>
            <h1>${escapeHtml(title)}</h1>
            <table>
              <thead><tr>${safeColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead>
              <tbody>${body}</tbody>
            </table>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${title} PDF` });
    } catch (error) {
      console.error('PDF export error:', error);
      Alert.alert('Hata', 'PDF aktarımı oluşturulamadı.');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.button, styles.excel]} onPress={exportCsv}>
        <Feather name="file-text" size={14} color="#047857" />
        <Text style={[styles.text, styles.excelText]}>Excel</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.pdf]} onPress={exportPdf}>
        <MaterialCommunityIcons name="file-pdf-box" size={15} color="#b91c1c" />
        <Text style={[styles.text, styles.pdfText]}>PDF</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  excel: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  pdf: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  excelText: {
    color: '#047857',
  },
  pdfText: {
    color: '#b91c1c',
  },
});
