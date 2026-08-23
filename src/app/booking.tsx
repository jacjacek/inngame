import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, Divider, formatTime, InfoRow, LoadingScreen, ModalHeader, Pill, SectionTitle, selectionHaptic, successHaptic, ToggleRow, withSheetPage } from '@/components/ui';
import { AppRepositoryError, supabaseAppRepository, type BookingQuote } from '@/data/repositories';
import type { Club, Court, Trainer, Training } from '@/data/models';
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

function quoteErrorMessage(error: unknown) {
  const code = error instanceof AppRepositoryError ? error.code : undefined;
  if (code === 'SLOT_TAKEN' || code === '23P01') return 'Ten termin został właśnie zajęty.';
  if (code === 'BOOKING_QUOTA_EXCEEDED' || code === 'FUTURE_UNPAID_BOOKING_LIMIT') {
    return 'Masz już maksymalną liczbę przyszłych, nierozliczonych rezerwacji.';
  }
  if (code === 'BOOKING_RATE_LIMITED' || code === 'RATE_LIMITED') {
    return 'Zbyt wiele prób rezerwacji. Odczekaj chwilę i spróbuj ponownie.';
  }
  if (code === 'QUOTE_CHANGED') return 'Cena rezerwacji właśnie się zmieniła. Sprawdź podsumowanie ponownie.';
  if (code === 'OFFER_PRICE_CHANGED') return 'Cena tej oferty uległa zmianie. Odśwież dane przed rezerwacją.';
  if (code === 'INVALID_SLOT_STEP' || code === 'INVALID_START_TIME') return 'Wybierz godzinę zgodną z siatką dostępności.';
  if (code === 'TRAINER_NOT_AVAILABLE') return 'Trener nie jest dostępny w tym terminie.';
  if (code === 'COURT_NOT_AVAILABLE') return 'Kort nie jest dostępny w tym terminie.';
  return 'Nie udało się potwierdzić ceny i dostępności. Zmień termin albo spróbuj ponownie.';
}

function minorUnitsToMajor(minor: number, currency: string) {
  try {
    const exponent = new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
    return minor / (10 ** exponent);
  } catch {
    return minor / 100;
  }
}

function formatQuotedPrice(quote?: BookingQuote) {
  if (!quote) return '—';
  try {
    const formatter = new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: quote.currency,
    });
    return formatter.format(minorUnitsToMajor(quote.totalMinor, quote.currency));
  } catch {
    return `${(quote.totalMinor / 100).toFixed(2)} ${quote.currency}`;
  }
}

function equivalentQuotes(left: BookingQuote, right: BookingQuote) {
  return left.sportId === right.sportId
    && left.venueId === right.venueId
    && left.courtId === right.courtId
    && left.trainerId === right.trainerId
    && new Date(left.startsAt).getTime() === new Date(right.startsAt).getTime()
    && new Date(left.endsAt).getTime() === new Date(right.endsAt).getTime()
    && left.durationMinutes === right.durationMinutes
    && left.courtRateId === right.courtRateId
    && left.trainerRateId === right.trainerRateId
    && left.courtAmountMinor === right.courtAmountMinor
    && left.trainerAmountMinor === right.trainerAmountMinor
    && left.discountMinor === right.discountMinor
    && left.totalMinor === right.totalMinor
    && left.currency === right.currency;
}

function historicalTrainer(training?: Training, trainerReference?: string): Trainer {
  const name = training?.trainer && training.trainer !== 'Gra indywidualna'
    ? training.trainer
    : 'Trener';
  return {
    id: trainerReference ?? 'historical-trainer',
    databaseId: training?.trainerId ?? '',
    name,
    initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toLocaleUpperCase('pl'),
    specialty: '',
    certification: '',
    phone: '',
    distance: '',
    rating: '—',
    reviewCount: 0,
    price: 0,
    priceMinor: 0,
    availability: '',
    experience: '',
    trainings: 0,
    about: [],
    clubs: training ? [training.venue] : [],
    venueIds: training ? [training.venueId] : [],
    sportIds: training ? [training.sportId] : [],
  };
}

function historicalClub(training: Training): Club {
  return {
    id: `historical-${training.venueId}`,
    databaseId: training.venueId,
    organizationId: '',
    courtId: training.courtId,
    courtIds: [training.courtId],
    name: training.venue,
    address: '',
    city: '',
    distance: '',
    courts: 1,
    surface: '',
    price: 0,
    priceMinor: 0,
  };
}

