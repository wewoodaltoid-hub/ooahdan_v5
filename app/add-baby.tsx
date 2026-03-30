/**
 * 새 아이 등록.
 * 프로필 사진(앨범), 이름, 생년월일 → Storage 업로드 → babies INSERT → family_connections INSERT → Context 갱신 후 메인으로.
 */

import { useBaby, isBabyAdmin } from "@/contexts/BabyContext";
import type { Baby } from "@/contexts/BabyContext";
import { PastelColors, Fonts, flashcardShadow, primaryCtaPadding } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Redirect, Stack, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";

const DEFAULT_AVATAR = require("@/assets/images/icon.png");
const INPUT_RADIUS = 16;
const BUTTON_RADIUS = 16;
const AVATAR_BUCKET = "avatars";

function formatDateForInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AddBabyScreen() {
  const router = useRouter();
  const { refreshBabies, setActiveBaby, activeBaby, loading: babiesLoading, loaded: babiesLoaded } = useBaby();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "앨범 접근 권한이 필요해요. 설정에서 허용해 주세요.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfileImageUri(result.assets[0].uri);
    }
  }, []);

  const handleRegister = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("이름을 입력해 주세요.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("로그인이 필요해요.");
      return;
    }
    setSaving(true);
    try {
      const birthDateStr = formatDateForInput(birthDate);
      let profileImageUrl: string | null = null;

      const { data: baby, error: insertBabyError } = await supabase
        .from("babies")
        .insert([{ name: trimmedName, birth_date: birthDateStr, profile_image_url: null }])
        .select("id, name, profile_image_url, birth_date, created_at")
        .single();

      if (insertBabyError || !baby) {
        Alert.alert("등록 실패", insertBabyError?.message ?? "아이를 등록하지 못했어요.");
        setSaving(false);
        return;
      }

      if (profileImageUri && profileImageUri.startsWith("file://")) {
        const base64 = await FileSystem.readAsStringAsync(profileImageUri, { encoding: "base64" });
        const ext = profileImageUri.toLowerCase().includes(".png") ? "png" : "jpg";
        const fileName = `${baby.id}/${Date.now()}.${ext}`;
        const contentType = ext === "png" ? "image/png" : "image/jpeg";
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(fileName, decode(base64), { contentType, upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(fileName);
          profileImageUrl = urlData.publicUrl;
          await supabase.from("babies").update({ profile_image_url: profileImageUrl }).eq("id", baby.id);
        }
      }

      const { error: connError } = await supabase.from("family_connections").insert([
        { user_id: user.id, baby_id: baby.id, role: "admin" },
      ]);
      if (connError) {
        Alert.alert("연결 실패", connError.message);
        setSaving(false);
        return;
      }

      const newBaby: Baby = {
        id: baby.id,
        name: baby.name ?? trimmedName,
        profile_image_url: profileImageUrl ?? baby.profile_image_url,
        birth_date: baby.birth_date ?? birthDateStr,
        created_at: baby.created_at ?? new Date().toISOString(),
        role: "admin",
        relation_name: null,
      };
      const list = await refreshBabies();
      const created = list.find((b) => b.id === baby.id);
      setActiveBaby(created ?? newBaby);
      router.back();
    } catch (e) {
      Alert.alert("오류", e instanceof Error ? e.message : "등록 중 오류가 났어요.");
    } finally {
      setSaving(false);
    }
  }, [name, birthDate, profileImageUri, refreshBabies, setActiveBaby, router]);

  if (babiesLoaded && !babiesLoading && activeBaby && !isBabyAdmin(activeBaby)) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "새 아이 등록",
          headerBackTitle: "메인",
          headerStyle: { backgroundColor: PastelColors.background },
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: Fonts.rounded, fontSize: 17, fontWeight: "600" },
        }}
      />
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formCard}>
              <Pressable style={styles.avatarWrap} onPress={pickImage}>
                <Image
                  source={profileImageUri ? { uri: profileImageUri } : DEFAULT_AVATAR}
                  style={styles.avatar}
                />
                <Text style={styles.avatarHint}>사진 탭하여 등록</Text>
              </Pressable>

              <Text style={styles.label}>이름</Text>
              <TextInput
                style={styles.input}
                placeholder="아이 이름"
                placeholderTextColor={PastelColors.textSecondary}
                value={name}
                onChangeText={setName}
                editable={!saving}
              />

              <Text style={styles.label}>생년월일</Text>
              <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)} disabled={saving}>
                <Text style={styles.dateButtonText}>{formatDateForInput(birthDate)}</Text>
              </Pressable>

              {showDatePicker && (
                <DateTimePicker
                  value={birthDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, d) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (d) setBirthDate(d);
                  }}
                  maximumDate={new Date()}
                />
              )}

              <Pressable
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleRegister}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>등록하기</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PastelColors.background },
  keyboard: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  formCard: {
    backgroundColor: PastelColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    padding: 24,
    ...flashcardShadow,
  },
  avatarWrap: { alignItems: "center", marginBottom: 32 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: PastelColors.cardBg },
  avatarHint: { marginTop: 8, fontSize: 14, color: PastelColors.textSecondary, fontFamily: Fonts.rounded },
  label: { fontSize: 14, fontWeight: "600", color: PastelColors.text, marginBottom: 8, fontFamily: Fonts.rounded },
  input: {
    height: 52,
    backgroundColor: PastelColors.cardBg,
    borderRadius: INPUT_RADIUS,
    paddingHorizontal: 20,
    fontSize: 17,
    color: PastelColors.text,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  dateButton: {
    height: 52,
    backgroundColor: PastelColors.cardBg,
    borderRadius: INPUT_RADIUS,
    paddingHorizontal: 20,
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  dateButtonText: { fontSize: 17, color: PastelColors.text, fontFamily: Fonts.rounded },
  submitButton: {
    minHeight: 56,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: PastelColors.buttonPrimary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    ...primaryCtaPadding,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
});
