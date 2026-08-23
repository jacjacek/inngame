import type { PostgrestError } from '@supabase/supabase-js';

import { usableAvailabilityRanges } from '@/data/availability';
import type {
  AppRepository,
  BookingQuote,
  CreateBookingInput,
  QuoteBookingInput,
  RescheduleBookingInput,
  SaveAvailabilityPreferenceInput,
  SaveProfileInput,
  SendMessageInput,
} from '@/data/repositories/app-repository';
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
import { mapSnapshot } from '@/data/repositories/mappers';
import type { BookingPaymentStatus, NotificationSettings, UUID } from '@/data/models';
import { getSupabaseClient } from '@/lib/supabase/client';

type QueryResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

type MyRolesPayload = {
  is_platform_admin?: boolean;
  trainer_id?: UUID | null;
};

export class AppRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AppRepositoryError';
    this.code = /^[A-Z][A-Z0-9_]+$/.test(message) ? message : code;
  }
}

function unwrap<T>(result: QueryResult<T>, fallback: T): T {
  if (result.error) {
    throw new AppRepositoryError(result.error.message, result.error.code);
  }
  return result.data ?? fallback;
}

function assertSuccess(result: QueryResult<unknown>): void {
  if (result.error) {
    throw new AppRepositoryError(result.error.message, result.error.code);
  }
}

function extractId(data: unknown, keys: string[]): UUID {
  const value = Array.isArray(data) ? data[0] : data;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    for (const key of keys) {
      const candidate = (value as Record<string, unknown>)[key];
      if (typeof candidate === 'string') return candidate;
    }
  }
  throw new AppRepositoryError('Serwer nie zwrócił identyfikatora zapisanego rekordu.', 'INVALID_RPC_RESPONSE');
}

function extractBooking(data: unknown): BookingRow {
  const value = Array.isArray(data) ? data[0] : data;
  if (value && typeof value === 'object' && typeof (value as Partial<BookingRow>).id === 'string') {
    return value as BookingRow;
  }
  throw new AppRepositoryError('Serwer nie zwrócił zapisanej rezerwacji.', 'INVALID_RPC_RESPONSE');
}

function extractBookingQuote(data: unknown): BookingQuote {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== 'object') {
    throw new AppRepositoryError('Serwer nie zwrócił wyceny rezerwacji.', 'INVALID_RPC_RESPONSE');
  }
  const quote = value as Record<string, unknown>;
  const requiredStrings = ['sport_id', 'venue_id', 'court_id', 'starts_at', 'ends_at', 'court_rate_id', 'currency', 'payment_status'] as const;
  const requiredNumbers = [
    'duration_minutes',
    'court_amount_minor',
    'trainer_amount_minor',
    'subtotal_minor',
    'discount_minor',
    'total_minor',
  ] as const;
  if (
    requiredStrings.some((key) => typeof quote[key] !== 'string')
    || requiredNumbers.some((key) => typeof quote[key] !== 'number' || !Number.isFinite(quote[key]))
    || (quote.trainer_id !== null && quote.trainer_id !== undefined && typeof quote.trainer_id !== 'string')
    || (quote.trainer_rate_id !== null && quote.trainer_rate_id !== undefined && typeof quote.trainer_rate_id !== 'string')
  ) {
    throw new AppRepositoryError('Serwer zwrócił niepełną wycenę rezerwacji.', 'INVALID_RPC_RESPONSE');
  }
  const paymentStatus = String(quote.payment_status);
  if (paymentStatus !== 'unpaid' && paymentStatus !== 'paid' && paymentStatus !== 'not_required') {
    throw new AppRepositoryError('Serwer zwrócił nieprawidłowy status rozliczenia.', 'INVALID_RPC_RESPONSE');
  }
  return {
    sportId: String(quote.sport_id),
    venueId: String(quote.venue_id),
    courtId: String(quote.court_id),
    trainerId: typeof quote.trainer_id === 'string' ? quote.trainer_id : undefined,
    startsAt: String(quote.starts_at),
    endsAt: String(quote.ends_at),
    durationMinutes: Number(quote.duration_minutes),
    courtRateId: String(quote.court_rate_id),
    trainerRateId: typeof quote.trainer_rate_id === 'string' ? quote.trainer_rate_id : undefined,
    courtAmountMinor: Number(quote.court_amount_minor),
    trainerAmountMinor: Number(quote.trainer_amount_minor),
    subtotalMinor: Number(quote.subtotal_minor),
    discountMinor: Number(quote.discount_minor),
    totalMinor: Number(quote.total_minor),
    currency: String(quote.currency),
    paymentStatus,
  };
}

