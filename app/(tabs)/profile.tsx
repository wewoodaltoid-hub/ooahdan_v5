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
  ScrollView,
  Switch,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { PastelColors, Fonts, flashcardShadow, primaryCtaPadding } from '@/constants/theme';
import { useUserStore, type GuardianGender } from '@/stores/user-store';
import { supabase } from '@/lib/supabase';
import { useBaby } from '@/contexts/BabyContext';
import {
  COMMUNITY_NICKNAME_MAX_LEN,
  getOrCreateCommunityNickname,
  updateCommunityNickname,
} from '@/lib/community-nickname';
import {
  getPushNotificationsEnabled,
  setPushNotificationsEnabled,
} from '@/lib/push-notification-settings';

const RELATION_PRESETS = ['부', '모', '조부모', '할머니', '할아버지'] as const;

type SocialRow = {
  id: string;
  label: string;
  connected: boolean;
};

function buildSocialRows(
  identities: { provider: string }[] | undefined,
  hasEmail: boolean,
): SocialRow[] {
  const providers = new Set(identities?.map((i) => i.provider) ?? []);
  return [
    { id: 'email', label: '이메일 (ID/비밀번호)', connected: hasEmail },
    { id: 'google', label: 'Google', connected: providers.has('google') },
    { id: 'apple', label: 'Apple', connected: providers.has('apple') },
    { id: 'kakao', label: 'Kakao', connected: providers.has('kakao') },
  ];
}

