begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(46);

create or replace function pg_temp.set_actor(
  p_user_id uuid,
  p_role text default 'authenticated'
)
returns void
language plpgsql
as $$
begin
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', coalesce(p_user_id::text, ''), true
  );
  perform pg_catalog.set_config('request.jwt.claim.role', p_role, true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', p_user_id,
      'role', p_role
    )::text,
    true
  );
end;
$$;

create or replace function pg_temp.blocked_private_update_count()
returns integer
language plpgsql
as $$
declare
  v_preferences integer := 0;
  v_notifications integer := 0;
  v_offers integer := 0;
begin
  update public.notification_preferences
     set marketing = true
   where user_id = '91000000-0000-0000-0000-000000000010';
  get diagnostics v_preferences = row_count;

  update public.notifications
     set read_at = pg_catalog.now()
   where recipient_id = '91000000-0000-0000-0000-000000000010';
  get diagnostics v_notifications = row_count;

  update public.availability_offers
     set read_at = pg_catalog.now()
   where recipient_id = '91000000-0000-0000-0000-000000000010';
  get diagnostics v_offers = row_count;

  return v_preferences + v_notifications + v_offers;
end;
$$;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select u.id,
       'authenticated',
       'authenticated',
       u.email,
       'test-only',
       pg_catalog.now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       pg_catalog.jsonb_build_object('display_name', u.display_name),
       pg_catalog.now(),
       pg_catalog.now()
from (values
  ('91000000-0000-0000-0000-000000000001'::uuid, 'admin@test.invalid', 'Admin'),
  ('91000000-0000-0000-0000-000000000002'::uuid, 'creator@test.invalid', 'Creator'),
  ('91000000-0000-0000-0000-000000000003'::uuid, 'old-trainer@test.invalid', 'Old Trainer'),
  ('91000000-0000-0000-0000-000000000004'::uuid, 'new-trainer@test.invalid', 'New Trainer'),
  ('91000000-0000-0000-0000-000000000005'::uuid, 'org-trainer@test.invalid', 'Org Trainer'),
  ('91000000-0000-0000-0000-000000000006'::uuid, 'viewer@test.invalid', 'Viewer'),
  ('91000000-0000-0000-0000-000000000007'::uuid, 'reception@test.invalid', 'Reception'),
  ('91000000-0000-0000-0000-000000000008'::uuid, 'alert@test.invalid', 'Alert Recipient'),
  ('91000000-0000-0000-0000-000000000009'::uuid, 'quota@test.invalid', 'Quota User'),
  ('91000000-0000-0000-0000-000000000010'::uuid, 'blocked@test.invalid', 'Blocked User')
) as u(id, email, display_name);

-- Make the fixture independent from a developer's earlier local E2E run.
update public.trainers
   set user_id = null
 where id in (
   '30000000-0000-0000-0000-000000000001'::uuid,
   '30000000-0000-0000-0000-000000000003'::uuid
 );

insert into private.platform_role_assignments (user_id, role)
values ('91000000-0000-0000-0000-000000000001', 'platform_admin');

insert into public.organization_memberships (
  organization_id, user_id, role, status, joined_at
)
values
  ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000005', 'trainer', 'active', now()),
  ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000006', 'viewer', 'active', now()),
  ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000007', 'reception', 'active', now());

create temp table workflow_state (
  court_id uuid not null,
  second_court_id uuid not null,
  main_start timestamptz not null,
  second_start timestamptz not null,
  moved_start timestamptz not null,
  main_booking_id uuid,
  second_booking_id uuid,
  quote jsonb,
  moved_quote jsonb,
  preference_id uuid,
  offer_id uuid,
  reserved_booking_id uuid,
  due_completed_id uuid,
  due_no_show_id uuid,
  due_cutoff timestamptz,
  blocked_coach_booking_id uuid
);

create temp table rpc_results (
  label text primary key,
  payload jsonb not null,
  response_status text not null
);

insert into workflow_state (
  court_id, second_court_id, main_start, second_start, moved_start, due_cutoff
)
select
  max(c.id::text) filter (where c.code = 'court-1')::uuid,
  max(c.id::text) filter (where c.code = 'court-2')::uuid,
  date_trunc('day', pg_catalog.now()) + interval '2 days 10 hours',
  date_trunc('day', pg_catalog.now()) + interval '3 days 11 hours',
  date_trunc('day', pg_catalog.now()) + interval '4 days 12 hours',
  pg_catalog.now()
from public.courts c
where c.venue_id = '20000000-0000-0000-0000-000000000001';

select pg_temp.set_actor('91000000-0000-0000-0000-000000000002');

update workflow_state ws
set quote = public.quote_booking(
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  ws.court_id,
  '30000000-0000-0000-0000-000000000001',
  ws.main_start,
  60,
  null
);

