/**
 * 초대 코드로 아이(가족) 연결.
 * 6자리 코드 입력 → invite_codes 조회 → 만료/중복 검사 → family_connections INSERT → Context 갱신 후 메인으로.
 */

import { useBaby } from "@/contexts/BabyContext";
import { PastelColors, Fonts, flashcardShadow, primaryCtaPadding } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { Stack, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function JoinBabyScreen() {
  const router = useRouter();
  const { refreshBabies, setActiveBaby } = useBaby();
  const [code, setCode] = useState("");
  const [connecting, setConnecting] = useState(false);

  const handleConnect = useCallback(async () => {
    const raw = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (raw.length !== 6) {
      Alert.alert("코드 입력", "6자리 초대 코드를 입력해 주세요.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("로그인이 필요해요.");
      return;
    }
    setConnecting(true);
    try {
      const { data: invite, error: inviteError } = await supabase
        .from("invite_codes")
        .select("id, baby_id, role, expires_at")
        .eq("code", raw)
        .single();

      if (inviteError || !invite) {
        Alert.alert("코드 오류", "유효하지 않거나 만료된 코드입니다.");
        setConnecting(false);
        return;
      }
      if (new Date(invite.expires_at) < new Date()) {
        Alert.alert("코드 만료", "유효하지 않거나 만료된 코드입니다.");
        setConnecting(false);
        return;
      }

      const { data: existing } = await supabase
        .from("family_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("baby_id", invite.baby_id)
        .maybeSingle();
      if (existing) {
        Alert.alert("이미 연결됨", "이미 연결된 아이입니다.");
        setConnecting(false);
        return;
      }

      const { error: insertError } = await supabase.from("family_connections").insert([
        { user_id: user.id, baby_id: invite.baby_id, role: invite.role },
      ]);
      if (insertError) {
        Alert.alert("연결 실패", insertError.message);
        setConnecting(false);
        return;
      }

      const babyId = invite.baby_id;
      Alert.alert("환영해요!", "우아단 가족이 되신 것을 환영합니다!", [
        {
          text: "확인",
          onPress: async () => {
            const newList = await refreshBabies();
            const connected = newList.find((b) => b.id === babyId);
            if (connected) setActiveBaby(connected);
            router.back();
          },
        },
      ]);
    } catch (e) {
      Alert.alert("오류", e instanceof Error ? e.message : "연결 중 오류가 났어요.");
    } finally {
      setConnecting(false);
    }
  }, [code, refreshBabies, setActiveBaby, router]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "초대 코드로 연결",
          headerBackTitle: "메인",
          headerStyle: { backgroundColor: PastelColors.background },
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: Fonts.rounded, fontSize: 17, fontWeight: "600" },
        }}
      />
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.content}>
            <View style={styles.formCard}>
              <Text style={styles.hint}>초대 코드를 입력해주세요</Text>
              <TextInput
                style={styles.input}
                placeholder="예: A7X9B2"
                placeholderTextColor={PastelColors.textSecondary}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                editable={!connecting}
              />
              <Pressable
                style={[styles.button, connecting && styles.buttonDisabled]}
                onPress={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>연결하기</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PastelColors.background },
  keyboard: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32, alignItems: "center" },
  formCard: {
    width: "100%",
    backgroundColor: PastelColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    padding: 24,
    alignItems: "center",
    ...flashcardShadow,
  },
  hint: {
    fontSize: 17,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 20,
  },
  input: {
    width: "100%",
    height: 64,
    backgroundColor: PastelColors.background,
    borderRadius: 16,
    paddingHorizontal: 24,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 10,
    color: PastelColors.text,
    textAlign: "center",
    marginBottom: 28,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  button: {
    width: "100%",
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: PastelColors.buttonPrimary,
    justifyContent: "center",
    alignItems: "center",
    ...primaryCtaPadding,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
});