function historicalCourt(training: Training): Court {
  return {
    id: training.courtId,
    venueId: training.venueId,
    sportId: training.sportId,
    code: 'historical',
    name: training.court,
    surface: '',
    indoor: false,
    status: 'historical',
    priceMinor: 0,
    currency: training.currency,
  };
}

function HydratedBookingScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; offerId?: string; suggestedDate?: string }>();
  const store = useAppStore();
  const existing = params.id ? store.trainings.find((item) => item.id === params.id) : undefined;
  const offer = params.offerId ? store.availabilityOffers.find((item) => item.id === params.offerId) : undefined;
  const missingOffer = Boolean(params.offerId && !offer);
  const missingBooking = Boolean(params.id && !existing);
  const missingTarget = missingOffer || missingBooking;
  const trainers = store.trainers;
  const allClubs = store.clubs;
  const trainerReference = offer?.trainerId ?? existing?.trainerId ?? store.selectedTrainerId;
  const trainer = trainers.find((item) => (
    item.id === trainerReference || item.databaseId === trainerReference
  )) ?? historicalTrainer(existing, trainerReference);
  const bookingSportId = existing?.sportId
    ?? store.sports.find((sport) => sport.name === store.selectedSport)?.id
    ?? store.sports[0]?.id;
  const trainerSupportsSport = Boolean(bookingSportId && trainer.sportIds.includes(bookingSportId));
  const [withTrainer, setWithTrainer] = useState(offer ? true : existing ? Boolean(existing.trainerId) : true);
  const activeCourtsForClub = (clubDatabaseId: string) => store.courts.filter((court) => (
    court.venueId === clubDatabaseId
    && court.status === 'active'
    && court.sportId === bookingSportId
  ));
  const eligibleClubs = (includeTrainer: boolean) => allClubs.filter((club) => (
    activeCourtsForClub(club.databaseId).length > 0
    && (!includeTrainer || (
      trainerSupportsSport && trainer.venueIds.includes(club.databaseId)
    ))
  ));
  const assignedClub = allClubs.find((club) => (
    club.databaseId === existing?.venueId || club.name === offer?.venue
  )) ?? (existing ? historicalClub(existing) : undefined);
  const filteredClubs = eligibleClubs(withTrainer);
  const clubs = assignedClub && !filteredClubs.some((club) => club.id === assignedClub.id)
    ? [assignedClub, ...filteredClubs]
    : filteredClubs;
  const requestedInitialDate = existing?.start ?? offer?.start ?? params.suggestedDate;
  const requestedInitialTimestamp = requestedInitialDate ? new Date(requestedInitialDate).getTime() : Number.NaN;
  const days = useMemo(() => {
    const availableDays = Array.from({ length: 8 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + index);
      return date;
    });
    if (Number.isFinite(requestedInitialTimestamp)) {
      const requestedDay = new Date(requestedInitialTimestamp);
      requestedDay.setHours(0, 0, 0, 0);
      if (!availableDays.some((date) => sameDay(date, requestedDay))) availableDays.push(requestedDay);
    }
    return availableDays.sort((left, right) => left.getTime() - right.getTime());
  }, [requestedInitialTimestamp]);

  const initialDate = Number.isFinite(requestedInitialTimestamp) ? new Date(requestedInitialTimestamp) : days[1];
  const [selectedDay, setSelectedDay] = useState(() => {
    const index = days.findIndex((date) => sameDay(date, initialDate));
    return index >= 0 ? index : Math.min(1, days.length - 1);
  });
  const [hour, setHour] = useState(existing ? new Date(existing.start).getHours() : offer ? new Date(offer.start).getHours() : 12);
  const [minute, setMinute] = useState(existing ? new Date(existing.start).getMinutes() : offer ? new Date(offer.start).getMinutes() : 0);
  const visibleSlots = useMemo(() => (
    slots.includes(hour) ? slots : [...slots, hour].sort((left, right) => left - right)
  ), [hour]);
  const [duration, setDuration] = useState(existing?.durationMinutes ?? offer?.durationMinutes ?? 120);
  const [clubId, setClubId] = useState(
    assignedClub?.id ?? clubs[0]?.id ?? allClubs[0].id,
  );
  const [submitting, setSubmitting] = useState(false);
  const reservationInProgress = useRef(false);
  const quoteRequestGeneration = useRef(0);
  const activeQuoteKey = useRef<string | undefined>(undefined);
  const [quoteState, setQuoteState] = useState<{
    key: string;
    status: 'loading' | 'success' | 'error';
    quote?: BookingQuote;
    error?: string;
  }>();

  const selectedClub = clubs.find((item) => item.id === clubId) ?? clubs[0] ?? allClubs[0];
  const assignedCourt = store.courts.find((court) => (
    court.id === existing?.courtId
    || (court.venueId === selectedClub.databaseId && court.name === offer?.court)
  )) ?? (existing ? historicalCourt(existing) : undefined);
  const activeSelectedClubCourts = activeCourtsForClub(selectedClub.databaseId);
  const courtOptions = assignedCourt && !activeSelectedClubCourts.some((court) => court.id === assignedCourt.id)
    ? [assignedCourt, ...activeSelectedClubCourts]
    : activeSelectedClubCourts;
  const [courtId, setCourtId] = useState(
    existing?.courtId
      ?? store.courts.find((court) => court.venueId === assignedClub?.databaseId && court.name === offer?.court)?.id
      ?? activeSelectedClubCourts[0]?.id
      ?? '',
  );
  const selectedCourt = courtOptions.find((court) => court.id === courtId);
  const effectiveVenueId = existing?.venueId ?? selectedClub.databaseId;
  const effectiveCourtId = existing?.courtId ?? selectedCourt?.id;
  const effectiveTrainerId = existing
    ? existing.trainerId
    : withTrainer ? trainer.databaseId || undefined : undefined;
  const effectiveTrainerName = existing?.trainer ?? (withTrainer ? trainer.name : 'Gra indywidualna');
  const effectiveVenueName = existing?.venue ?? selectedClub.name;
  const effectiveCourtName = existing?.court ?? offer?.court ?? selectedCourt?.name ?? '—';
  const effectiveSelectedDay = offer
    ? Math.max(days.findIndex((date) => sameDay(date, new Date(offer.start))), 0)
    : selectedDay;
  const start = offer ? new Date(offer.start) : new Date(days[selectedDay] ?? initialDate);
  if (!offer) start.setHours(hour, minute, 0, 0);
  const effectiveDuration = offer?.durationMinutes ?? duration;
  const startIso = start.toISOString();
  const quoteKey = !offer && bookingSportId && effectiveVenueId && effectiveCourtId
    ? JSON.stringify({
      sportId: bookingSportId,
      venueId: effectiveVenueId,
      courtId: effectiveCourtId,
      trainerId: effectiveTrainerId ?? null,
      startsAt: startIso,
      durationMinutes: effectiveDuration,
      excludeBookingId: existing?.id ?? null,
    })
    : undefined;
  const currentQuoteState = quoteState && quoteState.key === quoteKey ? quoteState : undefined;
  const currentQuote = currentQuoteState?.quote;
  const quoteLoading = Boolean(quoteKey && (!currentQuoteState || currentQuoteState.status === 'loading'));
  const quoteError = currentQuoteState?.error;
  const quotedPrice = offer ? `${offer.price} zł` : formatQuotedPrice(currentQuote);

  useEffect(() => {
    activeQuoteKey.current = quoteKey;
  }, [quoteKey]);

  useEffect(() => {
    const generation = ++quoteRequestGeneration.current;
    let active = true;
    if (!quoteKey || !bookingSportId || !effectiveCourtId || offer || missingTarget) {
      return;
    }

    const timeout = setTimeout(() => {
      setQuoteState({ key: quoteKey, status: 'loading' });
      void supabaseAppRepository.quoteBooking({
        sportId: bookingSportId,
        venueId: effectiveVenueId,
        courtId: effectiveCourtId,
        trainerId: effectiveTrainerId,
        startsAt: startIso,
        durationMinutes: effectiveDuration,
        excludeBookingId: existing?.id,
      }).then((quote) => {
        if (!active || generation !== quoteRequestGeneration.current) return;
        setQuoteState({ key: quoteKey, status: 'success', quote });
      }).catch((error: unknown) => {
        if (!active || generation !== quoteRequestGeneration.current) return;
        setQuoteState({ key: quoteKey, status: 'error', error: quoteErrorMessage(error) });
      });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [
    bookingSportId,
    effectiveCourtId,
    effectiveDuration,
    effectiveTrainerId,
    effectiveVenueId,
    existing?.id,
    missingTarget,
    offer,
    quoteKey,
    startIso,
  ]);

  const conflictsWithBooking = (item: (typeof store.trainings)[number], candidateStart: number, candidateEnd: number) => {
    if (item.id === existing?.id) return false;
    if (item.status.startsWith('cancelled') || item.status === 'no_show') return false;
    const itemStart = new Date(item.start).getTime();
    const itemEnd = new Date(item.end).getTime();
    if (!(candidateStart < itemEnd && candidateEnd > itemStart)) return false;
    const conflictsWithCurrentUser = item.role !== 'staff';
    const conflictsWithCourt = Boolean(effectiveCourtId && item.courtId === effectiveCourtId);
    const conflictsWithTrainer = Boolean(effectiveTrainerId && item.trainerId === effectiveTrainerId);
    return conflictsWithCurrentUser || conflictsWithCourt || conflictsWithTrainer;
  };
  const conflict = store.trainings.find((item) => conflictsWithBooking(
    item,
    start.getTime(),
    start.getTime() + effectiveDuration * 60_000,
  ));
  const offerCanBeReserved = Boolean(
    offer
    && offer.status === 'available'
    && new Date(offer.start).getTime() > store.now,
  );

  const isSlotDisabled = (slot: number) => {
    const candidate = new Date(days[selectedDay]);
    candidate.setHours(slot, slot === hour ? minute : 0, 0, 0);
    if (candidate.getTime() < store.now) return true;
    return store.trainings.some((item) => conflictsWithBooking(
      item,
      candidate.getTime(),
      candidate.getTime() + effectiveDuration * 60_000,
    ));
  };

  const selectClub = (nextClubId: string) => {
    const nextClub = clubs.find((club) => club.id === nextClubId);
    if (!nextClub) return;
    setClubId(nextClubId);
    setCourtId(activeCourtsForClub(nextClub.databaseId)[0]?.id ?? '');
  };

  const toggleTrainer = (enabled: boolean) => {
    setWithTrainer(enabled);
    const nextClubs = eligibleClubs(enabled);
    const currentStillEligible = nextClubs.some((club) => club.id === clubId);
    if (currentStillEligible) return;
    const nextClub = nextClubs[0];
    if (!nextClub) {
      setCourtId('');
      return;
    }
    setClubId(nextClub.id);
    setCourtId(activeCourtsForClub(nextClub.databaseId)[0]?.id ?? '');
  };

  const confirm = async () => {
    if (
      reservationInProgress.current
      || conflict
      || missingTarget
      || (offer ? !offerCanBeReserved : (
        !effectiveVenueId
        || !effectiveCourtId
        || (withTrainer && !effectiveTrainerId)
        || !currentQuote
      ))
    ) return;
    reservationInProgress.current = true;
    setSubmitting(true);
    const submittedQuoteKey = quoteKey;
    activeQuoteKey.current = submittedQuoteKey;
    try {
      if (offer) {
        const training = await store.reserveAvailabilityOffer(offer.id);
        if (!training) {
          Alert.alert('Nie udało się zarezerwować', store.error ?? 'Termin mógł zostać zajęty. Odśwież dane i spróbuj ponownie.');
          return;
        }
        successHaptic();
        router.replace({ pathname: '/training/[id]', params: { id: training.id } });
        return;
      }

      if (!bookingSportId || !effectiveVenueId || !effectiveCourtId) {
        Alert.alert('Brak aktywnego kortu', 'Ten obiekt nie ma aktywnego kortu dla wybranej dyscypliny.');
        return;
      }
      if (!currentQuote || !quoteKey) {
        Alert.alert('Brak aktualnej wyceny', 'Poczekaj na potwierdzenie ceny i dostępności przez serwer.');
        return;
      }

      let acceptedQuote: BookingQuote;
      try {
        acceptedQuote = await supabaseAppRepository.quoteBooking({
          sportId: bookingSportId,
          venueId: effectiveVenueId,
          courtId: effectiveCourtId,
          trainerId: effectiveTrainerId,
          startsAt: startIso,
          durationMinutes: effectiveDuration,
          excludeBookingId: existing?.id,
        });
      } catch (error) {
        const nextError = quoteErrorMessage(error);
        setQuoteState({ key: quoteKey, status: 'error', error: nextError });
        Alert.alert('Termin wymaga ponownego sprawdzenia', nextError);
        return;
      }
      if (activeQuoteKey.current !== submittedQuoteKey) {
        Alert.alert(
          'Formularz się zmienił',
          'Sprawdź nowy termin i aktualną wycenę, a następnie potwierdź rezerwację ponownie.',
        );
        return;
      }
      if (!equivalentQuotes(currentQuote, acceptedQuote)) {
        setQuoteState({ key: quoteKey, status: 'success', quote: acceptedQuote });
        Alert.alert(
          'Warunki rezerwacji się zmieniły',
          `Aktualna cena to ${formatQuotedPrice(acceptedQuote)}. Sprawdź podsumowanie i potwierdź ponownie.`,
        );
        return;
      }

      const payload = {
        sportId: bookingSportId,
        venueId: effectiveVenueId,
        courtId: effectiveCourtId,
        trainerId: effectiveTrainerId,
        start: startIso,
        durationMinutes: effectiveDuration,
        title: existing?.title ?? (withTrainer ? `Trening · ${trainer.name}` : 'Gra indywidualna'),
        trainer: effectiveTrainerName,
        venue: effectiveVenueName,
        court: effectiveCourtName,
        totalPrice: minorUnitsToMajor(acceptedQuote.totalMinor, acceptedQuote.currency),
        totalPriceMinor: acceptedQuote.totalMinor,
        currency: acceptedQuote.currency,
        role: 'player' as const,
        participants: existing?.participants ?? (withTrainer ? [trainer.name] : []),
        notes: existing?.notes ?? '',
      };
      if (existing) {
        const updated = await store.updateTraining(existing.id, payload);
        if (!updated) {
          Alert.alert('Nie udało się przełożyć treningu', store.error ?? 'Termin mógł zostać zajęty. Spróbuj ponownie.');
          return;
        }
        successHaptic();
        router.back();
      } else {
        const training = await store.addTraining(payload);
        if (!training) {
          Alert.alert('Nie udało się zapisać treningu', store.error ?? 'Sprawdź termin i spróbuj ponownie.');
          return;
        }
        successHaptic();
        router.replace({ pathname: '/training/[id]', params: { id: training.id } });
      }
    } finally {
      reservationInProgress.current = false;
      setSubmitting(false);
    }
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
        {missingBooking ? (
          <View style={styles.warningCard}>
            <Ionicons name="alert-circle-outline" size={22} color={theme.colors.coral} />
            <View style={styles.flex}>
              <Text style={styles.warningCardTitle}>Nie znaleziono tej rezerwacji</Text>
              <Text style={styles.warningCardText}>Rezerwacja mogła zostać usunięta albo nie masz już do niej dostępu.</Text>
            </View>
          </View>
        ) : null}
        {store.error && !missingTarget ? (
          <View style={styles.warningCard}>
            <Ionicons name="alert-circle-outline" size={22} color={theme.colors.coral} />
            <View style={styles.flex}>
              <Text style={styles.warningCardTitle}>Nie udało się zapisać ostatniej zmiany</Text>
              <Text style={styles.warningCardText}>{store.error}</Text>
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
                accessibilityState={{ selected: effectiveSelectedDay === index, disabled: Boolean(offer) || submitting }}
                disabled={Boolean(offer) || submitting}
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
            {visibleSlots.map((slot) => {
              const disabled = isSlotDisabled(slot);
              const active = (offer ? new Date(offer.start).getHours() : hour) === slot;
              const selectedTimeLabel = active && (offer || existing)
                ? formatTime(start.toISOString())
                : `${String(slot).padStart(2, '0')}:00`;
              return (
                <Pressable
                  key={slot}
                  accessibilityLabel={selectedTimeLabel}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, disabled: disabled || Boolean(offer) || submitting }}
                  disabled={disabled || Boolean(offer) || submitting}
                  onPress={() => { selectionHaptic(); setHour(slot); setMinute(0); }}
                  style={[styles.slot, active && styles.slotSelected, disabled && styles.slotDisabled]}>
                  <Text style={[styles.slotText, active && styles.darkText]}>{selectedTimeLabel}</Text>
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
                onPress={offer || submitting ? undefined : () => setDuration(value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Obiekt" />
          <View>
            {clubs.map((club, index) => {
              const selected = club.id === clubId;
              return (
                <View key={club.id}>
                  <Pressable
                    accessibilityLabel={`${club.name}, ${club.courts} kortów`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: Boolean(offer || existing) || submitting }}
                    disabled={Boolean(offer || existing) || submitting}
                    onPress={() => { selectionHaptic(); selectClub(club.id); }}
                    style={[styles.clubRow, (offer || existing) && !selected && styles.choiceLocked]}>
                    <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                    <View style={styles.flex}>
                      <Text style={styles.clubName}>{club.name}</Text>
                      <Text style={styles.clubMeta}>{existing && club.databaseId === existing.venueId
                        ? 'Obiekt przypisany do tej rezerwacji'
                        : `${club.address || club.city} · ${club.surface}`}</Text>
                    </View>
                    <Text style={styles.clubPrice}>{existing && club.databaseId === existing.venueId ? 'przypisany' : `${club.price} zł/h`}</Text>
                  </Pressable>
                  {index < clubs.length - 1 ? <Divider inset={36} /> : null}
                </View>
              );
            })}
            {!clubs.length ? (
              <View style={styles.catalogWarning}>
                <Ionicons name="alert-circle-outline" size={18} color={theme.colors.coral} />
                <Text style={styles.catalogWarningText}>Brak obiektu zgodnego z wybranym sportem i przypisaniem trenera.</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Kort" />
          <View>
            {courtOptions.map((court, index) => {
              const selected = court.id === courtId;
              return (
                <View key={court.id}>
                  <Pressable
                    accessibilityLabel={`${court.name}, ${court.surface}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: Boolean(offer || existing) || submitting }}
                    disabled={Boolean(offer || existing) || submitting}
                    onPress={() => { selectionHaptic(); setCourtId(court.id); }}
                    style={[styles.clubRow, (offer || existing) && !selected && styles.choiceLocked]}>
                    <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                    <View style={styles.flex}>
                      <Text style={styles.clubName}>{court.name}</Text>
                      <Text style={styles.clubMeta}>{existing && court.id === existing.courtId
                        ? 'Kort przypisany do tej rezerwacji'
                        : `${court.surface} · ${court.indoor ? 'hala' : 'kort zewnętrzny'}`}</Text>
                    </View>
                    <Text style={styles.clubPrice}>{existing && court.id === existing.courtId ? 'przypisany' : `${court.priceMinor / 100} zł/h`}</Text>
                  </Pressable>
                  {index < courtOptions.length - 1 ? <Divider inset={36} /> : null}
                </View>
              );
            })}
            {!courtOptions.length ? (
              <View style={styles.catalogWarning}>
                <Ionicons name="alert-circle-outline" size={18} color={theme.colors.coral} />
                <Text style={styles.catalogWarningText}>Ten obiekt nie ma aktywnego kortu dla wybranego sportu.</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Uczestnicy" />
          <View>
            {offer ? (
              <InfoRow flat icon="person-circle-outline" title={`Trener: ${trainer.name}`} detail="Przypisany do wolnego terminu" />
            ) : existing ? (
              <InfoRow flat icon="person-circle-outline" title={existing.trainer === 'Gra indywidualna' ? existing.trainer : `Trener: ${existing.trainer}`} detail="Przy przełożeniu zmieniasz wyłącznie termin" />
            ) : (
              <ToggleRow
                flat
                title={`Trener: ${trainer.name}`}
                subtitle={`${trainer.rating} ★ · ${trainer.price} zł/h`}
                value={withTrainer}
                onValueChange={(value) => {
                  if (!submitting) toggleTrainer(value);
                }}
              />
            )}
            <Divider inset={0} />
            <InfoRow flat icon="people-outline" title="Uczestnicy treningu" detail="Bez zaproszeń dodatkowych osób w wersji MVP" />
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Podsumowanie</Text>
            <Text style={styles.total}>{quoteLoading && !offer ? 'Wyceniam…' : quotedPrice}</Text>
          </View>
          <SummaryRow label="Termin" value={`${new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }).format(start)}, ${formatTime(start.toISOString())}`} />
          <SummaryRow label="Kort" value={`${effectiveVenueName} · ${effectiveCourtName}`} />
          <SummaryRow label="Czas" value={`${effectiveDuration} min`} />
          {withTrainer ? <SummaryRow label="Trener" value={effectiveTrainerName} /> : null}
        </View>
        {!offer && quoteError ? (
          <View style={styles.warning}>
            <Ionicons name="warning-outline" size={17} color={theme.colors.coral} />
            <Text style={styles.warningText}>{quoteError}</Text>
          </View>
        ) : null}
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <AppButton
          title={submitting
            ? 'Zapisywanie…'
            : missingTarget
              ? 'Wróć'
              : quoteLoading && !offer
                ? 'Sprawdzam cenę…'
                : existing
                  ? 'Zapisz nowy termin'
                  : offer
                    ? `Rezerwuję · ${quotedPrice}`
                    : `Potwierdź · ${quotedPrice}`}
          disabled={submitting || store.mutationPending || (!missingTarget && (
            Boolean(conflict)
            || (offer ? !offerCanBeReserved : (
              !effectiveVenueId
              || !effectiveCourtId
              || (withTrainer && !effectiveTrainerId)
              || quoteLoading
              || !currentQuote
            ))
          ))}
          onPress={missingTarget ? () => router.back() : () => { void confirm(); }}
        />
      </SafeAreaView>
    </View>
  );
}

function BookingScreen() {
  const router = useRouter();
  const { id, offerId } = useLocalSearchParams<{ id?: string; offerId?: string }>();
  const store = useAppStore();
  const existing = id ? store.trainings.find((training) => training.id === id) : undefined;
  const offer = offerId ? store.availabilityOffers.find((item) => item.id === offerId) : undefined;
  const reservedTraining = offer?.status === 'reserved' && offer.reservedTrainingId
    ? store.trainings.find((training) => training.id === offer.reservedTrainingId)
    : undefined;

  useEffect(() => {
    if (!store.hydrated || !reservedTraining) return;
    router.replace({ pathname: '/training/[id]', params: { id: reservedTraining.id } });
  }, [reservedTraining, router, store.hydrated]);

  if (!store.hydrated || store.loading || reservedTraining) return <LoadingScreen />;
  if (id && !existing) {
    return (
      <View style={{ flex: 1 }}>
        <ModalHeader title="Przełóż trening" />
        <View style={{ flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Nie znaleziono treningu</Text>
          <Text style={{ textAlign: 'center' }}>Trening nie istnieje albo nie masz do niego dostępu.</Text>
          <AppButton title="Wróć" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }
  if (existing && !existing.canManageBooking) {
    return (
      <View style={{ flex: 1 }}>
        <ModalHeader title="Przełóż trening" />
        <View style={{ flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Brak uprawnień do zmiany</Text>
          <Text style={{ textAlign: 'center' }}>Termin może przełożyć organizator, trener lub obsługa klubu.</Text>
          <AppButton title="Wróć" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }
  if (!existing && (!store.trainers.length || !store.clubs.length || !store.courts.length)) {
    return (
      <View style={{ flex: 1 }}>
        <ModalHeader title="Umów grę" />
        <View style={{ flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Brak dostępnego katalogu</Text>
          <Text style={{ textAlign: 'center' }}>{store.error ?? 'Brakuje aktywnego trenera, obiektu lub kortu.'}</Text>
          <AppButton title="Odśwież" variant="secondary" onPress={() => { void store.refresh(); }} />
        </View>
      </View>
    );
  }
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
  catalogWarning: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 2 },
  catalogWarningText: { color: theme.colors.coral, fontSize: 12, lineHeight: 17, flex: 1 },
  summary: { paddingHorizontal: 2, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  summaryTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  total: { color: theme.colors.accentText, fontSize: 21, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 11 },
  summaryLabel: { color: theme.colors.secondaryText, fontSize: 13 },
  summaryValue: { color: theme.colors.text, fontSize: 13, fontWeight: '600', maxWidth: '68%', textAlign: 'right' },
  bottomBar: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: theme.colors.surfaceSoft, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
});