select extensions.ok(
  (quote ->> 'total_minor')::bigint
    = (quote ->> 'court_amount_minor')::bigint
      + (quote ->> 'trainer_amount_minor')::bigint
  and quote ->> 'currency' = 'PLN'
  and quote ? 'starts_at'
  and quote ? 'ends_at',
  'quote exposes a server-priced stable JSON contract'
)
from workflow_state;

with response as materialized (
  select public.create_booking_with_quote(
    '92000000-0000-0000-0000-000000000099',
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    (select court_id from workflow_state),
    '30000000-0000-0000-0000-000000000001',
    (select main_start from workflow_state),
    60,
    (select (quote ->> 'total_minor')::bigint + 1 from workflow_state),
    (select quote ->> 'currency' from workflow_state),
    '{}'::uuid[],
    'Changed quote fixture',
    'web'
  ) as payload
)
insert into rpc_results (label, payload, response_status)
select 'create_quote_changed', r.payload,
       pg_catalog.current_setting('response.status', true)
from response r;
select extensions.ok(
  exists (
    select 1 from rpc_results r
     where r.label = 'create_quote_changed'
       and r.response_status = '409'
       and r.payload ->> 'code' = 'QUOTE_CHANGED'
       and r.payload ?& array['code', 'message', 'details', 'hint']
  ),
  'create wrapper returns a standard 409 PostgREST body for stale quote'
);
select extensions.ok(
  not exists (
    select 1 from public.bookings b
     where b.client_request_id = '92000000-0000-0000-0000-000000000099'
  )
  and not exists (
    select 1 from private.idempotency_keys ik
     where ik.actor_id = '91000000-0000-0000-0000-000000000002'
       and ik.scope = 'create_booking'
       and ik.key = '92000000-0000-0000-0000-000000000099'
  )
  and exists (
    select 1 from private.actor_rate_limits arl
     where arl.actor_id = '91000000-0000-0000-0000-000000000002'
       and arl.scope = 'create_booking'
       and arl.request_count = 1
  ),
  'QUOTE_CHANGED rolls back booking/idempotency but commits the failed attempt'
);

update workflow_state ws
set main_booking_id = (
  public.create_booking_with_quote(
    '92000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    ws.court_id,
    '30000000-0000-0000-0000-000000000001',
    ws.main_start,
    60,
    (ws.quote ->> 'total_minor')::bigint,
    ws.quote ->> 'currency',
    '{}'::uuid[],
    'Main workflow booking',
    'web'
  ) ->> 'id'
)::uuid;

select extensions.is(
  (select b.total_minor from public.bookings b join workflow_state ws on ws.main_booking_id = b.id),
  (select (ws.quote ->> 'total_minor')::bigint from workflow_state ws),
  'create_booking uses the same amount as quote_booking'
);

with response as materialized (
  select public.quote_booking(
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    (select court_id from workflow_state),
    '30000000-0000-0000-0000-000000000001',
    (select main_start from workflow_state),
    60,
    null
  ) as payload
)
insert into rpc_results (label, payload, response_status)
select 'quote_conflict', r.payload,
       pg_catalog.current_setting('response.status', true)
from response r;
select extensions.ok(
  exists (
    select 1 from rpc_results r
     where r.label = 'quote_conflict'
       and r.response_status = '409'
       and r.payload ->> 'code' = 'SLOT_TAKEN'
       and r.payload ?& array['code', 'message', 'details', 'hint']
  ),
  'quote detects a conflict with a standard 409 PostgREST body'
);

with response as materialized (
  select public.quote_booking(
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    (select second_court_id from workflow_state),
    null,
    (select main_start + interval '7 minutes' from workflow_state),
    60,
    null
  ) as payload
)
insert into rpc_results (label, payload, response_status)
select 'quote_invalid_step', r.payload,
       pg_catalog.current_setting('response.status', true)
from response r;
select extensions.ok(
  exists (
    select 1 from rpc_results r
     where r.label = 'quote_invalid_step'
       and r.response_status = '400'
       and r.payload ->> 'code' = 'INVALID_SLOT_STEP'
  )
  and exists (
    select 1 from private.actor_rate_limits arl
     where arl.actor_id = '91000000-0000-0000-0000-000000000002'
       and arl.scope = 'quote_booking'
       and arl.request_count = 3
  ),
  'invalid quote returns 400 and still commits its rate-limit attempt'
);

with response as materialized (
  select private.rpc_error_response(
    'XX000',
    'raw internal exception text',
    'secret database detail',
    'secret database hint'
  ) as payload
)
insert into rpc_results (label, payload, response_status)
select 'unexpected_internal_error', r.payload,
       pg_catalog.current_setting('response.status', true)
