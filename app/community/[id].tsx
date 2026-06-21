import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { useBaby } from '@/contexts/BabyContext';
import {
  addCommunityComment,
  computeBabyMonthAge,
  deleteCommunityComment,
  deleteCommunityPost,
  fetchCommunityComments,
  fetchCommunityPostById,
  toggleCommunityPostLike,
  type CommunityComment,
  type CommunityPost,
} from '@/lib/community-api';
import { supabase } from '@/lib/supabase';
import { CommunityNicknameRow } from '@/components/community/CommunityNicknameRow';
import { CommunityPostImages } from '@/components/community/CommunityPostImages';
import { CATEGORY_LABELS } from '@/lib/community-feed';
import { getOrCreateCommunityNickname } from '@/lib/community-nickname';
import { PastelColors, Fonts, flashcardShadow, softShadow } from '@/constants/theme';

export default function CommunityPostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activeBaby } = useBaby();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentDraft, setCommentDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const commentBabyMonths = computeBabyMonthAge(activeBaby?.birth_date ?? null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const p = await fetchCommunityPostById(id);
    const c = await fetchCommunityComments(id, p?.authorUserId ?? null);
    setPost(p);
    setComments(c);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void getOrCreateCommunityNickname().then(setMyNickname);
      void supabase.auth.getUser().then(({ data: { user } }) => setMyUserId(user?.id ?? null));
    }, [load]),
  );

  const isPostMine = post != null && myUserId != null && post.authorUserId === myUserId;

  const handleDeletePost = useCallback(() => {
    if (!post) return;
    Alert.alert('글 삭제', '이 글을 삭제할까요? 복구할 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const result = await deleteCommunityPost(post.id);
            if (!result.ok) {
              Alert.alert('삭제 실패', result.message);
              return;
            }
            router.back();
          })();
        },
      },
    ]);
  }, [post, router]);

  const handleDeleteComment = useCallback(
    (comment: CommunityComment) => {
      if (!post) return;
      Alert.alert('댓글 삭제', '이 댓글을 삭제할까요?', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const result = await deleteCommunityComment({
                commentId: comment.id,
                postId: post.id,
                currentCommentsCount: post.commentsCount,
              });
              if (!result.ok) {
                Alert.alert('삭제 실패', result.message);
                return;
              }
              await load();
            })();
          },
        },
      ]);
    },
    [post, load],
  );

  const handleToggleLike = useCallback(async () => {
    if (!post) return;
    const result = await toggleCommunityPostLike(post);
    if (!result.ok) {
      Alert.alert('좋아요', result.message ?? '처리하지 못했어요.');
      return;
    }
    await load();
  }, [post, load]);

  const handleSubmitComment = useCallback(async () => {
    if (!post) return;
    setSubmitting(true);
    const nickname = myNickname ?? (await getOrCreateCommunityNickname());
    const result = await addCommunityComment({
      postId: post.id,
      body: commentDraft,
      authorNickname: nickname,
      babyMonths: commentBabyMonths,
      currentCommentsCount: post.commentsCount,
    });
    setSubmitting(false);
    if (!result.ok) {
      Alert.alert('댓글', result.message ?? '등록하지 못했어요.');
      return;
    }
    setCommentDraft('');
    await load();
  }, [post, commentDraft, myNickname, commentBabyMonths, load]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '게시글',
          headerBackTitle: '커뮤니티',
          headerTintColor: PastelColors.text,
          headerStyle: { backgroundColor: PastelColors.background },
          headerTitleStyle: { fontFamily: Fonts.rounded, fontSize: 18 },
        }}
      />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {loading || !post ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={PastelColors.accent} />
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {CATEGORY_LABELS[post.category] ?? post.category}
                    </Text>
                  </View>
                  {isPostMine ? (
                    <Pressable
                      style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                      onPress={handleDeletePost}
                      hitSlop={8}
                      accessibilityLabel="글 삭제"
                    >
                      <MaterialIcons name="delete-outline" size={22} color={PastelColors.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.meta}>{post.authorLabel}</Text>
                <Text style={styles.title}>{post.title}</Text>
                <Text style={styles.body}>{post.body}</Text>
                <CommunityPostImages imageUrls={post.imageUrls} variant="detail" />
                <Pressable
                  style={({ pressed }) => [styles.likeRow, pressed && styles.pressed]}
                  onPress={() => void handleToggleLike()}
                >
                  <Text style={[styles.likeText, post.likedByMe && styles.likeTextActive]}>
                    {post.likedByMe ? '♥' : '♡'} 좋아요 {post.likesCount}
                  </Text>
                  <Text style={styles.commentCount}>💬 댓글 {post.commentsCount}</Text>
                </Pressable>
              </View>

              <Text style={styles.commentsTitle}>댓글</Text>
              {comments.length === 0 ? (
                <Text style={styles.commentsEmpty}>첫 댓글을 남겨 보세요.</Text>
              ) : (
                comments.map((c) => (
                  <View
                    key={c.id}
                    style={[styles.commentItem, c.isPostAuthor && styles.commentItemPostAuthor]}
                  >
                    <View style={styles.commentAuthorRow}>
                      {c.isPostAuthor ? (
                        <View style={styles.postAuthorBadge}>
                          <Text style={styles.postAuthorBadgeText}>글쓴이</Text>
                        </View>
                      ) : null}
                      <Text
                        style={[
                          styles.commentAuthor,
                          c.isPostAuthor && styles.commentAuthorPostAuthor,
                        ]}
                        numberOfLines={2}
                      >
                        {c.authorLabel}
                      </Text>
                      {c.isMine ? (
                        <Pressable
                          style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                          onPress={() => handleDeleteComment(c)}
                          hitSlop={8}
                          accessibilityLabel="댓글 삭제"
                        >
                          <MaterialIcons
                            name="delete-outline"
                            size={18}
                            color={PastelColors.textSecondary}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={styles.commentBody}>{c.body}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <CommunityNicknameRow
              nickname={myNickname}
              onNicknameChange={setMyNickname}
              variant="inline"
            />
            <View style={styles.composer}>
              <TextInput
                style={styles.composerInput}
                placeholder="댓글을 입력하세요"
                placeholderTextColor={PastelColors.textSecondary}
                value={commentDraft}
                onChangeText={setCommentDraft}
                multiline
              />
              <Pressable
                style={({ pressed }) => [
                  styles.sendBtn,
                  pressed && styles.pressed,
                  submitting && styles.sendBtnDisabled,
                ]}
                onPress={() => void handleSubmitComment()}
                disabled={submitting}
              >
                <Text style={styles.sendBtnText}>{submitting ? '…' : '등록'}</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PastelColors.background },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 24 },
  card: {
    backgroundColor: PastelColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    padding: 18,
    marginBottom: 20,
    ...flashcardShadow,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: PastelColors.primaryLight,
  },
  deleteBtn: {
    padding: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
  },
  meta: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    lineHeight: 28,
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 16,
  },
  likeRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PastelColors.border,
  },
  pressed: { opacity: 0.88 },
  likeText: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    fontWeight: '600',
  },
  likeTextActive: { color: PastelColors.accent },
  commentCount: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 12,
  },
  commentsEmpty: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  commentItem: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...softShadow,
  },
  commentItemPostAuthor: {
    backgroundColor: PastelColors.primaryLight,
    borderColor: PastelColors.accent,
    borderWidth: 1.5,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  postAuthorBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: PastelColors.accent,
  },
  postAuthorBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  commentAuthor: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  commentAuthorPostAuthor: {
    color: '#7B5BA8',
    fontWeight: '800',
  },
  commentRelation: { fontWeight: '500', color: PastelColors.textSecondary },
  commentBody: {
    fontSize: 15,
    lineHeight: 22,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: PastelColors.border,
    backgroundColor: PastelColors.surface,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PastelColors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    backgroundColor: PastelColors.background,
  },
  sendBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: PastelColors.buttonPrimary,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
});
