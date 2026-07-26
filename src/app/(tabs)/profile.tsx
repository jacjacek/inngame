import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppStore } from '@/state/app-store';
import { theme } from '@/theme';
import { Divider, InfoRow, LoadingScreen, Screen, SectionTitle, ToggleRow } from '@/components/ui';

const levelNames: Record<string, string> = {
  '1.0': 'Początkujący',
  '1.5': 'Pierwsze wymiany',
  '2.0': 'Podstawy gry',
  '2.5': 'Rozwijający grę',
  '3.0': 'Średnio zaawansowany',
  '3.5': 'Regularny zawodnik',
  '4.0': 'Zaawansowany klubowy',
  '4.5': 'Turniejowy',
  '5.0+': 'Wysoki poziom turniejowy',
};

export default function ProfileScreen() {
  const router = useRouter();
  const store = useAppStore();
  if (!store.hydrated) return <LoadingScreen />;

  const initials = store.profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
  const subtitle = `${store.profile.city || 'Brak lokalizacji'} · ${store.profile.playingLevel ? store.profile.playingLevel.toLocaleLowerCase('pl') : 'ustaw poziom gry'}`;

  return (
    <Screen contentStyle={styles.content}>
      <Pressable onPress={() => router.push('/profile-form')} style={styles.profileHeader}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={styles.flex}>
          <Text style={styles.name}>{store.profile.name || 'Uzupełnij profil'}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.tertiaryText} />
      </Pressable>

      <View style={styles.section}>
        <SectionTitle title="Poziom tenisowy" />
        <Pressable onPress={() => router.push('/tennis-level')}>
          <View style={styles.levelRow}>
            <View>
              <Text style={styles.levelTitle}>NTRP {store.tennisLevel}</Text>
              <Text style={styles.levelSubtitle}>{levelNames[store.tennisLevel]}</Text>
            </View>
            <View style={styles.levelEdit}>
              <Text style={styles.editText}>Edytuj</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.tertiaryText} />
            </View>
          </View>
        </Pressable>
      </View>

      <View style={styles.section}>
        <SectionTitle title="Powiadomienia" />
        <View>
          <ToggleRow
            flat
            title="Przypomnienia o treningach"
            subtitle="Dzień wcześniej i 2 godz. przed"
            value={store.notifications.trainingReminders}
            onValueChange={(value) => store.setNotification('trainingReminders', value)}
          />
          <Divider inset={0} />
          <ToggleRow
            flat
            title="Nowe wiadomości"
            subtitle="Trenerzy, zawodnicy i partnerzy"
            value={store.notifications.chatMessages}
            onValueChange={(value) => store.setNotification('chatMessages', value)}
          />
          <Divider inset={0} />
          <ToggleRow
            flat
            title="Zmiany terminów"
            subtitle="Przełożenia i odwołania"
            value={store.notifications.scheduleChanges}
            onValueChange={(value) => store.setNotification('scheduleChanges', value)}
          />
          <Divider inset={0} />
          <ToggleRow
            flat
            title="Rozliczenia"
            subtitle="Płatności i zaległości"
            value={store.notifications.payments}
            onValueChange={(value) => store.setNotification('payments', value)}
          />
          <Divider inset={0} />
          <ToggleRow
            flat
            title="Warunki na korcie"
            subtitle="Pogoda i dostępność"
            value={store.notifications.courtConditions}
            onValueChange={(value) => store.setNotification('courtConditions', value)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle
          title="Sporty"
          action={<Pressable onPress={() => router.push('/sport-picker')} hitSlop={10}><Text style={styles.editText}>Dodaj</Text></Pressable>}
        />
        <View>
          <InfoRow flat icon="tennisball" title="Tenis" detail="Główny" />
          <Divider inset={40} />
          <InfoRow flat icon="fitness-outline" title="Squash" detail="Dodatkowy" />
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle title="Postępy" action={<Text style={styles.period}>Ostatnie 13 tygodni</Text>} />
        <View style={styles.progressContent}>
          <View style={styles.progressSummary}>
            <View>
              <Text style={styles.progressValue}>65</Text>
              <Text style={styles.progressLabel}>Treningi</Text>
            </View>
            <View style={styles.trendValue}><Ionicons name="trending-up" size={15} color={theme.colors.lime} /><Text style={styles.trendText}>18%</Text></View>
          </View>
          <View style={styles.chart}>
            {[24, 38, 32, 52, 40, 62, 56, 78, 64, 84, 73, 91, 80].map((height, index) => <View key={index} style={[styles.bar, { height }]} />)}
          </View>
          <View style={styles.progressRows}>
            <ProgressRow icon="time-outline" title="Czas na korcie" value="6 420 min" />
            <ProgressRow icon="people-outline" title="Partnerzy" value="12 osób" />
            <ProgressRow icon="location-outline" title="Kluby" value="4 miejsca" />
          </View>
        </View>
      </View>
    </Screen>
  );
}

function ProgressRow({ icon, title, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; value: string }) {
  return (
    <View style={styles.progressRow}>
      <Ionicons name={icon} size={17} color={theme.colors.secondaryText} />
      <Text style={styles.progressRowTitle}>{title}</Text>
      <Text style={styles.progressRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 22, paddingHorizontal: 18, paddingTop: 18 },
  flex: { flex: 1 },
  profileHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 4 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  name: { color: theme.colors.text, fontSize: 22, fontWeight: '600' },
  subtitle: { color: theme.colors.secondaryText, fontSize: 13, marginTop: 4 },
  section: { gap: 8 },
  levelRow: { minHeight: 66, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  levelSubtitle: { color: theme.colors.secondaryText, fontSize: 12, marginTop: 4 },
  levelEdit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editText: { color: theme.colors.lime, fontSize: 13, fontWeight: '600' },
  period: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500' },
  progressContent: { paddingHorizontal: 2, paddingBottom: 4 },
  progressSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressValue: { color: theme.colors.text, fontSize: 35, fontWeight: '300' },
  progressLabel: { color: theme.colors.secondaryText, fontSize: 12, marginTop: 2 },
  trendValue: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  trendText: { color: theme.colors.lime, fontSize: 12, fontWeight: '600' },
  chart: { height: 101, flexDirection: 'row', gap: 7, alignItems: 'flex-end', marginVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  bar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: 'rgba(199,225,46,0.34)' },
  progressRows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider, paddingTop: 6 },
  progressRow: { minHeight: 42, flexDirection: 'row', gap: 10, alignItems: 'center' },
  progressRowTitle: { color: theme.colors.secondaryText, fontSize: 13, flex: 1 },
  progressRowValue: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
});
