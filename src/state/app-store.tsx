import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import {
  type AvailabilityOffer,
  type AvailabilityPreference,
  type AvailabilityTimeRange,
  type DayPartKey,
  type WeekdayKey,
} from '@/data/availability';
import {
  defaultNotificationSettings,
  emptyProfile,
  type AccountRole,
  type BookingPaymentStatus,
  type ChatConversation,
  type ChatMessage,
  type Club,
  type Court,
  type InAppNotification,
  type NotificationSettings,
  type PackagePurchase,
  type Profile,
  type PurchasedPackage,
  type Sport,
  type Trainer,
  type Training,
  type UUID,
} from '@/data/models';
import { emptyAvailabilityPreference } from '@/data/repositories/mappers';
import { supabaseAppRepository } from '@/data/repositories';
import type { BookingRow } from '@/data/repositories/database-rows';
import { createUuid } from '@/lib/uuid';
import type { ThemeMode } from '@/theme';

const THEME_STORAGE_KEY = 'mymovio.theme.v1';
const REALTIME_REFRESH_DELAY_MS = 300;

type ServerState = {
  currentUserId?: UUID;
  accountRoles: AccountRole[];
  profile: Profile;
  profileCompleted: boolean;
  selectedTrainerId?: string;
  hasAnyTraining: boolean;
  trainings: Training[];
  packages: PurchasedPackage[];
  sports: Sport[];
  trainers: Trainer[];
  clubs: Club[];
  courts: Court[];
  conversations: ChatConversation[];
  selectedSport: string;
  tennisLevel: string;
  notifications: NotificationSettings;
  inAppNotifications: InAppNotification[];
  messages: ChatMessage[];
  trainingNote: string;
  availabilityOffers: AvailabilityOffer[];
  availabilityPreferences: Record<string, AvailabilityPreference>;
  availabilityNotificationsEnabled: boolean;
};

/** Compatibility input accepted while booking screens migrate to database IDs. */
export type TrainingDraft = Pick<
  Training,
  'start' | 'durationMinutes' | 'title' | 'trainer' | 'venue' | 'court' | 'totalPrice' | 'role' | 'participants' | 'notes'
> & Partial<Omit<Training, 'start' | 'durationMinutes' | 'title' | 'trainer' | 'venue' | 'court' | 'totalPrice' | 'role' | 'participants' | 'notes'>>;

export type AppStore = ServerState & {
  themeMode: ThemeMode;
  hydrated: boolean;
  loading: boolean;
  refreshing: boolean;
  mutationPending: boolean;
  error?: string;
  lastSyncedAt?: string;
  now: number;
  completedSteps: number;
  conversationUnread: Record<string, number>;
  setThemeMode: (mode: ThemeMode) => void;
  clearError: () => void;
  refresh: () => Promise<void>;
  saveProfile: (profile: Profile) => Promise<boolean>;
  selectTrainer: (id: string) => Promise<boolean>;
  addTraining: (training: TrainingDraft) => Promise<Training | undefined>;
  updateTraining: (id: string, patch: Partial<TrainingDraft>) => Promise<boolean>;
  cancelTraining: (id: string, reason?: string) => Promise<boolean>;
  markTrainingPayment: (id: string, status: BookingPaymentStatus, note?: string) => Promise<boolean>;
  topUpPackage: (
    packageId: string,
    hours: number,
    discountPercent: number,
    paymentMethod: string,
  ) => Promise<PackagePurchase | undefined>;
  setSelectedSport: (sport: string) => Promise<boolean>;
  setTennisLevel: (level: string) => Promise<boolean>;
  setNotification: (key: keyof NotificationSettings, value: boolean) => Promise<boolean>;
  markNotificationRead: (notificationId: string) => Promise<boolean>;
  sendMessage: (conversationId: string, body: string) => Promise<ChatMessage | undefined>;
  setTrainingNote: (bookingId: string, note: string) => Promise<boolean>;
  setAvailabilityEnabled: (trainerId: string, enabled: boolean) => Promise<boolean>;
  setAvailabilityNotificationsEnabled: (enabled: boolean) => Promise<boolean>;
  toggleAvailabilityDayPart: (trainerId: string, day: WeekdayKey, part: DayPartKey) => Promise<boolean>;
  setAvailabilityPreference: (
    trainerId: string,
    patch: Partial<Omit<AvailabilityPreference, 'dayParts'>>,
  ) => Promise<boolean>;
  addAvailabilityTimeRange: (trainerId: string, day: WeekdayKey) => Promise<boolean>;
  updateAvailabilityTimeRange: (
    trainerId: string,
    day: WeekdayKey,
    rangeId: string,
    patch: Partial<Pick<AvailabilityTimeRange, 'start' | 'end'>>,
  ) => Promise<boolean>;
  removeAvailabilityTimeRange: (trainerId: string, day: WeekdayKey, rangeId: string) => Promise<boolean>;
  markAvailabilityOfferRead: (offerId: string) => Promise<void>;
  markConversationOffersRead: (conversationId: string) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
  reserveAvailabilityOffer: (offerId: string) => Promise<Training | undefined>;
};

