import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { clubs, trainers } from '@/data/models';
import { AppButton, Divider, formatTime, InfoRow, LoadingScreen, ModalHeader, Pill, SectionTitle, selectionHaptic, successHaptic, ToggleRow, withSheetPage } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { AppTheme, useThemeStyles } from '@/theme';

function useStyles() {
  return useThemeStyles(createStyles);
}

const durations = [60, 90, 120];
const slots = Array.from({ length: 14 }, (_, index) => 7 + index);

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function HydratedBookingScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; offerId?: string; suggestedDate?: string }>();
  const store = useAppStore();
  const existing = params.id ? store.trainings.find((item) => item.id === params.id) : undefined;
  const offer = params.offerId ? store.availabilityOffers.find((item) => item.id === params.offerId) : undefined;
  const missingOffer = Boolean(params.offerId && !offer);
  const trainer = trainers.find((item) => item.id === (offer?.trainerId ?? store.selectedTrainerId)) ?? trainers[0];
  const days = useMemo(() => Array.from({ length: 8 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return date;
  }), []);

  const initialDate = existing ? new Date(existing.start) : offer ? new Date(offer.start) : params.suggestedDate ? new Date(params.suggestedDate) : days[1];
  const [selectedDay, setSelectedDay] = useState(() => days.findIndex((date) => sameDay(date, initialDate)) >= 0 ? days.findIndex((date) => sameDay(date, initialDate)) : 1);
  const [hour, setHour] = useState(existing ? new Date(existing.start).getHours() : offer ? new Date(offer.start).getHours() : 12);
  const [duration, setDuration] = useState(existing?.durationMinutes ?? offer?.durationMinutes ?? 120);
  const [clubId, setClubId] = useState(clubs.find((item) => item.name === (existing?.venue ?? offer?.venue))?.id ?? clubs[0].id);
  const [withTrainer, setWithTrainer] = useState(offer ? true : existing ? existing.trainer !== 'Gra indywidualna' : true);
  const [invitePartner, setInvitePartner] = useState(existing ? existing.participants.length > 1 : false);
  const reservationInProgress = useRef(false);

  const selectedClub = offer
    ? clubs.find((item) => item.name === offer.venue) ?? clubs.find((item) => item.id === clubId) ?? clubs[0]
    : clubs.find((item) => item.id === clubId) ?? clubs[0];
  const effectiveSelectedDay = offer
    ? Math.max(days.findIndex((date) => sameDay(date, new Date(offer.start))), 0)
    : selectedDay;
  const start = offer ? new Date(offer.start) : new Date(days[selectedDay]);
  if (!offer) start.setHours(hour, 0, 0, 0);
  const effectiveDuration = offer?.durationMinutes ?? duration;
  const courtCost = selectedClub.price * effectiveDuration / 60;
  const trainerCost = withTrainer ? trainer.price * effectiveDuration / 60 : 0;
  const totalPrice = offer?.price ?? Math.round(courtCost + trainerCost);

  const conflict = store.trainings.find((item) => {
    if (item.id === existing?.id) return false;
    const itemStart = new Date(item.start).getTime();
    const itemEnd = itemStart + item.durationMinutes * 60_000;
    const candidateStart = start.getTime();
    const candidateEnd = candidateStart + effectiveDuration * 60_000;
    return candidateStart < itemEnd && candidateEnd > itemStart;
  });
  const offerCanBeReserved = Boolean(
    offer
    && offer.status === 'available'
    && new Date(offer.start).getTime() > store.now,
  );

  const isSlotDisabled = (slot: number) => {
    const candidate = new Date(days[selectedDay]);
    candidate.setHours(slot, 0, 0, 0);
    if (candidate.getTime() < store.now) return true;
    return store.trainings.some((item) => {
      if (item.id === existing?.id) return false;
      const itemStart = new Date(item.start).getTime();
      const itemEnd = itemStart + item.durationMinutes * 60_000;
      return candidate.getTime() < itemEnd && candidate.getTime() + duration * 60_000 > itemStart;
    });
  };

  const confirm = () => {
    if (reservationInProgress.current || conflict || missingOffer || (offer && !offerCanBeReserved)) return;
    reservationInProgress.current = true;
    if (offer) {
      const training = store.reserveAvailabilityOffer(offer.id);
      if (!training) {
        reservationInProgress.current = false;
        return;
      }
      successHaptic();
      router.replace({ pathname: '/training/[id]', params: { id: training.id } });
      return;
    }
    const payload = {
      start: start.toISOString(),
      durationMinutes: duration,
      title: withTrainer ? `Trening · ${trainer.name}` : 'Gra indywidualna',
      trainer: withTrainer ? trainer.name : 'Gra indywidualna',
      venue: selectedClub.name,
      court: `Kort ${Math.min(selectedClub.courts, 2)}`,
      totalPrice,
      role: 'player' as const,
      participants: invitePartner ? [trainer.name, 'Zaproszony partner'] : withTrainer ? [trainer.name] : [],
      notes: 'Nowy trening w MyMovio.',
    };
    if (existing) {
      store.updateTraining(existing.id, payload);
    } else {
      store.addTraining({ id: `training-${start.toISOString()}`, ...payload });
    }
    successHaptic();
    router.back();
  };

  return (
    <View testID="booking-screen-hydrated" style={styles.page}>
      <ModalHeader title={existing ? 'Przełóż trening' : offer ? 'Potwierdź wolny termin' : 'Umów grę'} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {missingOffer ? (
          <View style={styles.warningCard}>
            <Ionicons name="alert-circle-outline" size={22} color={theme.colors.coral} />
            <View style={styles.flex}>
              <Text style={styles.warningCardTitle}>Ta oferta nie jest już dostępna</Text>
              <Text style={styles.warningCardText}>Wróć do rozmowy z trenerem, aby zobaczyć jej aktualny stan.</Text>
            </View>
          </View>
        ) : null}
        <View>
          <Text style={styles.title}>{existing ? 'Nowy termin' : offer ? 'Ten termin czeka na Ciebie' : 'Zaplanuj trening'}</Text>
          <Text style={styles.subtitle}>{offer ? 'Trener udostępnił konkretną godzinę. Sprawdź szczegóły i potwierdź rezerwację.' : 'Wybierz termin, długość i kort. Dostępność aktualizuje się automatycznie.'}</Text>
        </View>

        {offer ? (
          <View style={styles.offerNotice}>
            <View style={styles.offerNoticeIcon}><Ionicons name="flash" size={18} color={theme.colors.accentText} /></View>
            <View style={styles.flex}>
              <Text style={styles.offerNoticeTitle}>Wolny termin od {trainer.name}</Text>
              <Text style={styles.offerNoticeText}>Termin i miejsce są przypisane do tej oferty.</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionTitle title="Dzień" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
            {days.map((date, index) => (
              <Pressable
                key={date.toISOString()}
                accessibilityLabel={new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)}
                accessibilityRole="radio"
                accessibilityState={{ selected: effectiveSelectedDay === index, disabled: Boolean(offer) }}
                disabled={Boolean(offer)}
                onPress={() => { selectionHaptic(); setSelectedDay(index); }}
                style={[styles.day, effectiveSelectedDay === index && styles.daySelected, offer && effectiveSelectedDay !== index && styles.choiceLocked]}>
                <Text style={[styles.dayWeek, effectiveSelectedDay === index && styles.darkText]}>{new Intl.DateTimeFormat('pl-PL', { weekday: 'short' }).format(date).replace('.', '')}</Text>
                <Text style={[styles.dayNumber, effectiveSelectedDay === index && styles.darkText]}>{date.getDate()}</Text>
                <Text style={[styles.dayMonth, effectiveSelectedDay === index && styles.darkMuted]}>{new Intl.DateTimeFormat('pl-PL', { month: 'short' }).format(date).replace('.', '')}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Godzina" action={<Text style={styles.hint}><Ionicons name="lock-closed" size={10} /> zajęte lub minione</Text>} />
          <View style={styles.slotGrid}>
            {slots.map((slot) => {
              const disabled = isSlotDisabled(slot);
              const active = (offer ? new Date(offer.start).getHours() : hour) === slot;
              return (
                <Pressable
                  key={slot}
                  accessibilityLabel={offer && active ? formatTime(offer.start) : `${String(slot).padStart(2, '0')}:00`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, disabled: disabled || Boolean(offer) }}
                  disabled={disabled || Boolean(offer)}
                  onPress={() => { selectionHaptic(); setHour(slot); }}
                  style={[styles.slot, active && styles.slotSelected, disabled && styles.slotDisabled]}>
                  <Text style={[styles.slotText, active && styles.darkText]}>{offer && active ? formatTime(offer.start) : `${String(slot).padStart(2, '0')}:00`}</Text>
                  {disabled ? <Ionicons name="lock-closed" size={9} color={theme.colors.tertiaryText} /> : null}
                </Pressable>
              );
            })}
          </View>
          {conflict ? (
            <View style={styles.warning}>
              <Ionicons name="warning-outline" size={17} color={theme.colors.coral} />
              <Text style={styles.warningText}>Ten termin koliduje z: {conflict.title}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionTitle title="Długość treningu" />
          <View style={styles.durationRow}>
            {durations.map((value) => (
              <Pill
                key={value}
                label={value === 60 ? '1 godz.' : value === 90 ? '1,5 godz.' : '2 godz.'}
                active={effectiveDuration === value}
                onPress={offer ? undefined : () => setDuration(value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Kort" />
          <View>
            {clubs.map((club, index) => {
              const selected = club.id === clubId;
              return (
                <View key={club.id}>
                  <Pressable
                    accessibilityLabel={`${club.name}, ${offer && selected ? offer.court : 'Kort 2'}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: Boolean(offer) }}
                    disabled={Boolean(offer)}
                    onPress={() => { selectionHaptic(); setClubId(club.id); }}
                    style={[styles.clubRow, offer && !selected && styles.choiceLocked]}>
                    <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                    <View style={styles.flex}>
                      <Text style={styles.clubName}>{club.name}</Text>
                      <Text style={styles.clubMeta}>{offer && selected ? offer.court : 'Kort 2'} · {club.surface} · {club.distance}</Text>
                    </View>
                    <Text style={styles.clubPrice}>{club.price} zł/h</Text>
                  </Pressable>
                  {index < clubs.length - 1 ? <Divider inset={36} /> : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Uczestnicy" />
          <View>
            {offer ? (
              <InfoRow flat icon="person-circle-outline" title={`Trener: ${trainer.name}`} detail="Przypisany do wolnego terminu" />
            ) : (
              <ToggleRow flat title={`Trener: ${trainer.name}`} subtitle={`${trainer.rating} ★ · ${trainer.price} zł/h`} value={withTrainer} onValueChange={setWithTrainer} />
            )}
            <Divider inset={0} />
            {offer ? (
              <InfoRow flat icon="people-outline" title="Trening indywidualny" detail="Partnera możesz dodać po rezerwacji" />
            ) : (
              <ToggleRow flat title="Zaproś partnera" subtitle="Wyślemy zaproszenie po rezerwacji" value={invitePartner} onValueChange={setInvitePartner} />
            )}
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Podsumowanie</Text>
            <Text style={styles.total}>{totalPrice} zł</Text>
          </View>
          <SummaryRow label="Termin" value={`${new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }).format(start)}, ${formatTime(start.toISOString())}`} />
          <SummaryRow label="Kort" value={`${selectedClub.name} · ${offer?.court ?? 'Kort 2'}`} />
          <SummaryRow label="Czas" value={`${effectiveDuration} min`} />
          {withTrainer ? <SummaryRow label="Trener" value={trainer.name} /> : null}
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <AppButton
          title={missingOffer ? 'Wróć' : existing ? 'Zapisz nowy termin' : offer ? `Rezerwuję · ${totalPrice} zł` : `Potwierdź · ${totalPrice} zł`}
          disabled={!missingOffer && (Boolean(conflict) || (offer ? !offerCanBeReserved : false))}
          onPress={missingOffer ? () => router.back() : confirm}
        />
      </SafeAreaView>
    </View>
  );
}

function BookingScreen() {
  const router = useRouter();
  const { offerId } = useLocalSearchParams<{ offerId?: string }>();
  const store = useAppStore();
  const offer = offerId ? store.availabilityOffers.find((item) => item.id === offerId) : undefined;
  const reservedTraining = offer?.status === 'reserved' && offer.reservedTrainingId
    ? store.trainings.find((training) => training.id === offer.reservedTrainingId)
    : undefined;

  useEffect(() => {
    if (!store.hydrated || !reservedTraining) return;
    router.replace({ pathname: '/training/[id]', params: { id: reservedTraining.id } });
  }, [reservedTraining, router, store.hydrated]);

  if (!store.hydrated || reservedTraining) return <LoadingScreen />;
  return <HydratedBookingScreen />;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const { styles } = useStyles();
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export default withSheetPage(BookingScreen);

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 28, gap: 24 },
  title: { color: theme.colors.text, fontSize: 29, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { color: theme.colors.secondaryText, fontSize: 14, lineHeight: 20, marginTop: 7 },
  offerNotice: { minHeight: 70, padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.accentSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.accentBorder },
  offerNoticeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSoft },
  offerNoticeTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  offerNoticeText: { color: theme.colors.secondaryText, fontSize: 11.5, marginTop: 4 },
  warningCard: { minHeight: 74, padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.dangerSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.dangerBorder },
  warningCardTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  warningCardText: { color: theme.colors.secondaryText, fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  section: { gap: 9 },
  days: { gap: 8 },
  day: { width: 58, minHeight: 82, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceSoft },
  daySelected: { backgroundColor: theme.colors.lime, borderColor: theme.colors.lime },
  choiceLocked: { opacity: 0.28 },
  dayWeek: { color: theme.colors.secondaryText, fontSize: 10, textTransform: 'capitalize' },
  dayNumber: { color: theme.colors.text, fontSize: 20, fontWeight: '600', marginTop: 3 },
  dayMonth: { color: theme.colors.tertiaryText, fontSize: 9, marginTop: 3 },
  darkText: { color: theme.colors.onAccent },
  darkMuted: { color: 'rgba(17,18,15,0.56)' },
  hint: { color: theme.colors.tertiaryText, fontSize: 10 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '22.9%', minHeight: 43, borderRadius: 11, backgroundColor: theme.colors.surfaceSoft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  slotSelected: { backgroundColor: theme.colors.lime, borderColor: theme.colors.lime },
  slotDisabled: { opacity: 0.3 },
  slotText: { color: theme.colors.text, fontSize: 12.5, fontWeight: '600' },
  warning: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,109,77,0.24)' },
  warningText: { color: theme.colors.coral, fontSize: 12, flex: 1 },
  durationRow: { flexDirection: 'row', gap: 8 },
  clubRow: { minHeight: 72, paddingHorizontal: 2, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: theme.colors.tertiaryText, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: theme.colors.lime },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.lime },
  clubName: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  clubMeta: { color: theme.colors.secondaryText, fontSize: 11.5, marginTop: 4 },
  clubPrice: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  summary: { paddingHorizontal: 2, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  summaryTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  total: { color: theme.colors.accentText, fontSize: 21, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 11 },
  summaryLabel: { color: theme.colors.secondaryText, fontSize: 13 },
  summaryValue: { color: theme.colors.text, fontSize: 13, fontWeight: '600', maxWidth: '68%', textAlign: 'right' },
  bottomBar: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: theme.colors.surfaceSoft, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
});
