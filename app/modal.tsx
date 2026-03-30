import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, PastelColors, flashcardShadow, primaryCtaPadding } from '@/constants/theme';

export default function ModalScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">This is a modal</ThemedText>
      <Link href="/" dismissTo style={styles.link}>
        <ThemedText type="link" style={styles.linkText}>
          Go to home screen
        </ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: PastelColors.background,
  },
  link: {
    marginTop: 24,
    ...primaryCtaPadding,
    borderRadius: 16,
    backgroundColor: PastelColors.buttonPrimary,
    overflow: 'hidden',
    ...flashcardShadow,
  },
  linkText: {
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
    fontWeight: '600',
    fontSize: 16,
  },
});
