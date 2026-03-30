/**
 * 가족 초대 및 관리.
 * 권한별로 유효한 기존 코드가 있으면 재활용, 없으면 신규 6자리 발급 후 INSERT.
 */

import { isBabyAdmin, useBaby } from "@/contexts/BabyContext";
import { PastelColors, Fonts, flashcardShadow, primaryCtaPadding } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import * as Clipboard from "expo-clipboard";
import { Redirect, Stack, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

function titleWithParticle(name: string): string {
  if (!name.trim()) return "우리 아이의 가족 초대";
  const last = name.charCodeAt(name.length - 1);
  const hasJongseong = (last - 0xac00) % 28 !== 0;
  return `${name}${hasJongseong ? "이" : "가"}의 가족 초대`;
}

type Role = "admin" | "observer";

export default function FamilyInviteScreen() {
  const router = useRouter();
  const { activeBaby, loading: babiesLoading, loaded: babiesLoaded } = useBaby();
  const [role, setRole] = useState<Role>("admin");
  const [issuing, setIssuing] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  const handleIssue = useCallback(async () => {
    if (!activeBaby?.id) return;
    setIssuing(true);
    setIssuedCode(null);
    try {
      const now = new Date().toISOString();
      const { data: existing, error: selectError } = await supabase
        .from("invite_codes")
        .select("code")
        .eq("baby_id", activeBaby.id)
        .eq("role", role)
        .gt("expires_at", now)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (selectError) {
        Alert.alert("조회 실패", selectError.message);
        setIssuing(false);
        return;
      }

      if (existing?.code) {
        setIssuedCode(existing.code);
        Alert.alert("유효한 코드 있음", "기존에 발급된 유효한 코드를 불러왔습니다.");
        setIssuing(false);
        return;
      }

      const code = generateInviteCode();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      const { error } = await supabase.from("invite_codes").insert([
        { code, baby_id: activeBaby.id, role, expires_at: expiresAt.toISOString() },
      ]);
      if (error) {
        Alert.alert("발급 실패", error.message);
        setIssuing(false);
        return;
      }
      setIssuedCode(code);
    } catch (e) {
      Alert.alert("오류", e instanceof Error ? e.message : "초대 코드 발급 중 오류가 났어요.");
    } finally {
      setIssuing(false);
    }
  }, [activeBaby?.id, role]);

  const handleCopy = useCallback(async () => {
    if (!issuedCode) return;
    const text = `우아단 앱에 초대합니다! 초대 코드: ${issuedCode}`;
    await Clipboard.setStringAsync(text);
    Alert.alert("복사 완료", "초대 코드가 복사되었습니다!");
  }, [issuedCode]);

  if (babiesLoaded && !babiesLoading && activeBaby && !isBabyAdmin(activeBaby)) {
    return <Redirect href="/(tabs)" />;
  }

  if (!activeBaby) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "가족 초대 및 관리",
            headerBackTitle: "메인",
            headerStyle: { backgroundColor: PastelColors.background },
            headerShadowVisible: false,
            headerTitleStyle: { fontFamily: Fonts.rounded, fontSize: 17, fontWeight: "600" },
          }}
        />
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
          <View style={styles.empty}>
            <Text style={styles.emptyText}>선택된 아이가 없어요.</Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.backText}>← 뒤로</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const title = titleWithParticle(activeBaby.name);

  return (
    <>
      <Stack.Screen
        options={{
          title: "가족 초대 및 관리",
          headerBackTitle: "메인",
          headerStyle: { backgroundColor: PastelColors.background },
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: Fonts.rounded, fontSize: 17, fontWeight: "600" },
        }}
      />
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{title}</Text>

          <Text style={styles.sectionLabel}>초대 권한 선택</Text>
          <Pressable
            style={[styles.roleCard, role === "admin" && styles.roleCardActive]}
            onPress={() => setRole("admin")}
          >
            <Text style={styles.roleEmoji}>👑</Text>
            <View style={styles.roleTextWrap}>
              <Text style={styles.roleTitle}>우아마스터</Text>
              <Text style={styles.roleDesc}>
                단어 추가, 아카이브 영구 저장 및 프로필 관리 등 모든 권한을 가집니다.
              </Text>
            </View>
            <View style={[styles.radioOuter, role === "admin" && styles.radioOuterActive]}>
              {role === "admin" && <View style={styles.radioInner} />}
            </View>
          </Pressable>
          <Pressable
            style={[styles.roleCard, role === "observer" && styles.roleCardActive]}
            onPress={() => setRole("observer")}
          >
            <Text style={styles.roleEmoji}>👀</Text>
            <View style={styles.roleTextWrap}>
              <Text style={styles.roleTitle}>우아팬클럽</Text>
              <Text style={styles.roleDesc}>
                우아놀이 임시 기록은 볼 수 없으며, 마스터가 영구 저장한 '아카이브'의 기록만 열람/재생 가능합니다.
              </Text>
            </View>
            <View style={[styles.radioOuter, role === "observer" && styles.radioOuterActive]}>
              {role === "observer" && <View style={styles.radioInner} />}
            </View>
          </Pressable>

          <Pressable
            style={[styles.issueButton, issuing && styles.issueButtonDisabled]}
            onPress={handleIssue}
            disabled={issuing}
          >
            {issuing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.issueButtonText}>초대 코드 발급받기</Text>
            )}
          </Pressable>

          {issuedCode && (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>발급된 초대 코드</Text>
              <Text style={styles.resultCode}>{issuedCode}</Text>
              <Pressable style={styles.copyButton} onPress={handleCopy}>
                <Text style={styles.copyButtonText}>복사하기</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PastelColors.background },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { fontSize: 16, color: PastelColors.textSecondary, fontFamily: Fonts.rounded, marginBottom: 16 },
  backText: { fontSize: 16, color: PastelColors.accent, fontFamily: Fonts.rounded, fontWeight: "600" },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 12,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: PastelColors.border,
    backgroundColor: PastelColors.cardBg,
    ...flashcardShadow,
  },
  roleCardActive: {
    borderWidth: 2,
    borderColor: PastelColors.accent,
    backgroundColor: PastelColors.primaryLight,
  },
  roleEmoji: { fontSize: 28, marginRight: 14 },
  roleTextWrap: { flex: 1 },
  roleTitle: { fontSize: 17, fontWeight: "700", color: PastelColors.text, fontFamily: Fonts.rounded, marginBottom: 6 },
  roleDesc: { fontSize: 14, color: PastelColors.textSecondary, fontFamily: Fonts.rounded, lineHeight: 20 },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PastelColors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  radioOuterActive: { borderColor: PastelColors.accent },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: PastelColors.accent,
  },
  issueButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: PastelColors.buttonPrimary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
    ...primaryCtaPadding,
  },
  issueButtonDisabled: { opacity: 0.7 },
  issueButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  resultBox: {
    marginTop: 32,
    padding: 28,
    borderRadius: 16,
    backgroundColor: PastelColors.cardBg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  resultLabel: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 16,
  },
  resultCode: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 8,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 24,
  },
  copyButton: {
    ...primaryCtaPadding,
    borderRadius: 14,
    backgroundColor: PastelColors.buttonPrimary,
    alignItems: "center",
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
});
