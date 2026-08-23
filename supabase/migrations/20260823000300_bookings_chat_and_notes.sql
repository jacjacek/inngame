-- Atomic court/trainer reservations, manual settlement ledger and durable chat.

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  sport_id uuid not null references public.sports(id) on delete restrict,
  venue_id uuid not null references public.venues(id) on delete restrict,
  court_id uuid not null references public.courts(id) on delete restrict,
  trainer_id uuid references public.trainers(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in (
      'confirmed', 'completed', 'cancelled_by_customer',
      'cancelled_by_provider', 'no_show'
    )),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  currency char(3) not null default 'PLN' check (currency = upper(currency)),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'not_required')),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  source text not null default 'web' check (source in ('mobile', 'web', 'club_admin', 'import')),
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check (ends_at > starts_at),
  check (total_minor = subtotal_minor - discount_minor),
  check (
    (status in ('cancelled_by_customer', 'cancelled_by_provider') and cancelled_at is not null)
    or
    (status not in ('cancelled_by_customer', 'cancelled_by_provider') and cancelled_at is null)
  ),
  unique (creator_id, client_request_id),
  foreign key (court_id, venue_id, sport_id)
    references public.courts(id, venue_id, sport_id) on delete restrict
);

alter table public.bookings
  add constraint bookings_no_court_overlap
  exclude using gist (
    court_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status = 'confirmed');

alter table public.bookings
  add constraint bookings_no_trainer_overlap
  exclude using gist (
    trainer_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (trainer_id is not null and status = 'confirmed');

create index bookings_court_calendar_idx on public.bookings(court_id, starts_at);
create index bookings_trainer_calendar_idx
  on public.bookings(trainer_id, starts_at)
  where trainer_id is not null;
create index bookings_creator_calendar_idx on public.bookings(creator_id, starts_at desc);
create index bookings_venue_calendar_idx on public.bookings(venue_id, starts_at, status);

create trigger bookings_set_updated_at_and_version
before update on public.bookings
for each row execute function private.set_updated_at_and_version();

create table public.booking_participants (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  display_name_snapshot text not null check (char_length(btrim(display_name_snapshot)) between 1 and 80),
  role text not null check (role in ('organizer', 'player', 'coach')),
  response_status text not null default 'accepted'
    check (response_status in ('pending', 'accepted', 'declined', 'removed')),
  responded_at timestamptz,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create unique index booking_participants_unique_user_idx
  on public.booking_participants(booking_id, user_id)
  where user_id is not null;
create index booking_participants_user_booking_idx
  on public.booking_participants(user_id, booking_id)
  where user_id is not null;

create trigger booking_participants_set_updated_at_and_version
before update on public.booking_participants
for each row execute function private.set_updated_at_and_version();

create table public.booking_price_lines (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  kind text not null check (kind in ('court', 'trainer', 'fee', 'discount', 'tax')),
  label text not null check (char_length(label) between 1 and 160),
  quantity numeric(10,3) not null check (quantity > 0),
  unit_amount_minor bigint not null,
  total_amount_minor bigint not null,
  source_rate_id uuid,
  position smallint not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (booking_id, position)
);

create index booking_price_lines_booking_idx on public.booking_price_lines(booking_id);

create table public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 500),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index booking_status_history_booking_idx
  on public.booking_status_history(booking_id, created_at);

create table public.booking_settlement_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status text check (from_status is null or from_status in ('unpaid', 'paid', 'not_required')),
  to_status text not null check (to_status in ('unpaid', 'paid', 'not_required')),
  actor_id uuid references public.profiles(id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (booking_id, idempotency_key)
);

create index booking_settlement_events_booking_idx
  on public.booking_settlement_events(booking_id, created_at);

create table public.booking_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  visibility text not null default 'private'
    check (visibility in ('private', 'participants', 'coaches')),
  body text not null check (char_length(body) <= 5000),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create unique index booking_notes_one_per_author_idx
  on public.booking_notes(booking_id, author_id)
  where author_id is not null;
create index booking_notes_booking_idx on public.booking_notes(booking_id, created_at);

create trigger booking_notes_set_updated_at_and_version
before update on public.booking_notes
for each row execute function private.set_updated_at_and_version();

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group', 'booking', 'support')),
  booking_id uuid references public.bookings(id) on delete cascade,
  title text check (title is null or char_length(title) <= 160),
  created_by uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check ((kind = 'booking' and booking_id is not null) or (kind <> 'booking' and booking_id is null))
);

create unique index conversations_one_per_booking_idx
  on public.conversations(booking_id)
  where booking_id is not null and kind = 'booking';
create index conversations_last_message_idx on public.conversations(last_message_at desc nulls last);

create trigger conversations_set_updated_at_and_version
before update on public.conversations
for each row execute function private.set_updated_at_and_version();

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_read_message_id uuid,
  last_read_at timestamptz,
  muted_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  primary key (conversation_id, user_id),
  check (left_at is null or left_at >= joined_at)
);

create index conversation_members_user_active_idx
  on public.conversation_members(user_id, conversation_id)
  where left_at is null;

create trigger conversation_members_set_updated_at_and_version
before update on public.conversation_members
for each row execute function private.set_updated_at_and_version();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  client_message_id uuid,
  kind text not null default 'text' check (kind in ('text', 'system', 'booking_card', 'note_card')),
  body text check (body is null or char_length(body) <= 4000),
  reply_to_message_id uuid references public.messages(id) on delete set null,
  related_booking_id uuid references public.bookings(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'text' and body is not null and char_length(btrim(body)) > 0) or kind <> 'text'),
  check ((sender_id is null and kind = 'system') or sender_id is not null)
);

create unique index messages_sender_client_id_idx
  on public.messages(sender_id, client_message_id)
  where sender_id is not null and client_message_id is not null;
create index messages_conversation_feed_idx
  on public.messages(conversation_id, created_at desc, id desc);
create index messages_reply_idx
  on public.messages(reply_to_message_id)
  where reply_to_message_id is not null;

alter table public.conversation_members
  add constraint conversation_members_last_read_message_fk
  foreign key (last_read_message_id) references public.messages(id) on delete set null;
