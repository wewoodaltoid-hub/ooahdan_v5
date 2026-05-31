import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { PastelColors, Fonts } from '@/constants/theme';

type Props = {
  imageUrls: string[];
  variant?: 'feed' | 'detail';
};

export function CommunityPostImages({ imageUrls, variant = 'feed' }: Props) {
  const urls = imageUrls.filter((u) => u.trim().length > 0);
  if (urls.length === 0) return null;

  if (variant === 'feed') {
    return (
      <View style={styles.feedWrap}>
        <Image source={{ uri: urls[0] }} style={styles.feedImage} contentFit="cover" />
        {urls.length > 1 ? (
          <View style={styles.feedCountBadge}>
            <Text style={styles.feedCountText}>+{urls.length - 1}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.detailList}>
      {urls.map((uri, index) => (
        <View key={`${uri}-${index}`} style={styles.detailItem}>
          <Image source={{ uri }} style={styles.detailImage} contentFit="contain" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  feedWrap: {
    position: 'relative',
    marginBottom: 10,
  },
  feedImage: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    backgroundColor: PastelColors.primaryLight,
  },
  feedCountBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  feedCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    fontFamily: Fonts.rounded,
  },
  detailList: {
    gap: 10,
    marginBottom: 16,
  },
  detailItem: {
    width: '100%',
    minHeight: 120,
    maxHeight: 420,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: PastelColors.primaryLight,
  },
  detailImage: {
    width: '100%',
    height: 280,
  },
});