function availabilityWindows(input: SaveAvailabilityPreferenceInput) {
  const weekdays = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ] as const;
  const windows = weekdays.flatMap((weekday, index) => {
    const dayPartWindows = input.preference.dayParts[weekday].map((dayPart) => ({
      weekday: index + 1,
      day_part: dayPart,
      starts_local: null,
      ends_local: null,
    }));
    if (!input.preference.preciseHoursEnabled) return dayPartWindows;
    const preciseWindows = usableAvailabilityRanges(input.preference, weekday).map((range) => ({
      weekday: index + 1,
      day_part: null,
      starts_local: range.start,
      ends_local: range.end,
    }));
    return [...dayPartWindows, ...preciseWindows];
  });
  const deduplicated = [...new Map(windows.map((window) => [
    `${window.weekday}:${window.day_part ?? ''}:${window.starts_local ?? ''}:${window.ends_local ?? ''}`,
    window,
  ])).values()];
  if (deduplicated.length > 21) {
    throw new AppRepositoryError('Możesz zapisać maksymalnie 21 okien dostępności.', 'TOO_MANY_AVAILABILITY_WINDOWS');
  }
  return deduplicated;
}

export const supabaseAppRepository: AppRepository = {
  async loadSnapshot(userId) {
    const client = getSupabaseClient();
    const [
      profileResult,
      profileCardsResult,
      sportsResult,
      userSportsResult,
      notificationResult,
      inAppNotificationsResult,
      rolesResult,
      organizationsResult,
      membershipsResult,
      trainersResult,
      trainerSportsResult,
      trainerVenuesResult,
      trainerRatesResult,
      venuesResult,
      courtsResult,
      courtRatesResult,
      bookingsResult,
      participantsResult,
      notesResult,
      conversationsResult,
      conversationMembersResult,
      messagesResult,
      availabilityPreferencesResult,
      availabilityWindowsResult,
      availabilityOffersResult,
    ] = await Promise.all([
      client
        .from('profiles')
        .select('id,display_name,city,locale,timezone,status,onboarding_completed_at,selected_trainer_id')
        .eq('id', userId)
        .maybeSingle(),
      client.from('profile_cards').select('*'),
      client.from('sports').select('*').eq('active', true).order('name_pl'),
      client.from('user_sports').select('*').eq('user_id', userId),
      client.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle(),
      client.from('notifications').select('*').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(200),
      client.rpc('get_my_roles'),
      client
        .from('organizations')
        .select('id,kind,slug,display_name,status,created_at,updated_at,version')
        .neq('status', 'archived')
        .order('display_name'),
      client.from('organization_memberships').select('*').eq('user_id', userId).eq('status', 'active'),
      client
        .from('trainers')
        .select('id,slug,display_name,initials,specialty,certification,bio,public_contact_phone,image_url,experience_since,status,rating_average,rating_count,completed_bookings_count,created_at,updated_at,version')
        .eq('status', 'active')
        .order('display_name'),
      client.from('trainer_sports').select('*'),
      client.from('trainer_venues').select('*').eq('active', true),
      client.from('trainer_rates').select('*'),
      client.from('venues').select('*').neq('status', 'archived').order('name'),
      client.from('courts').select('*').neq('status', 'archived').order('name'),
      client.from('court_rates').select('*'),
      client.from('bookings').select('*').order('starts_at'),
      client.from('booking_participants').select('*'),
      client.from('booking_notes').select('*').order('created_at'),
      client.from('conversations').select('*').is('archived_at', null).order('last_message_at', { ascending: false }),
      client.from('conversation_members').select('*').is('left_at', null),
      client.from('messages').select('*').order('created_at', { ascending: false }).limit(1000),
      client.from('availability_alert_preferences').select('*').eq('user_id', userId),
      client.from('availability_alert_windows').select('*'),
      client.from('availability_offers').select('*').eq('recipient_id', userId).order('starts_at'),
    ]);

    const roles = unwrap(rolesResult as QueryResult<MyRolesPayload>, {});
    const snapshot = mapSnapshot(userId, {
      currentTrainerId: roles.trainer_id ?? undefined,
      isPlatformAdmin: roles.is_platform_admin === true,
      profile: unwrap(profileResult as QueryResult<ProfileRow>, null as unknown as ProfileRow),
      profileCards: unwrap(profileCardsResult as QueryResult<ProfileCardRow[]>, []),
      sports: unwrap(sportsResult as QueryResult<SportRow[]>, []),
      userSports: unwrap(userSportsResult as QueryResult<UserSportRow[]>, []),
      notifications: unwrap(notificationResult as QueryResult<NotificationPreferenceRow>, null as unknown as NotificationPreferenceRow),
      inAppNotifications: unwrap(inAppNotificationsResult as QueryResult<NotificationRow[]>, []),
      organizations: unwrap(organizationsResult as QueryResult<OrganizationRow[]>, []),
      memberships: unwrap(membershipsResult as QueryResult<OrganizationMembershipRow[]>, []),
      trainers: unwrap(trainersResult as QueryResult<TrainerRow[]>, []),
      trainerSports: unwrap(trainerSportsResult as QueryResult<TrainerSportRow[]>, []),
      trainerVenues: unwrap(trainerVenuesResult as QueryResult<TrainerVenueRow[]>, []),
      trainerRates: unwrap(trainerRatesResult as QueryResult<TrainerRateRow[]>, []),
      venues: unwrap(venuesResult as QueryResult<VenueRow[]>, []),
      courts: unwrap(courtsResult as QueryResult<CourtRow[]>, []),
      courtRates: unwrap(courtRatesResult as QueryResult<CourtRateRow[]>, []),
      bookings: unwrap(bookingsResult as QueryResult<BookingRow[]>, []),
      bookingParticipants: unwrap(participantsResult as QueryResult<BookingParticipantRow[]>, []),
      bookingNotes: unwrap(notesResult as QueryResult<BookingNoteRow[]>, []),
      conversations: unwrap(conversationsResult as QueryResult<ConversationRow[]>, []),
      conversationMembers: unwrap(conversationMembersResult as QueryResult<ConversationMemberRow[]>, []),
      messages: unwrap(messagesResult as QueryResult<MessageRow[]>, []),
      availabilityPreferences: unwrap(
        availabilityPreferencesResult as QueryResult<AvailabilityAlertPreferenceRow[]>,
        [],
      ),
      availabilityWindows: unwrap(availabilityWindowsResult as QueryResult<AvailabilityAlertWindowRow[]>, []),
      availabilityOffers: unwrap(availabilityOffersResult as QueryResult<AvailabilityOfferRow[]>, []),
    });
    if (roles.is_platform_admin === true) {
      snapshot.accountRoles = [...new Set([...snapshot.accountRoles, 'platform_admin' as const])];
    }
    return snapshot;
  },

  async saveProfile(input: SaveProfileInput) {
    const result = await getSupabaseClient().rpc('save_profile', {
      p_display_name: input.profile.name.trim(),
      p_city: input.profile.city.trim() || null,
      p_locale: input.profile.locale ?? 'pl-PL',
      p_timezone: input.profile.timezone ?? 'Europe/Warsaw',
      p_onboarding_completed: input.onboardingCompleted ?? false,
      p_primary_sport_id: input.primarySportId ?? null,
      p_skill_system: input.skillCode ? 'NTRP' : null,
      p_skill_code: input.skillCode ?? null,
      p_selected_trainer_id: input.selectedTrainerDatabaseId ?? null,
    });
    assertSuccess(result);
  },

  async selectTrainer(trainerDatabaseId) {
    const result = await getSupabaseClient().rpc('select_trainer', {
      p_trainer_id: trainerDatabaseId ?? null,
    });
    assertSuccess(result);
  },

  async quoteBooking(input: QuoteBookingInput) {
    const result = await getSupabaseClient().rpc('quote_booking', {
      p_sport_id: input.sportId,
      p_venue_id: input.venueId,
      p_court_id: input.courtId,
      p_trainer_id: input.trainerId ?? null,
      p_starts_at: input.startsAt,
      p_duration_minutes: input.durationMinutes,
      p_exclude_booking_id: input.excludeBookingId ?? null,
    });
    assertSuccess(result);
    return extractBookingQuote(result.data);
  },

  async createBooking(input: CreateBookingInput) {
    const result = await getSupabaseClient().rpc('create_booking_with_quote', {
      p_idempotency_key: input.idempotencyKey,
      p_sport_id: input.sportId,
      p_venue_id: input.venueId,
      p_court_id: input.courtId,
      p_trainer_id: input.trainerId ?? null,
      p_starts_at: input.startsAt,
      p_duration_minutes: input.durationMinutes,
      p_expected_total_minor: input.expectedTotalMinor,
      p_expected_currency: input.expectedCurrency,
      p_participant_user_ids: [],
      p_title: input.title,
      p_source: input.source ?? 'web',
    });
    assertSuccess(result);
    return extractBooking(result.data);
  },

  async rescheduleBooking(input: RescheduleBookingInput) {
    const result = await getSupabaseClient().rpc('reschedule_booking_with_quote', {
      p_booking_id: input.bookingId,
      p_idempotency_key: input.idempotencyKey,
      p_starts_at: input.startsAt,
      p_duration_minutes: input.durationMinutes,
      p_expected_total_minor: input.expectedTotalMinor,
      p_expected_currency: input.expectedCurrency,
    });
    assertSuccess(result);
    extractBooking(result.data);
  },

  async cancelBooking(bookingId, idempotencyKey, reason) {
    const result = await getSupabaseClient().rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_idempotency_key: idempotencyKey,
      p_reason: reason ?? null,
    });
    assertSuccess(result);
  },

  async saveBookingNote(bookingId, body) {
    const result = await getSupabaseClient().rpc('save_booking_note', {
      p_booking_id: bookingId,
      p_body: body.trim(),
      p_visibility: 'participants',
    });
    assertSuccess(result);
  },

  async markTrainingPayment(bookingId, status, idempotencyKey, note) {
    const result = await getSupabaseClient().rpc('set_booking_payment_status', {
      p_booking_id: bookingId,
      p_idempotency_key: idempotencyKey,
      p_payment_status: status,
      p_note: note ?? null,
    });
    assertSuccess(result);
  },

  async sendMessage(input: SendMessageInput) {
    const result = await getSupabaseClient().rpc('send_message', {
      p_conversation_id: input.conversationId,
      p_client_message_id: input.clientMessageId,
      p_body: input.body.trim(),
      p_reply_to_message_id: input.replyToMessageId ?? null,
    });
    assertSuccess(result);
    return extractId(result.data, ['id', 'message_id']);
  },

  async markConversationRead(conversationId, messageId) {
    if (!messageId) return;
    const result = await getSupabaseClient().rpc('mark_conversation_read', {
      p_conversation_id: conversationId,
      p_message_id: messageId,
    });
    assertSuccess(result);
  },

  async saveNotificationSettings(settings: NotificationSettings) {
    const client = getSupabaseClient();
    const userId = (await client.auth.getUser()).data.user?.id;
    if (!userId) throw new AppRepositoryError('Sesja użytkownika wygasła.', 'UNAUTHENTICATED');
    const result = await client
      .from('notification_preferences')
      .update({
        training_reminders: settings.trainingReminders,
        chat_messages: settings.chatMessages,
        schedule_changes: settings.scheduleChanges,
        payment_updates: settings.payments,
        court_conditions: settings.courtConditions,
        marketing: settings.marketing,
      })
      .eq('user_id', userId);
    assertSuccess(result);
  },

  async markNotificationRead(notificationId) {
    const client = getSupabaseClient();
    const userId = (await client.auth.getUser()).data.user?.id;
    if (!userId) throw new AppRepositoryError('Sesja użytkownika wygasła.', 'UNAUTHENTICATED');
    const result = await client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_id', userId);
    assertSuccess(result);
  },

  async setAvailabilityNotificationsEnabled(enabled) {
    const client = getSupabaseClient();
    const userId = (await client.auth.getUser()).data.user?.id;
    if (!userId) throw new AppRepositoryError('Sesja użytkownika wygasła.', 'UNAUTHENTICATED');
    const result = await client
      .from('notification_preferences')
      .update({ availability_alerts: enabled })
      .eq('user_id', userId);
    assertSuccess(result);
  },

  async saveAvailabilityPreference(input) {
    const client = getSupabaseClient();
    const availabilityResult = await client.rpc('save_availability_alert', {
      p_idempotency_key: input.idempotencyKey,
      p_sport_id: input.sportId,
      p_duration_minutes: input.durationMinutes,
      p_preference_id: null,
      p_venue_id: null,
      p_trainer_id: input.trainerId,
      p_enabled: input.preference.enabled,
      p_lead_time: input.preference.leadTime,
      p_keep_all_in_chat: input.preference.keepAllInChat,
      p_timezone: input.timezone ?? 'Europe/Warsaw',
      // Web push is not registered in this client yet. Keep the durable,
      // synchronous in-app notification path enabled without accumulating
      // undeliverable outbox events.
      p_notify_push: false,
      p_notify_in_app: true,
      p_valid_from: new Date().toISOString().slice(0, 10),
      p_valid_until: null,
      p_windows: availabilityWindows(input),
    });
    assertSuccess(availabilityResult);

  },

  async markAvailabilityOfferRead(offerId) {
    const result = await getSupabaseClient()
      .from('availability_offers')
      .update({ read_at: new Date().toISOString() })
      .eq('id', offerId);
    assertSuccess(result);
  },

  async reserveAvailabilityOffer(offerId, idempotencyKey) {
    const result = await getSupabaseClient().rpc('reserve_availability_offer', {
      p_offer_id: offerId,
      p_idempotency_key: idempotencyKey,
    });
    assertSuccess(result);
    return extractBooking(result.data);
  },

  subscribeToChanges(userId, onChange) {
    const client = getSupabaseClient();
    let postgresChangesReady = false;
    let replicationReady = false;
    let readinessRefreshSent = false;
    const refreshAfterReady = () => {
      if (readinessRefreshSent || !postgresChangesReady || !replicationReady) return;
      readinessRefreshSent = true;
      // Close the gap between the initial snapshot and the point at which CDC
      // is actually streaming. `SUBSCRIBED` alone only confirms the channel
      // join and can precede replication readiness after a server restart.
      onChange();
    };
    const channel = client
      .channel(`app-data:${userId}`, {
        config: { broadcast: { replication_ready: true } },
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, onChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, onChange)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, onChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings' }, onChange)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'availability_offers' }, onChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'availability_offers' }, onChange)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, onChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, onChange)
      .on('system', {}, (payload) => {
        if (payload.status !== 'ok') return;
        if (payload.extension === 'postgres_changes') postgresChangesReady = true;
        if (payload.extension === 'system') replicationReady = true;
        refreshAfterReady();
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  },
};

export function isBookingPaymentStatus(value: string): value is BookingPaymentStatus {
  return value === 'unpaid' || value === 'paid' || value === 'not_required';
}
