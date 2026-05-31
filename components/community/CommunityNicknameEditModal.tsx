import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  COMMUNITY_NICKNAME_MAX_LEN,
  updateCommunityNickname,
} from '@/lib/community-nickname';
import { PastelColors, Fonts, flashcardShadow, primaryCtaPadding } from '@/constants/theme';

type Props = {
  visible: boolean;
  initialNickname: string;
  onClose: () => void;
  onSaved: (nickname: string) => void;
};

export function CommunityNicknameEditModal({
  visible,
  initialNickname,
  onClose,
  onSaved,
}: Props) {
  const [draft, setDraft] = useState(initialNickname);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setDraft(initialNickname);
  }, [visible, initialNickname]);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateCommunityNickname(draft);
    setSaving(false);

    if (!result.ok) {
      Alert.alert('닉네임 변경', result.message);
      return;
    }

    onSaved(result.nickname);
    onClose();
    Alert.alert('변경 완료', '새 글과 댓글부터 변경된 닉네임으로 표시돼요.');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={() => !saving && onClose()} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.center}
        >
          <View style={styles.sheet}>
            <Text style={styles.title}>익명 닉네임 수정</Text>
            <Text style={styles.hint}>
              커뮤니티에서 보이는 이름이에요. 이미 올린 글·댓글의 닉네임은 바뀌지 않아요.
            </Text>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="닉네임 입력"
              placeholderTextColor={PastelColors.textSecondary}
              maxLength={COMMUNITY_NICKNAME_MAX_LEN}
              autoFocus
              editable={!saving}
              returnKeyType="done"
              onSubmitEditing={() => void handleSave()}
            />
            <Text style={styles.counter}>
              {draft.trim().length}/{COMMUNITY_NICKNAME_MAX_LEN}
            </Text>
            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && styles.pressed]}
                onPress={() => !saving && onClose()}
                disabled={saving}
              >
                <Text style={styles.btnCancelText}>취소</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnOk,
                  saving && styles.btnOkDisabled,
                  pressed && !saving && styles.pressed,
                ]}
                onPress={() => void handleSave()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={PastelColors.buttonTextOnPrimary} />
                ) : (
                  <Text style={styles.btnOkText}>저장</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  sheet: {
    backgroundColor: PastelColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    padding: 22,
    ...flashcardShadow,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 10,
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    lineHeight: 19,
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: PastelColors.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    backgroundColor: PastelColors.background,
  },
  counter: {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    textAlign: 'right',
  },
  actions: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnCancel: { backgroundColor: PastelColors.backgroundMint },
  btnCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  btnOk: {
    backgroundColor: PastelColors.buttonPrimary,
    borderRadius: 14,
    ...primaryCtaPadding,
  },
  btnOkDisabled: { opacity: 0.75 },
  btnOkText: {
    fontSize: 16,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  pressed: { opacity: 0.88 },
});