from response r;
select extensions.ok(
  exists (
    select 1 from rpc_results r
     where r.label = 'unexpected_internal_error'
       and r.response_status = '500'
       and r.payload = pg_catalog.jsonb_build_object(
         'code', 'INTERNAL_ERROR',
         'message', 'INTERNAL_ERROR',
         'details', '',
         'hint', ''
       )
  ),
  'unexpected database errors are sanitized into a standard 500 body'
);

select pg_temp.set_actor('91000000-0000-0000-0000-000000000001');
select public.admin_link_trainer_account(
  '30000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001'
);

select extensions.ok(
  exists (
    select 1
      from public.booking_participants bp
      join workflow_state ws on ws.main_booking_id = bp.booking_id
     where bp.user_id = '91000000-0000-0000-0000-000000000003'
       and bp.role = 'coach'
       and bp.response_status = 'accepted'
  ),
  'linking a trainer backfills historical booking participants'
);
select extensions.ok(
  exists (
    select 1
      from public.conversation_members cm
      join public.conversations c on c.id = cm.conversation_id
      join workflow_state ws on ws.main_booking_id = c.booking_id
     where cm.user_id = '91000000-0000-0000-0000-000000000003'
       and cm.left_at is null
  ),
  'linking a trainer backfills historical booking conversations'
);

select pg_temp.set_actor('91000000-0000-0000-0000-000000000003');
update workflow_state ws
set second_booking_id = (
  public.create_booking(
    '92000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    ws.second_court_id,
    '30000000-0000-0000-0000-000000000001',
    ws.second_start,
    60,
    '{}'::uuid[],
    'Creator is also old coach',
    'web'
  )
).id;

select pg_temp.set_actor('91000000-0000-0000-0000-000000000001');
select public.admin_link_trainer_account(
  '30000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001'
);

select extensions.ok(
  not exists (
    select 1
      from public.booking_participants bp
      join workflow_state ws on ws.main_booking_id = bp.booking_id
     where bp.user_id = '91000000-0000-0000-0000-000000000003'
  )
  and exists (
    select 1
      from public.conversation_members cm
      join public.conversations c on c.id = cm.conversation_id
      join workflow_state ws on ws.main_booking_id = c.booking_id
     where cm.user_id = '91000000-0000-0000-0000-000000000003'
       and cm.left_at is not null
  ),
  'relink removes only the old coach access to an unrelated booking'
);
select extensions.ok(
  exists (
    select 1
      from public.booking_participants bp
      join workflow_state ws on ws.second_booking_id = bp.booking_id
     where bp.user_id = '91000000-0000-0000-0000-000000000003'
       and bp.role = 'organizer'
       and bp.response_status = 'accepted'
  )
  and exists (
    select 1
      from public.conversation_members cm
      join public.conversations c on c.id = cm.conversation_id
      join workflow_state ws on ws.second_booking_id = c.booking_id
     where cm.user_id = '91000000-0000-0000-0000-000000000003'
       and cm.left_at is null
  ),
  'relink preserves the old account when it is independently the creator'
);
select extensions.ok(
  (
    select pg_catalog.count(*) = 2
      from public.booking_participants bp
      join workflow_state ws
        on bp.booking_id in (ws.main_booking_id, ws.second_booking_id)
     where bp.user_id = '91000000-0000-0000-0000-000000000004'
       and bp.response_status = 'accepted'
  )
  and (
    select pg_catalog.count(*) = 2
      from public.conversation_members cm
      join public.conversations c on c.id = cm.conversation_id
      join workflow_state ws
        on c.booking_id in (ws.main_booking_id, ws.second_booking_id)
     where cm.user_id = '91000000-0000-0000-0000-000000000004'
       and cm.left_at is null
  ),
  'relink backfills the new linked account without overwriting organizer rows'
);

select pg_temp.set_actor('91000000-0000-0000-0000-000000000005');
select extensions.is(
  private.is_booking_member((select main_booking_id from workflow_state)),
  false,
  'an unrelated organization trainer cannot read every organization booking'
);
select pg_temp.set_actor('91000000-0000-0000-0000-000000000006');
select extensions.is(
  private.is_booking_member((select main_booking_id from workflow_state)),
  false,
  'an organization viewer cannot read full booking data'
);
select pg_temp.set_actor('91000000-0000-0000-0000-000000000007');
select extensions.is(
  private.is_booking_member((select main_booking_id from workflow_state)),
  true,
  'reception has justified staff access to a booking'
);
select pg_temp.set_actor('91000000-0000-0000-0000-000000000001');
select extensions.is(
  private.is_booking_member((select main_booking_id from workflow_state)),
  true,
  'platform administrator has operational booking access'
);
select pg_temp.set_actor('91000000-0000-0000-0000-000000000004');
select extensions.is(
  private.is_booking_member((select main_booking_id from workflow_state)),
  true,
  'only the assigned linked trainer receives trainer booking access'
);

