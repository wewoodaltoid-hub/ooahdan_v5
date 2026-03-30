/**
 * 우아스냅 — 탭 전환은 tabPress에서 차단됨. 이 화면은 라우트용 최소 플레이스홀더.
 */
import { View } from 'react-native';
import { PastelColors } from '@/constants/theme';

export default function OoahSnapPlaceholder() {
  return <View style={{ flex: 1, backgroundColor: PastelColors.background }} />;
}
