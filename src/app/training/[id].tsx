import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, Divider, endTime, formatDate, formatTime, InfoRow, LoadingScreen, ModalHeader, selectionHaptic, useClientReady, withSheetPage } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { AppTheme, useThemeStyles } from '@/theme';

function useStyles() {
  return useThemeStyles(createStyles);
}

const blueCourt = require('@/assets/mymovio/blue-court.png');

function TrainingDetailScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useAppStore();
  const clientReady = useClientReady();
  const [busyAction, setBusyAction] = React.useState<'cancel' | 'payment' | null>(null);
  if (!clientReady || !store.hydrated) return <LoadingScreen />;
  const training = store.trainings.find((item) => item.id === id);

  if (!training) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.missing}>
          <Ionicons name="calendar-clear-outline" size={36} color={theme.colors.tertiaryText} />
          <Text style={styles.missingTitle}>Nie znaleziono treningu</Text>
          <AppButton title="Zamknij" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const statusLabel = training.status === 'confirmed'
    ? 'Potwierdzony'
    : training.status === 'completed'
      ? 'Zakończony'
      : training.status === 'cancelled_by_customer'
        ? 'Odwołany przez użytkownika'
        : training.status === 'cancelled_by_provider'
          ? 'Odwołany przez trenera'
          : training.status === 'no_show'
            ? 'Nieobecność'
            : 'Oczekuje na potwierdzenie';
  const paymentLabel = training.paymentStatus === 'paid'
    ? 'Opłacony'
    : training.paymentStatus === 'not_required'
      ? 'Nie wymaga rozliczenia'
      : 'Nieopłacony';
  const trainingClub = store.clubs.find((club) => club.databaseId === training.venueId);
  const canEdit = training.canManageBooking
    && !training.status.startsWith('cancelled')
    && !['completed', 'no_show'].includes(training.status);

  const cancel = () => Alert.alert(
    'Odwołać trening?',
    'Trener i pozostali uczestnicy dostaną powiadomienie.',
    [
      { text: 'Nie', style: 'cancel' },
      {
        text: 'Odwołaj',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusyAction('cancel');
            const cancelled = await store.cancelTraining(training.id, 'Odwołano w aplikacji.');
            setBusyAction(null);
            if (cancelled) router.back();
            else Alert.alert('Nie udało się odwołać treningu', store.error ?? 'Spróbuj ponownie.');
          })();
        },
      },
    ],
  );

  const updatePayment = async () => {
    const nextStatus = training.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    setBusyAction('payment');
    const updated = await store.markTrainingPayment(
      training.id,
      nextStatus,
      nextStatus === 'paid' ? 'Rozliczenie potwierdzone poza aplikacją.' : 'Cofnięto potwierdzenie rozliczenia.',
    );
    setBusyAction(null);
    if (!updated) {
      Alert.alert('Nie udało się zmienić rozliczenia', store.error ?? 'Sprawdź uprawnienia i spróbuj ponownie.');
    }
  };

  return (
    <View style={styles.page}>
      <ModalHeader title="Szczegóły treningu" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ImageBackground source={blueCourt} style={styles.hero} resizeMode="cover">
          <LinearGradient colors={['rgba(4,8,9,0.08)', 'rgba(11,15,15,0.34)', 'rgba(11,15,15,0.94)']} style={StyleSheet.absoluteFill} />
          <View style={styles.heroBody}>
            <View style={styles.confirmed}><Ionicons name="checkmark-circle" size={14} color={theme.colors.lime} /><Text style={styles.confirmedText}>{statusLabel} · {formatDate(training.start)}</Text></View>
            <Text style={styles.heroTitle}>{training.title}</Text>
            <Text style={styles.heroTime}>{formatTime(training.start)}–{endTime(training)} · {training.durationMinutes} min</Text>
            <Text style={styles.heroVenue}>{training.venue} · {training.court}</Text>
          </View>
        </ImageBackground>

        <View style={styles.body}>
          <View style={styles.factStrip}>
            <Fact icon="grid-outline" label="Kort" value={training.court} />
            <View style={styles.verticalDivider} />
            <Fact icon="person-outline" label="Trener" value={training.trainer.split(' ')[0]} />
            <View style={styles.verticalDivider} />
            <Fact icon="wallet-outline" label="Cena" value={`${training.totalPrice} zł`} />
          </View>

          <View style={styles.actions}>
            <TrainingAction title="Przełóż" icon="swap-horizontal" disabled={!canEdit || Boolean(busyAction)} onPress={() => {
              router.replace({ pathname: '/booking', params: { id: training.id } });
            }} />
            <View style={styles.actionDivider} />
            <TrainingAction title="Napisz na czacie" icon="chatbubble-outline" onPress={() => (
              training.conversationId
                ? router.replace({ pathname: '/chat', params: { conversationId: training.conversationId } })
                : router.replace('/chat')
            )} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Miejsce</Text>
            <View>
              <InfoRow flat icon="location-outline" title={training.venue} detail={`${training.court} · ${trainingClub?.address || trainingClub?.city || '—'}`} />
              <Divider inset={40} />
              <InfoRow flat icon="wallet-outline" title={paymentLabel} detail="Trening rozliczany poza aplikacją" />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Uczestnicy</Text>
            <View>
              {training.participantDetails.length ? training.participantDetails.map((participant, index) => (
                <View key={participant.id}>
                  <InfoRow
                    flat
                    icon={participant.role === 'coach' ? 'school-outline' : participant.role === 'organizer' ? 'person-circle-outline' : 'person-outline'}
                    title={participant.displayName}
                    detail={`${participant.role === 'coach' ? 'Trener' : participant.role === 'organizer' ? 'Organizator' : 'Uczestnik'} · ${participant.responseStatus === 'accepted' ? 'potwierdzono' : participant.responseStatus === 'declined' ? 'odrzucono' : 'oczekuje'}`}
                  />
                  {index < training.participantDetails.length - 1 ? <Divider inset={40} /> : null}
                </View>
              )) : <InfoRow flat icon="person-outline" title="Gra indywidualna" detail="Bez dodatkowych uczestników" />}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Plan treningu</Text>
            <View style={styles.noteRow}>
              <View style={styles.noteIcon}><Ionicons name="reader-outline" size={20} color={theme.colors.secondaryText} /></View>
              <View style={styles.flex}>
                <Text style={styles.noteLabel}>Notatka</Text>
                <Text style={styles.noteText}>{training.notes}</Text>
              </View>
            </View>
          </View>

          {training.canManagePayment ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rozliczenie poza aplikacją</Text>
              <Text style={styles.paymentHelp}>Trener lub obsługa klubu oznacza tutaj, czy płatność została rozliczona bezpośrednio.</Text>
              <AppButton
                title={busyAction === 'payment' ? 'Zapisywanie…' : training.paymentStatus === 'paid' ? 'Oznacz jako nieopłacony' : 'Oznacz jako opłacony'}
                variant="secondary"
                disabled={Boolean(busyAction)}
                onPress={() => { void updatePayment(); }}
              />
            </View>
          ) : null}

          {canEdit ? <AppButton title={busyAction === 'cancel' ? 'Odwoływanie…' : 'Odwołaj trening'} variant="danger" disabled={Boolean(busyAction)} onPress={cancel} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function TrainingAction({
  title,
  icon,
  disabled,
  onPress,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  onPress: () => void;
}) {
  const { styles, theme } = useStyles();
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.action, disabled && styles.actionDisabled, pressed && !disabled && styles.actionPressed]}>
      <Ionicons name={icon} size={18} color={theme.colors.secondaryText} />
      <Text style={styles.actionText}>{title}</Text>
    </Pressable>
  );
}

