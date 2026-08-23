-- Public tennis catalogue and organization roles. Catalogue trainers may exist
-- before they have an Auth account; trainers.user_id is an optional safe link.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'club' check (kind in ('club', 'platform')),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  legal_name text check (legal_name is null or char_length(legal_name) <= 200),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create trigger organizations_set_updated_at_and_version
before update on public.organizations
for each row execute function private.set_updated_at_and_version();

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'reception', 'trainer', 'viewer')),
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled')),
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  primary key (organization_id, user_id),
  check ((status = 'active' and joined_at is not null) or status <> 'active')
);

create index organization_memberships_user_idx
  on public.organization_memberships(user_id, status, organization_id);

create trigger organization_memberships_set_updated_at_and_version
before update on public.organization_memberships
for each row execute function private.set_updated_at_and_version();

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  slug text not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address_line text not null check (char_length(address_line) between 1 and 200),
  postal_code text check (postal_code is null or char_length(postal_code) <= 20),
  city text not null check (char_length(city) between 1 and 120),
  country_code char(2) not null default 'PL' check (country_code = upper(country_code)),
  timezone text not null default 'Europe/Warsaw' check (char_length(timezone) between 1 and 80),
  latitude numeric(9,6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9,6) check (longitude is null or longitude between -180 and 180),
  phone text check (phone is null or char_length(phone) <= 40),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'temporarily_closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (organization_id, slug),
  unique (id, organization_id)
);

create index venues_city_status_idx on public.venues(city, status);
create index venues_organization_idx on public.venues(organization_id, status);

create trigger venues_set_updated_at_and_version
before update on public.venues
for each row execute function private.set_updated_at_and_version();

create table public.venue_opening_hours (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  opens_local time not null,
  closes_local time not null,
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check (closes_local > opens_local),
  check (valid_until is null or valid_until >= valid_from),
  unique (venue_id, weekday, opens_local, valid_from)
);

create index venue_opening_hours_lookup_idx
  on public.venue_opening_hours(venue_id, weekday, valid_from, valid_until);

create trigger venue_opening_hours_set_updated_at_and_version
before update on public.venue_opening_hours
for each row execute function private.set_updated_at_and_version();

create table public.venue_closures (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 500),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check (ends_at > starts_at)
);

create index venue_closures_lookup_idx on public.venue_closures(venue_id, starts_at, ends_at);

create trigger venue_closures_set_updated_at_and_version
before update on public.venue_closures
for each row execute function private.set_updated_at_and_version();

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete restrict,
  sport_id uuid not null references public.sports(id) on delete restrict,
  code text not null check (char_length(code) between 1 and 40),
  name text not null check (char_length(name) between 1 and 120),
  surface text not null default 'other'
    check (surface in ('clay', 'hard', 'grass', 'carpet', 'artificial_clay', 'other')),
  indoor boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'maintenance', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (venue_id, code),
  unique (id, venue_id, sport_id)
);

create index courts_venue_sport_status_idx on public.courts(venue_id, sport_id, status);
create index courts_sport_status_idx on public.courts(sport_id, status);

create trigger courts_set_updated_at_and_version
before update on public.courts
for each row execute function private.set_updated_at_and_version();

create table public.court_rates (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  starts_local time not null,
  ends_local time not null,
  amount_per_60_min_minor bigint not null check (amount_per_60_min_minor >= 0),
  currency char(3) not null default 'PLN' check (currency = upper(currency)),
  valid_from date not null,
  valid_until date,
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check (ends_local > starts_local),
  check (valid_until is null or valid_until >= valid_from),
  unique (court_id, weekday, starts_local, valid_from, priority)
);

create index court_rates_lookup_idx
  on public.court_rates(court_id, weekday, valid_from, valid_until, priority desc);

create trigger court_rates_set_updated_at_and_version
before update on public.court_rates
for each row execute function private.set_updated_at_and_version();