select pg_temp.set_actor('91000000-0000-0000-0000-000000000006');
set local role authenticated;
select extensions.is(
  (select pg_catalog.count(*) from public.profile_cards),
  1::bigint,
  'an unrelated authenticated user cannot enumerate profile cards'
);
reset role;

select pg_temp.set_actor('91000000-0000-0000-0000-000000000004');
set local role authenticated;
select extensions.is(
  (
    select pg_catalog.count(*)
      from public.profile_cards pc
     where pc.user_id = '91000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'shared booking and conversation context exposes the relevant profile card'
);
reset role;

-- Positive-price bookings may only transition between unpaid and paid.
select extensions.throws_ok(
  pg_catalog.format(
    'select public.set_booking_payment_status(%L::uuid,%L::uuid,%L,%L)',
    (select second_booking_id from workflow_state),
    '92000000-0000-0000-0000-000000000003',
    'not_required',
    'free override'
  ),
  'P0001', 'PAYMENT_STATUS_NOT_ALLOWED',
  'positive booking cannot be marked not_required through the public RPC'
);

select public.set_booking_payment_status(
  (select second_booking_id from workflow_state),
  '92000000-0000-0000-0000-000000000004',
  'paid',
  'paid outside application'
);
select pg_temp.set_actor('91000000-0000-0000-0000-000000000003');
update workflow_state ws
set moved_quote = public.quote_booking(
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  ws.second_court_id,
  '30000000-0000-0000-0000-000000000001',
  ws.moved_start,
  90,
  ws.second_booking_id
);
with response as materialized (
  select public.reschedule_booking_with_quote(
    (select second_booking_id from workflow_state),
    '92000000-0000-0000-0000-000000000098',
    (select moved_start from workflow_state),
    90,
    (select (moved_quote ->> 'total_minor')::bigint + 1 from workflow_state),
    (select moved_quote ->> 'currency' from workflow_state)
  ) as payload
)
insert into rpc_results (label, payload, response_status)
select 'reschedule_quote_changed', r.payload,
       pg_catalog.current_setting('response.status', true)
from response r;
select extensions.ok(
  exists (
    select 1 from rpc_results r
     where r.label = 'reschedule_quote_changed'
       and r.response_status = '409'
       and r.payload ->> 'code' = 'QUOTE_CHANGED'
       and r.payload ?& array['code', 'message', 'details', 'hint']
  ),
  'reschedule wrapper returns a standard 409 body for stale quote'
);
select extensions.ok(
  exists (
    select 1
      from public.bookings b
      join workflow_state ws on ws.second_booking_id = b.id
     where b.starts_at = ws.second_start
       and b.payment_status = 'paid'
  )
  and not exists (
    select 1 from private.idempotency_keys ik
     where ik.actor_id = '91000000-0000-0000-0000-000000000003'
       and ik.scope = 'reschedule_booking'
       and ik.key = '92000000-0000-0000-0000-000000000098'
  ),
  'QUOTE_CHANGED rolls back the reschedule, payment reset and idempotency claim'
);
select public.reschedule_booking_with_quote(
  (select second_booking_id from workflow_state),
  '92000000-0000-0000-0000-000000000005',
  (select moved_start from workflow_state),
  90,
  (select (moved_quote ->> 'total_minor')::bigint from workflow_state),
  (select moved_quote ->> 'currency' from workflow_state)
);

select extensions.is(
  (select b.payment_status from public.bookings b join workflow_state ws on ws.second_booking_id = b.id),
  'unpaid',
  'a price-changing reschedule resets paid to unpaid'
);
select extensions.is(
  (
    select pg_catalog.count(*)
      from public.booking_settlement_events bse
      join workflow_state ws on ws.second_booking_id = bse.booking_id
     where bse.from_status = 'paid'
       and bse.to_status = 'unpaid'
       and bse.idempotency_key = '92000000-0000-0000-0000-000000000005'
  ),
  1::bigint,
  'the paid reset is represented exactly once in the settlement ledger'
);

-- A venue-only alert creates a private one-person alert conversation.
insert into public.availability_alert_preferences (
  id, user_id, sport_id, venue_id, trainer_id, duration_minutes,
  lead_time, keep_all_in_chat, timezone, enabled,
  notify_push, notify_in_app
)
values (
  '93000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  null,
  60,
  'threeDays',
  true,
  'Europe/Warsaw',
  true,
  true,
  true
);
insert into public.availability_alert_windows (
  preference_id, weekday, starts_local, ends_local
)
select
  '93000000-0000-0000-0000-000000000001',
  extract(isodow from (ws.main_start at time zone 'Europe/Warsaw'))::smallint,
  (ws.main_start at time zone 'Europe/Warsaw')::time,
  (ws.main_start at time zone 'Europe/Warsaw')::time + interval '60 minutes'
from workflow_state ws;
update workflow_state set preference_id = '93000000-0000-0000-0000-000000000001';

select pg_temp.set_actor('91000000-0000-0000-0000-000000000002');
select public.cancel_booking(
  (select main_booking_id from workflow_state),
  '92000000-0000-0000-0000-000000000006',
  'test freed slot'
);

update workflow_state ws
set offer_id = (
  select ao.id
    from public.availability_offers ao
   where ao.preference_id = ws.preference_id
     and ao.starts_at = ws.main_start
   limit 1
);

select extensions.ok(
  exists (
    select 1
      from public.availability_offers ao
      join workflow_state ws on ws.offer_id = ao.id
     where ao.status = 'available'
       and ao.recipient_id = '91000000-0000-0000-0000-000000000008'
  )
  and exists (
    select 1
      from public.notifications n
      join workflow_state ws on ws.offer_id = n.related_entity_id
     where n.type = 'availability_offer.created'
       and n.recipient_id = '91000000-0000-0000-0000-000000000008'
  ),
  'cancelling a future booking synchronously creates an offer and notification'
);
select extensions.is(
  (
    select pg_catalog.count(*)
      from public.conversation_members cm
      join public.availability_offers ao on ao.conversation_id = cm.conversation_id
      join workflow_state ws on ws.offer_id = ao.id
     where cm.left_at is null
  ),
  1::bigint,
  'venue-only availability chat contains no unrelated client or trainer'
);

select pg_temp.set_actor('91000000-0000-0000-0000-000000000008');
update public.court_rates cr
   set amount_per_60_min_minor = cr.amount_per_60_min_minor + 1000
  from workflow_state ws
 where cr.court_id = ws.court_id;
with response as materialized (
  select public.reserve_availability_offer(
    (select offer_id from workflow_state),
    '92000000-0000-0000-0000-000000000097'
  ) as payload
)
insert into rpc_results (label, payload, response_status)
select 'offer_price_changed', r.payload,
       pg_catalog.current_setting('response.status', true)
from response r;
select extensions.ok(
  exists (
    select 1 from rpc_results r
     where r.label = 'offer_price_changed'
       and r.response_status = '409'
       and r.payload ->> 'code' = 'OFFER_PRICE_CHANGED'
       and r.payload ?& array['code', 'message', 'details', 'hint']
  ),
  'offer price drift returns a standard 409 PostgREST body'
);
select extensions.ok(
  exists (
    select 1
      from public.availability_offers ao
      join workflow_state ws on ws.offer_id = ao.id
     where ao.status = 'available'
       and ao.reserved_booking_id is null
  )
  and not exists (
    select 1 from public.bookings b
     where b.client_request_id = '92000000-0000-0000-0000-000000000097'
  ),
  'OFFER_PRICE_CHANGED rolls back both booking and offer mutations'
);
update public.court_rates cr
   set amount_per_60_min_minor = cr.amount_per_60_min_minor - 1000
  from workflow_state ws
 where cr.court_id = ws.court_id;
update workflow_state ws
set reserved_booking_id = (
  public.reserve_availability_offer(
    ws.offer_id,
    '92000000-0000-0000-0000-000000000007'
  ) ->> 'id'
)::uuid;
select extensions.ok(
  exists (
    select 1
      from public.availability_offers ao
      join workflow_state ws on ws.offer_id = ao.id
     where ao.status = 'reserved'
       and ao.reserved_booking_id = ws.reserved_booking_id
  ),
  'the offer can be atomically reserved into a booking'
);

-- Quota fixtures deliberately bypass the catalogue RPC, but still pass through
-- the database trigger used by every INSERT path.
create or replace function pg_temp.insert_quota_booking(p_day_offset integer)
returns void
language plpgsql
as $$
declare
  v_court_id uuid;
  v_starts_at timestamptz;
begin
  select ws.second_court_id into v_court_id from workflow_state ws;
  v_starts_at := date_trunc('day', pg_catalog.now())
    + pg_catalog.make_interval(days => 10 + p_day_offset, hours => 10);

  insert into public.bookings (
    id, creator_id, sport_id, venue_id, court_id, trainer_id,
    starts_at, ends_at, status, title, currency,
    subtotal_minor, discount_minor, total_minor, payment_status,
    source, client_request_id
  ) values (
    pg_catalog.md5('quota-booking:' || p_day_offset::text)::uuid,
    '91000000-0000-0000-0000-000000000009',
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    v_court_id,
    null,
    v_starts_at,
    v_starts_at + interval '60 minutes',
    'confirmed',
    'Quota fixture',
    'PLN',
    100,
    0,
    100,
    'unpaid',
    'web',
    pg_catalog.md5('quota-request:' || p_day_offset::text)::uuid
  );
end;
$$;

select pg_temp.set_actor('91000000-0000-0000-0000-000000000009');
select pg_temp.insert_quota_booking(i)
from pg_catalog.generate_series(1, 12) as g(i);
select extensions.is(
  (
    select pg_catalog.count(*)
      from public.bookings b
     where b.creator_id = '91000000-0000-0000-0000-000000000009'
       and b.status = 'confirmed'
       and b.payment_status = 'unpaid'
       and b.starts_at > pg_catalog.now()
  ),
  12::bigint,
  'the configured future unpaid quota allows twelve bookings'
);
select extensions.throws_ok(
  'select pg_temp.insert_quota_booking(13)',
  'P0001', 'FUTURE_UNPAID_BOOKING_LIMIT',
  'the thirteenth future unpaid booking is rejected'
);
select extensions.ok(
  pg_catalog.pg_get_functiondef(
    'private.assert_future_unpaid_booking_quota(uuid,uuid)'::regprocedure
  ) like '%pg_advisory_xact_lock%',
  'quota count and write are serialized by a transaction advisory lock'
);

insert into private.actor_rate_limits (
  actor_id, scope, window_started_at, request_count
)
values (
  '91000000-0000-0000-0000-000000000009',
  'quote_booking',
  pg_catalog.now(),
  60
)
on conflict (actor_id, scope) do update
set window_started_at = excluded.window_started_at,
    request_count = excluded.request_count;

with response as materialized (
  select public.quote_booking(
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    (select court_id from workflow_state),
    null,
    date_trunc('day', pg_catalog.now()) + interval '60 days 10 hours',
    60,
    null
  ) as payload
)
insert into rpc_results (label, payload, response_status)
select 'quote_rate_limited', r.payload,
       pg_catalog.current_setting('response.status', true)
from response r;
select extensions.ok(
  exists (
    select 1 from rpc_results r
     where r.label = 'quote_rate_limited'
       and r.response_status = '429'
       and r.payload ->> 'code' = 'RATE_LIMITED'
       and r.payload ?& array['code', 'message', 'details', 'hint']
  )
  and exists (
    select 1 from private.actor_rate_limits arl
     where arl.actor_id = '91000000-0000-0000-0000-000000000009'
       and arl.scope = 'quote_booking'
       and arl.request_count = 60
  ),
  'quote rate limit returns HTTP 429 without rolling back its durable window'
);

-- Two due rows exercise both terminal transitions and idempotent processing.
insert into public.bookings (
  id, creator_id, sport_id, venue_id, court_id, trainer_id,
  starts_at, ends_at, status, title, currency,
  subtotal_minor, discount_minor, total_minor, payment_status,
  source, client_request_id
)
select
  x.id,
  '91000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  x.court_id,
  x.trainer_id,
  date_trunc('day', pg_catalog.now()) - interval '2 days' + x.hour_offset,
  date_trunc('day', pg_catalog.now()) - interval '2 days' + x.hour_offset + interval '60 minutes',
  'confirmed',
  'Due fixture',
  'PLN',
  100,
  0,
  100,
  'unpaid',
  'import',
  x.request_id
from workflow_state ws
cross join lateral (values
  (
    '94000000-0000-0000-0000-000000000001'::uuid,
    ws.court_id,
    '30000000-0000-0000-0000-000000000001'::uuid,
    interval '10 hours',
    '94000000-0000-0000-0000-000000000011'::uuid
  ),
  (
    '94000000-0000-0000-0000-000000000002'::uuid,
    ws.second_court_id,
    null::uuid,
    interval '12 hours',
    '94000000-0000-0000-0000-000000000012'::uuid
  )
) as x(id, court_id, trainer_id, hour_offset, request_id);
update workflow_state
set due_completed_id = '94000000-0000-0000-0000-000000000001',
    due_no_show_id = '94000000-0000-0000-0000-000000000002';

select pg_temp.set_actor(null, 'service_role');
select extensions.is(
  public.process_due_bookings(
    '94000000-0000-0000-0000-000000000021',
    (select due_cutoff from workflow_state),
    array[(select due_no_show_id from workflow_state)],
    100
  ),
  2,
  'service processing transitions both due bookings'
);
select extensions.ok(
  exists (
    select 1 from public.bookings b join workflow_state ws on ws.due_completed_id = b.id
     where b.status = 'completed'
  )
  and exists (
    select 1 from public.bookings b join workflow_state ws on ws.due_no_show_id = b.id
     where b.status = 'no_show'
  ),
  'due processing distinguishes completed and explicit no_show'
);
select extensions.is(
  public.process_due_bookings(
    '94000000-0000-0000-0000-000000000021',
    (select due_cutoff from workflow_state),
    array[(select due_no_show_id from workflow_state)],
    100
  ),
  2,
  'process_due_bookings retry returns the original result'
);
select extensions.is(
  (
    select t.completed_bookings_count
      from public.trainers t
     where t.id = '30000000-0000-0000-0000-000000000001'
  ),
  (
    select pg_catalog.count(*)::integer
      from public.bookings b
     where b.trainer_id = '30000000-0000-0000-0000-000000000001'
       and b.status = 'completed'
  ),
  'due processing synchronizes the trainer completed booking count'
);

-- Deprovisioning revokes every durable capability behind an already issued JWT.
select pg_temp.set_actor('91000000-0000-0000-0000-000000000001');
select public.admin_link_trainer_account(
  '30000000-0000-0000-0000-000000000003',
  '91000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000001'
);
select pg_temp.set_actor('91000000-0000-0000-0000-000000000002');
update workflow_state ws
set blocked_coach_booking_id = (
  public.create_booking(
    '95000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    ws.court_id,
    '30000000-0000-0000-0000-000000000003',
    date_trunc('day', pg_catalog.now()) + interval '5 days 14 hours',
    60,
    '{}'::uuid[],
    'Former coach deprovision fixture',
    'web'
  )
).id;
insert into private.platform_role_assignments (user_id, role, assigned_by)
values (
  '91000000-0000-0000-0000-000000000010',
  'support',
  '91000000-0000-0000-0000-000000000001'
);
insert into public.conversation_members (conversation_id, user_id)
select c.id, '91000000-0000-0000-0000-000000000010'
  from public.conversations c
  join workflow_state ws on ws.second_booking_id = c.booking_id
on conflict (conversation_id, user_id) do update set left_at = null;
insert into public.device_installations (
  id, user_id, platform, push_provider, push_token
)
values (
  '95000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000010',
  'web',
  'web_push',
  'blocked-user-test-push-token'
);
insert into public.notifications (
  id, recipient_id, type, title, body
)
values (
  '95000000-0000-0000-0000-000000000003',
  '91000000-0000-0000-0000-000000000010',
  'security.fixture',
  'Security fixture',
  'Must be hidden after blocking.'
);
insert into public.availability_alert_preferences (
  id, user_id, sport_id, venue_id, duration_minutes,
  lead_time, timezone, enabled, notify_push, notify_in_app
)
values (
  '95000000-0000-0000-0000-000000000004',
  '91000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  60,
  'sevenDays',
  'Europe/Warsaw',
  true,
  true,
  true
);
insert into public.user_sports (
  user_id, sport_id, is_primary, skill_system, skill_code
)
values (
  '91000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  true,
  'self_reported',
  'intermediate'
);
insert into public.availability_alert_windows (
  id, preference_id, weekday, day_part, starts_local, ends_local
)
values (
  '95000000-0000-0000-0000-000000000007',
  '95000000-0000-0000-0000-000000000004',
  1,
  'morning',
  '06:00'::time,
  '12:00'::time
);
insert into public.availability_offers (
  id, preference_id, recipient_id, sport_id, venue_id, court_id,
  trainer_id, starts_at, ends_at, total_minor, currency,
  status, expires_at, created_by
)
select
  '95000000-0000-0000-0000-000000000005',
  '95000000-0000-0000-0000-000000000004',
  '91000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  ws.second_court_id,
  null,
  date_trunc('day', pg_catalog.now()) + interval '6 days 10 hours',
  date_trunc('day', pg_catalog.now()) + interval '6 days 11 hours',
  100,
  'PLN',
  'available',
  pg_catalog.now() + interval '24 hours',
  '91000000-0000-0000-0000-000000000001'
from workflow_state ws;

update public.profiles
   set status = 'blocked'
 where id = '91000000-0000-0000-0000-000000000010';

select extensions.ok(
  not exists (
    select 1 from public.organization_memberships om
     where om.user_id = '91000000-0000-0000-0000-000000000010'
       and om.status <> 'disabled'
  )
  and not exists (
    select 1 from private.platform_role_assignments pra
     where pra.user_id = '91000000-0000-0000-0000-000000000010'
       and pra.revoked_at is null
  )
  and not exists (
    select 1 from public.trainers t
     where t.user_id = '91000000-0000-0000-0000-000000000010'
  )
  and not exists (
    select 1 from public.conversation_members cm
     where cm.user_id = '91000000-0000-0000-0000-000000000010'
       and cm.left_at is null
  )
  and not exists (
    select 1 from public.device_installations di
     where di.user_id = '91000000-0000-0000-0000-000000000010'
       and di.disabled_at is null
  )
  and exists (
    select 1
      from public.booking_participants bp
      join workflow_state ws on ws.blocked_coach_booking_id = bp.booking_id
     where bp.user_id = '91000000-0000-0000-0000-000000000010'
       and bp.role = 'coach'
       and bp.response_status = 'removed'
  ),
  'deprovision disables capabilities and removes historical coach participation'
);

select pg_temp.set_actor('91000000-0000-0000-0000-000000000010');
select extensions.ok(
  not private.is_active_actor()
  and not private.is_platform_admin()
  and not private.is_org_member(
    '10000000-0000-0000-0000-000000000001', null
  )
  and not private.is_booking_member(
    (select second_booking_id from workflow_state)
  )
  and not private.is_conversation_member(
    (
      select c.id from public.conversations c
      join workflow_state ws on ws.second_booking_id = c.booking_id
    )
  ),
  'a blocked account with an already issued JWT fails every authorization helper'
);

set local role authenticated;
select extensions.is(
  (
    select
      (select pg_catalog.count(*) from public.profiles)
      + (select pg_catalog.count(*) from public.profile_cards)
      + (select pg_catalog.count(*) from public.user_sports)
      + (select pg_catalog.count(*) from public.notification_preferences)
      + (select pg_catalog.count(*) from public.device_installations)
      + (select pg_catalog.count(*) from public.notifications)
      + (select pg_catalog.count(*) from public.organization_memberships)
      + (select pg_catalog.count(*) from public.availability_alert_preferences)
      + (select pg_catalog.count(*) from public.availability_alert_windows)
      + (select pg_catalog.count(*) from public.availability_offers)
  ),
  0::bigint,
  'blocked JWT cannot read any private own Data API row'
);
select extensions.is(
  pg_temp.blocked_private_update_count(),
  0,
  'blocked JWT cannot update preference, notification or offer rows'
);
select extensions.throws_ok(
  $$insert into public.device_installations (
      id, user_id, platform, push_provider, push_token
    ) values (
      '95000000-0000-0000-0000-000000000006'::uuid,
      '91000000-0000-0000-0000-000000000010'::uuid,
      'web', 'web_push', 'blocked-second-device-token'
    )$$,
  '42501',
  'new row violates row-level security policy for table "device_installations"',
  'blocked JWT cannot insert a device installation'
);
reset role;

select extensions.throws_ok(
  pg_catalog.format(
    'select public.cancel_booking(%L::uuid,%L::uuid,%L)',
    (select second_booking_id from workflow_state),
    '95000000-0000-0000-0000-000000000002',
    'blocked JWT'
  ),
  'P0001', 'FORBIDDEN',
  'a blocked JWT cannot mutate a booking'
);

update public.profiles
   set status = 'active'
 where id = '91000000-0000-0000-0000-000000000010';
select pg_temp.set_actor('91000000-0000-0000-0000-000000000010');
select extensions.ok(
  not private.is_booking_member(
    (select blocked_coach_booking_id from workflow_state)
  )
  and exists (
    select 1
      from public.booking_participants bp
      join workflow_state ws on ws.blocked_coach_booking_id = bp.booking_id
     where bp.user_id = '91000000-0000-0000-0000-000000000010'
       and bp.role = 'coach'
       and bp.response_status = 'removed'
  ),
  'profile reactivation alone does not restore historical coach access'
);
update public.profiles
   set status = 'blocked'
 where id = '91000000-0000-0000-0000-000000000010';

select pg_temp.set_actor('91000000-0000-0000-0000-000000000001');
select extensions.throws_ok(
  $$select public.admin_set_organization_membership(
      '10000000-0000-0000-0000-000000000001'::uuid,
      '91000000-0000-0000-0000-000000000010'::uuid,
      'viewer',
      'active'
    )$$,
  'P0001', 'PROFILE_NOT_ACTIVE',
  'administrators cannot reactivate a membership for an inactive target'
);

select extensions.ok(
  (
    select pg_catalog.count(*)
      from public.notifications n
     where n.related_entity_type = 'booking'
       and n.type in (
         'booking.created', 'booking.rescheduled', 'booking.cancelled',
         'booking.payment_status_changed'
       )
  ) > 0
  and exists (
    select 1
      from private.outbox_events oe
     where oe.event_type in ('booking.created', 'notification.push', 'availability_offer.push')
  ),
  'booking workflows commit in-app events while retaining push outbox delivery'
);

select * from extensions.finish();
rollback;
