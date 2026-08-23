import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton, ModalHeader, withSheetPage } from '@/components/ui';
import { AppTheme, useThemeStyles } from '@/theme';

function useStyles() {
  return useThemeStyles(createStyles);
}

function PaymentsDisabledScreen() {
  const router = useRouter();
  const { styles, theme } = useStyles();

  return (
    <View style={styles.page}>
      <ModalHeader title="Rozliczenia" />
      <View style={styles.content}>
        <View style={styles.icon}>
          <Ionicons name="wallet-outline" size={32} color={theme.colors.accentText} />
        </View>
        <Text style={styles.title}>Płatności odbywają się poza aplikacją</Text>
        <Text style={styles.description}>
          Każdy trening jest rozliczany bezpośrednio z trenerem. W MyMovio zobaczysz jedynie,
          czy przypisany trener oznaczył spotkanie jako opłacone albo nieopłacone.
        </Text>
        <AppButton title="Wróć" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}

export default withSheetPage(PaymentsDisabledScreen, 'compact');

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  icon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: theme.colors.accentSoft,
  },
  title: {
    color: theme.colors.text,
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  description: {
    maxWidth: 440,
    color: theme.colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 8,
  },
});
