import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  ChatMessage,
  initialMessages,
  NotificationSettings,
  PackagePurchase,
  Profile,
  PurchasedPackage,
  samplePackages,
  sampleTrainings,
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
};

type AppStore = PersistedState & {
  hydrated: boolean;
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
};

function mergeSeedMessages(messages: ChatMessage[] | undefined) {
  if (!messages) return initialMessages;
  const knownIds = new Set(messages.map((message) => message.id));
  return [...messages, ...initialMessages.filter((message) => !knownIds.has(message.id))];
}

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        const restored = JSON.parse(value) as Partial<PersistedState>;
        setState((current) => ({
          ...current,
          ...restored,
          messages: mergeSeedMessages(restored.messages),
        }));
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [hydrated, state]);

  const patchState = useCallback((patch: Partial<PersistedState>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const store = useMemo<AppStore>(() => ({
    ...state,
    hydrated,
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
  }), [hydrated, patchState, state]);

  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(AppStoreContext);
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider');
  return value;
}

