import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { useAppStore } from '@/state/app-store';
import { AppTheme, ThemeMode, useThemeStyles } from '@/theme';
import { Divider, InfoRow, LoadingScreen, Screen, SectionTitle, ToggleRow } from '@/components/ui';

function useStyles() {
  return useThemeStyles(createStyles);
}

const themeOptions: { mode: ThemeMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { mode: 'light', label: 'Jasny', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Ciemny', icon: 'moon-outline' },
  { mode: 'system', label: 'Systemowy', icon: 'contrast-outline' },
];

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

const roleNames: Record<string, string> = {
  player: 'Zawodnik',
  trainer: 'Trener',
  owner: 'Właściciel klubu',
  manager: 'Menedżer klubu',
  reception: 'Recepcja',
  viewer: 'Podgląd',
  platform_admin: 'Administrator platformy',
};

export default function ProfileScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const store = useAppStore();
  const { signOut } = useAuth();
  if (!store.hydrated) return <LoadingScreen />;

  const initials = store.profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
  const subtitle = `${store.profile.city || 'Brak lokalizacji'} · ${store.profile.playingLevel ? store.profile.playingLevel.toLocaleLowerCase('pl') : 'ustaw poziom gry'}`;
  const completedTrainings = store.trainings.filter((training) => (
    training.role !== 'staff'
    && training.status !== 'no_show'
    && !training.status.startsWith('cancelled')
    && (training.status === 'completed'
    || (
      training.status === 'confirmed'
      && new Date(training.end).getTime() < store.now
    ))
  ));
  const totalMinutes = completedTrainings.reduce((sum, training) => sum + training.durationMinutes, 0);
  const partnerCount = new Set(
    completedTrainings.flatMap((training) => training.participantDetails)
      .filter((participant) => participant.userId !== store.currentUserId)
      .map((participant) => participant.userId ?? participant.displayName),
  ).size;
  const venueCount = new Set(completedTrainings.map((training) => training.venueId)).size;
  const weeklyTrainingCounts = Array.from({ length: 13 }, (_, index) => {
    const end = store.now - (12 - index) * 7 * 24 * 60 * 60 * 1000;
    const start = end - 7 * 24 * 60 * 60 * 1000;
    return completedTrainings.filter((training) => {
      const timestamp = new Date(training.start).getTime();
      return timestamp >= start && timestamp < end;
    }).length;
  });
  const maxWeeklyCount = Math.max(1, ...weeklyTrainingCounts);

  return (
    <Screen testID="profile-hydrated" contentStyle={styles.content}>
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
        <SectionTitle title="Wygląd" />
        <ThemeModeSelector />
      </View>

      <View style={styles.section}>
        <SectionTitle title="Powiadomienia" />
        <View>
          <InfoRow
            flat
            icon="flash-outline"
            title="Wolne terminy trenerów"
            detail={store.availabilityNotificationsEnabled ? 'Dopasowane do Twojego rytmu tygodnia' : 'Wyłączone'}
            onPress={() => router.push('/availability-preferences')}
          />
          <Divider inset={0} />
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
            title="Status rozliczenia treningu"
            subtitle="Oznaczenie opłacone lub nieopłacone"
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
          {store.sports.length ? store.sports.map((sport, index) => (
            <React.Fragment key={sport.id}>
              <InfoRow
                flat
                icon={sport.code === 'tennis' ? 'tennisball' : 'fitness-outline'}
                title={sport.name}
                detail={sport.name === store.selectedSport ? 'Główny' : 'Dostępny'}
              />
              {index < store.sports.length - 1 ? <Divider inset={40} /> : null}
            </React.Fragment>
          )) : (
            <InfoRow flat icon="tennisball-outline" title="Brak aktywnych sportów" detail="Skontaktuj się z administratorem" />
          )}
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle title="Role i uprawnienia" />
        <View>
          {store.accountRoles.map((role, index) => (
            <React.Fragment key={role}>
              <InfoRow
                flat
                icon={role === 'player' ? 'person-outline' : role === 'trainer' ? 'school-outline' : 'shield-checkmark-outline'}
                title={roleNames[role] ?? role}
                detail={role === 'player' ? 'Konto użytkownika' : 'Uprawnienia nadane przez organizację'}
              />
              {index < store.accountRoles.length - 1 ? <Divider inset={40} /> : null}
            </React.Fragment>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle title="Postępy" action={<Text style={styles.period}>Ostatnie 13 tygodni</Text>} />
        <View style={styles.progressContent}>
          <View style={styles.progressSummary}>
            <View>
              <Text style={styles.progressValue}>{completedTrainings.length}</Text>
              <Text style={styles.progressLabel}>Treningi</Text>
            </View>
            <View style={styles.trendValue}><Ionicons name="stats-chart-outline" size={15} color={theme.colors.accentText} /><Text style={styles.trendText}>z bazy</Text></View>
          </View>
          <View style={styles.chart}>
            {weeklyTrainingCounts.map((count, index) => (
              <View key={index} style={[styles.bar, { height: Math.max(3, Math.round((count / maxWeeklyCount) * 91)) }]} />
            ))}
          </View>
          <View style={styles.progressRows}>
            <ProgressRow icon="time-outline" title="Czas na korcie" value={`${totalMinutes.toLocaleString('pl-PL')} min`} />
            <ProgressRow icon="people-outline" title="Partnerzy" value={`${partnerCount} os.`} />
            <ProgressRow icon="location-outline" title="Kluby" value={`${venueCount} miejsc`} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle title="Konto" />
        <InfoRow
          flat
          icon="log-out-outline"
          title="Wyloguj się"
          detail="Zakończ sesję na tym urządzeniu"
          onPress={() => {
            void signOut().catch((error: unknown) => {
              Alert.alert(
                'Nie udało się wylogować',
                error instanceof Error ? error.message : 'Spróbuj ponownie.',
              );
            });
          }}
        />
      </View>
    </Screen>
  );
}

function ProgressRow({ icon, title, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; value: string }) {
  const { styles, theme } = useStyles();
  return (
    <View style={styles.progressRow}>
      <Ionicons name={icon} size={17} color={theme.colors.secondaryText} />
      <Text style={styles.progressRowTitle}>{title}</Text>
      <Text style={styles.progressRowValue}>{value}</Text>
    </View>
  );
}

function ThemeModeSelector() {
  const { styles, theme } = useStyles();
  const store = useAppStore();

  return (
    <View>
      <View accessibilityRole="radiogroup" style={styles.themeSelector}>
        {themeOptions.map((option) => {
          const active = store.themeMode === option.mode;
          return (
            <Pressable
              key={option.mode}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              aria-checked={active}
              onPress={() => store.setThemeMode(option.mode)}
              style={({ pressed }) => [
                styles.themeOption,
                active && styles.themeOptionActive,
                pressed && styles.themeOptionPressed,
              ]}>
              <Ionicons
                name={option.icon}
                size={17}
                color={active ? theme.colors.onAccent : theme.colors.secondaryText}
              />
              <Text style={[styles.themeOptionText, active && styles.themeOptionTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.themeHint}>Tryb systemowy podąża za ustawieniem Twojego urządzenia.</Text>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  content: { gap: 22, paddingHorizontal: 18, paddingTop: 18 },
  flex: { flex: 1 },
  profileHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 4 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  name: { color: theme.colors.text, fontSize: 22, fontWeight: '600' },
  subtitle: { color: theme.colors.secondaryText, fontSize: 13, marginTop: 4 },
  section: { gap: 8 },
  themeSelector: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: theme.colors.surfaceElevated },
  themeOption: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  themeOptionActive: { backgroundColor: theme.colors.lime },
  themeOptionPressed: { opacity: 0.72 },
  themeOptionText: { color: theme.colors.secondaryText, fontSize: 11.5, fontWeight: '600' },
  themeOptionTextActive: { color: theme.colors.onAccent },
  themeHint: { color: theme.colors.tertiaryText, fontSize: 10.5, lineHeight: 15, marginTop: 7, marginLeft: 2 },
  levelRow: { minHeight: 66, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  levelSubtitle: { color: theme.colors.secondaryText, fontSize: 12, marginTop: 4 },
  levelEdit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editText: { color: theme.colors.accentText, fontSize: 13, fontWeight: '600' },
  period: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500' },
  progressContent: { paddingHorizontal: 2, paddingBottom: 4 },
  progressSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressValue: { color: theme.colors.text, fontSize: 35, fontWeight: '300' },
  progressLabel: { color: theme.colors.secondaryText, fontSize: 12, marginTop: 2 },
  trendValue: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  trendText: { color: theme.colors.accentText, fontSize: 12, fontWeight: '600' },
  chart: { height: 101, flexDirection: 'row', gap: 7, alignItems: 'flex-end', marginVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  bar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: 'rgba(199,225,46,0.34)' },
  progressRows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider, paddingTop: 6 },
  progressRow: { minHeight: 42, flexDirection: 'row', gap: 10, alignItems: 'center' },
  progressRowTitle: { color: theme.colors.secondaryText, fontSize: 13, flex: 1 },
  progressRowValue: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
});