create table public.trainers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  initials text check (initials is null or char_length(initials) between 1 and 8),
  specialty text check (specialty is null or char_length(specialty) <= 240),
  certification text check (certification is null or char_length(certification) <= 240),
  bio text check (bio is null or char_length(bio) <= 4000),
  public_contact_phone text check (public_contact_phone is null or char_length(public_contact_phone) <= 40),
  image_url text check (image_url is null or char_length(image_url) <= 1000),
  experience_since date,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  rating_average numeric(3,2) not null default 0 check (rating_average between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  completed_bookings_count integer not null default 0 check (completed_bookings_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create index trainers_status_rating_idx
  on public.trainers(status, rating_average desc, display_name, id);

create trigger trainers_set_updated_at_and_version
before update on public.trainers
for each row execute function private.set_updated_at_and_version();

alter table public.profiles
  add column selected_trainer_id uuid references public.trainers(id) on delete set null;

create index profiles_selected_trainer_idx
  on public.profiles(selected_trainer_id)
  where selected_trainer_id is not null;

create table public.trainer_sports (
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  sport_id uuid not null references public.sports(id) on delete restrict,
  specialty text check (specialty is null or char_length(specialty) <= 240),
  skill_min_code text check (skill_min_code is null or char_length(skill_min_code) <= 40),
  skill_max_code text check (skill_max_code is null or char_length(skill_max_code) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  primary key (trainer_id, sport_id)
);

create index trainer_sports_lookup_idx on public.trainer_sports(sport_id, trainer_id);

create trigger trainer_sports_set_updated_at_and_version
before update on public.trainer_sports
for each row execute function private.set_updated_at_and_version();

create table public.trainer_venues (
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  primary key (trainer_id, venue_id)
);

create index trainer_venues_lookup_idx on public.trainer_venues(venue_id, trainer_id) where active;

create trigger trainer_venues_set_updated_at_and_version
before update on public.trainer_venues
for each row execute function private.set_updated_at_and_version();

create table public.trainer_rates (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  sport_id uuid not null references public.sports(id) on delete restrict,
  venue_id uuid references public.venues(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  starts_local time not null,
  ends_local time not null,
  amount_per_60_min_minor bigint not null check (amount_per_60_min_minor >= 0),
  currency char(3) not null default 'PLN' check (currency = upper(currency)),
  valid_from date not null,
  valid_until date,
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check (ends_local > starts_local),
  check (valid_until is null or valid_until >= valid_from)
);

create index trainer_rates_lookup_idx
  on public.trainer_rates(trainer_id, sport_id, venue_id, weekday, valid_from, valid_until, priority desc);

create trigger trainer_rates_set_updated_at_and_version
before update on public.trainer_rates
for each row execute function private.set_updated_at_and_version();

create table public.trainer_availability_rules (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  starts_local time not null,
  ends_local time not null,
  valid_from date not null,
  valid_until date,
  slot_step_minutes smallint not null default 30 check (slot_step_minutes in (15, 30, 60)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check (ends_local > starts_local),
  check (valid_until is null or valid_until >= valid_from)
);

create index trainer_availability_rules_lookup_idx
  on public.trainer_availability_rules(trainer_id, weekday, valid_from, valid_until);

create trigger trainer_availability_rules_set_updated_at_and_version
before update on public.trainer_availability_rules
for each row execute function private.set_updated_at_and_version();

create table public.trainer_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  kind text not null check (kind in ('available', 'unavailable')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check (ends_at > starts_at)
);

create index trainer_availability_exceptions_lookup_idx
  on public.trainer_availability_exceptions(trainer_id, starts_at, ends_at);

create trigger trainer_availability_exceptions_set_updated_at_and_version
before update on public.trainer_availability_exceptions
for each row execute function private.set_updated_at_and_version();

alter table private.audit_events
  add constraint audit_events_organization_fk
  foreign key (organization_id) references public.organizations(id) on delete set null;

create or replace function private.sync_linked_trainer_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.user_id is not null
     and (tg_op = 'DELETE' or new.user_id is distinct from old.user_id) then
    update public.profile_cards
       set is_trainer = false
     where user_id = old.user_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.user_id is not null then
    update public.profile_cards
       set is_trainer = true,
           display_name = new.display_name
     where user_id = new.user_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_linked_trainer_card() from public, anon, authenticated;

create trigger trainers_sync_linked_profile_card
after insert or update of user_id, display_name or delete on public.trainers
for each row execute function private.sync_linked_trainer_card();
