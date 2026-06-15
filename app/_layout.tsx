import { BabyProvider } from "@/contexts/BabyContext";
import { PastelColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  clearLocalAuthSession,
  isNetworkAuthError,
  isSupabaseReachable,
  SUPABASE_DASHBOARD_URL,
  supabase,
} from "@/lib/supabase";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendUnreachable, setBackendUnreachable] = useState(false);

  const initAuth = useCallback(async () => {
    setLoading(true);
    setBackendUnreachable(false);

    const reachable = await isSupabaseReachable();
    if (!reachable) {
      await clearLocalAuthSession();
      setSession(null);
      setBackendUnreachable(true);
      setLoading(false);
      return;
    }

    try {
      const {
        data: { session: nextSession },
        error,
      } = await supabase.auth.getSession();
      if (error && isNetworkAuthError(error)) {
        await clearLocalAuthSession();
        setSession(null);
        setBackendUnreachable(true);
        return;
      }
      setSession(nextSession);
    } catch (error) {
      if (isNetworkAuthError(error)) {
        await clearLocalAuthSession();
        setBackendUnreachable(true);
      }
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void initAuth();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, [initAuth]);

  const onAuthScreen = segments[0] === "auth";

  if (loading) {
    return (
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <View
          style={{
            flex: 1,
            backgroundColor: PastelColors.background,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="large" color={PastelColors.accent} />
        </View>
        <StatusBar style="auto" />
      </ThemeProvider>
    );
  }

  if (backendUnreachable) {
    return (
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <View
          style={{
            flex: 1,
            backgroundColor: PastelColors.background,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 28,
            gap: 16,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "700", textAlign: "center", color: "#333" }}>
            서버에 연결할 수 없어요
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 22, textAlign: "center", color: "#666" }}>
            Supabase 프로젝트(ooahdan)가 일시 중지(INACTIVE) 상태입니다. 대시보드에서 Restore project를
            눌러 복구한 뒤 다시 시도해 주세요.
          </Text>
          <Pressable
            onPress={() => Linking.openURL(SUPABASE_DASHBOARD_URL)}
            style={{
              backgroundColor: PastelColors.accent,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Supabase 대시보드 열기</Text>
          </Pressable>
          <Pressable onPress={() => void initAuth()}>
            <Text style={{ color: PastelColors.accent, fontWeight: "600" }}>다시 연결</Text>
          </Pressable>
        </View>
        <StatusBar style="auto" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      {!session && <Redirect href="/auth" />}
      {session && onAuthScreen && <Redirect href="/(tabs)" />}
      <BabyProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="baby-onboarding" options={{ title: "아이 등록" }} />
          <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
          <Stack.Screen name="play-cards" options={{ headerShown: true, title: "우아놀이" }} />
          <Stack.Screen name="play-cards-video" options={{ headerShown: true, title: "우아놀이 (영상)" }} />
          <Stack.Screen name="record-inbox" options={{ headerShown: true, title: "우아기록" }} />
        </Stack>
      </BabyProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
