/**
 * 현재 선택된 아이(activeBaby) 프로필 수정.
 * 프로필 사진(앨범), 이름, 생년월일 → Supabase UPDATE + Storage 업로드 → Context 즉시 반영.
 */

import { isBabyAdmin, useBaby } from "@/contexts/BabyContext";
import { PastelColors, Fonts, flashcardShadow, primaryCtaPadding } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Redirect, Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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

function parseBirthDate(s: string | null): Date {
  if (!s) return new Date();
  const [y, m, d] = s.split("-").map(Number);
  if (y && m && d) return new Date(y, m - 1, d);
  return new Date();
}

export default function BabyEditScreen() {
  const router = useRouter();
  const { activeBaby, updateActiveBaby, refreshBabies, setActiveBaby, loading: babiesLoading, loaded: babiesLoaded } = useBaby();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!activeBaby) return;
    setName(activeBaby.name ?? "");
    setBirthDate(parseBirthDate(activeBaby.birth_date));
    setProfileImageUri(activeBaby.profile_image_url);
  }, [activeBaby?.id]);

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

  const handleSave = useCallback(async () => {
    if (!activeBaby?.id) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("이름을 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      let profileImageUrl: string | null = profileImageUri;

      if (profileImageUri && profileImageUri.startsWith("file://")) {
        const base64 = await FileSystem.readAsStringAsync(profileImageUri, { encoding: "base64" });
        const ext = profileImageUri.toLowerCase().includes(".png") ? "png" : "jpg";
        const fileName = `${activeBaby.id}/${Date.now()}.${ext}`;
        const contentType = ext === "png" ? "image/png" : "image/jpeg";
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(fileName, decode(base64), { contentType, upsert: true });
        if (uploadError) {
          Alert.alert("사진 업로드 실패", uploadError.message);
          setSaving(false);
          return;
        }
        const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(fileName);
        profileImageUrl = urlData.publicUrl;
      }

      const birthDateStr = formatDateForInput(birthDate);
      const { error } = await supabase
        .from("babies")
        .update({
          name: trimmedName,
          profile_image_url: profileImageUrl,
          birth_date: birthDateStr,
        })
        .eq("id", activeBaby.id);

      if (error) {
        Alert.alert("저장 실패", error.message);
        setSaving(false);
        return;
      }

      updateActiveBaby({ name: trimmedName, profile_image_url: profileImageUrl, birth_date: birthDateStr });
      router.back();
    } catch (e) {
      Alert.alert("오류", e instanceof Error ? e.message : "저장 중 오류가 났어요.");
    } finally {
      setSaving(false);
    }
  }, [activeBaby?.id, name, birthDate, profileImageUri, updateActiveBaby, router]);

  const handleDelete = useCallback(() => {
    if (!activeBaby?.id) return;
    Alert.alert(
      "이 아이 프로필 삭제",
      "정말 삭제하시겠습니까? 이 아이와 관련된 모든 기록이 영구적으로 삭제됩니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "확인",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              const { error } = await supabase.from("babies").delete().eq("id", activeBaby.id);
              if (error) {
                Alert.alert("삭제 실패", error.message);
                setDeleting(false);
                return;
              }
              const newList = await refreshBabies();
              if (newList.length > 0) {
                setActiveBaby(newList[0]);
                router.back();
              } else {
                router.replace("/baby-onboarding");
              }
            } catch (e) {
              Alert.alert("오류", e instanceof Error ? e.message : "삭제 중 오류가 났어요.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [activeBaby?.id, refreshBabies, setActiveBaby, router]);

  if (babiesLoaded && !babiesLoading && activeBaby && !isBabyAdmin(activeBaby)) {
    return <Redirect href="/(tabs)" />;
  }

  if (!activeBaby) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "아이 프로필 수정",
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

  return (
    <>
      <Stack.Screen
        options={{
          title: "아이 프로필 수정",
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
                <Text style={styles.avatarHint}>사진 탭하여 변경</Text>
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
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
                disabled={saving}
              >
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
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving || deleting}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>저장하기</Text>
                )}
              </Pressable>
            </View>

            <Pressable
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={saving || deleting}
            >
              <Text style={styles.deleteButtonText}>이 아이 프로필 삭제하기</Text>
            </Pressable>
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
    marginBottom: 8,
    ...flashcardShadow,
  },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { fontSize: 16, color: PastelColors.textSecondary, fontFamily: Fonts.rounded, marginBottom: 16 },
  backText: { fontSize: 16, color: PastelColors.accent, fontFamily: Fonts.rounded, fontWeight: "600" },
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
  saveButton: {
    minHeight: 56,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: PastelColors.buttonPrimary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    ...primaryCtaPadding,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { fontSize: 18, fontWeight: "600", color: PastelColors.buttonTextOnPrimary, fontFamily: Fonts.rounded },
  deleteButton: { alignItems: "center", marginTop: 32, marginBottom: 48, paddingVertical: 16 },
  deleteButtonText: { fontSize: 16, fontWeight: "600", color: "#C62828", fontFamily: Fonts.rounded },
});
