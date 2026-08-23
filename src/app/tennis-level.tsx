import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, ModalHeader, selectionHaptic, withSheetPage } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { AppTheme, useThemeStyles } from '@/theme';

function useStyles() {
  return useThemeStyles(createStyles);
}

const levels = [
  ['1.0', 'Początkujący', 'Dopiero poznajesz zasady i podstawowe uderzenia.'],
  ['1.5', 'Pierwsze wymiany', 'Utrzymujesz krótką wymianę przy spokojnym tempie.'],
  ['2.0', 'Podstawy gry', 'Grasz podstawowe uderzenia, ale brakuje regularności.'],
  ['2.5', 'Rozwijający grę', 'Budujesz punkty i coraz pewniej serwujesz.'],
  ['3.0', 'Średnio zaawansowany', 'Regularna gra z głębi kortu i kontrola kierunku.'],
  ['3.5', 'Regularny zawodnik', 'Stabilna gra meczowa, urozmaicone tempo i rotacja.'],
  ['4.0', 'Zaawansowany klubowy', 'Dobra kontrola, taktyka i gra pod presją.'],
  ['4.5', 'Turniejowy', 'Silna, zróżnicowana gra i doświadczenie turniejowe.'],
  ['5.0+', 'Wysoki poziom turniejowy', 'Zaawansowana technika i regularne starty.'],
] as const;

function TennisLevelScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const store = useAppStore();
  const [selected, setSelected] = useState(store.tennisLevel);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const saved = await store.setTennisLevel(selected);
    setSaving(false);
    if (!saved) {
      Alert.alert('Nie udało się zapisać poziomu', store.error ?? 'Spróbuj ponownie.');
      return;
    }
    router.back();
  };
  return (
    <View style={styles.page}>
      <ModalHeader title="Poziom tenisowy" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Wybierz poziom najbardziej zbliżony do Twojej obecnej gry. To samoocena w skali NTRP.</Text>
        <View>
          {levels.map(([score, title, detail], index) => {
            const active = score === selected;
            return (
              <View key={score}>
                <Pressable onPress={() => { selectionHaptic(); setSelected(score); }} style={styles.level}>
                  <View style={[styles.score, active && styles.scoreSelected]}><Text style={[styles.scoreText, active && styles.dark]}>{score}</Text></View>
                  <View style={styles.flex}><Text style={styles.title}>{title}</Text><Text style={styles.detail}>{detail}</Text></View>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={theme.colors.accentText} /> : null}
                </Pressable>
                {index < levels.length - 1 ? <View style={styles.levelDivider} /> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.bottom}>
        <AppButton title={saving ? 'Zapisywanie…' : 'Zapisz'} disabled={saving || !selected} onPress={() => { void save(); }} />
      </SafeAreaView>
    </View>
  );
}

export default withSheetPage(TennisLevelScreen);

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 30 },
  intro: { color: theme.colors.secondaryText, fontSize: 13.5, lineHeight: 20 },
  level: { minHeight: 85, paddingHorizontal: 2, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginLeft: 60 },
  score: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceElevated },
  scoreSelected: { backgroundColor: theme.colors.lime },
  scoreText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  dark: { color: theme.colors.onAccent },
  title: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  detail: { color: theme.colors.secondaryText, fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  bottom: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: theme.colors.surfaceSoft, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
});
