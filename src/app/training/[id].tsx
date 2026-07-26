import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, Divider, endTime, formatDate, formatTime, InfoRow, ModalHeader, selectionHaptic, withSheetPage } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { theme } from '@/theme';

const blueCourt = require('@/assets/mymovio/blue-court.png');

function TrainingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useAppStore();
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

  const cancel = () => Alert.alert(
    'Odwołać trening?',
    'Trener i pozostali uczestnicy dostaną powiadomienie.',
    [
      { text: 'Nie', style: 'cancel' },
      {
        text: 'Odwołaj',
        style: 'destructive',
        onPress: () => {
          store.cancelTraining(training.id);
          router.back();
        },
      },
    ],
  );

  return (
    <View style={styles.page}>
      <ModalHeader title="Szczegóły treningu" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ImageBackground source={blueCourt} style={styles.hero} resizeMode="cover">
          <LinearGradient colors={['rgba(4,8,9,0.08)', 'rgba(11,15,15,0.34)', theme.colors.background]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroBody}>
            <View style={styles.confirmed}><Ionicons name="checkmark-circle" size={14} color={theme.colors.lime} /><Text style={styles.confirmedText}>Potwierdzony · {formatDate(training.start)}</Text></View>
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
            <TrainingAction title="Przełóż" icon="swap-horizontal" onPress={() => {
              router.replace({ pathname: '/booking', params: { id: training.id } });
            }} />
            <View style={styles.actionDivider} />
            <TrainingAction title="Napisz na czacie" icon="chatbubble-outline" onPress={() => router.replace('/chat')} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Miejsce</Text>
            <View>
              <InfoRow flat icon="location-outline" title={training.venue} detail={`${training.court} · Warszawa`} onPress={() => undefined} />
              <Divider inset={40} />
              <InfoRow flat icon="partly-sunny-outline" title="22° · Słonecznie" detail="Wiatr 9 km/h · Kort w dobrym stanie" />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Uczestnicy</Text>
            <View>
              {training.participants.length ? training.participants.map((participant, index) => (
                <View key={`${participant}-${index}`}>
                  <InfoRow flat icon={index === 0 ? 'person-circle-outline' : 'person-outline'} title={participant} detail={index === 0 ? 'Trener · potwierdzono' : 'Uczestnik · potwierdzono'} />
                  {index < training.participants.length - 1 ? <Divider inset={40} /> : null}
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

          <AppButton title="Odwołaj trening" variant="danger" onPress={cancel} />
        </View>
      </ScrollView>
    </View>
  );
}

function TrainingAction({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
      <Ionicons name={icon} size={18} color={theme.colors.secondaryText} />
      <Text style={styles.actionText}>{title}</Text>
    </Pressable>
  );
}

function Fact({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={14} color={theme.colors.secondaryText} />
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

export default withSheetPage(TrainingDetailScreen);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: 35 },
  flex: { flex: 1 },
  hero: { height: 284 },
  heroBody: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 48, paddingHorizontal: 20 },
  confirmed: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  confirmedText: { color: theme.colors.lime, fontSize: 10, fontWeight: '600' },
  heroTitle: { color: theme.colors.text, fontSize: 29, fontWeight: '700', marginTop: 12, letterSpacing: -0.6 },
  heroTime: { color: theme.colors.text, fontSize: 16, fontWeight: '600', marginTop: 8 },
  heroVenue: { color: theme.colors.secondaryText, fontSize: 13, marginTop: 6 },
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
  section: { gap: 8 },
  sectionTitle: { color: 'rgba(255,255,255,0.86)', fontSize: 14, fontWeight: '600', marginLeft: 2 },
  noteRow: { paddingHorizontal: 2, paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  noteIcon: { width: 32, alignItems: 'center', justifyContent: 'center', paddingTop: 1 },
  noteLabel: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500' },
  noteText: { color: theme.colors.text, fontSize: 14, lineHeight: 20, marginTop: 6 },
  missing: { flex: 1, padding: 30, alignItems: 'center', justifyContent: 'center', gap: 14 },
  missingTitle: { color: theme.colors.text, fontSize: 19, fontWeight: '700' },
});
