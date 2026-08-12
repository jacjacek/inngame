import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import {
  AvailabilityOffer,
  AvailabilityPreference,
  AvailabilityTimeRange,
  createDefaultAvailabilityPreferences,
  createSampleAvailabilityOffers,
  DayPartKey,
  expireAvailabilityOffers,
  mergeAvailabilityPreferences,
  restoreAvailabilityOffers,
  WeekdayKey,
} from '@/data/availability';
import {
  ChatMessage,
  conversations,
  initialMessages,
  NotificationSettings,
  PackagePurchase,
  Profile,
  PurchasedPackage,
  samplePackages,
  sampleTrainings,
  trainers,
  Training,
} from '@/data/models';

type PersistedState = {
  profile: Profile;
  profileCompleted: boolean;
  selectedTrainerId?: string;
  hasAnyTraining: boolean;
  trainings: Training[];
  packages: PurchasedPackage[];
  selectedSport: string;
  tennisLevel: string;
  notifications: NotificationSettings;
  messages: ChatMessage[];
  trainingNote: string;
  availabilityOffers: AvailabilityOffer[];
  availabilityPreferences: Record<string, AvailabilityPreference>;
  availabilityNotificationsEnabled: boolean;
  conversationUnread: Record<string, number>;
};

type AppStore = PersistedState & {
  hydrated: boolean;
  now: number;
  completedSteps: number;
  saveProfile: (profile: Profile) => void;
  selectTrainer: (id: string) => void;
  addTraining: (training: Training) => void;
  updateTraining: (id: string, patch: Partial<Training>) => void;
  cancelTraining: (id: string) => void;
  topUpPackage: (packageId: string, hours: number, discountPercent: number, paymentMethod: string) => PackagePurchase | undefined;
  setSelectedSport: (sport: string) => void;
  setTennisLevel: (level: string) => void;
  setNotification: (key: keyof NotificationSettings, value: boolean) => void;
  sendMessage: (conversationId: string, body: string) => void;
  setTrainingNote: (note: string) => void;
  setAvailabilityEnabled: (trainerId: string, enabled: boolean) => void;
  setAvailabilityNotificationsEnabled: (enabled: boolean) => void;
  toggleAvailabilityDayPart: (trainerId: string, day: WeekdayKey, part: DayPartKey) => void;
  setAvailabilityPreference: (trainerId: string, patch: Partial<Omit<AvailabilityPreference, 'dayParts'>>) => void;
  addAvailabilityTimeRange: (trainerId: string, day: WeekdayKey) => void;
  updateAvailabilityTimeRange: (trainerId: string, day: WeekdayKey, rangeId: string, patch: Partial<Pick<AvailabilityTimeRange, 'start' | 'end'>>) => void;
  removeAvailabilityTimeRange: (trainerId: string, day: WeekdayKey, rangeId: string) => void;
  markAvailabilityOfferRead: (offerId: string) => void;
  markConversationOffersRead: (conversationId: string) => void;
  markConversationRead: (conversationId: string) => void;
  reserveAvailabilityOffer: (offerId: string) => Training | undefined;
};

const STORAGE_KEY = 'mymovio.expo.state.v1';

const initialState: PersistedState = {
  profile: { name: '', city: '', playingLevel: '' },
  profileCompleted: false,
  selectedTrainerId: undefined,
  hasAnyTraining: false,
  trainings: sampleTrainings,
  packages: samplePackages,
  selectedSport: 'Tenis',
  tennisLevel: '3.5',
  notifications: {
    trainingReminders: true,
    chatMessages: true,
    scheduleChanges: true,
    payments: true,
    courtConditions: false,
  },
  messages: initialMessages,
  trainingNote: 'Serwis: wyższy podrzut piłki. Return z bekhendu i wcześniejszy split step.',
  availabilityOffers: createSampleAvailabilityOffers(),
  availabilityPreferences: createDefaultAvailabilityPreferences(),
  availabilityNotificationsEnabled: true,
  conversationUnread: Object.fromEntries(conversations.map((conversation) => [conversation.id, conversation.unread])),
};

function mergeSeedMessages(messages: ChatMessage[] | undefined) {
  if (!messages) return initialMessages;
  const knownIds = new Set(messages.map((message) => message.id));
  return [...messages, ...initialMessages.filter((message) => !knownIds.has(message.id))];
}

