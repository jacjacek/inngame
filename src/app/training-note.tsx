import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, Field, ModalHeader } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { theme } from '@/theme';

export default function TrainingNoteScreen() {
  const router = useRouter();
  const store = useAppStore();
  const [note, setNote] = useState(store.trainingNote);
  return (
    <View style={styles.page}>
      <ModalHeader title="Notatka po treningu" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.training}>
            <View style={styles.icon}><Ionicons name="tennisball" size={20} color={theme.colors.secondaryText} /></View>
            <View style={styles.flex}><Text style={styles.eyebrow}>Ostatni trening</Text><Text style={styles.title}>Korty Deski · Bartek Nowak</Text><Text style={styles.meta}>17 lipca · 120 min</Text></View>
          </View>
          <Field label="Notatka dla Ciebie i trenera" value={note} onChangeText={setNote} multiline placeholder="Co warto zapamiętać przed kolejnym treningiem?" autoFocus />
          <View style={styles.info}><Ionicons name="pin-outline" size={16} color={theme.colors.secondaryText} /><Text style={styles.infoText}>Notatka pozostaje przypięta w rozmowie do czasu następnego treningu.</Text></View>
        </ScrollView>
        <SafeAreaView edges={['bottom']} style={styles.bottom}><AppButton title="Zapisz notatkę" onPress={() => { store.setTrainingNote(note.trim()); router.back(); }} /></SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { padding: 16, gap: 18 },
  training: { paddingHorizontal: 2, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  icon: { width: 36, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500' },
  title: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginTop: 4 },
  meta: { color: theme.colors.secondaryText, fontSize: 11, marginTop: 4 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 8 },
  infoText: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 17, flex: 1 },
  bottom: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: theme.colors.surfaceSoft, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
});
