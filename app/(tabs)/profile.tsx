/**
 * 프로필 — 보호자·아이 정보 마이페이지 (회원가입 시 입력한 정보 수정)
 */

import { useCallback, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { PastelColors, Fonts, flashcardShadow, primaryCtaPadding } from '@/constants/theme';
import { useUserStore, type GuardianGender } from '@/stores/user-store';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const childName = useUserStore((s) => s.childName);
  const setChildName = useUserStore((s) => s.setChildName);
  const userName = useUserStore((s) => s.userName);
  const setUserName = useUserStore((s) => s.setUserName);
  const guardianGender = useUserStore((s) => s.guardianGender);
  const setGuardianGender = useUserStore((s) => s.setGuardianGender);

  const [guardianName, setGuardianName] = useState(userName);
  const [inputText, setInputText] = useState(childName);
  const [localGender, setLocalGender] = useState<GuardianGender>(guardianGender);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? '');
        const meta = user.user_metadata ?? {};
        const uName = meta.user_name ?? userName;
        const bName = meta.baby_name ?? childName;
        const g = meta.guardian_gender === 'female' ? 'female' : 'male';
        setGuardianName(uName);
        setInputText(bName);
        setLocalGender(g);
        if (meta.user_name !== undefined) setUserName(String(meta.user_name));
        if (meta.baby_name !== undefined) setChildName(String(meta.baby_name));
        if (meta.guardian_gender !== undefined) setGuardianGender(g);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    setGuardianName(userName);
  }, [userName]);
  useEffect(() => {
    setInputText(childName);
  }, [childName]);
  useEffect(() => {
    setLocalGender(guardianGender);
  }, [guardianGender]);

  const handleSave = useCallback(async () => {
    Keyboard.dismiss();
    const trimmedChild = inputText.trim();
    if (trimmedChild === '') {
      Alert.alert('알림', '우리 아이의 이름을 입력해 주세요!');
      return;
    }
    setSaving(true);
    const trimmedGuardian = guardianName.trim();
    const { error } = await supabase.auth.updateUser({
      data: {
        user_name: trimmedGuardian || undefined,
        baby_name: trimmedChild,
        guardian_gender: localGender,
      },
    });
    setSaving(false);
    if (error) {
      Alert.alert('저장 실패', error.message);
      return;
    }
    setUserName(trimmedGuardian);
    setChildName(trimmedChild);
    setGuardianGender(localGender);
    Alert.alert('저장 완료', '프로필 정보가 안전하게 업데이트되었어요!');
  }, [guardianName, inputText, localGender, setChildName, setUserName, setGuardianGender]);

  return (
    <>
      <Stack.Screen
        options={{
          title: '프로필',
          headerStyle: { backgroundColor: PastelColors.background },
          headerTitleStyle: { fontFamily: Fonts.rounded, fontSize: 18, color: PastelColors.text },
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: PastelColors.background }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.content}>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={PastelColors.accent} />
              </View>
            ) : (
              <>
                {/* 보호자 정보 — 회원가입 시 입력한 닉네임·이메일 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>보호자 정보</Text>
                  <View style={styles.card}>
                    <Text style={styles.inputLabel}>이메일</Text>
                    <TextInput
                      style={[styles.input, styles.inputReadOnly]}
                      value={email}
                      editable={false}
                      placeholder="로그인한 이메일"
                      placeholderTextColor={PastelColors.textSecondary}
                    />
                    <Text style={[styles.inputLabel, { marginTop: 16 }]}>닉네임 (보호자 이름)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="보호자 닉네임을 입력해주세요"
                      placeholderTextColor={PastelColors.textSecondary}
                      value={guardianName}
                      onChangeText={setGuardianName}
                      returnKeyType="next"
                    />
                    <Text style={[styles.inputLabel, { marginTop: 16 }]}>보호자 성별</Text>
                    <View style={styles.genderRow}>
                      <Pressable
                        style={[styles.genderChip, localGender === 'female' && styles.genderChipActive]}
                        onPress={() => setLocalGender('female')}
                      >
                        <Text style={[styles.genderChipText, localGender === 'female' && styles.genderChipTextActive]}>엄마</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.genderChip, localGender === 'male' && styles.genderChipActive]}
                        onPress={() => setLocalGender('male')}
                      >
                        <Text style={[styles.genderChipText, localGender === 'male' && styles.genderChipTextActive]}>아빠</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* 우리 아이 정보 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>우리 아이 정보</Text>
                  <View style={styles.card}>
                    <Text style={styles.inputLabel}>아이 이름</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="아이 이름을 입력해주세요"
                      placeholderTextColor={PastelColors.textSecondary}
                      value={inputText}
                      onChangeText={setInputText}
                      returnKeyType="done"
                    />
                  </View>
                </View>

                <View style={styles.spacer} />

                {/* 저장하기 */}
                <Pressable
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.saveButtonPressed,
                    saving && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={PastelColors.buttonTextOnPrimary} />
                  ) : (
                    <Text style={styles.saveButtonText}>저장하기</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PastelColors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 12,
  },
  card: {
    backgroundColor: PastelColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    padding: 20,
    ...flashcardShadow,
  },
  inputLabel: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 10,
  },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: PastelColors.background,
    borderWidth: 1,
    borderColor: PastelColors.border,
    paddingHorizontal: 18,
    fontSize: 16,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  inputReadOnly: {
    backgroundColor: PastelColors.backgroundMint,
    color: PastelColors.textSecondary,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  genderChip: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: PastelColors.backgroundMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderChipActive: {
    backgroundColor: PastelColors.buttonPrimary,
  },
  genderChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  genderChipTextActive: {
    color: PastelColors.buttonTextOnPrimary,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  spacer: {
    flex: 1,
  },
  saveButton: {
    ...primaryCtaPadding,
    borderRadius: 16,
    backgroundColor: PastelColors.buttonPrimary,
    alignItems: 'center',
    marginBottom: 24,
    ...flashcardShadow,
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
});
