-- MyMovio production MVP: extensions, private infrastructure and account data.
-- Payment processors and prepaid packages are intentionally out of scope.

create schema if not exists extensions;
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create or replace function private.set_updated_at_and_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (pg_catalog.to_jsonb(new) - array['updated_at', 'version']::text[])
      is distinct from
     (pg_catalog.to_jsonb(old) - array['updated_at', 'version']::text[]) then
    new.updated_at := pg_catalog.clock_timestamp();
    new.version := old.version + 1;
  else
    new.updated_at := old.updated_at;
    new.version := old.version;
  end if;
  return new;
end;
$$;

revoke all on function private.set_updated_at_and_version() from public, anon, authenticated;

create table public.sports (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_-]{1,39}$'),
  name_pl text not null unique check (char_length(name_pl) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create trigger sports_set_updated_at_and_version
before update on public.sports
for each row execute function private.set_updated_at_and_version();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  city text check (city is null or char_length(city) <= 120),
  locale text not null default 'pl-PL' check (char_length(locale) between 2 and 20),
  timezone text not null default 'Europe/Warsaw' check (char_length(timezone) between 1 and 80),
  status text not null default 'active'
    check (status in ('active', 'deletion_requested', 'anonymized', 'blocked')),
  onboarding_completed_at timestamptz,
  deletion_requested_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create trigger profiles_set_updated_at_and_version
before update on public.profiles
for each row execute function private.set_updated_at_and_version();

create table public.profile_cards (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  is_trainer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create trigger profile_cards_set_updated_at_and_version
before update on public.profile_cards
for each row execute function private.set_updated_at_and_version();

create table public.user_sports (
  user_id uuid not null references public.profiles(id) on delete cascade,
  sport_id uuid not null references public.sports(id) on delete restrict,
  is_primary boolean not null default false,
  skill_system text check (skill_system is null or char_length(skill_system) <= 40),
  skill_code text check (skill_code is null or char_length(skill_code) <= 40),
  assessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  primary key (user_id, sport_id)
);

create unique index user_sports_one_primary_idx
  on public.user_sports(user_id)
  where is_primary;

create index user_sports_sport_user_idx on public.user_sports(sport_id, user_id);

create trigger user_sports_set_updated_at_and_version
before update on public.user_sports
for each row execute function private.set_updated_at_and_version();

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  training_reminders boolean not null default true,
  chat_messages boolean not null default true,
  schedule_changes boolean not null default true,
  payment_updates boolean not null default true,
  court_conditions boolean not null default false,
  availability_alerts boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  marketing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check ((quiet_hours_start is null) = (quiet_hours_end is null))
);

create trigger notification_preferences_set_updated_at_and_version
before update on public.notification_preferences
for each row execute function private.set_updated_at_and_version();

create table public.device_installations (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  push_provider text not null check (push_provider in ('expo', 'apns', 'fcm', 'web_push')),
  push_token text not null unique check (char_length(push_token) between 8 and 4096),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  locale text check (locale is null or char_length(locale) <= 20),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create index device_installations_user_idx on public.device_installations(user_id);
create index device_installations_stale_idx
  on public.device_installations(last_seen_at)
  where disabled_at is null;

create trigger device_installations_set_updated_at_and_version
before update on public.device_installations
for each row execute function private.set_updated_at_and_version();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (char_length(type) between 1 and 80),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 500),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  related_entity_type text check (related_entity_type is null or char_length(related_entity_type) <= 80),
  related_entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_feed_idx
  on public.notifications(recipient_id, read_at, created_at desc);

create table private.platform_role_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('platform_admin', 'support')),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, role)
);

comment on table private.platform_role_assignments is
  'Bootstrap the first platform_admin only from a trusted SQL/service session; never from user_metadata.';

create table private.idempotency_keys (
  actor_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (char_length(scope) between 1 and 100),
  key uuid not null,
  request_hash text not null check (char_length(request_hash) between 16 and 128),
  resource_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  primary key (actor_id, scope, key)
);

create index idempotency_keys_expiry_idx on private.idempotency_keys(expires_at);

create table private.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (char_length(event_type) between 1 and 100),
  aggregate_type text not null check (char_length(aggregate_type) between 1 and 80),
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  idempotency_key uuid not null,
  run_after timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed', 'dead')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (event_type, idempotency_key)
);

create index outbox_events_work_idx on private.outbox_events(status, run_after);

create table private.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_kind text not null default 'user' check (actor_kind in ('user', 'service', 'system')),
  organization_id uuid,
  action text not null check (char_length(action) between 1 and 100),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id uuid,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create or replace function private.sync_profile_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile_cards (user_id, display_name)
  values (new.id, new.display_name)
  on conflict (user_id) do update
    set display_name = excluded.display_name;
  return new;
end;
$$;

revoke all on function private.sync_profile_card() from public, anon, authenticated;

create trigger profiles_sync_profile_card
after insert or update of display_name on public.profiles
for each row execute function private.sync_profile_card();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
begin
  v_display_name := nullif(
    pg_catalog.left(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), 80),
    ''
  );
  if v_display_name is null then
    v_display_name := nullif(
      pg_catalog.left(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), 80),
      ''
    );
  end if;
  if v_display_name is null then
    v_display_name := 'Użytkownik';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, v_display_name)
  on conflict (id) do nothing;

  insert into public.profile_cards (user_id, display_name)
  values (new.id, v_display_name)
  on conflict (user_id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
