import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Image, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { preferenceSummary } from '@/data/availability';
import { trainers } from '@/data/models';
import { trainerPhotos } from '@/data/trainer-media';
import { AppButton, Divider, IconButton, InfoRow, ModalHeader, withSheetPage } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { theme } from '@/theme';

function TrainerProfileScreen() {
  const router = useRouter();
  const { id, purpose } = useLocalSearchParams<{ id: string; purpose?: string }>();
  const store = useAppStore();
  const trainer = trainers.find((candidate) => candidate.id === id);
  if (!trainer) return null;
  const selected = store.selectedTrainerId === trainer.id;
  const availabilityPreference = store.availabilityPreferences[trainer.id];

  const choose = () => {
    store.selectTrainer(trainer.id);
    router.dismissAll();
  };

  return (
    <View style={styles.page}>
      <ModalHeader
        title="Profil trenera"
        trailing={<IconButton icon="share-outline" accessibilityLabel="Udostępnij profil" onPress={() => Share.share({ message: `${trainer.name} — trener tenisa w MyMovio` })} />}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            {trainerPhotos[trainer.id]
              ? <Image source={trainerPhotos[trainer.id]} style={styles.avatarImage} />
              : <Text style={styles.avatarText}>{trainer.initials}</Text>}
          </View>
          <View style={styles.verified}><Ionicons name="checkmark-circle" size={17} color={theme.colors.sky} /><Text style={styles.verifiedText}>Profil zweryfikowany</Text></View>
          <Text style={styles.name}>{trainer.name}</Text>
          <Text style={styles.specialty}>{trainer.specialty}</Text>
          <View style={styles.rating}><Ionicons name="star" size={16} color={theme.colors.lime} /><Text style={styles.ratingText}>{trainer.rating}</Text><Text style={styles.ratingMuted}>{trainer.reviewCount} opinii · {trainer.distance} · {trainer.price} zł/h</Text></View>
          {selected ? <View style={styles.selected}><Ionicons name="checkmark-circle" size={16} color={theme.colors.success} /><Text style={styles.selectedText}>Twój aktywny trener</Text></View> : null}
        </View>

        <View style={styles.metrics}>
          <Metric value={trainer.experience} label="doświadczenia" />
          <View style={styles.metricDivider} />
          <Metric value={`${trainer.trainings}`} label="treningów" />
          <View style={styles.metricDivider} />
          <Metric value={trainer.rating} label="ocena" />
        </View>

        <View style={styles.availability}>
          <View style={styles.calendarIcon}><Ionicons name="calendar-outline" size={22} color={theme.colors.secondaryText} /></View>
          <View style={styles.flex}>
            <Text style={styles.availabilityLabel}>Najbliższy termin</Text>
            <Text style={styles.availabilityValue}>{trainer.availability}</Text>
          </View>
        </View>

        <View style={styles.alertPreference}>
          <View style={styles.alertIcon}>
            <Ionicons name="flash-outline" size={19} color={availabilityPreference.enabled ? theme.colors.lime : theme.colors.secondaryText} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.availabilityLabel}>Powiadomienia o wolnych terminach</Text>
            <Text numberOfLines={2} style={styles.availabilityValue}>{preferenceSummary(availabilityPreference)}</Text>
          </View>
          <AppButton
            compact
            title={availabilityPreference.enabled ? 'Edytuj' : 'Włącz'}
            variant="secondary"
            onPress={() => router.push({ pathname: '/availability-preferences', params: { trainerId: trainer.id } })}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>O trenerze</Text>
          <View style={styles.aboutContent}>{trainer.about.map((paragraph) => <Text key={paragraph} style={styles.about}>{paragraph}</Text>)}</View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informacje</Text>
          <View>
            <InfoRow flat icon="ribbon-outline" title={trainer.certification} detail="Certyfikacja trenerska" />
            <Divider inset={40} />
            <InfoRow flat icon="location-outline" title={trainer.clubs.join(', ')} detail="Kluby, w których prowadzi treningi" />
            <Divider inset={40} />
            <InfoRow flat icon="call-outline" title={trainer.phone} detail="Telefon kontaktowy" onPress={() => Linking.openURL(`tel:${trainer.phone.replaceAll(' ', '')}`)} />
          </View>
        </View>

        <View style={styles.buttons}>
          <AppButton title={selected ? 'Wybrany trener' : purpose === 'onboarding' ? 'Wybierz trenera' : 'Ustaw jako trenera'} icon="checkmark-circle-outline" disabled={selected} onPress={choose} />
          <AppButton title="Zobacz kalendarz" icon="calendar-outline" variant="secondary" onPress={() => {
            if (!selected) store.selectTrainer(trainer.id);
            router.replace('/booking');
          }} />
        </View>
      </ScrollView>
    </View>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

export default withSheetPage(TrainerProfileScreen);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },

  content: { padding: 16, gap: 20, paddingBottom: 42 },
  hero: { alignItems: 'center', paddingVertical: 10 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#343630', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 46 },
  avatarText: { color: theme.colors.text, fontSize: 27, fontWeight: '700' },
  verified: { flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 14 },
  verifiedText: { color: theme.colors.sky, fontSize: 11.5, fontWeight: '600' },
  name: { color: theme.colors.text, fontSize: 28, fontWeight: '700', marginTop: 8 },
  specialty: { color: theme.colors.secondaryText, fontSize: 14, marginTop: 5 },
  rating: { flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 12 },
  ratingText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  ratingMuted: { color: theme.colors.secondaryText, fontSize: 12 },
  selected: { flexDirection: 'row', gap: 6, marginTop: 13, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(152,215,91,0.12)' },
  selectedText: { color: theme.colors.success, fontSize: 11, fontWeight: '600' },
  metrics: { flexDirection: 'row', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
  metric: { flex: 1, minHeight: 83, alignItems: 'center', justifyContent: 'center' },
  metricDivider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginVertical: 13 },
  metricValue: { color: theme.colors.text, fontSize: 18, fontWeight: '600' },
  metricLabel: { color: theme.colors.secondaryText, fontSize: 10.5, marginTop: 5 },
  availability: { paddingHorizontal: 2, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  alertPreference: { paddingHorizontal: 2, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  alertIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(199,225,46,0.08)' },
  calendarIcon: { width: 36, alignItems: 'center', justifyContent: 'center' },
  availabilityLabel: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500' },
  availabilityValue: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginTop: 4 },
  section: { gap: 8 },
  sectionTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600', marginLeft: 2 },
  aboutContent: { paddingHorizontal: 2, gap: 12 },
  about: { color: theme.colors.secondaryText, fontSize: 14, lineHeight: 21 },
  buttons: { gap: 10 },
});
