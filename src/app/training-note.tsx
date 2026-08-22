import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, Field, ModalHeader, withSheetPage } from '@/components/ui';
import { useResponsiveLayout } from '@/responsive';
import { useAppStore } from '@/state/app-store';
import { AppTheme, useThemeStyles } from '@/theme';

function useStyles() {
  return useThemeStyles(createStyles);
}

function TrainingNoteScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const store = useAppStore();
  const [note, setNote] = useState(store.trainingNote);
  const { gutter, height, isDesktop, isPhone } = useResponsiveLayout();
  const compactHeight = height < 680;
  const centerContent = !isPhone && !compactHeight;

  const save = () => {
    store.setTrainingNote(note.trim());
    router.back();
  };

  return (
    <View style={styles.page}>
      <ModalHeader title="Notatka po treningu" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: gutter, paddingTop: compactHeight ? 14 : 24 },
            centerContent && styles.contentCentered,
          ]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.inner}>
            <View style={styles.training}>
              <View style={styles.icon}><Ionicons name="tennisball" size={20} color={theme.colors.secondaryText} /></View>
              <View style={styles.trainingCopy}><Text style={styles.eyebrow}>Ostatni trening</Text><Text style={styles.title} numberOfLines={2}>Korty Deski · Bartek Nowak</Text><Text style={styles.meta}>17 lipca · 120 min</Text></View>
            </View>
            <Field
              label="Notatka dla Ciebie i trenera"
              accessibilityLabel="Notatka dla Ciebie i trenera"
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Co warto zapamiętać przed kolejnym treningiem?"
              autoFocus={Platform.OS === 'web' && isDesktop}
              style={[
                styles.noteField,
                isDesktop && styles.noteFieldDesktop,
                compactHeight && styles.noteFieldCompact,
              ]}
            />
            <View style={styles.info}><Ionicons name="pin-outline" size={16} color={theme.colors.secondaryText} /><Text style={styles.infoText}>Notatka pozostaje przypięta w rozmowie do czasu następnego treningu.</Text></View>
          </View>
        </ScrollView>
        <SafeAreaView edges={['bottom']} style={[styles.bottom, { paddingHorizontal: gutter }]}>
          <View style={styles.bottomInner}><AppButton title="Zapisz notatkę" onPress={save} /></View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default withSheetPage(TrainingNoteScreen, 'form');

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', paddingBottom: 24 },
  contentCentered: { justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 640, gap: 18 },
  training: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: theme.radius.medium, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSoft },
  icon: { width: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  trainingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500' },
  title: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginTop: 4 },
  meta: { color: theme.colors.secondaryText, fontSize: 11, marginTop: 4 },
  noteField: { minHeight: 170, borderRadius: 12, paddingHorizontal: 15, paddingTop: 14, paddingBottom: 14, color: theme.colors.text, fontSize: 16, backgroundColor: theme.colors.surfaceSoft, textAlignVertical: 'top' },
  noteFieldCompact: { minHeight: 140 },
  noteFieldDesktop: { minHeight: 190 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 8 },
  infoText: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 17, flex: 1 },
  bottom: { alignItems: 'center', paddingTop: 10, paddingBottom: 10, backgroundColor: theme.colors.surfaceSoft, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  bottomInner: { width: '100%', maxWidth: 640 },
});
