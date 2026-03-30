import { Fonts, PastelColors, flashcardShadow } from "@/constants/theme";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useRouter } from "expo-router";

WebBrowser.maybeCompleteAuthSession();

const KAKAO_BG = "#FEE500";
const KAKAO_TEXT = "#191919";

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleKakaoLogin() {
    try {
      setLoading(true);
      const redirectTo = await makeRedirectUri({ scheme: "ooahdan" });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo },
      });
      if (error) throw error;
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );
        if (result.type === "success" && result.url) {
          const url = result.url;
          const [_, fragment] = url.split("#");
          const params = new URLSearchParams(fragment || "");
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
          router.replace("/(tabs)");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "카카오 로그인에 실패했어요.";
      Alert.alert("로그인 실패", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.sheet}>
          <Text style={styles.logo}>우아단</Text>
          <Text style={styles.intro}>
            우리 아이의 말걸기 기록을 남기고{"\n"}
            언어 성장을 함께 응원해요
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.kakaoButton,
              pressed && styles.kakaoButtonPressed,
              loading && styles.kakaoButtonDisabled,
            ]}
            onPress={handleKakaoLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={KAKAO_TEXT} size="small" />
            ) : (
              <>
                <Text style={styles.kakaoIcon}>💬</Text>
                <Text style={styles.kakaoButtonText}>카카오로 시작하기</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PastelColors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    width: "100%",
    maxWidth: 360,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: PastelColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  logo: {
    fontSize: 36,
    fontWeight: "700",
    color: PastelColors.text,
    marginBottom: 12,
    letterSpacing: -0.5,
    fontFamily: Fonts.rounded,
  },
  intro: {
    fontSize: 16,
    lineHeight: 24,
    color: PastelColors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    fontFamily: Fonts.rounded,
  },
  kakaoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: KAKAO_BG,
    width: "100%",
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 10,
  },
  kakaoButtonPressed: {
    opacity: 0.9,
  },
  kakaoButtonDisabled: {
    opacity: 0.7,
  },
  kakaoIcon: {
    fontSize: 22,
  },
  kakaoButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: KAKAO_TEXT,
    fontFamily: Fonts.rounded,
  },
});
