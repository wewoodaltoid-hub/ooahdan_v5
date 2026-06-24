import { isBabyAdmin, useBaby } from '@/contexts/BabyContext';
import { Fonts, PastelColors, flashcardShadow } from '@/constants/theme';
import { TUTORIAL_SECTIONS } from '@/lib/tutorial-content';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TutorialHubScreen() {
  const router = useRouter();
  const { activeBaby } = useBaby();
  const isAdmin = isBabyAdmin(activeBaby);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>사용법</Text>
        <Text style={styles.subtitle}>우아홈 메뉴별로 기능을 익혀 보세요</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {TUTORIAL_SECTIONS.map((section) => {
            const locked = section.masterOnly && !isAdmin;
            return (
              <Pressable
                key={section.id}
                style={({ pressed }) => [
                  styles.card,
                  locked && styles.cardLocked,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => router.push(`/tutorial/${section.id}`)}
              >
                <View style={[styles.iconWrap, locked && styles.iconWrapLocked]}>
                  <MaterialIcons
                    name={section.icon}
                    size={32}
                    color={locked ? PastelColors.textSecondary : PastelColors.primary}
                  />
                </View>
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, locked && styles.cardTitleLocked]} numberOfLines={1}>
                    {section.title}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={2}>
                    {section.subtitle}
                  </Text>
                  {locked ? (
                    <View style={styles.lockBadge}>
                      <MaterialIcons name="lock" size={12} color={PastelColors.textSecondary} />
                      <Text style={styles.lockText}>마스터 전용 기능</Text>
                    </View>
                  ) : null}
                </View>
                <MaterialIcons name="chevron-right" size={22} color={PastelColors.textSecondary} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.tipBox}>
          <MaterialIcons name="lightbulb" size={20} color={PastelColors.primary} />
          <Text style={styles.tipText}>
            각 메뉴를 누르면 단계별 화면 미리보기와 함께 사용법을 확인할 수 있어요.{'\n'}
            예시 이미지는 어플 패치 및 디자인 수정에 따라 현재 어플 디자인과 상이할 수 있어요.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PastelColors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  subtitle: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  grid: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PastelColors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  cardLocked: {
    opacity: 0.72,
  },
  cardPressed: {
    opacity: 0.88,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: PastelColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapLocked: {
    backgroundColor: PastelColors.border,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  cardTitleLocked: {
    color: PastelColors.textSecondary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  lockText: {
    fontSize: 11,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: PastelColors.primaryLight,
    borderRadius: 14,
    padding: 14,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
});
