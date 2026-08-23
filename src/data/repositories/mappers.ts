import {
  defaultNotificationSettings,
  emptyProfile,
  type AccountRole,
  type ChatConversation,
  type ChatMessage,
  type Club,
  type Court,
  type Sport,
  type Trainer,
  type Training,
  type UUID,
} from '@/data/models';
import {
  type AvailabilityPreference,
  type DayPartKey,
  type WeekdayKey,
} from '@/data/availability';
import type { AppDataSnapshot } from '@/data/repositories/app-repository';
import type {
  AvailabilityAlertPreferenceRow,
  AvailabilityAlertWindowRow,
  AvailabilityOfferRow,
  BookingNoteRow,
  BookingParticipantRow,
  BookingRow,
  ConversationMemberRow,
  ConversationRow,
  CourtRateRow,
  CourtRow,
  MessageRow,
  NotificationPreferenceRow,
  NotificationRow,
  OrganizationMembershipRow,
  OrganizationRow,
  ProfileCardRow,
  ProfileRow,
  SportRow,
  TrainerRateRow,
  TrainerRow,
  TrainerSportRow,
  TrainerVenueRow,
  UserSportRow,
  VenueRow,
} from '@/data/repositories/database-rows';

export type SnapshotRows = {
  currentTrainerId?: UUID;
  isPlatformAdmin?: boolean;
  profile: ProfileRow | null;
  profileCards: ProfileCardRow[];
  sports: SportRow[];
  userSports: UserSportRow[];
  notifications: NotificationPreferenceRow | null;
  inAppNotifications: NotificationRow[];
  organizations: OrganizationRow[];
  memberships: OrganizationMembershipRow[];
  trainers: TrainerRow[];
  trainerSports: TrainerSportRow[];
  trainerVenues: TrainerVenueRow[];
  trainerRates: TrainerRateRow[];
  venues: VenueRow[];
  courts: CourtRow[];
  courtRates: CourtRateRow[];
  bookings: BookingRow[];
  bookingParticipants: BookingParticipantRow[];
  bookingNotes: BookingNoteRow[];
  conversations: ConversationRow[];
  conversationMembers: ConversationMemberRow[];
  messages: MessageRow[];
  availabilityPreferences: AvailabilityAlertPreferenceRow[];
  availabilityWindows: AvailabilityAlertWindowRow[];
  availabilityOffers: AvailabilityOfferRow[];
};

const weekdayKeys: WeekdayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const surfaceNames: Record<string, string> = {
  clay: 'Mączka',
  hard: 'Hard',
  grass: 'Trawa',
  carpet: 'Dywan',
  artificial_clay: 'Sztuczna mączka',
  other: 'Inna',
};

