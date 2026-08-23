-- User-defined recurring windows and bookable availability offers.

create table public.availability_alert_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sport_id uuid not null references public.sports(id) on delete restrict,
  venue_id uuid references public.venues(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete cascade,
  duration_minutes integer not null check (duration_minutes between 30 and 360 and duration_minutes % 15 = 0),
  lead_time text not null default 'threeDays'
    check (lead_time in ('today', 'threeDays', 'sevenDays')),
  keep_all_in_chat boolean not null default true,
  timezone text not null default 'Europe/Warsaw' check (char_length(timezone) between 1 and 80),
  enabled boolean not null default true,
  notify_push boolean not null default true,
  notify_in_app boolean not null default true,
  valid_from date not null default current_date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check (venue_id is not null or trainer_id is not null),
  check (notify_push or notify_in_app),
  check (valid_until is null or valid_until >= valid_from)
);

create unique index availability_alert_preferences_unique_target_idx
  on public.availability_alert_preferences(
    user_id,
    sport_id,
    coalesce(venue_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(trainer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    duration_minutes
  );
create index availability_alert_preferences_match_idx
  on public.availability_alert_preferences(sport_id, venue_id, trainer_id, enabled)
  where enabled;

create trigger availability_alert_preferences_set_updated_at_and_version
before update on public.availability_alert_preferences
for each row execute function private.set_updated_at_and_version();

create table public.availability_alert_windows (
  id uuid primary key default gen_random_uuid(),
  preference_id uuid not null references public.availability_alert_preferences(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  day_part text check (day_part is null or day_part in ('morning', 'day', 'evening')),
  starts_local time not null,
  ends_local time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check (ends_local > starts_local),
  unique (preference_id, weekday, starts_local, ends_local)
);

create index availability_alert_windows_match_idx
  on public.availability_alert_windows(weekday, starts_local, ends_local, preference_id);

create trigger availability_alert_windows_set_updated_at_and_version
before update on public.availability_alert_windows
for each row execute function private.set_updated_at_and_version();

create table public.availability_offers (
  id uuid primary key default gen_random_uuid(),
  preference_id uuid not null references public.availability_alert_preferences(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  sport_id uuid not null references public.sports(id) on delete restrict,
  venue_id uuid not null references public.venues(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  total_minor bigint not null check (total_minor >= 0),
  currency char(3) not null default 'PLN' check (currency = upper(currency)),
  status text not null default 'available'
    check (status in ('available', 'reserved', 'withdrawn', 'cancelled', 'expired')),
  expires_at timestamptz not null,
  reserved_booking_id uuid references public.bookings(id) on delete set null,
  read_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check (ends_at > starts_at),
  check ((status = 'reserved' and reserved_booking_id is not null) or status <> 'reserved'),
  foreign key (court_id, venue_id, sport_id)
    references public.courts(id, venue_id, sport_id) on delete cascade
);

create index availability_offers_recipient_feed_idx
  on public.availability_offers(recipient_id, status, starts_at, expires_at);
create index availability_offers_expiry_idx
  on public.availability_offers(status, expires_at)
  where status = 'available';
create index availability_offers_preference_idx on public.availability_offers(preference_id);
create index availability_offers_conversation_idx
  on public.availability_offers(conversation_id, created_at desc)
  where conversation_id is not null;

create trigger availability_offers_set_updated_at_and_version
before update on public.availability_offers
for each row execute function private.set_updated_at_and_version();
