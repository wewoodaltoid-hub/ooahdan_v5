import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CommunityNicknameEditModal } from '@/components/community/CommunityNicknameEditModal';
import { PastelColors, Fonts } from '@/constants/theme';

type Props = {
  nickname: string | null;
  onNicknameChange: (nickname: string) => void;
  variant?: 'banner' | 'inline';
  babyMonths?: number | null;
};

export function CommunityNicknameRow({
  nickname,
  onNicknameChange,
  variant = 'inline',
  babyMonths,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const displayName = nickname?.trim() || '불러오는 중…';

  const openEdit = () => {
    if (!nickname?.trim()) return;
    setModalVisible(true);
  };

  if (variant === 'banner') {
    return (
      <>
        <Pressable
          style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
          onPress={openEdit}
          disabled={!nickname?.trim()}
        >
          <View style={styles.bannerTop}>
            <Text style={styles.bannerLabel}>익명 닉네임</Text>
            <Text style={styles.editLink}>수정</Text>
          </View>
          <Text style={styles.bannerValue}>{displayName}</Text>
          {babyMonths != null ? (
            <Text style={styles.bannerSub}>게시 시 · {babyMonths}개월 양육으로 표시돼요</Text>
          ) : null}
        </Pressable>
        {nickname ? (
          <CommunityNicknameEditModal
            visible={modalVisible}
            initialNickname={nickname}
            onClose={() => setModalVisible(false)}
            onSaved={onNicknameChange}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <View style={styles.inlineRow}>
        <Text style={styles.inlineLabel} numberOfLines={1}>
          익명 <Text style={styles.inlineNickname}>{displayName}</Text>
        </Text>
        <Pressable
          style={({ pressed }) => [styles.inlineEditBtn, pressed && styles.pressed]}
          onPress={openEdit}
          disabled={!nickname?.trim()}
        >
          <Text style={styles.inlineEditText}>닉네임 수정</Text>
        </Pressable>
      </View>
      {nickname ? (
        <CommunityNicknameEditModal
          visible={modalVisible}
          initialNickname={nickname}
          onClose={() => setModalVisible(false)}
          onSaved={onNicknameChange}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: PastelColors.primaryLight,
    marginBottom: 16,
  },
  bannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bannerLabel: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  editLink: {
    fontSize: 13,
    fontWeight: '700',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
  },
  bannerValue: {
    fontSize: 16,
    fontWeight: '700',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
  },
  bannerSub: {
    marginTop: 6,
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  inlineLabel: {
    flex: 1,
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  inlineNickname: {
    fontWeight: '700',
    color: PastelColors.accent,
  },
  inlineEditBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  inlineEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
  },
  pressed: { opacity: 0.88 },
});