const emptyServerState: ServerState = {
  currentUserId: undefined,
  accountRoles: [],
  profile: { ...emptyProfile },
  profileCompleted: false,
  selectedTrainerId: undefined,
  hasAnyTraining: false,
  trainings: [],
  packages: [],
  sports: [],
  trainers: [],
  clubs: [],
  courts: [],
  conversations: [],
  selectedSport: '',
  tennisLevel: '',
  notifications: { ...defaultNotificationSettings },
  inAppNotifications: [],
  messages: [],
  trainingNote: '',
  availabilityOffers: [],
  availabilityPreferences: {},
  availabilityNotificationsEnabled: false,
};

function messageForError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code ?? '');
    if (code === 'SLOT_TAKEN' || code === '23P01') return 'Ten termin został właśnie zajęty. Wybierz inną godzinę.';
    if (code === 'OFFER_NOT_AVAILABLE' || code === 'OFFER_NOT_FOUND') return 'Ta oferta nie jest już dostępna.';
    if (code === 'FORBIDDEN' || code === '42501') return 'Nie masz uprawnień do wykonania tej operacji.';
    if (code === 'UNAUTHENTICATED' || code === 'AUTH_REQUIRED' || code === 'PGRST301') {
      return 'Sesja wygasła. Zaloguj się ponownie.';
    }
    if (code === 'PROFILE_NOT_ACTIVE') return 'To konto jest nieaktywne. Skontaktuj się z obsługą.';
    if (code === 'FUTURE_UNPAID_BOOKING_LIMIT') {
      return 'Masz już maksymalną liczbę przyszłych, nierozliczonych rezerwacji.';
    }
    if (code === 'BOOKING_RATE_LIMITED' || code === 'RATE_LIMITED') {
      return 'Zbyt wiele prób rezerwacji. Odczekaj chwilę i spróbuj ponownie.';
    }
    if (code === 'QUOTE_CHANGED') return 'Cena rezerwacji uległa zmianie. Sprawdź nową wycenę i potwierdź ponownie.';
    if (code === 'OFFER_PRICE_CHANGED') return 'Cena wolnego terminu uległa zmianie. Oferta wymaga odświeżenia.';
    if (code === 'BOOKING_NOT_CANCELLABLE') return 'Tego treningu nie można już odwołać.';
    if (code === 'BOOKING_NOT_RESCHEDULABLE') return 'Tego treningu nie można już przełożyć.';
    if (code === 'TRAINER_NOT_FOUND') return 'Wybrany trener nie jest już dostępny dla tej dyscypliny.';
    if (code === 'SPORT_NOT_FOUND') return 'Wybrana dyscyplina nie jest już dostępna.';
    if (code === 'INVALID_NOTE') return 'Notatka nie może być pusta i może mieć maksymalnie 5000 znaków.';
    if (code === 'PAYMENT_STATUS_NOT_ALLOWED') return 'Dodatni koszt treningu można oznaczyć tylko jako opłacony albo nieopłacony.';
    if (code === 'INVALID_AVAILABILITY_WINDOWS' || code === 'TOO_MANY_AVAILABILITY_WINDOWS') {
      return 'Sprawdź godziny dostępności. Możesz zapisać maksymalnie 21 poprawnych okien.';
    }
    if (code === 'AVAILABILITY_ALERT_DISABLED') return 'Włącz alerty dostępności przed rezerwacją oferty.';
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Nie udało się zapisać zmian. Spróbuj ponownie.';
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function temporaryTrainingFromBooking(
  booking: BookingRow,
  context: {
    currentUserId?: string;
    currentUserName: string;
    trainerName: string;
    venueName: string;
    courtName: string;
    notes: string;
  },
): Training {
  const start = new Date(booking.starts_at).getTime();
  const end = new Date(booking.ends_at).getTime();
  return {
    id: booking.id,
    sportId: booking.sport_id,
    venueId: booking.venue_id,
    courtId: booking.court_id,
    trainerId: booking.trainer_id ?? undefined,
    creatorId: booking.creator_id ?? undefined,
    start: booking.starts_at,
    end: booking.ends_at,
    durationMinutes: Math.max(0, Math.round((end - start) / 60_000)),
    title: booking.title,
    trainer: context.trainerName,
    venue: context.venueName,
    court: context.courtName,
    totalPrice: booking.total_minor / 100,
    totalPriceMinor: booking.total_minor,
    currency: booking.currency,
    role: 'player',
    participants: context.currentUserName ? [context.currentUserName] : [],
    participantDetails: context.currentUserName ? [{
      id: `temporary-${booking.id}`,
      userId: context.currentUserId,
      displayName: context.currentUserName,
      role: 'organizer',
      responseStatus: 'accepted',
    }] : [],
    notes: context.notes,
    status: booking.status,
    paymentStatus: booking.payment_status,
    canManageBooking: true,
    canManagePayment: false,
  };
}

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [themeHydrated, setThemeHydrated] = useState(false);
  const [serverState, setServerState] = useState<ServerState>(emptyServerState);
  const [dataHydrated, setDataHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mutationCount, setMutationCount] = useState(0);
  const [error, setError] = useState<string>();
  const [lastSyncedAt, setLastSyncedAt] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const serverStateRef = useRef(serverState);
  const userIdRef = useRef<string | undefined>(undefined);
  const requestGenerationRef = useRef(0);
  const createBookingKeysRef = useRef(new Map<string, UUID>());
  const reserveOfferKeysRef = useRef(new Map<UUID, UUID>());
  const availabilityMutationGenerationRef = useRef(0);
  const availabilityMutationQueuesRef = useRef(new Map<string, Promise<boolean>>());
  const intendedAvailabilityPreferencesRef = useRef(new Map<string, AvailabilityPreference>());

  useEffect(() => {
    serverStateRef.current = serverState;
  }, [serverState]);

  const replaceServerState = useCallback((next: ServerState) => {
    serverStateRef.current = next;
    setServerState(next);
  }, []);

  const patchServerState = useCallback((patch: Partial<ServerState>) => {
    const next = { ...serverStateRef.current, ...patch };
    replaceServerState(next);
  }, [replaceServerState]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (active && isThemeMode(stored)) setThemeModeState(stored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setThemeHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  }, []);

  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<typeof supabaseAppRepository.loadSnapshot>>) => {
    const intendedAvailabilityPreferences = Object.fromEntries(
      intendedAvailabilityPreferencesRef.current.entries(),
    );
    replaceServerState({
      currentUserId: snapshot.currentUserId,
      accountRoles: snapshot.accountRoles,
      profile: snapshot.profile,
      profileCompleted: Boolean(snapshot.profile.onboardingCompletedAt),
      selectedTrainerId: snapshot.selectedTrainerId,
      hasAnyTraining: snapshot.trainings.some((training) => (
        training.role !== 'staff'
        && !training.status.startsWith('cancelled')
        && training.status !== 'no_show'
      )),
      trainings: snapshot.trainings,
      packages: [],
      sports: snapshot.sports,
      trainers: snapshot.trainers,
      clubs: snapshot.clubs,
      courts: snapshot.courts,
      conversations: snapshot.conversations,
      selectedSport: snapshot.selectedSport,
      tennisLevel: snapshot.tennisLevel,
      notifications: snapshot.notifications,
      inAppNotifications: snapshot.inAppNotifications,
      messages: snapshot.messages,
      trainingNote: snapshot.trainingNote,
      availabilityOffers: snapshot.availabilityOffers,
      availabilityPreferences: {
        ...snapshot.availabilityPreferences,
        ...intendedAvailabilityPreferences,
      },
      availabilityNotificationsEnabled: snapshot.availabilityNotificationsEnabled,
    });
    setLastSyncedAt(new Date().toISOString());
  }, [replaceServerState]);

  const loadForUser = useCallback(async (userId: string, background = false) => {
    const generation = ++requestGenerationRef.current;
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const snapshot = await supabaseAppRepository.loadSnapshot(userId);
      if (generation !== requestGenerationRef.current || userIdRef.current !== userId) return;
      applySnapshot(snapshot);
      setError(undefined);
    } catch (loadError) {
      if (generation !== requestGenerationRef.current || userIdRef.current !== userId) return;
      setError(messageForError(loadError));
    } finally {
      if (generation === requestGenerationRef.current && userIdRef.current === userId) {
        setLoading(false);
        setRefreshing(false);
        setDataHydrated(true);
      }
    }
  }, [applySnapshot]);

  useEffect(() => {
    let active = true;
    const userId = user?.id;

    // Auth callbacks are external input. Defer synchronization so the effect
    // does not create a synchronous render cascade when the provider mounts.
    void Promise.resolve().then(() => {
      if (!active) return;
      availabilityMutationGenerationRef.current += 1;
      availabilityMutationQueuesRef.current.clear();
      intendedAvailabilityPreferencesRef.current.clear();
      setMutationCount(0);
      if (authLoading) {
        setDataHydrated(false);
        setLoading(true);
        return;
      }

      requestGenerationRef.current += 1;
      userIdRef.current = userId;
      createBookingKeysRef.current.clear();
      reserveOfferKeysRef.current.clear();
      setError(undefined);
      setLastSyncedAt(undefined);
      replaceServerState(emptyServerState);

      if (!userId) {
        setLoading(false);
        setRefreshing(false);
        setDataHydrated(true);
        return;
      }

      setDataHydrated(false);
      void loadForUser(userId);
    });

    return () => {
      active = false;
      requestGenerationRef.current += 1;
      availabilityMutationGenerationRef.current += 1;
      userIdRef.current = undefined;
    };
  }, [authLoading, loadForUser, replaceServerState, user?.id]);

  const refresh = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    await loadForUser(userId, true);
  }, [loadForUser]);

  const runMutation = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    if (!userIdRef.current) {
      setError('Zaloguj się, aby zapisać zmiany.');
      return undefined;
    }
    setMutationCount((count) => count + 1);
    setError(undefined);
    try {
      const result = await operation();
      await refresh();
      return result;
    } catch (mutationError) {
      const mutationMessage = messageForError(mutationError);
      await refresh().catch(() => undefined);
      setError(mutationMessage);
      return undefined;
    } finally {
      setMutationCount((count) => Math.max(0, count - 1));
    }
  }, [refresh]);

  const runVoidMutation = useCallback(async (operation: () => Promise<void>): Promise<boolean> => {
    const result = await runMutation(async () => {
      await operation();
      return true as const;
    });
    return result === true;
  }, [runMutation]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || !dataHydrated) return;
    let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = supabaseAppRepository.subscribeToChanges(userId, () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        void refresh();
      }, REALTIME_REFRESH_DELAY_MS);
    });
    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      unsubscribe();
    };
  }, [dataHydrated, refresh, user?.id]);

  useEffect(() => {
    const updateClock = () => setNow(Date.now());
    const interval = setInterval(updateClock, 15_000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      updateClock();
      void refresh();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [refresh]);

  const trainerFromReference = useCallback((reference?: string) => {
    if (!reference) return undefined;
    return serverStateRef.current.trainers.find((trainer) => (
      trainer.id === reference || trainer.databaseId === reference || trainer.name === reference
    ));
  }, []);

  const clubFromReference = useCallback((reference?: string) => {
    if (!reference) return undefined;
    return serverStateRef.current.clubs.find((club) => (
      club.id === reference || club.databaseId === reference || club.name === reference
    ));
  }, []);

  const sportFromReference = useCallback((reference?: string) => {
    if (!reference) return undefined;
    const normalized = reference.toLocaleLowerCase('pl');
    return serverStateRef.current.sports.find((sport) => (
      sport.id === reference
      || sport.code.toLocaleLowerCase('pl') === normalized
      || sport.name.toLocaleLowerCase('pl') === normalized
    ));
  }, []);

  const profileMutationInput = useCallback((overrides?: {
    profile?: Profile;
    selectedSport?: string;
    tennisLevel?: string;
    selectedTrainerId?: string | null;
  }) => {
    const current = serverStateRef.current;
    const selectedTrainerReference = overrides && 'selectedTrainerId' in overrides
      ? overrides.selectedTrainerId ?? undefined
      : current.selectedTrainerId;
    const selectedTrainer = trainerFromReference(selectedTrainerReference);
    const selectedSport = sportFromReference(overrides?.selectedSport ?? current.selectedSport);
    return {
      profile: overrides?.profile ?? current.profile,
      primarySportId: selectedSport?.id,
      skillCode: (overrides?.tennisLevel ?? overrides?.profile?.playingLevel ?? current.tennisLevel) || undefined,
      selectedTrainerDatabaseId: selectedTrainer?.databaseId,
      onboardingCompleted: current.profileCompleted,
    };
  }, [sportFromReference, trainerFromReference]);

  const saveAvailabilityPreference = useCallback(async (
    trainerId: string,
    preference: AvailabilityPreference,
  ) => {
    const trainer = trainerFromReference(trainerId);
    const sport = sportFromReference(serverStateRef.current.selectedSport) ?? serverStateRef.current.sports[0];
    if (!trainer || !sport) throw new Error('Nie można zapisać dostępności bez trenera i dyscypliny.');
    await supabaseAppRepository.saveAvailabilityPreference({
      idempotencyKey: createUuid(),
      trainerId: trainer.databaseId,
      sportId: sport.id,
      durationMinutes: 60,
      notificationsEnabled: serverStateRef.current.availabilityNotificationsEnabled,
      timezone: serverStateRef.current.profile.timezone,
      preference,
    });
  }, [sportFromReference, trainerFromReference]);

  const enqueueAvailabilityPreference = useCallback((
    trainerId: string,
    preference: AvailabilityPreference,
  ): Promise<boolean> => {
    const actorUserId = userIdRef.current;
    if (!actorUserId) {
      setError('Zaloguj się, aby zapisać zmiany.');
      return Promise.resolve(false);
    }
    const generation = availabilityMutationGenerationRef.current;
    const isCurrentSession = () => (
      availabilityMutationGenerationRef.current === generation
      && userIdRef.current === actorUserId
    );

    intendedAvailabilityPreferencesRef.current.set(trainerId, preference);
    setMutationCount((count) => count + 1);
    setError(undefined);

    const previous = availabilityMutationQueuesRef.current.get(trainerId) ?? Promise.resolve(true);
    let mutationError: string | undefined;
    const queued = previous.then(async () => {
      if (!isCurrentSession()) return false;
      try {
        await saveAvailabilityPreference(trainerId, preference);
        return true;
      } catch (error) {
        mutationError = messageForError(error);
        return false;
      } finally {
        if (isCurrentSession()) {
          setMutationCount((count) => Math.max(0, count - 1));
        }
      }
    });
    availabilityMutationQueuesRef.current.set(trainerId, queued);

    return queued.then(async (saved) => {
      if (!isCurrentSession()) return false;
      if (availabilityMutationQueuesRef.current.get(trainerId) !== queued) return saved;

      if (!saved) intendedAvailabilityPreferencesRef.current.delete(trainerId);
      await refresh();

      if (!isCurrentSession()) return false;
      if (availabilityMutationQueuesRef.current.get(trainerId) === queued) {
        availabilityMutationQueuesRef.current.delete(trainerId);
        intendedAvailabilityPreferencesRef.current.delete(trainerId);
        if (!saved && mutationError) setError(mutationError);
      }
      return saved;
    });
  }, [refresh, saveAvailabilityPreference]);

  const updateAvailabilityPreference = useCallback(async (
    trainerId: string,
    updater: (current: AvailabilityPreference) => AvailabilityPreference,
  ) => {
    if (!userIdRef.current) {
      setError('Zaloguj się, aby zapisać zmiany.');
      return false;
    }
    const current = serverStateRef.current.availabilityPreferences[trainerId] ?? emptyAvailabilityPreference();
    const next = updater(current);
    patchServerState({
      availabilityPreferences: {
        ...serverStateRef.current.availabilityPreferences,
        [trainerId]: next,
      },
    });
    return enqueueAvailabilityPreference(trainerId, next);
  }, [enqueueAvailabilityPreference, patchServerState]);

  const saveProfile = useCallback(async (profile: Profile) => {
    const current = serverStateRef.current;
    const categoryChanged = profile.playingLevel !== current.profile.playingLevel;
    const categoryLevel: Record<string, string> = {
      Początkujący: '1.0',
      'Średnio zaawansowany': '3.0',
      Zaawansowany: '4.0',
    };
    const directNtrpCode = /^\d(?:\.\d)?\+?$/.test(profile.playingLevel)
      ? profile.playingLevel
      : undefined;
    const tennisLevel = directNtrpCode
      ?? (categoryChanged ? categoryLevel[profile.playingLevel] : undefined)
      ?? current.tennisLevel;
    patchServerState({ profile, profileCompleted: true, tennisLevel });
    return runVoidMutation(() => supabaseAppRepository.saveProfile(profileMutationInput({ profile, tennisLevel })));
  }, [patchServerState, profileMutationInput, runVoidMutation]);

  const selectTrainer = useCallback(async (id: string) => {
    const trainer = trainerFromReference(id);
    if (!trainer) {
      setError('Nie znaleziono wybranego trenera.');
      return false;
    }
    const selectedSport = sportFromReference(serverStateRef.current.selectedSport);
    if (selectedSport && trainer.sportIds.length && !trainer.sportIds.includes(selectedSport.id)) {
      setError('Ten trener nie prowadzi zajęć w wybranej dyscyplinie.');
      return false;
    }
    patchServerState({ selectedTrainerId: trainer.id });
    return runVoidMutation(() => supabaseAppRepository.selectTrainer(trainer.databaseId));
  }, [patchServerState, runVoidMutation, sportFromReference, trainerFromReference]);

  const addTraining = useCallback(async (draft: TrainingDraft) => {
    const current = serverStateRef.current;
    const sport = sportFromReference(draft.sportId ?? current.selectedSport) ?? current.sports[0];
    const club = clubFromReference(draft.venueId ?? draft.venue);
    const court = current.courts.find((item) => item.id === draft.courtId)
      ?? current.courts.find((item) => item.venueId === club?.databaseId && item.name === draft.court)
      ?? current.courts.find((item) => item.venueId === club?.databaseId)
      ?? (draft.courtId ? current.courts.find((item) => item.id === draft.courtId) : undefined);
    const trainer = trainerFromReference(draft.trainerId ?? draft.trainer);
    if (!sport || !club || !court) {
      setError('Nie można utworzyć treningu bez dyscypliny, obiektu i kortu.');
      return undefined;
    }
    const expectedTotalMinor = draft.totalPriceMinor;
    const expectedCurrency = draft.currency;
    if (expectedTotalMinor === undefined || !expectedCurrency) {
      setError('Brakuje potwierdzonej przez serwer wyceny treningu.');
      return undefined;
    }
    const requestFingerprint = JSON.stringify({
      sportId: sport.id,
      venueId: club.databaseId,
      courtId: court.id,
      trainerId: trainer?.databaseId ?? null,
      startsAt: draft.start,
      durationMinutes: draft.durationMinutes,
      title: draft.title,
    });
    const idempotencyKey = createBookingKeysRef.current.get(requestFingerprint) ?? createUuid();
    createBookingKeysRef.current.set(requestFingerprint, idempotencyKey);
    const booking = await runMutation(() => supabaseAppRepository.createBooking({
        idempotencyKey,
        sportId: sport.id,
        venueId: club.databaseId,
        courtId: court.id,
        trainerId: trainer?.databaseId,
        startsAt: draft.start,
        durationMinutes: draft.durationMinutes,
        title: draft.title,
        source: Platform.OS === 'web' ? 'web' : 'mobile',
        expectedTotalMinor,
        expectedCurrency,
      }));
    if (!booking) return undefined;
    createBookingKeysRef.current.delete(requestFingerprint);

    if (draft.notes.trim()) {
      await runVoidMutation(() => supabaseAppRepository.saveBookingNote(booking.id, draft.notes));
    }

    const refreshedTraining = serverStateRef.current.trainings.find((training) => training.id === booking.id);
    if (refreshedTraining) return refreshedTraining;
    const temporaryTraining = temporaryTrainingFromBooking(booking, {
      currentUserId: current.currentUserId,
      currentUserName: current.profile.name,
      trainerName: trainer?.name ?? 'Gra indywidualna',
      venueName: club.name,
      courtName: court.name,
      notes: draft.notes,
    });
    patchServerState({
      hasAnyTraining: true,
      trainings: [...serverStateRef.current.trainings, temporaryTraining]
        .sort((left, right) => left.start.localeCompare(right.start)),
    });
    return temporaryTraining;
  }, [clubFromReference, patchServerState, runMutation, runVoidMutation, sportFromReference, trainerFromReference]);

  const updateTraining = useCallback(async (id: string, patch: Partial<TrainingDraft>) => {
    const existing = serverStateRef.current.trainings.find((training) => training.id === id);
    if (!existing) {
      setError('Nie znaleziono treningu.');
      return false;
    }
    const changesBookingAssignment = (
      (patch.venueId !== undefined && patch.venueId !== existing.venueId)
      || (patch.courtId !== undefined && patch.courtId !== existing.courtId)
      || ('trainerId' in patch && patch.trainerId !== existing.trainerId)
    );
    if (changesBookingAssignment) {
      setError('Podczas przekładania można zmienić tylko termin i długość treningu.');
      return false;
    }
    const startsAt = patch.start ?? existing.start;
    const durationMinutes = patch.durationMinutes ?? existing.durationMinutes;
    const scheduleChanged = startsAt !== existing.start || durationMinutes !== existing.durationMinutes;
    if (scheduleChanged && (patch.totalPriceMinor === undefined || !patch.currency)) {
      setError('Brakuje potwierdzonej przez serwer wyceny nowego terminu.');
      return false;
    }
    return runVoidMutation(async () => {
      if (scheduleChanged) {
        await supabaseAppRepository.rescheduleBooking({
          bookingId: id,
          idempotencyKey: createUuid(),
          startsAt,
          durationMinutes,
          expectedTotalMinor: patch.totalPriceMinor as number,
          expectedCurrency: patch.currency as string,
        });
      }
      if (patch.notes !== undefined && patch.notes !== existing.notes) {
        await supabaseAppRepository.saveBookingNote(id, patch.notes);
      }
    });
  }, [runVoidMutation]);

  const cancelTraining = useCallback(async (id: string, reason?: string) => {
    return runVoidMutation(() => supabaseAppRepository.cancelBooking(id, createUuid(), reason));
  }, [runVoidMutation]);

  const markTrainingPayment = useCallback(async (
    id: string,
    status: BookingPaymentStatus,
    note?: string,
  ) => {
    return runVoidMutation(() => supabaseAppRepository.markTrainingPayment(id, status, createUuid(), note));
  }, [runVoidMutation]);

  const setSelectedSport = useCallback(async (sportReference: string) => {
    const sport = sportFromReference(sportReference);
    if (!sport) {
      setError('Nie znaleziono wybranej dyscypliny.');
      return false;
    }
    const selectedTrainer = trainerFromReference(serverStateRef.current.selectedTrainerId);
    const trainerMatchesSport = !selectedTrainer
      || !selectedTrainer.sportIds.length
      || selectedTrainer.sportIds.includes(sport.id);
    patchServerState({
      selectedSport: sport.name,
      selectedTrainerId: trainerMatchesSport ? selectedTrainer?.id : undefined,
    });
    return runVoidMutation(() => supabaseAppRepository.saveProfile(profileMutationInput({
      selectedSport: sport.name,
      selectedTrainerId: trainerMatchesSport ? selectedTrainer?.id : null,
    })));
  }, [patchServerState, profileMutationInput, runVoidMutation, sportFromReference, trainerFromReference]);

  const setTennisLevel = useCallback(async (tennisLevel: string) => {
    const numericLevel = Number.parseFloat(tennisLevel);
    const playingLevel = Number.isFinite(numericLevel)
      ? numericLevel < 3 ? 'Początkujący' : numericLevel < 4 ? 'Średnio zaawansowany' : 'Zaawansowany'
      : serverStateRef.current.profile.playingLevel;
    patchServerState({
      tennisLevel,
      profile: { ...serverStateRef.current.profile, playingLevel },
    });
    return runVoidMutation(() => supabaseAppRepository.saveProfile(profileMutationInput({ tennisLevel })));
  }, [patchServerState, profileMutationInput, runVoidMutation]);

  const setNotification = useCallback(async (key: keyof NotificationSettings, value: boolean) => {
    const notifications = { ...serverStateRef.current.notifications, [key]: value };
    patchServerState({ notifications });
    return runVoidMutation(() => supabaseAppRepository.saveNotificationSettings(notifications));
  }, [patchServerState, runVoidMutation]);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    const readAt = new Date().toISOString();
    patchServerState({
      inAppNotifications: serverStateRef.current.inAppNotifications.map((notification) => (
        notification.id === notificationId && !notification.readAt
          ? { ...notification, readAt }
          : notification
      )),
    });
    return runVoidMutation(() => supabaseAppRepository.markNotificationRead(notificationId));
  }, [patchServerState, runVoidMutation]);

  const sendMessage = useCallback(async (conversationId: string, rawBody: string) => {
    const body = rawBody.trim();
    if (!body) return undefined;
    const clientMessageId = createUuid();
    const optimistic: ChatMessage = {
      id: clientMessageId,
      conversationId,
      senderId: serverStateRef.current.currentUserId,
      clientMessageId,
      author: 'me',
      kind: 'text',
      body,
      sentAt: new Date().toISOString(),
    };
    patchServerState({ messages: [...serverStateRef.current.messages, optimistic] });
    const messageId = await runMutation(() => supabaseAppRepository.sendMessage({
      conversationId,
      clientMessageId,
      body,
    }));
    if (!messageId) return undefined;
    return serverStateRef.current.messages.find((message) => message.id === messageId || message.clientMessageId === clientMessageId);
  }, [patchServerState, runMutation]);

  const setTrainingNote = useCallback(async (bookingId: string, note: string) => {
    const referenceTime = Date.now();
    const training = serverStateRef.current.trainings.find((item) => item.id === bookingId);
    const completed = Boolean(training
      && training.role !== 'staff'
      && !training.status.startsWith('cancelled')
      && training.status !== 'no_show'
      && (training.status === 'completed' || (
        training.status === 'confirmed' && new Date(training.end).getTime() <= referenceTime
      )));
    if (!training || !completed) {
      setError('Notatkę można przypisać dopiero do zakończonego treningu.');
      return false;
    }
    patchServerState({
      trainingNote: note,
      trainings: serverStateRef.current.trainings.map((item) => (
        item.id === bookingId ? { ...item, notes: note } : item
      )),
    });
    return runVoidMutation(() => supabaseAppRepository.saveBookingNote(training.id, note));
  }, [patchServerState, runVoidMutation]);

  const setAvailabilityNotificationsEnabled = useCallback(async (enabled: boolean) => {
    patchServerState({ availabilityNotificationsEnabled: enabled });
    return runVoidMutation(() => supabaseAppRepository.setAvailabilityNotificationsEnabled(enabled));
  }, [patchServerState, runVoidMutation]);

  const setAvailabilityEnabled = useCallback(async (trainerId: string, enabled: boolean) => {
    return updateAvailabilityPreference(trainerId, (preference) => ({ ...preference, enabled }));
  }, [updateAvailabilityPreference]);

  const toggleAvailabilityDayPart = useCallback(async (
    trainerId: string,
    day: WeekdayKey,
    part: DayPartKey,
  ) => {
    return updateAvailabilityPreference(trainerId, (preference) => {
      const selected = preference.dayParts[day];
      const dayParts = selected.includes(part)
        ? selected.filter((item) => item !== part)
        : [...selected, part];
      return { ...preference, dayParts: { ...preference.dayParts, [day]: dayParts } };
    });
  }, [updateAvailabilityPreference]);

  const setAvailabilityPreference = useCallback(async (
    trainerId: string,
    patch: Partial<Omit<AvailabilityPreference, 'dayParts'>>,
  ) => {
    return updateAvailabilityPreference(trainerId, (preference) => ({ ...preference, ...patch }));
  }, [updateAvailabilityPreference]);

  const addAvailabilityTimeRange = useCallback(async (trainerId: string, day: WeekdayKey) => {
    return updateAvailabilityPreference(trainerId, (preference) => {
      const ranges = preference.preciseHours[day] ?? [];
      const nextRange: AvailabilityTimeRange = ranges.length
        ? { id: createUuid(), start: '17:00', end: '20:00' }
        : { id: createUuid(), start: '08:00', end: '11:00' };
      return {
        ...preference,
        preciseHours: { ...preference.preciseHours, [day]: [...ranges, nextRange] },
      };
    });
  }, [updateAvailabilityPreference]);

  const updateAvailabilityTimeRange = useCallback(async (
    trainerId: string,
    day: WeekdayKey,
    rangeId: string,
    patch: Partial<Pick<AvailabilityTimeRange, 'start' | 'end'>>,
  ) => {
    return updateAvailabilityPreference(trainerId, (preference) => ({
      ...preference,
      preciseHours: {
        ...preference.preciseHours,
        [day]: (preference.preciseHours[day] ?? []).map((range) => (
          range.id === rangeId ? { ...range, ...patch } : range
        )),
      },
    }));
  }, [updateAvailabilityPreference]);

  const removeAvailabilityTimeRange = useCallback(async (
    trainerId: string,
    day: WeekdayKey,
    rangeId: string,
  ) => {
    return updateAvailabilityPreference(trainerId, (preference) => ({
      ...preference,
      preciseHours: {
        ...preference.preciseHours,
        [day]: (preference.preciseHours[day] ?? []).filter((range) => range.id !== rangeId),
      },
    }));
  }, [updateAvailabilityPreference]);

  const markAvailabilityOfferRead = useCallback(async (offerId: string) => {
    const readAt = new Date().toISOString();
    patchServerState({
      availabilityOffers: serverStateRef.current.availabilityOffers.map((offer) => (
        offer.id === offerId && !offer.readAt ? { ...offer, readAt } : offer
      )),
    });
    await runMutation(() => supabaseAppRepository.markAvailabilityOfferRead(offerId));
  }, [patchServerState, runMutation]);

  const markConversationOffersRead = useCallback(async (conversationId: string) => {
    const offers = serverStateRef.current.availabilityOffers.filter((offer) => (
      offer.conversationId === conversationId && !offer.readAt
    ));
    if (!offers.length) return;
    const readAt = new Date().toISOString();
    patchServerState({
      availabilityOffers: serverStateRef.current.availabilityOffers.map((offer) => (
        offer.conversationId === conversationId && !offer.readAt ? { ...offer, readAt } : offer
      )),
    });
    await runMutation(() => Promise.all(offers.map((offer) => (
      supabaseAppRepository.markAvailabilityOfferRead(offer.id)
    ))));
  }, [patchServerState, runMutation]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    const latestMessage = serverStateRef.current.messages
      .filter((message) => message.conversationId === conversationId)
      .sort((left, right) => right.sentAt.localeCompare(left.sentAt))[0];
    const unreadOffers = serverStateRef.current.availabilityOffers.filter((offer) => (
      offer.conversationId === conversationId && !offer.readAt
    ));
    patchServerState({
      conversations: serverStateRef.current.conversations.map((conversation) => (
        conversation.id === conversationId ? { ...conversation, unread: 0 } : conversation
      )),
      availabilityOffers: serverStateRef.current.availabilityOffers.map((offer) => (
        offer.conversationId === conversationId && !offer.readAt
          ? { ...offer, readAt: new Date().toISOString() }
          : offer
      )),
    });
    await runMutation(async () => {
      await supabaseAppRepository.markConversationRead(conversationId, latestMessage?.id);
      await Promise.all(unreadOffers.map((offer) => supabaseAppRepository.markAvailabilityOfferRead(offer.id)));
    });
  }, [patchServerState, runMutation]);

  const reserveAvailabilityOffer = useCallback(async (offerId: string) => {
    const existingOffer = serverStateRef.current.availabilityOffers.find((offer) => offer.id === offerId);
    if (!existingOffer) {
      setError('Nie znaleziono oferty.');
      return undefined;
    }
    if (existingOffer.status === 'reserved' && existingOffer.reservedTrainingId) {
      return serverStateRef.current.trainings.find((training) => training.id === existingOffer.reservedTrainingId);
    }
    if (existingOffer.status !== 'available' || new Date(existingOffer.start).getTime() <= Date.now()) {
      setError('Ta oferta nie jest już dostępna.');
      return undefined;
    }
    const idempotencyKey = reserveOfferKeysRef.current.get(offerId) ?? createUuid();
    reserveOfferKeysRef.current.set(offerId, idempotencyKey);
    const booking = await runMutation(() => supabaseAppRepository.reserveAvailabilityOffer(offerId, idempotencyKey));
    if (!booking) return undefined;
    reserveOfferKeysRef.current.delete(offerId);
    const refreshedTraining = serverStateRef.current.trainings.find((training) => training.id === booking.id);
    if (refreshedTraining) return refreshedTraining;

    const trainer = trainerFromReference(existingOffer.trainerId);
    const club = clubFromReference(booking.venue_id) ?? serverStateRef.current.clubs.find((item) => item.name === existingOffer.venue);
    const court = serverStateRef.current.courts.find((item) => item.id === booking.court_id);
    const temporaryTraining = temporaryTrainingFromBooking(booking, {
      currentUserId: serverStateRef.current.currentUserId,
      currentUserName: serverStateRef.current.profile.name,
      trainerName: trainer?.name ?? 'Trener',
      venueName: club?.name ?? existingOffer.venue,
      courtName: court?.name ?? existingOffer.court,
      notes: '',
    });
    patchServerState({
      hasAnyTraining: true,
      trainings: [...serverStateRef.current.trainings, temporaryTraining]
        .sort((left, right) => left.start.localeCompare(right.start)),
      availabilityOffers: serverStateRef.current.availabilityOffers.map((offer) => (
        offer.id === offerId
          ? { ...offer, status: 'reserved', reservedTrainingId: booking.id }
          : offer
      )),
    });
    return temporaryTraining;
  }, [clubFromReference, patchServerState, runMutation, trainerFromReference]);

  const topUpPackage = useCallback(async () => {
    setError('Pakiety i płatności online są obecnie wyłączone. Treningi są rozliczane poza aplikacją.');
    return undefined;
  }, []);

  const conversationUnread = useMemo(() => Object.fromEntries(
    serverState.conversations.map((conversation) => [conversation.id, conversation.unread]),
  ), [serverState.conversations]);

  const store = useMemo<AppStore>(() => ({
    ...serverState,
    themeMode,
    hydrated: themeHydrated && dataHydrated && !authLoading,
    loading: loading || authLoading,
    refreshing,
    mutationPending: mutationCount > 0,
    error,
    lastSyncedAt,
    now,
    completedSteps: Number(serverState.profileCompleted)
      + Number(Boolean(serverState.selectedTrainerId))
      + Number(serverState.hasAnyTraining),
    conversationUnread,
    setThemeMode,
    clearError: () => setError(undefined),
    refresh,
    saveProfile,
    selectTrainer,
    addTraining,
    updateTraining,
    cancelTraining,
    markTrainingPayment,
    topUpPackage,
    setSelectedSport,
    setTennisLevel,
    setNotification,
    markNotificationRead,
    sendMessage,
    setTrainingNote,
    setAvailabilityEnabled,
    setAvailabilityNotificationsEnabled,
    toggleAvailabilityDayPart,
    setAvailabilityPreference,
    addAvailabilityTimeRange,
    updateAvailabilityTimeRange,
    removeAvailabilityTimeRange,
    markAvailabilityOfferRead,
    markConversationOffersRead,
    markConversationRead,
    reserveAvailabilityOffer,
  }), [
    addAvailabilityTimeRange,
    addTraining,
    authLoading,
    cancelTraining,
    conversationUnread,
    dataHydrated,
    error,
    lastSyncedAt,
    loading,
    markNotificationRead,
    markAvailabilityOfferRead,
    markConversationOffersRead,
    markConversationRead,
    markTrainingPayment,
    mutationCount,
    now,
    refreshing,
    refresh,
    removeAvailabilityTimeRange,
    reserveAvailabilityOffer,
    saveProfile,
    selectTrainer,
    sendMessage,
    serverState,
    setAvailabilityEnabled,
    setAvailabilityNotificationsEnabled,
    setAvailabilityPreference,
    setNotification,
    setSelectedSport,
    setTennisLevel,
    setThemeMode,
    setTrainingNote,
    themeHydrated,
    themeMode,
    toggleAvailabilityDayPart,
    topUpPackage,
    updateAvailabilityTimeRange,
    updateTraining,
  ]);

  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const value = useContext(AppStoreContext);
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider');
  return value;
}
