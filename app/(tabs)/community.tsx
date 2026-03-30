import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PastelColors, Fonts } from '@/constants/theme';

export default function CommunityScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Text style={styles.title}>커뮤니티</Text>
        <Text style={styles.sub}>곧 만나요</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PastelColors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
});
