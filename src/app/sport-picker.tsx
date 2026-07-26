import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Divider, ModalHeader, selectionHaptic } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { theme } from '@/theme';

const sports = [
  { name: 'Tenis', icon: 'tennisball' as const, color: theme.colors.lime },
  { name: 'Squash', icon: 'fitness' as const, color: theme.colors.coral },
  { name: 'Padel', icon: 'tennisball-outline' as const, color: theme.colors.sky },
];

export default function SportPickerScreen() {
  const router = useRouter();
  const store = useAppStore();
  return (
    <View style={styles.page}>
      <ModalHeader title="Wybierz sport" />
      <View style={styles.content}>
        <Text style={styles.subtitle}>Aktywny sport zmienia treningi, trenerów i statystyki widoczne w aplikacji.</Text>
        <View>
          {sports.map((sport, index) => {
            const selected = store.selectedSport === sport.name;
            return (
              <View key={sport.name}>
                <Pressable
                  onPress={() => {
                    selectionHaptic();
                    store.setSelectedSport(sport.name);
                    router.back();
                  }}
                  style={styles.row}>
                  <View style={[styles.icon, { backgroundColor: `${sport.color}20` }]}><Ionicons name={sport.icon} size={22} color={sport.color} /></View>
                  <Text style={styles.name}>{sport.name}</Text>
                  {selected ? <Ionicons name="checkmark-circle" size={22} color={theme.colors.lime} /> : null}
                </Pressable>
                {index < sports.length - 1 ? <Divider inset={56} /> : null}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 14 },
  subtitle: { color: theme.colors.secondaryText, fontSize: 13, lineHeight: 19 },
  row: { minHeight: 72, flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 2 },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  name: { color: theme.colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
});
