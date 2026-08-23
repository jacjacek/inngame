import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton, Divider, LoadingScreen, ModalHeader, selectionHaptic, useClientReady, withSheetPage } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { AppTheme, useThemeStyles } from '@/theme';

function useStyles() {
  return useThemeStyles(createStyles);
}

function SportPickerScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const store = useAppStore();
  const clientReady = useClientReady();
  const [saving, setSaving] = useState<string>();
  if (!clientReady || !store.hydrated) return <LoadingScreen />;

  const iconForSport = (code: string): React.ComponentProps<typeof Ionicons>['name'] => (
    code === 'tennis' || code === 'padel' ? 'tennisball' : 'fitness'
  );

  const selectSport = async (name: string) => {
    if (saving) return;
    selectionHaptic();
    setSaving(name);
    const saved = await store.setSelectedSport(name);
    setSaving(undefined);
    if (!saved) {
      Alert.alert('Nie udało się zmienić sportu', store.error ?? 'Spróbuj ponownie.');
      return;
    }
    router.back();
  };
  return (
    <View style={styles.page}>
      <ModalHeader title="Wybierz sport" />
      <View style={styles.content}>
        <Text style={styles.subtitle}>Aktywny sport zmienia treningi, trenerów i statystyki widoczne w aplikacji.</Text>
        <View>
          {store.sports.map((sport, index) => {
            const selected = store.selectedSport === sport.name;
            const color = sport.code === 'tennis' ? theme.colors.accentText : sport.code === 'padel' ? theme.colors.sky : theme.colors.coral;
            return (
              <View key={sport.id}>
                <Pressable
                  disabled={Boolean(saving)}
                  onPress={() => { void selectSport(sport.name); }}
                  style={styles.row}>
                  <View style={[styles.icon, { backgroundColor: `${color}20` }]}><Ionicons name={iconForSport(sport.code)} size={22} color={color} /></View>
                  <Text style={styles.name}>{sport.name}</Text>
                  {saving === sport.name ? <Text style={styles.saving}>Zapisywanie…</Text> : selected ? <Ionicons name="checkmark-circle" size={22} color={theme.colors.accentText} /> : null}
                </Pressable>
                {index < store.sports.length - 1 ? <Divider inset={56} /> : null}
              </View>
            );
          })}
          {!store.sports.length ? (
            <View style={styles.empty}>
              <Ionicons name="tennisball-outline" size={28} color={theme.colors.tertiaryText} />
              <Text style={styles.emptyTitle}>Brak aktywnych sportów</Text>
              <Text style={styles.emptyText}>{store.error ?? 'Katalog dyscyplin nie jest jeszcze skonfigurowany.'}</Text>
              <AppButton compact title="Odśwież" variant="secondary" onPress={() => { void store.refresh(); }} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default withSheetPage(SportPickerScreen);

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 14 },
  subtitle: { color: theme.colors.secondaryText, fontSize: 13, lineHeight: 19 },
  row: { minHeight: 72, flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 2 },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  name: { color: theme.colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  saving: { color: theme.colors.secondaryText, fontSize: 11 },
  empty: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 26 },
  emptyTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  emptyText: { color: theme.colors.secondaryText, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
});
