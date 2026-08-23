import type {
  AccountRole,
  BookingPaymentStatus,
  ChatConversation,
  ChatMessage,
  Club,
  Court,
  InAppNotification,
  NotificationSettings,
  Profile,
  Sport,
  Trainer,
  Training,
  UUID,
} from '@/data/models';
import type { AvailabilityOffer, AvailabilityPreference } from '@/data/availability';
import type { BookingRow } from '@/data/repositories/database-rows';

export type AppDataSnapshot = {
  currentUserId: UUID;
  accountRoles: AccountRole[];
  profile: Profile;
  selectedTrainerId?: string;
  sports: Sport[];
  selectedSport: string;
  tennisLevel: string;
  notifications: NotificationSettings;
  inAppNotifications: InAppNotification[];
  trainers: Trainer[];
  clubs: Club[];
  courts: Court[];
  trainings: Training[];
  conversations: ChatConversation[];
  messages: ChatMessage[];
  trainingNote: string;
  availabilityPreferences: Record<string, AvailabilityPreference>;
  availabilityOffers: AvailabilityOffer[];
  availabilityNotificationsEnabled: boolean;
};

export type SaveProfileInput = {
  profile: Profile;
  onboardingCompleted?: boolean;
  primarySportId?: UUID;
  skillCode?: string;
  selectedTrainerDatabaseId?: UUID;
};

export type CreateBookingInput = {
  idempotencyKey: UUID;
  sportId: UUID;
  venueId: UUID;
  courtId: UUID;
  trainerId?: UUID;
  startsAt: string;
  durationMinutes: number;
  title: string;
  source?: 'web' | 'mobile';
  expectedTotalMinor: number;
  expectedCurrency: string;
};

export type QuoteBookingInput = {
  sportId: UUID;
  venueId: UUID;
  courtId: UUID;
  trainerId?: UUID;
  startsAt: string;
  durationMinutes: number;
  excludeBookingId?: UUID;
};

export type BookingQuote = {
  sportId: UUID;
  venueId: UUID;
  courtId: UUID;
  trainerId?: UUID;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  courtRateId: UUID;
  trainerRateId?: UUID;
  courtAmountMinor: number;
  trainerAmountMinor: number;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  paymentStatus: BookingPaymentStatus;
};

export type RescheduleBookingInput = {
  bookingId: UUID;
  idempotencyKey: UUID;
  startsAt: string;
  durationMinutes: number;
  expectedTotalMinor: number;
  expectedCurrency: string;
};

export type SendMessageInput = {
  conversationId: UUID;
  clientMessageId: UUID;
  body: string;
  replyToMessageId?: UUID;
};

export type SaveAvailabilityPreferenceInput = {
  idempotencyKey: UUID;
  trainerId: UUID;
  sportId: UUID;
  durationMinutes: number;
  notificationsEnabled: boolean;
  timezone?: string;
  preference: AvailabilityPreference;
};

export type AppRepository = {
  loadSnapshot(userId: UUID): Promise<AppDataSnapshot>;
  saveProfile(input: SaveProfileInput): Promise<void>;
  selectTrainer(trainerDatabaseId?: UUID): Promise<void>;
  quoteBooking(input: QuoteBookingInput): Promise<BookingQuote>;
  createBooking(input: CreateBookingInput): Promise<BookingRow>;
  rescheduleBooking(input: RescheduleBookingInput): Promise<void>;
  cancelBooking(bookingId: UUID, idempotencyKey: UUID, reason?: string): Promise<void>;
  saveBookingNote(bookingId: UUID, body: string): Promise<void>;
  markTrainingPayment(
    bookingId: UUID,
    status: BookingPaymentStatus,
    idempotencyKey: UUID,
    note?: string,
  ): Promise<void>;
  sendMessage(input: SendMessageInput): Promise<UUID>;
  markConversationRead(conversationId: UUID, messageId?: UUID): Promise<void>;
  saveNotificationSettings(settings: NotificationSettings): Promise<void>;
  markNotificationRead(notificationId: UUID): Promise<void>;
  setAvailabilityNotificationsEnabled(enabled: boolean): Promise<void>;
  saveAvailabilityPreference(input: SaveAvailabilityPreferenceInput): Promise<void>;
  markAvailabilityOfferRead(offerId: UUID): Promise<void>;
  reserveAvailabilityOffer(offerId: UUID, idempotencyKey: UUID): Promise<BookingRow>;
  subscribeToChanges(userId: UUID, onChange: () => void): () => void;
};
