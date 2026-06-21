import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_ENABLED_KEY = 'ooahdan_push_notifications_enabled_v1';

/** 푸시 알림 수신 On/Off (로컬 설정 — 추후 expo-notifications 연동 예정) */
export async function getPushNotificationsEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PUSH_ENABLED_KEY);
  if (raw === null) return true;
  return raw === '1';
}

export async function setPushNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PUSH_ENABLED_KEY, enabled ? '1' : '0');
}
