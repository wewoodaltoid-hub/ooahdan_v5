import { Fonts, PastelColors, primaryCtaPadding } from "@/constants/theme";
import { useUserStore } from "@/stores/user-store";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const INPUT_RADIUS = 16;
const BUTTON_RADIUS = 16;

export default function OnboardingScreen() {
  const setChildName = useUserStore((s) => s.setChildName);
  const [babyName, setBabyName] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);

  const canStart = termsAgreed;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>환영합니다!</Text>
          <Text style={styles.subtitle}>우리아가의 이름을 알려주세요</Text>

          <TextInput
            style={styles.input}
            placeholder="우리 아이 이름 (예: 우리 아이)"
            placeholderTextColor={PastelColors.textSecondary}
            value={babyName}
            onChangeText={setBabyName}
            autoCapitalize="words"
          />

          <View style={styles.termsRow}>
            <Switch
              value={termsAgreed}
              onValueChange={setTermsAgreed}
              trackColor={{ false: PastelColors.border, true: PastelColors.accent }}
              thumbColor="#fff"
            />
            <Text style={styles.termsLabel}>[필수] 개인정보 수집 및 이용 동의</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              canStart ? styles.buttonPrimary : styles.buttonDisabledLocked,
              pressed && canStart && styles.buttonPressed,
            ]}
onPress={() => {
                if (canStart) {
                  if (babyName.trim()) setChildName(babyName.trim());
                  Alert.alert("안내", "정보 저장 기능은 준비 중입니다.");
                }
              }}
            disabled={!canStart}
          >
            <Text
              style={[
                canStart ? styles.buttonPrimaryText : styles.buttonDisabledText,
              ]}
            >
              우아단 시작하기
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PastelColors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: PastelColors.text,
    marginBottom: 8,
    textAlign: "center",
    fontFamily: Fonts.rounded,
  },
  subtitle: {
    fontSize: 17,
    color: PastelColors.textSecondary,
    marginBottom: 32,
    textAlign: "center",
    fontFamily: Fonts.rounded,
  },
  input: {
    height: 56,
    backgroundColor: PastelColors.cardBg,
    borderRadius: INPUT_RADIUS,
    paddingHorizontal: 20,
    fontSize: 17,
    color: PastelColors.text,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: PastelColors.border,
    fontFamily: Fonts.rounded,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
  },
  termsLabel: {
    fontSize: 15,
    color: PastelColors.text,
    flex: 1,
    fontFamily: Fonts.rounded,
  },
  button: {
    minHeight: 56,
    borderRadius: BUTTON_RADIUS,
    justifyContent: "center",
    alignItems: "center",
    ...primaryCtaPadding,
  },
  buttonPrimary: {
    backgroundColor: PastelColors.buttonPrimary,
  },
  buttonPrimaryText: {
    fontSize: 18,
    fontWeight: "600",
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabledLocked: {
    backgroundColor: PastelColors.buttonViewerDisabled,
  },
  buttonDisabledText: {
    fontSize: 18,
    fontWeight: "600",
    color: PastelColors.textSecondary,
    opacity: 0.8,
  },
});
