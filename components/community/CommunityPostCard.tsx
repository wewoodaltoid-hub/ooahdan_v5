import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CommunityPostImages } from '@/components/community/CommunityPostImages';
import { summarizePostBody, type CommunityPost } from '@/lib/community-api';
import { CATEGORY_LABELS } from '@/lib/community-feed';
import { PastelColors, Fonts, softShadow } from '@/constants/theme';

type Props = {
  post: CommunityPost;
  onPress: () => void;
};

export function CommunityPostCard({ post, onPress }: Props) {
  const categoryLabel = CATEGORY_LABELS[post.category] ?? post.category;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{categoryLabel}</Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {post.authorLabel}
        </Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {post.title}
      </Text>
      <Text style={styles.body} numberOfLines={3}>
        {summarizePostBody(post.body)}
      </Text>

      <CommunityPostImages imageUrls={post.imageUrls} variant="feed" />

      <View style={styles.footer}>
        <Text style={styles.stat}>❤️ 좋아요 {post.likesCount}</Text>
        <Text style={styles.stat}>💬 댓글 {post.commentsCount}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...softShadow,
  },
  cardPressed: {
    opacity: 0.92,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: PastelColors.primaryLight,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
  },
  meta: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    lineHeight: 22,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 14,
  },
  stat: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
});