function compact<T>(values: (T | null | undefined)[]): T[] {
  return values.filter((value): value is T => value !== null && value !== undefined);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function emptyWeek(): Record<WeekdayKey, DayPartKey[]> {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

export function emptyAvailabilityPreference(): AvailabilityPreference {
  return {
    enabled: false,
    dayParts: emptyWeek(),
    leadTime: 'threeDays',
    keepAllInChat: true,
    preciseHoursEnabled: false,
    preciseHours: {},
  };
}

export function slugify(value: string, fallback: string): string {
  const normalized = value
    .toLocaleLowerCase('pl')
    .replaceAll('ł', 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || fallback;
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('pl'))
    .join('') || 'MM';
}

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function experienceLabel(since: string | null): string {
  if (!since) return '—';
  const started = new Date(since);
  if (Number.isNaN(started.getTime())) return '—';
  const years = Math.max(0, Math.floor((Date.now() - started.getTime()) / 31_556_952_000));
  return `${years} ${years === 1 ? 'rok' : years >= 2 && years <= 4 ? 'lata' : 'lat'}`;
}

function conversationTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function playingLevelLabel(skillCode: string | null | undefined): string {
  if (!skillCode) return '';
  const numeric = Number.parseFloat(skillCode);
  if (!Number.isFinite(numeric)) return skillCode;
  if (numeric < 3) return 'Początkujący';
  if (numeric < 4) return 'Średnio zaawansowany';
  return 'Zaawansowany';
}

function buildCatalog(rows: SnapshotRows, userId: UUID) {
  const organizationsById = new Map(rows.organizations.map((row) => [row.id, row]));
  const venuesById = new Map(rows.venues.map((row) => [row.id, row]));
  const courtsById = new Map(rows.courts.map((row) => [row.id, row]));
  const trainerRowsById = new Map(rows.trainers.map((row) => [row.id, row]));
  const currentDate = new Date().toISOString().slice(0, 10);
  const activeCourtRates = rows.courtRates.filter((rate) => (
    rate.valid_from <= currentDate && (!rate.valid_until || rate.valid_until >= currentDate)
  ));
  const activeTrainerRates = rows.trainerRates.filter((rate) => (
    rate.valid_from <= currentDate && (!rate.valid_until || rate.valid_until >= currentDate)
  ));

  const courts: Court[] = rows.courts.map((row) => {
    const rates = activeCourtRates.filter((rate) => rate.court_id === row.id);
    const priceMinor = rates.length ? Math.min(...rates.map((rate) => rate.amount_per_60_min_minor)) : 0;
    return {
      id: row.id,
      venueId: row.venue_id,
      sportId: row.sport_id,
      code: row.code,
      name: row.name,
      surface: row.surface,
      indoor: row.indoor,
      status: row.status,
      priceMinor,
      currency: rates[0]?.currency ?? 'PLN',
    };
  });

  const clubs: Club[] = rows.venues.map((venue) => {
    const organization = organizationsById.get(venue.organization_id);
    const venueCourts = courts.filter((court) => court.venueId === venue.id && court.status === 'active');
    const prices = venueCourts.map((court) => court.priceMinor).filter((price) => price > 0);
    const priceMinor = prices.length ? Math.min(...prices) : 0;
    const surfaces = unique(venueCourts.map((court) => surfaceNames[court.surface] ?? court.surface).filter(Boolean));
    return {
      id: venue.slug || organization?.slug || slugify(venue.name, venue.id),
      databaseId: venue.id,
      organizationId: venue.organization_id,
      courtId: venueCourts[0]?.id,
      courtIds: venueCourts.map((court) => court.id),
      name: venue.name,
      address: [venue.address_line, venue.city].filter(Boolean).join(', '),
      city: venue.city,
      distance: '—',
      courts: venueCourts.length,
      surface: surfaces.join(' / ') || '—',
      price: priceMinor / 100,
      priceMinor,
    };
  });

  const trainers: Trainer[] = rows.trainers.map((trainer) => {
    const sports = rows.trainerSports.filter((row) => row.trainer_id === trainer.id);
    const venueLinks = rows.trainerVenues.filter((row) => row.trainer_id === trainer.id && row.active);
    const venueIds = venueLinks.map((row) => row.venue_id);
    const rates = activeTrainerRates.filter((rate) => rate.trainer_id === trainer.id);
    const priceMinor = rates.length ? Math.min(...rates.map((rate) => rate.amount_per_60_min_minor)) : 0;
    const trainerCourts = courts.filter((court) => venueIds.includes(court.venueId) && court.status === 'active');
    const specialty = compact(sports.map((row) => row.specialty))[0] ?? trainer.specialty ?? '';
    const bio = trainer.bio?.split(/\n+/).map((part) => part.trim()).filter(Boolean) ?? [];
    const rating = Number(trainer.rating_average);
    return {
      id: trainer.slug || slugify(trainer.display_name, trainer.id),
      databaseId: trainer.id,
      userId: trainer.id === rows.currentTrainerId ? userId : undefined,
      courtId: trainerCourts[0]?.id,
      name: trainer.display_name,
      initials: trainer.initials?.trim() || initials(trainer.display_name),
      specialty,
      certification: trainer.certification ?? '',
      phone: trainer.public_contact_phone ?? '',
      distance: '—',
      rating: Number.isFinite(rating) ? rating.toLocaleString('pl-PL', { maximumFractionDigits: 2 }) : '—',
      reviewCount: trainer.rating_count,
      price: priceMinor / 100,
      priceMinor,
      availability: 'Sprawdź dostępność',
      experience: experienceLabel(trainer.experience_since),
      trainings: trainer.completed_bookings_count,
      about: bio,
      clubs: compact(venueIds.map((id) => venuesById.get(id)?.name)),
      venueIds,
      sportIds: sports.map((row) => row.sport_id),
    };
  });

  return {
    clubs,
    courts,
    trainers,
    courtsById,
    trainerRowsById,
    venuesById,
  };
}

function buildTrainings(rows: SnapshotRows, userId: UUID, catalog: ReturnType<typeof buildCatalog>): Training[] {
  const participantsByBooking = new Map<UUID, BookingParticipantRow[]>();
  for (const participant of rows.bookingParticipants) {
    const list = participantsByBooking.get(participant.booking_id) ?? [];
    list.push(participant);
    participantsByBooking.set(participant.booking_id, list);
  }
  const notesByBooking = new Map<UUID, BookingNoteRow[]>();
  for (const note of rows.bookingNotes) {
    const list = notesByBooking.get(note.booking_id) ?? [];
    list.push(note);
    notesByBooking.set(note.booking_id, list);
  }
  const conversationByBooking = new Map(compact(rows.conversations.map((row) => (
    row.booking_id ? [row.booking_id, row.id] as const : undefined
  ))));
  const membershipsByOrganization = new Map<UUID, OrganizationMembershipRow[]>();
  for (const membership of rows.memberships) {
    const list = membershipsByOrganization.get(membership.organization_id) ?? [];
    list.push(membership);
    membershipsByOrganization.set(membership.organization_id, list);
  }

  return rows.bookings.map((booking): Training => {
    const venue = catalog.venuesById.get(booking.venue_id);
    const court = catalog.courtsById.get(booking.court_id);
    const trainer = booking.trainer_id ? catalog.trainerRowsById.get(booking.trainer_id) : undefined;
    const participants = participantsByBooking.get(booking.id) ?? [];
    const notes = [...(notesByBooking.get(booking.id) ?? [])].sort((left, right) => (
      right.created_at.localeCompare(left.created_at)
    ));
    const trainerIsCurrentUser = booking.trainer_id === rows.currentTrainerId;
    const organizationMemberships = venue ? membershipsByOrganization.get(venue.organization_id) ?? [] : [];
    const canManageAsStaff = organizationMemberships.some((membership) => (
      membership.user_id === userId
      && membership.status === 'active'
      && ['owner', 'manager', 'reception'].includes(membership.role)
    ));
    const participantRole = participants.find((participant) => (
      participant.user_id === userId && participant.response_status !== 'removed'
    ))?.role;
    const start = new Date(booking.starts_at).getTime();
    const end = new Date(booking.ends_at).getTime();
    return {
      id: booking.id,
      sportId: booking.sport_id,
      venueId: booking.venue_id,
      courtId: booking.court_id,
      trainerId: booking.trainer_id ?? undefined,
      creatorId: booking.creator_id ?? undefined,
      conversationId: conversationByBooking.get(booking.id),
      start: booking.starts_at,
      end: booking.ends_at,
      durationMinutes: Math.max(0, Math.round((end - start) / 60_000)),
      title: booking.title,
      trainer: trainer?.display_name
        ?? participants.find((participant) => participant.role === 'coach')?.display_name_snapshot
        ?? (booking.trainer_id ? 'Trener (profil nieaktywny)' : 'Gra indywidualna'),
      venue: venue?.name ?? 'Nieznane miejsce',
      court: court?.name ?? 'Nieznany kort',
      totalPrice: booking.total_minor / 100,
      totalPriceMinor: booking.total_minor,
      currency: booking.currency,
      role: trainerIsCurrentUser || participantRole === 'coach'
        ? 'coach'
        : participantRole || booking.creator_id === userId
          ? 'player'
          : 'staff',
      participants: participants
        .filter((participant) => participant.response_status !== 'removed')
        .map((participant) => participant.display_name_snapshot),
      participantDetails: participants
        .filter((participant) => participant.response_status !== 'removed')
        .map((participant) => ({
          id: participant.id,
          userId: participant.user_id ?? undefined,
          displayName: participant.display_name_snapshot,
          role: participant.role,
          responseStatus: participant.response_status,
        })),
      notes: notes[0]?.body ?? '',
      status: booking.status,
      paymentStatus: booking.payment_status,
      canManageBooking: Boolean(rows.isPlatformAdmin)
        || booking.creator_id === userId
        || trainerIsCurrentUser
        || participantRole === 'organizer'
        || canManageAsStaff,
      canManagePayment: Boolean(rows.isPlatformAdmin) || trainerIsCurrentUser || canManageAsStaff,
    };
  }).sort((left, right) => left.start.localeCompare(right.start));
}

function buildConversations(rows: SnapshotRows, userId: UUID, profileCardsById: Map<UUID, ProfileCardRow>) {
  const messagesByConversation = new Map<UUID, MessageRow[]>();
  for (const message of rows.messages) {
    const list = messagesByConversation.get(message.conversation_id) ?? [];
    list.push(message);
    messagesByConversation.set(message.conversation_id, list);
  }
  for (const messages of messagesByConversation.values()) {
    messages.sort((left, right) => left.created_at.localeCompare(right.created_at));
  }
  const membersByConversation = new Map<UUID, ConversationMemberRow[]>();
  for (const member of rows.conversationMembers.filter((row) => !row.left_at)) {
    const list = membersByConversation.get(member.conversation_id) ?? [];
    list.push(member);
    membersByConversation.set(member.conversation_id, list);
  }
  const bookingById = new Map(rows.bookings.map((row) => [row.id, row]));

  const conversations: ChatConversation[] = rows.conversations.map((conversation) => {
    const members = membersByConversation.get(conversation.id) ?? [];
    const currentMember = members.find((member) => member.user_id === userId);
    const otherNames = compact(members
      .filter((member) => member.user_id !== userId)
      .map((member) => profileCardsById.get(member.user_id)?.display_name));
    const messages = messagesByConversation.get(conversation.id) ?? [];
    const lastMessage = messages.at(-1);
    const booking = conversation.booking_id ? bookingById.get(conversation.booking_id) : undefined;
    const name = conversation.title || otherNames.join(', ') || booking?.title || 'Rozmowa';
    const unread = messages.filter((message) => (
      message.sender_id !== userId
      && (!currentMember?.last_read_at || message.created_at > currentMember.last_read_at)
    )).length;
    return {
      id: conversation.id,
      kind: conversation.kind,
      name,
      initials: initials(name),
      role: conversation.kind === 'booking' ? 'Rozmowa treningowa' : conversation.kind === 'group' ? 'Grupa' : 'Użytkownik',
      preview: lastMessage?.deleted_at ? 'Wiadomość usunięta' : lastMessage?.body ?? '',
      time: conversationTime(lastMessage?.created_at ?? conversation.last_message_at),
      unread,
      trainingId: conversation.booking_id ?? undefined,
      memberIds: members.map((member) => member.user_id),
      lastMessageAt: lastMessage?.created_at ?? conversation.last_message_at ?? undefined,
    };
  }).sort((left, right) => (right.lastMessageAt ?? '').localeCompare(left.lastMessageAt ?? ''));

  const messages: ChatMessage[] = rows.messages.map((message) => ({
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id ?? undefined,
    clientMessageId: message.client_message_id ?? undefined,
    author: message.kind === 'system' || !message.sender_id ? 'system' : message.sender_id === userId ? 'me' : 'them',
    kind: message.kind,
    body: message.deleted_at ? 'Wiadomość usunięta' : message.body ?? '',
    sentAt: message.created_at,
    editedAt: message.edited_at ?? undefined,
    deletedAt: message.deleted_at ?? undefined,
  }));

  return { conversations, messages };
}

function buildAvailability(rows: SnapshotRows, catalog: ReturnType<typeof buildCatalog>) {
  const trainersByDatabaseId = new Map(catalog.trainers.map((trainer) => [trainer.databaseId, trainer]));
  const windowsByPreference = new Map<UUID, AvailabilityAlertWindowRow[]>();
  for (const window of rows.availabilityWindows) {
    const list = windowsByPreference.get(window.preference_id) ?? [];
    list.push(window);
    windowsByPreference.set(window.preference_id, list);
  }
  const preferences: Record<string, AvailabilityPreference> = {};
  for (const trainer of catalog.trainers) preferences[trainer.id] = emptyAvailabilityPreference();

  for (const preferenceRow of rows.availabilityPreferences) {
    if (!preferenceRow.trainer_id) continue;
    const trainer = trainersByDatabaseId.get(preferenceRow.trainer_id);
    if (!trainer) continue;
    const preference = emptyAvailabilityPreference();
    preference.enabled = preferenceRow.enabled;
    preference.leadTime = preferenceRow.lead_time;
    preference.keepAllInChat = preferenceRow.keep_all_in_chat;
    for (const window of windowsByPreference.get(preferenceRow.id) ?? []) {
      const weekday = weekdayKeys[window.weekday - 1];
      if (!weekday) continue;
      const start = normalizeTime(window.starts_local);
      const end = normalizeTime(window.ends_local);
      const dayPart = window.day_part;
      if (dayPart) {
        preference.dayParts[weekday].push(dayPart);
      } else {
        preference.preciseHoursEnabled = true;
        const ranges = preference.preciseHours[weekday] ?? [];
        ranges.push({ id: window.id, start, end });
        preference.preciseHours[weekday] = ranges;
      }
    }
    for (const weekday of weekdayKeys) preference.dayParts[weekday] = unique(preference.dayParts[weekday]);
    preferences[trainer.id] = preference;
  }

  const preferenceById = new Map(rows.availabilityPreferences.map((preference) => [preference.id, preference]));
  const offers = compact(rows.availabilityOffers.map((offer) => {
    const trainerId = offer.trainer_id ?? preferenceById.get(offer.preference_id)?.trainer_id;
    const trainer = trainerId ? trainersByDatabaseId.get(trainerId) : undefined;
    if (!trainer) return undefined;
    const venue = catalog.venuesById.get(offer.venue_id);
    const court = catalog.courtsById.get(offer.court_id);
    const start = new Date(offer.starts_at).getTime();
    const end = new Date(offer.ends_at).getTime();
    return {
      id: offer.id,
      trainerId: trainer.id,
      conversationId: offer.conversation_id ?? '',
      start: offer.starts_at,
      durationMinutes: Math.max(0, Math.round((end - start) / 60_000)),
      venue: venue?.name ?? 'Nieznane miejsce',
      court: court?.name ?? 'Nieznany kort',
      price: offer.total_minor / 100,
      packageHours: 0,
      sentAt: offer.created_at,
      status: offer.status === 'available' && new Date(offer.expires_at).getTime() <= Date.now()
        ? 'expired'
        : offer.status,
      expiresAt: offer.expires_at,
      readAt: offer.read_at ?? undefined,
      reservedTrainingId: offer.reserved_booking_id ?? undefined,
    };
  }));

  return {
    availabilityPreferences: preferences,
    availabilityOffers: offers,
    availabilityNotificationsEnabled: rows.notifications?.availability_alerts ?? false,
  };
}

export function mapSnapshot(userId: UUID, rows: SnapshotRows): AppDataSnapshot {
  const profileCardsById = new Map(rows.profileCards.map((row) => [row.user_id, row]));
  const catalog = buildCatalog(rows, userId);
  const trainings = buildTrainings(rows, userId, catalog);
  const chat = buildConversations(rows, userId, profileCardsById);
  const availability = buildAvailability(rows, catalog);
  const sports: Sport[] = rows.sports.map((sport) => ({
    id: sport.id,
    code: sport.code,
    name: sport.name_pl,
    active: sport.active,
  }));
  const primaryUserSport = rows.userSports.find((sport) => sport.is_primary) ?? rows.userSports[0];
  const selectedSport = sports.find((sport) => sport.id === primaryUserSport?.sport_id)?.name ?? sports[0]?.name ?? '';
  const roles = new Set<AccountRole>(['player']);
  if (rows.currentTrainerId) roles.add('trainer');
  for (const membership of rows.memberships) {
    if (membership.user_id === userId && membership.status === 'active') roles.add(membership.role);
  }
  const selectedTrainer = catalog.trainers.find((trainer) => trainer.databaseId === rows.profile?.selected_trainer_id);
  const latestCompletedOwnTraining = [...trainings]
    .filter((training) => (
      training.role !== 'staff'
      && !training.status.startsWith('cancelled')
      && training.status !== 'no_show'
      && (training.status === 'completed' || (
        training.status === 'confirmed' && new Date(training.end).getTime() <= Date.now()
      ))
    ))
    .sort((left, right) => right.end.localeCompare(left.end))[0];

  return {
    currentUserId: userId,
    accountRoles: [...roles],
    profile: rows.profile ? {
      id: rows.profile.id,
      name: rows.profile.display_name,
      city: rows.profile.city ?? '',
      playingLevel: playingLevelLabel(primaryUserSport?.skill_code),
      locale: rows.profile.locale,
      timezone: rows.profile.timezone,
      status: rows.profile.status,
      onboardingCompletedAt: rows.profile.onboarding_completed_at ?? undefined,
    } : { ...emptyProfile, id: userId },
    selectedTrainerId: selectedTrainer?.id,
    sports,
    selectedSport,
    tennisLevel: primaryUserSport?.skill_code ?? '',
    notifications: rows.notifications ? {
      trainingReminders: rows.notifications.training_reminders,
      chatMessages: rows.notifications.chat_messages,
      scheduleChanges: rows.notifications.schedule_changes,
      payments: rows.notifications.payment_updates,
      courtConditions: rows.notifications.court_conditions,
      marketing: rows.notifications.marketing,
    } : { ...defaultNotificationSettings },
    inAppNotifications: rows.inAppNotifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      relatedEntityType: notification.related_entity_type ?? undefined,
      relatedEntityId: notification.related_entity_id ?? undefined,
      readAt: notification.read_at ?? undefined,
      createdAt: notification.created_at,
    })),
    trainers: catalog.trainers,
    clubs: catalog.clubs,
    courts: catalog.courts,
    trainings,
    conversations: chat.conversations,
    messages: chat.messages,
    trainingNote: latestCompletedOwnTraining?.notes ?? '',
    ...availability,
  };
}
