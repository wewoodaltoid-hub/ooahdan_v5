/**
 * 등록된 아이가 0명일 때 표시. 새 아이 등록 또는 초대 코드 입력으로 연결.
 */

import { useBaby } from "@/contexts/BabyContext";
import { PastelColors, Fonts, flashcardShadow, primaryCtaPadding } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const INPUT_RADIUS = 16;
const BUTTON_RADIUS = 16;

function BabyOnboardingContent() {
  const router = useRouter();
  const { refreshBabies } = useBaby();
  const [mode, setMode] = useState<"choice" | "register" | "invite">("choice");
  const [babyName, setBabyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const name = babyName.trim();
    if (!name) {
      Alert.alert("이름을 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("로그인이 필요해요.");
        setLoading(false);
        return;
      }
      const { data: baby, error: babyError } = await supabase
        .from("babies")
        .insert([{ name }])
        .select("id")
        .single();
      if (babyError || !baby) {
        Alert.alert("등록 실패", babyError?.message ?? "아이를 등록하지 못했어요.");
        setLoading(false);
        return;
      }
      const { error: connError } = await supabase.from("family_connections").insert([
        { user_id: user.id, baby_id: baby.id, role: "admin" },
      ]);
      if (connError) {
        Alert.alert("연결 실패", connError.message);
        setLoading(false);
        return;
      }
      await refreshBabies();
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("오류", e instanceof Error ? e.message : "등록 중 오류가 났어요.");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSubmit = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      Alert.alert("초대 코드를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("로그인이 필요해요.");
        setLoading(false);
        return;
      }
      const { data: invite, error: inviteError } = await supabase
        .from("invite_codes")
        .select("id, baby_id, role, expires_at")
        .eq("code", code)
        .single();
      if (inviteError || !invite) {
        Alert.alert("유효하지 않은 코드예요.", "코드를 확인해 주세요.");
        setLoading(false);
        return;
      }
      if (new Date(invite.expires_at) < new Date()) {
        Alert.alert("만료된 코드예요.");
        setLoading(false);
        return;
      }
      const { error: connError } = await supabase.from("family_connections").insert([
        { user_id: user.id, baby_id: invite.baby_id, role: invite.role },
      ]);
      if (connError) {
        if (connError.code === "23505") Alert.alert("이미 연결된 아이예요.");
        else Alert.alert("연결 실패", connError.message);
        setLoading(false);
        return;
      }
      await refreshBabies();
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("오류", e instanceof Error ? e.message : "연결 중 오류가 났어요.");
    } finally {
      setLoading(false);
    }
  };

  if (mode === "choice") {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>아이를 등록해 주세요</Text>
          <Text style={styles.subtitle}>아이를 등록하거나 초대 코드를 입력해 주세요.</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={() => setMode("register")}
          >
            <Text style={styles.primaryButtonText}>➕ 새 아이 등록하기</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={() => setMode("invite")}
          >
            <Text style={styles.secondaryButtonText}>🔗 초대 코드로 연결하기</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (mode === "register") {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => setMode("choice")} style={styles.backRow}>
              <Text style={styles.backText}>← 뒤로</Text>
            </Pressable>
            <Text style={styles.title}>새 아이 등록</Text>
            <Text style={styles.subtitle}>우리 아이 이름을 입력해 주세요.</Text>
            <TextInput
              style={styles.input}
              placeholder="이름 (예: 한율)"
              placeholderTextColor={PastelColors.textSecondary}
              value={babyName}
              onChangeText={setBabyName}
              autoCapitalize="words"
              editable={!loading}
            />
            <Pressable
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>등록하기</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => setMode("choice")} style={styles.backRow}>
            <Text style={styles.backText}>← 뒤로</Text>
          </Pressable>
          <Text style={styles.title}>초대 코드 입력</Text>
          <Text style={styles.subtitle}>가족이 공유한 초대 코드를 입력하세요.</Text>
          <TextInput
            style={styles.input}
            placeholder="초대 코드"
            placeholderTextColor={PastelColors.textSecondary}
            value={inviteCode}
            onChangeText={(t) => setInviteCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
          />
          <Pressable
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleInviteSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>연결하기</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function BabyOnboardingScreen() {
  return <BabyOnboardingContent />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PastelColors.background },
  keyboardView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 48 },
  backRow: { marginBottom: 24 },
  backText: { fontSize: 16, color: PastelColors.accent, fontFamily: Fonts.rounded, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "700", color: PastelColors.text, marginBottom: 8, fontFamily: Fonts.rounded },
  subtitle: { fontSize: 16, color: PastelColors.textSecondary, marginBottom: 32, fontFamily: Fonts.rounded },
  input: {
    height: 56,
    backgroundColor: PastelColors.cardBg,
    borderRadius: INPUT_RADIUS,
    paddingHorizontal: 20,
    fontSize: 17,
    color: PastelColors.text,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: PastelColors.buttonPrimary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    ...primaryCtaPadding,
  },
  primaryButtonText: { fontSize: 18, fontWeight: "600", color: PastelColors.buttonTextOnPrimary, fontFamily: Fonts.rounded },
  secondaryButton: {
    minHeight: 56,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: PastelColors.cardBg,
    justifyContent: "center",
    alignItems: "center",
    ...primaryCtaPadding,
    borderWidth: 2,
    borderColor: PastelColors.accent,
    ...flashcardShadow,
  },
  secondaryButtonText: { fontSize: 18, fontWeight: "600", color: PastelColors.accent, fontFamily: Fonts.rounded },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { opacity: 0.7 },
});
