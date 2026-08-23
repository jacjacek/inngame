import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Image, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { preferenceSummary } from '@/data/availability';
import { trainerPhotos } from '@/data/trainer-media';
import { AppButton, Divider, IconButton, InfoRow, LoadingScreen, ModalHeader, useClientReady, withSheetPage } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { AppTheme, useThemeStyles } from '@/theme';

function useStyles() {
  return useThemeStyles(createStyles);
}

function TrainerProfileScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const { id, purpose } = useLocalSearchParams<{ id: string; purpose?: string }>();
  const store = useAppStore();
  const clientReady = useClientReady();
  if (!clientReady || !store.hydrated || store.loading) return <LoadingScreen />;

  const trainer = store.trainers.find((candidate) => candidate.id === id);
  if (!trainer) {
    return (
      <View style={styles.page}>
        <ModalHeader title="Profil trenera" />
        <ProfileState
          icon={store.error ? 'cloud-offline-outline' : 'person-outline'}
          title={store.error ? 'Nie udało się pobrać profilu' : 'Ten trener nie jest dostępny'}
          description={store.error ?? 'Profil mógł zostać wyłączony lub adres jest już nieaktualny.'}
          action={store.error ? 'Spróbuj ponownie' : 'Wróć do trenerów'}
          onPress={() => {
            if (store.error) void store.refresh();
            else router.replace('/trainers');
          }}
        />
      </View>
    );
  }

  const selected = store.selectedTrainerId === trainer.id;
  const availabilityPreference = store.availabilityPreferences[trainer.id];

  const choose = async () => {
    const saved = await store.selectTrainer(trainer.id);
    if (!saved) {
      Alert.alert('Nie udało się wybrać trenera', store.error ?? 'Spróbuj ponownie.');
      return;
    }
    router.dismissAll();
  };

  const openCalendar = async () => {
    if (!selected) {
      const saved = await store.selectTrainer(trainer.id);
      if (!saved) {
        Alert.alert('Nie udało się otworzyć kalendarza', store.error ?? 'Spróbuj ponownie.');
        return;
      }
    }
    router.replace('/booking');
  };

  return (
    <View style={styles.page}>
      <ModalHeader
        title="Profil trenera"
        trailing={<IconButton icon="share-outline" accessibilityLabel="Udostępnij profil" onPress={() => Share.share({ message: `${trainer.name} — trener tenisa w MyMovio` })} />}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {store.error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={18} color={theme.colors.coral} />
            <Text style={styles.errorText}>{store.error}</Text>
          </View>
        ) : null}

        <View style={styles.hero}>
          <View style={styles.avatar}>
            {trainerPhotos[trainer.id]
              ? <Image source={trainerPhotos[trainer.id]} style={styles.avatarImage} />
              : <Text style={styles.avatarText}>{trainer.initials}</Text>}
          </View>
          <View style={styles.verified}><Ionicons name="checkmark-circle" size={17} color={theme.colors.sky} /><Text style={styles.verifiedText}>Profil zweryfikowany</Text></View>
          <Text style={styles.name}>{trainer.name}</Text>
          <Text style={styles.specialty}>{trainer.specialty}</Text>
          <View style={styles.rating}><Ionicons name="star" size={16} color={theme.colors.accentText} /><Text style={styles.ratingText}>{trainer.rating}</Text><Text style={styles.ratingMuted}>{trainer.reviewCount} opinii · {trainer.distance} · {trainer.price} zł/h</Text></View>
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
            <Ionicons name="flash-outline" size={19} color={availabilityPreference?.enabled ? theme.colors.accentText : theme.colors.secondaryText} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.availabilityLabel}>Powiadomienia o wolnych terminach</Text>
            <Text numberOfLines={2} style={styles.availabilityValue}>
              {availabilityPreference ? preferenceSummary(availabilityPreference) : 'Brak zapisanych preferencji'}
            </Text>
          </View>
          <AppButton
            compact
            title={availabilityPreference?.enabled ? 'Edytuj' : 'Włącz'}
            variant="secondary"
            onPress={() => router.push({ pathname: '/availability-preferences', params: { trainerId: trainer.id } })}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>O trenerze</Text>
          <View style={styles.aboutContent}>
            {trainer.about.length
              ? trainer.about.map((paragraph) => <Text key={paragraph} style={styles.about}>{paragraph}</Text>)
              : <Text style={styles.about}>Trener nie uzupełnił jeszcze opisu.</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informacje</Text>
          <View>
            <InfoRow flat icon="ribbon-outline" title={trainer.certification} detail="Certyfikacja trenerska" />
            <Divider inset={40} />
            <InfoRow flat icon="location-outline" title={trainer.clubs.join(', ') || 'Brak przypisanych klubów'} detail="Kluby, w których prowadzi treningi" />
            <Divider inset={40} />
            <InfoRow
              flat
              icon="call-outline"
              title={trainer.phone || 'Brak telefonu'}
              detail="Telefon kontaktowy"
              onPress={trainer.phone ? () => Linking.openURL(`tel:${trainer.phone.replaceAll(' ', '')}`) : undefined}
            />
          </View>
        </View>

        <View style={styles.buttons}>
          <AppButton
            title={selected ? 'Wybrany trener' : store.mutationPending ? 'Zapisywanie…' : purpose === 'onboarding' ? 'Wybierz trenera' : 'Ustaw jako trenera'}
            icon="checkmark-circle-outline"
            disabled={selected || store.mutationPending}
            onPress={() => void choose()}
          />
          <AppButton
            title="Zobacz kalendarz"
            icon="calendar-outline"
            variant="secondary"
            disabled={store.mutationPending}
            onPress={() => void openCalendar()}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function ProfileState({
  icon,
  title,
  description,
  action,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  action: string;
  onPress: () => void;
}) {
  const { styles, theme } = useStyles();
  return (
    <View style={styles.profileState}>
      <Ionicons name={icon} size={27} color={theme.colors.secondaryText} />
      <Text style={styles.profileStateTitle}>{title}</Text>
      <Text style={styles.profileStateDescription}>{description}</Text>
      <AppButton compact variant="secondary" title={action} onPress={onPress} />
    </View>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  const { styles } = useStyles();
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

export default withSheetPage(TrainerProfileScreen);

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },

  content: { padding: 16, gap: 20, paddingBottom: 42 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 14, backgroundColor: theme.colors.dangerSoft },
  errorText: { flex: 1, color: theme.colors.danger, fontSize: 12, lineHeight: 17 },
  profileState: { flex: 1, paddingHorizontal: 30, alignItems: 'center', justifyContent: 'center', gap: 9 },
  profileStateTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  profileStateDescription: { color: theme.colors.secondaryText, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginBottom: 6 },
  hero: { alignItems: 'center', paddingVertical: 10 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 46 },
  avatarText: { color: theme.colors.text, fontSize: 27, fontWeight: '700' },
  verified: { flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 14 },
  verifiedText: { color: theme.colors.sky, fontSize: 11.5, fontWeight: '600' },
  name: { color: theme.colors.text, fontSize: 28, fontWeight: '700', marginTop: 8 },
  specialty: { color: theme.colors.secondaryText, fontSize: 14, marginTop: 5 },
  rating: { flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 12 },
  ratingText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  ratingMuted: { color: theme.colors.secondaryText, fontSize: 12 },
  selected: { flexDirection: 'row', gap: 6, marginTop: 13, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: theme.colors.successSoft },
  selectedText: { color: theme.colors.success, fontSize: 11, fontWeight: '600' },
  metrics: { flexDirection: 'row', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
  metric: { flex: 1, minHeight: 83, alignItems: 'center', justifyContent: 'center' },
  metricDivider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginVertical: 13 },
  metricValue: { color: theme.colors.text, fontSize: 18, fontWeight: '600' },
  metricLabel: { color: theme.colors.secondaryText, fontSize: 10.5, marginTop: 5 },
  availability: { paddingHorizontal: 2, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  alertPreference: { paddingHorizontal: 2, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  alertIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSoft },
  calendarIcon: { width: 36, alignItems: 'center', justifyContent: 'center' },
  availabilityLabel: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500' },
  availabilityValue: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginTop: 4 },
  section: { gap: 8 },
  sectionTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600', marginLeft: 2 },
  aboutContent: { paddingHorizontal: 2, gap: 12 },
  about: { color: theme.colors.secondaryText, fontSize: 14, lineHeight: 21 },
  buttons: { gap: 10 },
});
