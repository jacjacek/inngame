import type { BookingPaymentStatus, BookingStatus, UUID } from '@/data/models';

export type ProfileRow = {
  id: UUID;
  display_name: string;
  city: string | null;
  locale: string;
  timezone: string;
  status: 'active' | 'deletion_requested' | 'anonymized' | 'blocked';
  onboarding_completed_at: string | null;
  selected_trainer_id?: UUID | null;
};

export type ProfileCardRow = {
  user_id: UUID;
  display_name: string;
  is_trainer: boolean;
};

export type SportRow = {
  id: UUID;
  code: string;
  name_pl: string;
  active: boolean;
};

export type UserSportRow = {
  user_id: UUID;
  sport_id: UUID;
  is_primary: boolean;
  skill_system: string | null;
  skill_code: string | null;
};

export type NotificationPreferenceRow = {
  user_id: UUID;
  training_reminders: boolean;
  chat_messages: boolean;
  schedule_changes: boolean;
  payment_updates: boolean;
  court_conditions: boolean;
  marketing: boolean;
  availability_alerts?: boolean;
};

export type NotificationRow = {
  id: UUID;
  recipient_id: UUID;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  related_entity_type: string | null;
  related_entity_id: UUID | null;
  read_at: string | null;
  created_at: string;
};

export type OrganizationRow = {
  id: UUID;
  slug: string;
  display_name: string;
  status: string;
};

export type OrganizationMembershipRow = {
  organization_id: UUID;
  user_id: UUID;
  role: 'owner' | 'manager' | 'reception' | 'trainer' | 'viewer';
  status: string;
};

export type TrainerRow = {
  id: UUID;
  slug?: string | null;
  display_name: string;
  initials?: string | null;
  specialty: string | null;
  certification: string | null;
  bio: string | null;
  public_contact_phone: string | null;
  experience_since: string | null;
  status: string;
  rating_average: number | string;
  rating_count: number;
  completed_bookings_count: number;
};

export type TrainerSportRow = {
  trainer_id: UUID;
  sport_id: UUID;
  specialty: string | null;
};

export type TrainerVenueRow = {
  trainer_id: UUID;
  venue_id: UUID;
  active: boolean;
};

export type TrainerRateRow = {
  id: UUID;
  trainer_id: UUID;
  sport_id: UUID;
  venue_id: UUID | null;
  amount_per_60_min_minor: number;
  currency: string;
  valid_from: string;
  valid_until: string | null;
  priority: number;
};

export type VenueRow = {
  id: UUID;
  organization_id: UUID;
  slug?: string | null;
  name: string;
  address_line: string;
  city: string;
  phone: string | null;
  status: string;
};

export type CourtRow = {
  id: UUID;
  venue_id: UUID;
  sport_id: UUID;
  code: string;
  name: string;
  surface: string;
  indoor: boolean;
  status: string;
};

export type CourtRateRow = {
  id: UUID;
  court_id: UUID;
  amount_per_60_min_minor: number;
  currency: string;
  valid_from: string;
  valid_until: string | null;
  priority: number;
};

export type BookingRow = {
  id: UUID;
  creator_id: UUID | null;
  sport_id: UUID;
  venue_id: UUID;
  court_id: UUID;
  trainer_id: UUID | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  title: string;
  currency: string;
  total_minor: number;
  payment_status: BookingPaymentStatus;
};

export type BookingParticipantRow = {
  id: UUID;
  booking_id: UUID;
  user_id: UUID | null;
  display_name_snapshot: string;
  role: 'organizer' | 'player' | 'coach';
  response_status: 'pending' | 'accepted' | 'declined' | 'removed';
};

export type BookingNoteRow = {
  id: UUID;
  booking_id: UUID;
  author_id: UUID | null;
  visibility: 'private' | 'participants' | 'coaches';
  body: string;
  created_at: string;
  edited_at: string | null;
};

export type ConversationRow = {
  id: UUID;
  kind: 'direct' | 'group' | 'booking' | 'support';
  booking_id: UUID | null;
  title: string | null;
  last_message_at: string | null;
  archived_at: string | null;
};

export type ConversationMemberRow = {
  conversation_id: UUID;
  user_id: UUID;
  role: 'member' | 'moderator';
  left_at: string | null;
  last_read_message_id: UUID | null;
  last_read_at: string | null;
};

export type MessageRow = {
  id: UUID;
  conversation_id: UUID;
  sender_id: UUID | null;
  client_message_id: UUID | null;
  kind: 'text' | 'system' | 'booking_card' | 'note_card';
  body: string | null;
  related_booking_id: UUID | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type AvailabilityAlertPreferenceRow = {
  id: UUID;
  user_id: UUID;
  sport_id: UUID;
  venue_id: UUID | null;
  trainer_id: UUID | null;
  enabled: boolean;
  duration_minutes: number;
  lead_time: 'today' | 'threeDays' | 'sevenDays';
  keep_all_in_chat: boolean;
  timezone: string;
  notify_push: boolean;
  notify_in_app: boolean;
};

export type AvailabilityAlertWindowRow = {
  id: UUID;
  preference_id: UUID;
  weekday: number;
  day_part: 'morning' | 'day' | 'evening' | null;
  starts_local: string;
  ends_local: string;
};

export type AvailabilityOfferRow = {
  id: UUID;
  preference_id: UUID;
  recipient_id: UUID;
  sport_id: UUID;
  trainer_id: UUID | null;
  conversation_id: UUID | null;
  starts_at: string;
  ends_at: string;
  venue_id: UUID;
  court_id: UUID;
  total_minor: number;
  currency: string;
  status: 'available' | 'reserved' | 'cancelled' | 'expired' | 'withdrawn';
  expires_at: string;
  read_at: string | null;
  reserved_booking_id: UUID | null;
  created_by: UUID | null;
  created_at: string;
};