function Fact({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  const { styles, theme } = useStyles();
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={14} color={theme.colors.secondaryText} />
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

export default withSheetPage(TrainingDetailScreen);

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: 35 },
  flex: { flex: 1 },
  hero: { height: 284 },
  heroBody: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 48, paddingHorizontal: 20 },
  confirmed: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  confirmedText: { color: theme.colors.lime, fontSize: 10, fontWeight: '600' },
  heroTitle: { color: theme.colors.heroText, fontSize: 29, fontWeight: '700', marginTop: 12, letterSpacing: -0.6 },
  heroTime: { color: theme.colors.heroText, fontSize: 16, fontWeight: '600', marginTop: 8 },
  heroVenue: { color: theme.colors.heroSecondary, fontSize: 13, marginTop: 6 },
  body: { paddingHorizontal: 16, paddingTop: 18, gap: 20 },
  factStrip: { flexDirection: 'row', paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
  fact: { flex: 1, alignItems: 'center', gap: 4 },
  factLabel: { color: theme.colors.secondaryText, fontSize: 9.5, fontWeight: '500' },
  factValue: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  verticalDivider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  actions: { minHeight: 58, flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionDivider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginVertical: 12 },
  actionText: { color: theme.colors.text, fontSize: 13.5, fontWeight: '600' },
  actionPressed: { opacity: 0.55 },
  actionDisabled: { opacity: 0.35 },
  section: { gap: 8 },
  sectionTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginLeft: 2 },
  noteRow: { paddingHorizontal: 2, paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  noteIcon: { width: 32, alignItems: 'center', justifyContent: 'center', paddingTop: 1 },
  noteLabel: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500' },
  noteText: { color: theme.colors.text, fontSize: 14, lineHeight: 20, marginTop: 6 },
  paymentHelp: { color: theme.colors.secondaryText, fontSize: 12.5, lineHeight: 18, marginBottom: 3 },
  missing: { flex: 1, padding: 30, alignItems: 'center', justifyContent: 'center', gap: 14 },
  missingTitle: { color: theme.colors.text, fontSize: 19, fontWeight: '700' },
});
