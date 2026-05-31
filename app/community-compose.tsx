import { useCallback, useEffect, useState } from 'react';
import {
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { useBaby } from '@/contexts/BabyContext';
import {
  computeBabyMonthAge,
  createCommunityPost,
  MAX_COMMUNITY_POST_IMAGES,
  uploadCommunityPostImages,
  type CommunityCategory,
} from '@/lib/community-api';
import { CommunityImageFreeCropModal } from '@/components/community/CommunityImageFreeCropModal';
import { CommunityNicknameRow } from '@/components/community/CommunityNicknameRow';
import { getOrCreateCommunityNickname } from '@/lib/community-nickname';
import { supabase } from '@/lib/supabase';
import { PastelColors, Fonts, primaryCtaPadding, softShadow } from '@/constants/theme';

const CATEGORIES: { key: CommunityCategory; label: string }[] = [
  { key: 'parenting_tip', label: '💡 육아꿀팁' },
  { key: 'free_talk', label: '💬 자유수다' },
];

export default function CommunityComposeScreen() {
  const router = useRouter();
  const { activeBaby } = useBaby();

  const [category, setCategory] = useState<CommunityCategory>('parenting_tip');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [nickname, setNickname] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cropSourceUri, setCropSourceUri] = useState<string | null>(null);

  const babyMonths = computeBabyMonthAge(activeBaby?.birth_date ?? null);

  useEffect(() => {
    void getOrCreateCommunityNickname().then(setNickname);
  }, []);

  const pickImage = useCallback(async () => {
    if (imageUris.length >= MAX_COMMUNITY_POST_IMAGES) {
      Alert.alert('알림', `사진은 최대 ${MAX_COMMUNITY_POST_IMAGES}장까지 첨부할 수 있어요.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '앨범 접근 권한이 필요해요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setCropSourceUri(result.assets[0].uri);
    }
  }, [imageUris.length]);

  const handleCroppedImage = useCallback((uri: string) => {
    setImageUris((prev) => [...prev, uri].slice(0, MAX_COMMUNITY_POST_IMAGES));
    setCropSourceUri(null);
  }, []);

  const removeImageAt = useCallback((index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle) {
      Alert.alert('알림', '제목을 입력해 주세요.');
      return;
    }
    if (!trimmedBody) {
      Alert.alert('알림', '내용을 입력해 주세요.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('알림', '로그인이 필요해요.');
      return;
    }

    const authorNickname = nickname ?? (await getOrCreateCommunityNickname());

    setSaving(true);
    let imageUrls: string[] = [];
    const localUris = imageUris.filter((u) => u.startsWith('file://'));
    if (localUris.length > 0) {
      const uploaded = await uploadCommunityPostImages(localUris, user.id);
      if (!uploaded.ok) {
        setSaving(false);
        Alert.alert('사진 업로드 실패', uploaded.message);
        return;
      }
      imageUrls = uploaded.urls;
    }

    const result = await createCommunityPost({
      category,
      title: trimmedTitle,
      body: trimmedBody,
      babyId: activeBaby?.id ?? null,
      babyMonths,
      authorNickname,
      imageUrls,
    });
    setSaving(false);

    if (!result.ok) {
      Alert.alert('등록 실패', result.message ?? '글을 등록하지 못했어요.');
      return;
    }

    Alert.alert('등록 완료', '커뮤니티에 글이 올라갔어요!', [
      {
        text: '확인',
        onPress: () => {
          if (result.id) {
            router.replace({
              pathname: '/community/[id]',
              params: { id: result.id },
            } as import('expo-router').Href);
          } else {
            router.back();
          }
        },
      },
    ]);
  }, [
    title,
    body,
    category,
    imageUris,
    nickname,
    activeBaby?.id,
    babyMonths,
    router,
  ]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '글쓰기',
          headerBackTitle: '취소',
          headerTintColor: PastelColors.text,
          headerStyle: { backgroundColor: PastelColors.background },
          headerTitleStyle: { fontFamily: Fonts.rounded, fontSize: 18 },
        }}
      />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <CommunityNicknameRow
              nickname={nickname}
              onNicknameChange={setNickname}
              variant="banner"
              babyMonths={babyMonths}
            />

            <Text style={styles.label}>카테고리</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.key}
                  style={[styles.catChip, category === c.key && styles.catChipActive]}
                  onPress={() => setCategory(c.key)}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      category === c.key && styles.catChipTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>제목</Text>
            <TextInput
              style={styles.input}
              placeholder="제목을 입력하세요"
              placeholderTextColor={PastelColors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>본문</Text>
            <TextInput
              style={[styles.input, styles.bodyInput]}
              placeholder="육아 이야기를 나눠 보세요"
              placeholderTextColor={PastelColors.textSecondary}
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>
              사진 (선택, 최대 {MAX_COMMUNITY_POST_IMAGES}장)
            </Text>
            {imageUris.length > 0 ? (
              <View style={styles.imageGrid}>
                {imageUris.map((uri, index) => (
                  <View key={`${uri}-${index}`} style={styles.imageTile}>
                    <Image source={{ uri }} style={styles.imageTileImg} resizeMode="cover" />
                    <Pressable
                      style={styles.imageRemoveBtn}
                      onPress={() => removeImageAt(index)}
                      hitSlop={8}
                    >
                      <Text style={styles.imageRemoveBtnText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            {imageUris.length < MAX_COMMUNITY_POST_IMAGES ? (
              <Pressable
                style={({ pressed }) => [styles.attachBtn, pressed && styles.attachBtnPressed]}
                onPress={() => void pickImage()}
              >
                <Text style={styles.attachBtnText}>
                  📷 사진 추가 ({imageUris.length}/{MAX_COMMUNITY_POST_IMAGES})
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && styles.submitBtnPressed,
              saving && styles.submitBtnDisabled,
            ]}
            onPress={() => void handleSubmit()}
            disabled={saving}
          >
            <Text style={styles.submitBtnText}>{saving ? '등록 중…' : '게시하기'}</Text>
          </Pressable>
        </KeyboardAvoidingView>

        <CommunityImageFreeCropModal
          visible={cropSourceUri != null}
          imageUri={cropSourceUri}
          onClose={() => setCropSourceUri(null)}
          onCropped={handleCroppedImage}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PastelColors.background },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 24 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  catChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...softShadow,
  },
  catChipActive: {
    backgroundColor: PastelColors.accent,
    borderColor: PastelColors.accent,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  catChipTextActive: {
    color: PastelColors.buttonTextOnPrimary,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PastelColors.border,
    backgroundColor: PastelColors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 16,
    ...softShadow,
  },
  bodyInput: {
    minHeight: 160,
  },
  attachBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PastelColors.border,
    borderStyle: 'dashed',
    backgroundColor: PastelColors.surface,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  attachBtnPressed: { opacity: 0.88 },
  attachBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  imageTile: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: PastelColors.primaryLight,
    position: 'relative',
  },
  imageTileImg: {
    width: '100%',
    height: '100%',
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageRemoveBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  submitBtn: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: PastelColors.buttonPrimary,
    alignItems: 'center',
    ...primaryCtaPadding,
    ...softShadow,
  },
  submitBtnPressed: { opacity: 0.9 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
});