function mergeConversationUnread(stored: Record<string, number> | undefined) {
  return Object.fromEntries(conversations.map((conversation) => [
    conversation.id,
    Math.max(0, stored?.[conversation.id] ?? conversation.unread),
  ]));
}

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        const restored = JSON.parse(value) as Partial<PersistedState>;
        setState((current) => ({
          ...current,
          ...restored,
          messages: mergeSeedMessages(restored.messages),
          availabilityOffers: restoreAvailabilityOffers(restored.availabilityOffers),
          availabilityPreferences: mergeAvailabilityPreferences(restored.availabilityPreferences),
          conversationUnread: mergeConversationUnread(restored.conversationUnread),
        }));
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [hydrated, state]);

  useEffect(() => {
    const refresh = () => {
      const nextNow = Date.now();
      setNow(nextNow);
      setState((current) => {
        const availabilityOffers = expireAvailabilityOffers(current.availabilityOffers, nextNow);
        return availabilityOffers === current.availabilityOffers ? current : { ...current, availabilityOffers };
      });
    };
    const interval = setInterval(refresh, 15_000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refresh();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const patchState = useCallback((patch: Partial<PersistedState>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const store = useMemo<AppStore>(() => ({
    ...state,
    hydrated,
    now,
    completedSteps: Number(state.profileCompleted) + Number(Boolean(state.selectedTrainerId)) + Number(state.hasAnyTraining),
    saveProfile: (profile) => patchState({ profile, profileCompleted: true }),
    selectTrainer: (id) => patchState({ selectedTrainerId: id }),
    addTraining: (training) => setState((current) => ({
      ...current,
      trainings: [...current.trainings, training].sort((a, b) => a.start.localeCompare(b.start)),
      hasAnyTraining: true,
    })),
    updateTraining: (id, patch) => setState((current) => ({
      ...current,
      trainings: current.trainings.map((training) => training.id === id ? { ...training, ...patch } : training),
    })),
    cancelTraining: (id) => setState((current) => ({
      ...current,
      trainings: current.trainings.filter((training) => training.id !== id),
      availabilityOffers: current.availabilityOffers.map((offer) => (
        offer.reservedTrainingId === id ? { ...offer, status: 'cancelled' } : offer
      )),
    })),
    topUpPackage: (packageId, hours, discountPercent, paymentMethod) => {
      const existing = state.packages.find((item) => item.id === packageId);
      if (!existing) return undefined;
      const amount = Math.round(hours * existing.baseHourlyPrice * (1 - discountPercent / 100));
      const now = new Date();
      const purchase: PackagePurchase = {
        id: `${now.getTime()}`,
        purchasedAt: now.toISOString(),
        hours,
        amount,
        paymentMethod,
        reference: `MYM-${now.toISOString().slice(2, 10).replaceAll('-', '')}-${String(now.getTime()).slice(-4)}`,
      };
      const validUntil = new Date(existing.validUntil);
      const baseline = validUntil > now ? validUntil : now;
      baseline.setMonth(baseline.getMonth() + 6);
      setState((current) => ({
        ...current,
        packages: current.packages.map((item) => item.id === packageId ? {
          ...item,
          totalHours: item.totalHours + hours,
          remainingHours: item.remainingHours + hours,
          validUntil: baseline.toISOString(),
          purchases: [...item.purchases, purchase],
        } : item),
      }));
      return purchase;
    },
    setSelectedSport: (selectedSport) => patchState({ selectedSport }),
    setTennisLevel: (tennisLevel) => patchState({ tennisLevel }),
    setNotification: (key, value) => setState((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: value },
    })),
    sendMessage: (conversationId, body) => setState((current) => ({
      ...current,
      messages: [...current.messages, {
        id: `${Date.now()}`,
        conversationId,
        author: 'me',
        body,
        sentAt: new Date().toISOString(),
      }],
    })),
    setTrainingNote: (trainingNote) => patchState({ trainingNote }),
    setAvailabilityNotificationsEnabled: (availabilityNotificationsEnabled) => patchState({ availabilityNotificationsEnabled }),
    setAvailabilityEnabled: (trainerId, enabled) => setState((current) => ({
      ...current,
      availabilityPreferences: {
        ...current.availabilityPreferences,
        [trainerId]: { ...current.availabilityPreferences[trainerId], enabled },
      },
    })),
    toggleAvailabilityDayPart: (trainerId, day, part) => setState((current) => {
      const preference = current.availabilityPreferences[trainerId];
      const selected = preference.dayParts[day];
      const dayParts = selected.includes(part)
        ? selected.filter((item) => item !== part)
        : [...selected, part];
      return {
        ...current,
        availabilityPreferences: {
          ...current.availabilityPreferences,
          [trainerId]: {
            ...preference,
            dayParts: { ...preference.dayParts, [day]: dayParts },
          },
        },
      };
    }),
    setAvailabilityPreference: (trainerId, patch) => setState((current) => ({
      ...current,
      availabilityPreferences: {
        ...current.availabilityPreferences,
        [trainerId]: { ...current.availabilityPreferences[trainerId], ...patch },
      },
    })),
    addAvailabilityTimeRange: (trainerId, day) => setState((current) => {
      const preference = current.availabilityPreferences[trainerId];
      const ranges = preference.preciseHours[day] ?? [];
      const nextRange: AvailabilityTimeRange = ranges.length
        ? { id: `${day}-${Date.now()}`, start: '17:00', end: '20:00' }
        : { id: `${day}-${Date.now()}`, start: '08:00', end: '11:00' };
      return {
        ...current,
        availabilityPreferences: {
          ...current.availabilityPreferences,
          [trainerId]: {
            ...preference,
            preciseHours: { ...preference.preciseHours, [day]: [...ranges, nextRange] },
          },
        },
      };
    }),
    updateAvailabilityTimeRange: (trainerId, day, rangeId, patch) => setState((current) => {
      const preference = current.availabilityPreferences[trainerId];
      const ranges = (preference.preciseHours[day] ?? []).map((range) => range.id === rangeId ? { ...range, ...patch } : range);
      return {
        ...current,
        availabilityPreferences: {
          ...current.availabilityPreferences,
          [trainerId]: { ...preference, preciseHours: { ...preference.preciseHours, [day]: ranges } },
        },
      };
    }),
    removeAvailabilityTimeRange: (trainerId, day, rangeId) => setState((current) => {
      const preference = current.availabilityPreferences[trainerId];
      const ranges = (preference.preciseHours[day] ?? []).filter((range) => range.id !== rangeId);
      return {
        ...current,
        availabilityPreferences: {
          ...current.availabilityPreferences,
          [trainerId]: { ...preference, preciseHours: { ...preference.preciseHours, [day]: ranges } },
        },
      };
    }),
    markAvailabilityOfferRead: (offerId) => setState((current) => ({
      ...current,
      availabilityOffers: current.availabilityOffers.map((offer) => (
        offer.id === offerId && !offer.readAt ? { ...offer, readAt: new Date().toISOString() } : offer
      )),
    })),
    markConversationOffersRead: (conversationId) => setState((current) => ({
      ...current,
      availabilityOffers: current.availabilityOffers.map((offer) => (
        offer.conversationId === conversationId && !offer.readAt
          ? { ...offer, readAt: new Date().toISOString() }
          : offer
      )),
    })),
    markConversationRead: (conversationId) => setState((current) => {
      const unread = current.conversationUnread[conversationId] ?? 0;
      const hasUnreadOffer = current.availabilityOffers.some((offer) => (
        offer.conversationId === conversationId && !offer.readAt
      ));
      if (!unread && !hasUnreadOffer) return current;
      const readAt = new Date().toISOString();
      return {
        ...current,
        conversationUnread: { ...current.conversationUnread, [conversationId]: 0 },
        availabilityOffers: current.availabilityOffers.map((offer) => (
          offer.conversationId === conversationId && !offer.readAt ? { ...offer, readAt } : offer
        )),
      };
    }),
    reserveAvailabilityOffer: (offerId) => {
      const offer = state.availabilityOffers.find((item) => item.id === offerId);
      if (!offer) return undefined;
      if (offer.status === 'reserved' && offer.reservedTrainingId) {
        return state.trainings.find((training) => training.id === offer.reservedTrainingId);
      }
      if (offer.status !== 'available' || new Date(offer.start).getTime() <= Date.now()) return undefined;
      const trainer = trainers.find((item) => item.id === offer.trainerId);
      const trainerName = trainer?.name ?? 'Trener';
      const training: Training = {
        id: `offer-training-${offer.id}`,
        start: offer.start,
        durationMinutes: offer.durationMinutes,
        title: `Trening · ${trainerName}`,
        trainer: trainerName,
        venue: offer.venue,
        court: offer.court,
        totalPrice: offer.price,
        role: 'player',
        participants: [trainerName],
        notes: 'Wolny termin zarezerwowany z rozmowy z trenerem.',
      };
      setState((current) => ({
        ...current,
        hasAnyTraining: true,
        trainings: current.trainings.some((item) => item.id === training.id)
          ? current.trainings
          : [...current.trainings, training].sort((a, b) => a.start.localeCompare(b.start)),
        availabilityOffers: current.availabilityOffers.map((item) => item.id === offer.id ? {
          ...item,
          status: 'reserved',
          readAt: item.readAt ?? new Date().toISOString(),
          reservedTrainingId: training.id,
        } : item),
      }));
      return training;
    },
  }), [hydrated, now, patchState, state]);

  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(AppStoreContext);
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider');
  return value;
}

