import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, Field, ModalHeader, Pill, successHaptic, withSheetPage } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { AppTheme, useThemeStyles } from '@/theme';

function useStyles() {
  return useThemeStyles(createStyles);
}

const levels = ['Początkujący', 'Średnio zaawansowany', 'Zaawansowany'];

function ProfileFormScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const store = useAppStore();
  const [name, setName] = useState(store.profile.name);
  const [city, setCity] = useState(store.profile.city || 'Warszawa');
  const [playingLevel, setPlayingLevel] = useState(store.profile.playingLevel || levels[1]);
  const valid = name.trim().length >= 2 && city.trim().length >= 2;

  const save = () => {
    if (!valid) return;
    store.saveProfile({ name: name.trim(), city: city.trim(), playingLevel });
    successHaptic();
    router.back();
  };

  return (
    <View style={styles.page}>
      <ModalHeader title="Twój profil" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.icon}><Ionicons name="person-outline" size={28} color={theme.colors.accentText} /></View>
            <Text style={styles.title}>Poznajmy się</Text>
            <Text style={styles.subtitle}>Te informacje pomogą nam dobrać trenera, który pasuje do Twojego poziomu i lokalizacji.</Text>
          </View>
          <View style={styles.form}>
            <Field label="Imię i nazwisko" value={name} onChangeText={setName} placeholder="np. Jan Kowalski" autoCapitalize="words" textContentType="name" />
            <Field label="Miasto" value={city} onChangeText={setCity} placeholder="np. Warszawa" autoCapitalize="words" />
            <View style={styles.level}>
              <Text style={styles.label}>Poziom gry</Text>
              <View style={styles.levels}>{levels.map((item) => <Pill key={item} label={item} active={playingLevel === item} onPress={() => setPlayingLevel(item)} />)}</View>
            </View>
          </View>
          <View style={styles.privacy}><Ionicons name="lock-closed-outline" size={15} color={theme.colors.secondaryText} /><Text style={styles.privacyText}>Dane profilu służą wyłącznie do dopasowania usług MyMovio.</Text></View>
        </ScrollView>
        <SafeAreaView edges={['bottom']} style={styles.bottom}><AppButton title="Zapisz profil" disabled={!valid} onPress={save} /></SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default withSheetPage(ProfileFormScreen);

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { padding: 16, gap: 22 },
  hero: { alignItems: 'center', paddingTop: 15 },
  icon: { width: 58, height: 58, borderRadius: 19, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.colors.text, fontSize: 29, fontWeight: '700', marginTop: 15 },
  subtitle: { color: theme.colors.secondaryText, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 330, marginTop: 7 },
  form: { paddingHorizontal: 2, gap: 17 },
  level: { gap: 8 },
  label: { color: theme.colors.secondaryText, fontSize: 13, fontWeight: '600', marginLeft: 2 },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 18 },
  privacyText: { color: theme.colors.secondaryText, fontSize: 11.5, textAlign: 'center', flexShrink: 1 },
  bottom: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: theme.colors.surfaceSoft, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
});
