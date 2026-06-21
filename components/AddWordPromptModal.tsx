import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PastelColors, Fonts, flashcardShadow, primaryCtaPadding } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (word: string) => void;
};

/** 새 단어 입력 후 상세 설정(DetailModal)으로 이어지는 1단계 프롬프트 */
export function AddWordPromptModal({ visible, onClose, onConfirm }: Props) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  const handleConfirm = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    setText('');
    onClose();
  }, [text, onConfirm, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <Text style={styles.title}>새 단어 추가</Text>
            <Text style={styles.hint}>추가할 단어를 입력한 뒤, 카테고리와 사진을 설정해요.</Text>
            <TextInput
              style={styles.input}
              placeholder="단어를 입력하세요"
              placeholderTextColor={PastelColors.textSecondary}
              value={text}
              onChangeText={setText}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />
            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
                onPress={onClose}
              >
                <Text style={styles.cancelBtnText}>취소</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  !text.trim() && styles.confirmBtnDisabled,
                  pressed && text.trim() && styles.btnPressed,
                ]}
                onPress={handleConfirm}
                disabled={!text.trim()}
              >
                <Text style={styles.confirmBtnText}>다음</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrap: {
    width: '100%',
  },
  sheet: {
    backgroundColor: PastelColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    backgroundColor: PastelColors.cardBg,
    paddingHorizontal: 20,
    fontSize: 16,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 20,
    ...flashcardShadow,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    ...primaryCtaPadding,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: PastelColors.primaryLight,
  },
  confirmBtn: {
    flex: 1,
    ...primaryCtaPadding,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: PastelColors.buttonPrimary,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  btnPressed: {
    opacity: 0.88,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
});
