import AsyncStorage from '@react-native-async-storage/async-storage';

const PERIOD_KEY = 'report_period';
const START_KEY = 'report_start_date';
const END_KEY = 'report_end_date';
const KASA_KEY = 'report_kasa_no';

const ALLOWED = [
  'today',
  'yesterday',
  'week',
  'last7days',
  'month',
  'lastmonth',
  'custom',
];

export async function readStoredPeriod() {
  try {
    const saved =
      (await AsyncStorage.getItem(PERIOD_KEY)) ||
      (await AsyncStorage.getItem('dashboard_period')) ||
      'today';
    const period = ALLOWED.includes(saved) ? saved : 'today';
    const startDate =
      (await AsyncStorage.getItem(START_KEY)) ||
      (await AsyncStorage.getItem('dashboard_start_date')) ||
      '';
    const endDate =
      (await AsyncStorage.getItem(END_KEY)) ||
      (await AsyncStorage.getItem('dashboard_end_date')) ||
      '';
    if (period === 'custom' && (!startDate || !endDate)) {
      return { period: 'today', startDate: '', endDate: '' };
    }
    return { period, startDate, endDate };
  } catch {
    return { period: 'today', startDate: '', endDate: '' };
  }
}

export async function persistPeriod(period, startDate = '', endDate = '') {
  try {
    await AsyncStorage.setItem(PERIOD_KEY, period);
    await AsyncStorage.setItem('dashboard_period', period);
    if (period === 'custom') {
      if (startDate) {
        await AsyncStorage.setItem(START_KEY, startDate);
        await AsyncStorage.setItem('dashboard_start_date', startDate);
      }
      if (endDate) {
        await AsyncStorage.setItem(END_KEY, endDate);
        await AsyncStorage.setItem('dashboard_end_date', endDate);
      }
    }
  } catch {}
}

export async function readStoredKasaNo() {
  try {
    return (await AsyncStorage.getItem(KASA_KEY)) || '';
  } catch {
    return '';
  }
}

export async function persistKasaNo(kasaNo) {
  try {
    if (!kasaNo) {
      await AsyncStorage.removeItem(KASA_KEY);
      return;
    }
    await AsyncStorage.setItem(KASA_KEY, String(kasaNo));
  } catch {}
}

export function getBranchKasaOptions(user) {
  if (!user?.branches?.length) return [];
  const idx = typeof user.selected_branch === 'number' ? user.selected_branch : 0;
  const branch =
    (user.selected_branch_id &&
      user.branches.find((b) => String(b?.id) === String(user.selected_branch_id))) ||
    user.branches[idx] ||
    user.branches[0];
  if (!branch) return [];
  const nos = [];
  const primary = Number(branch.kasa_no);
  if (Number.isFinite(primary) && primary > 0) nos.push(primary);
  const extras = Array.isArray(branch.kasalar) ? branch.kasalar : [];
  for (const k of extras) {
    const n = Number(k);
    if (Number.isFinite(n) && n > 0) nos.push(n);
  }
  return Array.from(new Set(nos)).sort((a, b) => a - b);
}

/** URLSearchParams / query string'e period + kasa ekle */
export function appendReportParams(params, { period, startDate, endDate, kasaNo }) {
  params.append('period', period || 'today');
  if (period === 'custom') {
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
  }
  if (kasaNo) params.append('kasa_no', String(kasaNo));
  return params;
}