export default function ProfileScreen() {
  const childName = useUserStore((s) => s.childName);
  const setChildName = useUserStore((s) => s.setChildName);
  const userName = useUserStore((s) => s.userName);
  const setUserName = useUserStore((s) => s.setUserName);
  const guardianGender = useUserStore((s) => s.guardianGender);
  const setGuardianGender = useUserStore((s) => s.setGuardianGender);
  const { activeBaby, updateActiveBaby, updateRelationName } = useBaby();

  const [communityNickname, setCommunityNickname] = useState(userName);
  const [inputText, setInputText] = useState(childName);
  const [relationName, setRelationName] = useState('');
  const [localGender, setLocalGender] = useState<GuardianGender>(guardianGender);
  const [email, setEmail] = useState('');
  const [socialRows, setSocialRows] = useState<SocialRow[]>([]);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? '');
        const meta = user.user_metadata ?? {};
        const g = meta.guardian_gender === 'female' ? 'female' : 'male';
        setLocalGender(g);
        if (meta.guardian_gender !== undefined) setGuardianGender(g);

        const nickname = await getOrCreateCommunityNickname();
        setCommunityNickname(nickname);
        setUserName(nickname);

        const bName = activeBaby?.name ?? meta.baby_name ?? childName;
        setInputText(String(bName));
        if (meta.baby_name !== undefined && !activeBaby?.name) setChildName(String(meta.baby_name));

        setSocialRows(buildSocialRows(user.identities, !!user.email));
      }

      setRelationName(activeBaby?.relation_name?.trim() ?? '');
      setPushEnabled(await getPushNotificationsEnabled());
      setLoading(false);
    })();
  }, [activeBaby?.id, activeBaby?.name, activeBaby?.relation_name]);

  useEffect(() => {
    if (activeBaby?.name) setInputText(activeBaby.name);
    setRelationName(activeBaby?.relation_name?.trim() ?? '');
  }, [activeBaby?.id, activeBaby?.name, activeBaby?.relation_name]);

  const handlePushToggle = useCallback(async (next: boolean) => {
    setPushEnabled(next);
    await setPushNotificationsEnabled(next);
  }, []);

  const handleAccountPassword = useCallback(() => {
    Alert.alert(
      'ID/비밀번호 관리',
      '비밀번호 변경은 로그인 화면의 「비밀번호 찾기」 또는 이메일 가입 계정 설정에서 진행할 수 있어요.\n(전용 관리 화면은 추후 제공 예정)',
    );
  }, []);

  const handleSocialSettings = useCallback(() => {
    const lines = socialRows.map((row) => `${row.label}: ${row.connected ? '연동됨 ✓' : '미연동'}`);
    Alert.alert('소셜 로그인 연동 상태', lines.join('\n'));
  }, [socialRows]);

  const handleSave = useCallback(async () => {
    Keyboard.dismiss();
    const trimmedChild = inputText.trim();
    if (trimmedChild === '') {
      Alert.alert('알림', '우리 아이의 이름을 입력해 주세요!');
      return;
    }

    setSaving(true);
    try {
      const trimmedNickname = communityNickname.trim();
      const nickResult = await updateCommunityNickname(trimmedNickname);
      if (!nickResult.ok) {
        Alert.alert('닉네임 저장 실패', nickResult.message);
        return;
      }
      setCommunityNickname(nickResult.nickname);

      const { error } = await supabase.auth.updateUser({
        data: {
          user_name: nickResult.nickname,
          baby_name: trimmedChild,
          guardian_gender: localGender,
        },
      });
      if (error) {
        Alert.alert('저장 실패', error.message);
        return;
      }

      if (activeBaby?.id) {
        const { error: babyError } = await supabase
          .from('babies')
          .update({ name: trimmedChild })
          .eq('id', activeBaby.id);
        if (babyError) {
          Alert.alert('아이 이름 저장 실패', babyError.message);
          return;
        }
        updateActiveBaby({ name: trimmedChild });

        const { ok, error: relationError } = await updateRelationName(relationName);
        if (!ok) {
          Alert.alert('관계 저장 실패', relationError ?? '관계를 저장하지 못했어요.');
          return;
        }
      }

      setUserName(nickResult.nickname);
      setChildName(trimmedChild);
      setGuardianGender(localGender);
      Alert.alert('저장 완료', '프로필 정보가 안전하게 업데이트되었어요!');
    } finally {
      setSaving(false);
    }
  }, [
    communityNickname,
    inputText,
    localGender,
    relationName,
    activeBaby?.id,
    setChildName,
    setUserName,
    setGuardianGender,
    updateActiveBaby,
    updateRelationName,
  ]);

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
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={PastelColors.accent} />
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* 보호자 정보 */}
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
                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>
                    닉네임 (커뮤니티 익명 네임)
                  </Text>
                  <Text style={styles.inputHint}>커뮤니티 글·댓글에 표시되는 이름과 동기화돼요</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="익명 닉네임"
                    placeholderTextColor={PastelColors.textSecondary}
                    value={communityNickname}
                    onChangeText={setCommunityNickname}
                    maxLength={COMMUNITY_NICKNAME_MAX_LEN}
                    returnKeyType="next"
                  />
                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>보호자 성별</Text>
                  <View style={styles.genderRow}>
                    <Pressable
                      style={[styles.genderChip, localGender === 'female' && styles.genderChipActive]}
                      onPress={() => setLocalGender('female')}
                    >
                      <Text
                        style={[
                          styles.genderChipText,
                          localGender === 'female' && styles.genderChipTextActive,
                        ]}
                      >
                        엄마
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.genderChip, localGender === 'male' && styles.genderChipActive]}
                      onPress={() => setLocalGender('male')}
                    >
                      <Text
                        style={[
                          styles.genderChipText,
                          localGender === 'male' && styles.genderChipTextActive,
                        ]}
                      >
                        아빠
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* 계정설정 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>계정설정</Text>
                <View style={styles.card}>
                  <Pressable
                    style={({ pressed }) => [styles.settingsRow, pressed && styles.settingsRowPressed]}
                    onPress={handleAccountPassword}
                  >
                    <MaterialIcons name="lock-outline" size={22} color={PastelColors.accent} />
                    <Text style={styles.settingsRowLabel}>ID/비밀번호 관리</Text>
                    <MaterialIcons name="chevron-right" size={22} color={PastelColors.textSecondary} />
                  </Pressable>
                  <View style={styles.settingsDivider} />
                  <Pressable
                    style={({ pressed }) => [styles.settingsRow, pressed && styles.settingsRowPressed]}
                    onPress={handleSocialSettings}
                  >
                    <MaterialIcons name="link" size={22} color={PastelColors.accent} />
                    <View style={styles.settingsRowBody}>
                      <Text style={styles.settingsRowLabel}>소셜로그인 설정 및 연동 상태</Text>
                      <Text style={styles.settingsRowSub}>
                        {socialRows.filter((r) => r.connected).map((r) => r.label).join(', ') ||
                          '연동 없음'}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color={PastelColors.textSecondary} />
                  </Pressable>
                  <View style={styles.settingsDivider} />
                  <View style={styles.settingsRow}>
                    <MaterialIcons name="notifications-none" size={22} color={PastelColors.accent} />
                    <Text style={[styles.settingsRowLabel, styles.settingsRowLabelFlex]}>
                      푸시 알림 설정
                    </Text>
                    <Switch
                      value={pushEnabled}
                      onValueChange={(v) => void handlePushToggle(v)}
                      trackColor={{ false: PastelColors.border, true: PastelColors.primaryLight }}
                      thumbColor={pushEnabled ? PastelColors.accent : PastelColors.cardBg}
                    />
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
                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>관계 (아이와의 호칭)</Text>
                  <Text style={styles.inputHint}>예: 부, 모, 조부모 — 우아홈 인사말에도 반영돼요</Text>
                  <View style={styles.relationRow}>
                    {RELATION_PRESETS.map((preset) => (
                      <Pressable
                        key={preset}
                        style={[
                          styles.relationChip,
                          relationName === preset && styles.relationChipActive,
                        ]}
                        onPress={() => setRelationName(preset)}
                      >
                        <Text
                          style={[
                            styles.relationChipText,
                            relationName === preset && styles.relationChipTextActive,
                          ]}
                        >
                          {preset}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.input, { marginTop: 12 }]}
                    placeholder="직접 입력 (비우면 「가족」)"
                    placeholderTextColor={PastelColors.textSecondary}
                    value={relationName}
                    onChangeText={setRelationName}
                    maxLength={16}
                  />
                </View>
              </View>

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
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
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
  inputHint: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 8,
    lineHeight: 17,
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
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  settingsRowPressed: {
    opacity: 0.85,
  },
  settingsRowBody: {
    flex: 1,
  },
  settingsRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  settingsRowLabelFlex: {
    flex: 1,
  },
  settingsRowSub: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginTop: 2,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: PastelColors.border,
  },
  relationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  relationChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: PastelColors.backgroundMint,
  },
  relationChipActive: {
    backgroundColor: PastelColors.buttonPrimary,
  },
  relationChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  relationChipTextActive: {
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
  saveButton: {
    ...primaryCtaPadding,
    borderRadius: 16,
    backgroundColor: PastelColors.buttonPrimary,
    alignItems: 'center',
    marginBottom: 8,
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
