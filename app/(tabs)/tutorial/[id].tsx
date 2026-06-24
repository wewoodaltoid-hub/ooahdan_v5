import { TutorialStepVisual } from '@/components/tutorial/TutorialPreviews';
import { isBabyAdmin, useBaby } from '@/contexts/BabyContext';
import { Fonts, PastelColors, flashcardShadow, primaryCtaPadding } from '@/constants/theme';
import { alertMasterOnlyFeature } from '@/lib/master-only-alert';
import { getTutorialSection } from '@/lib/tutorial-content';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TutorialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activeBaby } = useBaby();
  const isAdmin = isBabyAdmin(activeBaby);
  const section = getTutorialSection(id ?? '');

  if (!section) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.notFound}>가이드를 찾을 수 없어요.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>← 목록으로</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const locked = section.masterOnly && !isAdmin;

  const handleStart = () => {
    if (locked) {
      alertMasterOnlyFeature();
      return;
    }
    if (section.route) {
      if (section.id === 'family-invite' && !isAdmin) {
        router.push('/join-baby');
        return;
      }
      router.push(section.route as '/manage-cards');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <MaterialIcons name="arrow-back" size={24} color={PastelColors.text} />
          </Pressable>
          <View style={styles.topBarText}>
            <Text style={styles.topTitle} numberOfLines={1}>
              {section.title}
            </Text>
            <Text style={styles.topSubtitle} numberOfLines={1}>
              {section.subtitle}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {section.steps.map((step, index) => (
            <View key={step.visual} style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
              </View>
              <TutorialStepVisual visualKey={step.visual} />
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          ))}

          {section.route ? (
            <Pressable
              style={({ pressed }) => [
                styles.cta,
                locked && styles.ctaLocked,
                pressed && !locked && styles.pressed,
              ]}
              onPress={handleStart}
            >
              <MaterialIcons
                name={locked ? 'lock' : 'play-arrow'}
                size={20}
                color={locked ? PastelColors.textSecondary : PastelColors.buttonTextOnPrimary}
              />
              <Text style={[styles.ctaText, locked && styles.ctaTextLocked]}>
                {locked
                  ? '마스터만 사용할 수 있어요'
                  : section.id === 'family-invite' && !isAdmin
                    ? '초대 코드로 연결하기'
                    : '바로 시작하기'}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PastelColors.background,
  },
  notFound: {
    fontSize: 16,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    padding: 20,
  },
  backLink: {
    fontSize: 14,
    color: PastelColors.primary,
    paddingHorizontal: 20,
    fontFamily: Fonts.rounded,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PastelColors.surface,
    ...flashcardShadow,
  },
  topBarText: {
    flex: 1,
    gap: 2,
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  topSubtitle: {
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  stepCard: {
    backgroundColor: PastelColors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PastelColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    fontFamily: Fonts.rounded,
  },
  stepTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PastelColors.buttonPrimary,
    borderRadius: 16,
    ...primaryCtaPadding,
  },
  ctaLocked: {
    backgroundColor: PastelColors.buttonViewerDisabled,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  ctaTextLocked: {
    color: PastelColors.textSecondary,
  },
  pressed: {
    opacity: 0.88,
  },
});
