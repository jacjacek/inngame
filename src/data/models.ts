export type UUID = string;

export type AccountRole =
  | 'player'
  | 'trainer'
  | 'owner'
  | 'manager'
  | 'reception'
  | 'viewer'
  | 'platform_admin';

export type BookingStatus =
  | 'hold'
  | 'awaiting_payment'
  | 'confirmed'
  | 'completed'
  | 'cancelled_by_customer'
  | 'cancelled_by_provider'
  | 'no_show';

export type BookingPaymentStatus = 'unpaid' | 'paid' | 'not_required';
export type TrainingRole = 'player' | 'coach' | 'staff';

export type TrainingParticipant = {
  id: UUID;
  userId?: UUID;
  displayName: string;
  role: 'organizer' | 'player' | 'coach';
  responseStatus: 'pending' | 'accepted' | 'declined' | 'removed';
};

/** UI-facing booking model. Monetary display fields use major PLN units. */
export type Training = {
  id: UUID;
  sportId: UUID;
  venueId: UUID;
  courtId: UUID;
  trainerId?: UUID;
  creatorId?: UUID;
  conversationId?: UUID;
  start: string;
  end: string;
  durationMinutes: number;
  title: string;
  trainer: string;
  venue: string;
  court: string;
  totalPrice: number;
  totalPriceMinor: number;
  currency: string;
  role: TrainingRole;
  participants: string[];
  participantDetails: TrainingParticipant[];
  notes: string;
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  canManageBooking: boolean;
  canManagePayment: boolean;
};

export type PackageScope = 'trainer' | 'club';

export type PackagePurchase = {
  id: UUID;
  purchasedAt: string;
  hours: number;
  amount: number;
  paymentMethod: string;
  reference: string;
};

/** Kept for UI compatibility. Packages are disabled until the payment phase. */
export type PurchasedPackage = {
  id: UUID;
  scope: PackageScope;
  name: string;
  totalHours: number;
  remainingHours: number;
  scheduledUses: number;
  baseHourlyPrice: number;
  validUntil: string;
  purchases: PackagePurchase[];
};

export type Sport = {
  id: UUID;
  code: string;
  name: string;
  active: boolean;
};

/**
 * `id` is a stable, human-readable slug used by routes and bundled assets.
 * `databaseId` is the authoritative database identifier used in mutations.
 */
export type Trainer = {
  id: string;
  databaseId: UUID;
  userId?: UUID;
  courtId?: UUID;
  name: string;
  initials: string;
  specialty: string;
  certification: string;
  phone: string;
  distance: string;
  rating: string;
  reviewCount: number;
  price: number;
  priceMinor: number;
  availability: string;
  experience: string;
  trainings: number;
  about: string[];
  clubs: string[];
  venueIds: UUID[];
  sportIds: UUID[];
};

/** A club card currently represents a physical venue. */
export type Club = {
  id: string;
  databaseId: UUID;
  organizationId: UUID;
  courtId?: UUID;
  courtIds: UUID[];
  name: string;
  address: string;
  city: string;
  distance: string;
  courts: number;
  surface: string;
  price: number;
  priceMinor: number;
};

export type Court = {
  id: UUID;
  venueId: UUID;
  sportId: UUID;
  code: string;
  name: string;
  surface: string;
  indoor: boolean;
  status: string;
  priceMinor: number;
  currency: string;
};

export type ChatConversation = {
  id: UUID;
  kind: 'direct' | 'group' | 'booking' | 'support';
  name: string;
  initials: string;
  role: string;
  preview: string;
  time: string;
  unread: number;
  trainingId?: UUID;
  memberIds: UUID[];
  lastMessageAt?: string;
};

export type ChatMessage = {
  id: UUID;
  conversationId: UUID;
  senderId?: UUID;
  clientMessageId?: UUID;
  author: 'me' | 'them' | 'system';
  kind: 'text' | 'system' | 'booking_card' | 'note_card';
  body: string;
  sentAt: string;
  editedAt?: string;
  deletedAt?: string;
};

export type Profile = {
  id?: UUID;
  name: string;
  city: string;
  playingLevel: string;
  locale?: string;
  timezone?: string;
  status?: 'active' | 'deletion_requested' | 'anonymized' | 'blocked';
  onboardingCompletedAt?: string;
};

export type NotificationSettings = {
  trainingReminders: boolean;
  chatMessages: boolean;
  scheduleChanges: boolean;
  payments: boolean;
  courtConditions: boolean;
  marketing: boolean;
};

export type InAppNotification = {
  id: UUID;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  relatedEntityType?: string;
  relatedEntityId?: UUID;
  readAt?: string;
  createdAt: string;
};

export const emptyProfile: Profile = {
  name: '',
  city: '',
  playingLevel: '',
};

export const defaultNotificationSettings: NotificationSettings = {
  trainingReminders: true,
  chatMessages: true,
  scheduleChanges: true,
  payments: true,
  courtConditions: false,
  marketing: false,
};
