-- Atomic booking lifecycle. All prices and authorization decisions are server-side.

create or replace function public.create_booking(
  p_idempotency_key uuid,
  p_sport_id uuid,
  p_venue_id uuid,
  p_court_id uuid,
  p_trainer_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_participant_user_ids uuid[] default '{}'::uuid[],
  p_title text default null,
  p_source text default 'web'
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_ends_at timestamptz;
  v_hash text;
  v_is_new boolean;
  v_existing_id uuid;
  v_booking public.bookings%rowtype;
  v_price record;
  v_title text;
  v_conversation_id uuid;
  v_system_message_id uuid;
  v_sport_name text;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = v_actor and p.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_ACTIVE';
  end if;
  if p_duration_minutes is null
     or p_duration_minutes < 30
     or p_duration_minutes > 360
     or p_duration_minutes % 15 <> 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_DURATION';
  end if;
  if p_starts_at < pg_catalog.now() - interval '5 minutes'
     or p_starts_at > pg_catalog.now() + interval '366 days' then
    raise exception using errcode = 'P0001', message = 'INVALID_START_TIME';
  end if;
  if p_source not in ('mobile', 'web') then
    raise exception using errcode = 'P0001', message = 'INVALID_SOURCE';
  end if;
  -- Participant invitations need an explicit accept/decline workflow. Until that
  -- RPC exists, accepting arbitrary profile UUIDs here would allow chat spam.
  if pg_catalog.cardinality(coalesce(p_participant_user_ids, '{}'::uuid[])) > 0 then
    raise exception using errcode = 'P0001', message = 'PARTICIPANT_INVITES_NOT_AVAILABLE';
  end if;

  v_ends_at := p_starts_at + pg_catalog.make_interval(mins => p_duration_minutes);
  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'sport_id', p_sport_id,
    'venue_id', p_venue_id,
    'court_id', p_court_id,
    'trainer_id', p_trainer_id,
    'starts_at', p_starts_at,
    'duration_minutes', p_duration_minutes,
    'participant_user_ids', coalesce(p_participant_user_ids, '{}'::uuid[]),
    'title', p_title,
    'source', p_source
  )::text);

  select c.is_new, c.resource_id
    into v_is_new, v_existing_id
    from private.claim_idempotency(v_actor, 'create_booking', p_idempotency_key, v_hash) c;

  if not v_is_new then
    select b.* into v_booking from public.bookings b where b.id = v_existing_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_RESULT_MISSING';
    end if;
    return v_booking;
  end if;

  perform private.assert_booking_availability(
    p_sport_id, p_venue_id, p_court_id, p_trainer_id, p_starts_at, v_ends_at
  );

  select * into v_price
    from private.calculate_booking_price(
      p_sport_id, p_venue_id, p_court_id, p_trainer_id, p_starts_at, v_ends_at
    );

  select s.name_pl into v_sport_name from public.sports s where s.id = p_sport_id and s.active;
  if v_sport_name is null then
    raise exception using errcode = 'P0001', message = 'SPORT_NOT_FOUND';
  end if;
  v_title := coalesce(
    nullif(pg_catalog.btrim(p_title), ''),
    'Trening: ' || v_sport_name
  );
  if char_length(v_title) > 120 then
    raise exception using errcode = 'P0001', message = 'INVALID_TITLE';
  end if;

  insert into public.bookings (
    creator_id, sport_id, venue_id, court_id, trainer_id,
    starts_at, ends_at, status, title, currency,
    subtotal_minor, discount_minor, total_minor, payment_status,
    source, client_request_id
  ) values (
    v_actor, p_sport_id, p_venue_id, p_court_id, p_trainer_id,
    p_starts_at, v_ends_at, 'confirmed', v_title, v_price.currency,
    v_price.subtotal_minor, 0, v_price.subtotal_minor,
    case when v_price.subtotal_minor = 0 then 'not_required' else 'unpaid' end,
    p_source, p_idempotency_key
  )
  returning * into v_booking;

  insert into public.booking_price_lines (
    booking_id, kind, label, quantity, unit_amount_minor,
    total_amount_minor, source_rate_id, position
  )
  select
    v_booking.id,
    'court',
    'Kort',
    p_duration_minutes::numeric / 60,
    cr.amount_per_60_min_minor,
    v_price.court_amount_minor,
    v_price.court_rate_id,
    0
  from public.court_rates cr
  where cr.id = v_price.court_rate_id;

  if p_trainer_id is not null then
    insert into public.booking_price_lines (
      booking_id, kind, label, quantity, unit_amount_minor,
      total_amount_minor, source_rate_id, position
    )
    select
      v_booking.id,
      'trainer',
      'Trener',
      p_duration_minutes::numeric / 60,
      tr.amount_per_60_min_minor,
      v_price.trainer_amount_minor,
      v_price.trainer_rate_id,
      1
    from public.trainer_rates tr
    where tr.id = v_price.trainer_rate_id;
  end if;

  insert into public.booking_participants (
    booking_id, user_id, display_name_snapshot, role, response_status, responded_at
  )
  select v_booking.id, p.id, p.display_name, 'organizer', 'accepted', pg_catalog.now()
    from public.profiles p
   where p.id = v_actor;

  insert into public.booking_participants (
    booking_id, user_id, display_name_snapshot, role, response_status
  )
  select distinct v_booking.id, p.id, p.display_name, 'player', 'pending'
    from public.profiles p
   where p.id = any(coalesce(p_participant_user_ids, '{}'::uuid[]))
     and p.id <> v_actor
  on conflict (booking_id, user_id) where user_id is not null do nothing;

  insert into public.booking_participants (
    booking_id, user_id, display_name_snapshot, role, response_status, responded_at
  )
  select v_booking.id, t.user_id, t.display_name, 'coach', 'accepted', pg_catalog.now()
    from public.trainers t
   where t.id = p_trainer_id
     and t.user_id is not null
     and t.user_id <> v_actor
  on conflict (booking_id, user_id) where user_id is not null do update
    set role = 'coach', response_status = 'accepted', responded_at = excluded.responded_at;

  insert into public.booking_status_history (
    booking_id, from_status, to_status, actor_id, reason
  ) values (
    v_booking.id, null, 'confirmed', v_actor, 'booking_created'
  );

  insert into public.booking_settlement_events (
    booking_id, from_status, to_status, actor_id, note, idempotency_key
  ) values (
    v_booking.id, null, v_booking.payment_status, v_actor, 'initial_status', p_idempotency_key
  );

  insert into public.conversations (kind, booking_id, title, created_by, last_message_at)
  values ('booking', v_booking.id, v_title, v_actor, pg_catalog.now())
  returning id into v_conversation_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  select distinct v_conversation_id, bp.user_id,
         case when bp.role in ('organizer', 'coach') then 'moderator' else 'member' end
    from public.booking_participants bp
   where bp.booking_id = v_booking.id
     and bp.user_id is not null;

  insert into public.messages (
    conversation_id, sender_id, client_message_id, kind, body, related_booking_id
  ) values (
    v_conversation_id, null, null, 'system', 'Utworzono trening.', v_booking.id
  ) returning id into v_system_message_id;

  update public.conversations c
     set last_message_at = pg_catalog.now()
   where c.id = v_conversation_id;

  insert into private.outbox_events (
    event_type, aggregate_type, aggregate_id, payload, idempotency_key
  ) values (
    'booking.created',
    'booking',
    v_booking.id,
    pg_catalog.jsonb_build_object('booking_id', v_booking.id),
    p_idempotency_key
  );

  perform private.finish_idempotency(v_actor, 'create_booking', p_idempotency_key, v_booking.id);
  return v_booking;
exception
  when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'SLOT_TAKEN';
end;
$$;

create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_idempotency_key uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.bookings%rowtype;
  v_booking public.bookings%rowtype;
  v_ends_at timestamptz;
  v_price record;
  v_hash text;
  v_is_new boolean;
  v_existing_id uuid;
  v_conversation_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_duration_minutes is null
     or p_duration_minutes < 30
     or p_duration_minutes > 360
     or p_duration_minutes % 15 <> 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_DURATION';
  end if;
  if p_starts_at < pg_catalog.now() - interval '5 minutes'
     or p_starts_at > pg_catalog.now() + interval '366 days' then
    raise exception using errcode = 'P0001', message = 'INVALID_START_TIME';
  end if;

  select b.* into v_old
    from public.bookings b
   where b.id = p_booking_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;
  if not private.can_manage_booking(p_booking_id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  v_ends_at := p_starts_at + pg_catalog.make_interval(mins => p_duration_minutes);
  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'booking_id', p_booking_id,
    'starts_at', p_starts_at,
    'duration_minutes', p_duration_minutes
  )::text);
  select c.is_new, c.resource_id
    into v_is_new, v_existing_id
    from private.claim_idempotency(v_actor, 'reschedule_booking', p_idempotency_key, v_hash) c;
  if not v_is_new then
    select b.* into v_booking from public.bookings b where b.id = v_existing_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_RESULT_MISSING';
    end if;
    return v_booking;
  end if;

  if v_old.status <> 'confirmed' then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_RESCHEDULABLE';
  end if;

  perform private.assert_booking_availability(
    v_old.sport_id, v_old.venue_id, v_old.court_id, v_old.trainer_id,
    p_starts_at, v_ends_at
  );
  select * into v_price
    from private.calculate_booking_price(
      v_old.sport_id, v_old.venue_id, v_old.court_id, v_old.trainer_id,
      p_starts_at, v_ends_at
    );

  update public.bookings b
     set starts_at = p_starts_at,
         ends_at = v_ends_at,
         currency = v_price.currency,
         subtotal_minor = v_price.subtotal_minor,
         discount_minor = 0,
         total_minor = v_price.subtotal_minor,
         payment_status = case
           when v_price.subtotal_minor = 0 then 'not_required'
           when v_old.total_minor is distinct from v_price.subtotal_minor
             or v_old.currency is distinct from v_price.currency
             then 'unpaid'
           when b.payment_status = 'not_required' then 'unpaid'
           else b.payment_status
         end
   where b.id = p_booking_id
  returning b.* into v_booking;

  delete from public.booking_price_lines bpl where bpl.booking_id = p_booking_id;
  insert into public.booking_price_lines (
    booking_id, kind, label, quantity, unit_amount_minor,
    total_amount_minor, source_rate_id, position
  )
  select p_booking_id, 'court', 'Kort', p_duration_minutes::numeric / 60,
         cr.amount_per_60_min_minor, v_price.court_amount_minor,
         v_price.court_rate_id, 0
    from public.court_rates cr
   where cr.id = v_price.court_rate_id;

  if v_old.trainer_id is not null then
    insert into public.booking_price_lines (
      booking_id, kind, label, quantity, unit_amount_minor,
      total_amount_minor, source_rate_id, position
    )
    select p_booking_id, 'trainer', 'Trener', p_duration_minutes::numeric / 60,
           tr.amount_per_60_min_minor, v_price.trainer_amount_minor,
           v_price.trainer_rate_id, 1
      from public.trainer_rates tr
     where tr.id = v_price.trainer_rate_id;
  end if;

  if v_old.payment_status is distinct from v_booking.payment_status then
    insert into public.booking_settlement_events (
      booking_id, from_status, to_status, actor_id, note, idempotency_key
    ) values (
      p_booking_id,
      v_old.payment_status,
      v_booking.payment_status,
      v_actor,
      'Status rozliczenia zresetowany po zmianie terminu lub ceny.',
      p_idempotency_key
    );

    insert into private.audit_events (
      actor_id, action, entity_type, entity_id, request_id, metadata
    ) values (
      v_actor,
      'booking.payment_status_reset_after_reschedule',
      'booking',
      p_booking_id,
      p_idempotency_key,
      pg_catalog.jsonb_build_object(
        'from_status', v_old.payment_status,
        'to_status', v_booking.payment_status,
        'old_total_minor', v_old.total_minor,
        'new_total_minor', v_booking.total_minor,
        'old_currency', v_old.currency,
        'new_currency', v_booking.currency
      )
    );
  end if;

  insert into public.booking_status_history (
    booking_id, from_status, to_status, actor_id, reason, metadata
  ) values (
    p_booking_id,
    v_old.status,
    v_old.status,
    v_actor,
    'booking_rescheduled',
    pg_catalog.jsonb_build_object(
      'old_starts_at', v_old.starts_at,
      'old_ends_at', v_old.ends_at,
      'new_starts_at', p_starts_at,
      'new_ends_at', v_ends_at,
      'old_total_minor', v_old.total_minor,
      'new_total_minor', v_booking.total_minor
    )
  );

  select c.id into v_conversation_id
    from public.conversations c
   where c.booking_id = p_booking_id and c.kind = 'booking';
  if v_conversation_id is not null then
    insert into public.messages (
      conversation_id, sender_id, kind, body, related_booking_id
    ) values (
      v_conversation_id, null, 'system', 'Termin treningu został zmieniony.', p_booking_id
    );
    update public.conversations c
       set last_message_at = pg_catalog.now()
     where c.id = v_conversation_id;
  end if;

  insert into private.outbox_events (
    event_type, aggregate_type, aggregate_id, payload, idempotency_key
  ) values (
    'booking.rescheduled', 'booking', p_booking_id,
    pg_catalog.jsonb_build_object('booking_id', p_booking_id),
    p_idempotency_key
  );

  perform private.finish_idempotency(v_actor, 'reschedule_booking', p_idempotency_key, p_booking_id);
  return v_booking;
exception
  when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'SLOT_TAKEN';
end;
$$;

create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_idempotency_key uuid,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.bookings%rowtype;
  v_booking public.bookings%rowtype;
  v_hash text;
  v_is_new boolean;
  v_existing_id uuid;
  v_new_status text;
  v_organization_id uuid;
  v_conversation_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_reason is not null and char_length(p_reason) > 500 then
    raise exception using errcode = 'P0001', message = 'INVALID_CANCELLATION_REASON';
  end if;

  select b.*
    into v_old
    from public.bookings b
   where b.id = p_booking_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;
  select v.organization_id into v_organization_id
    from public.venues v
   where v.id = v_old.venue_id;
  if not private.can_manage_booking(p_booking_id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'booking_id', p_booking_id, 'reason', p_reason
  )::text);
  select c.is_new, c.resource_id
    into v_is_new, v_existing_id
    from private.claim_idempotency(v_actor, 'cancel_booking', p_idempotency_key, v_hash) c;
  if not v_is_new then
    select b.* into v_booking from public.bookings b where b.id = v_existing_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_RESULT_MISSING';
    end if;
    return v_booking;
  end if;

  if v_old.status in ('cancelled_by_customer', 'cancelled_by_provider') then
    perform private.finish_idempotency(v_actor, 'cancel_booking', p_idempotency_key, p_booking_id);
    return v_old;
  end if;
  if v_old.status <> 'confirmed' then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_CANCELLABLE';
  end if;

  v_new_status := case
    when private.is_linked_trainer(v_old.trainer_id)
      or private.is_org_member(v_organization_id, array['owner', 'manager', 'reception'])
    then 'cancelled_by_provider'
    else 'cancelled_by_customer'
  end;

  update public.bookings b
     set status = v_new_status,
         cancelled_at = pg_catalog.now(),
         cancelled_by = v_actor,
         cancellation_reason = nullif(pg_catalog.btrim(p_reason), '')
   where b.id = p_booking_id
  returning b.* into v_booking;

  insert into public.booking_status_history (
    booking_id, from_status, to_status, actor_id, reason
  ) values (
    p_booking_id, v_old.status, v_new_status, v_actor,
    nullif(pg_catalog.btrim(p_reason), '')
  );

  select c.id into v_conversation_id
    from public.conversations c
   where c.booking_id = p_booking_id and c.kind = 'booking';
  if v_conversation_id is not null then
    insert into public.messages (
      conversation_id, sender_id, kind, body, related_booking_id
    ) values (
      v_conversation_id, null, 'system', 'Trening został anulowany.', p_booking_id
    );
    update public.conversations c
       set last_message_at = pg_catalog.now()
     where c.id = v_conversation_id;
  end if;

  insert into private.outbox_events (
    event_type, aggregate_type, aggregate_id, payload, idempotency_key
  ) values (
    'booking.cancelled', 'booking', p_booking_id,
    pg_catalog.jsonb_build_object('booking_id', p_booking_id, 'status', v_new_status),
    p_idempotency_key
  );

  perform private.finish_idempotency(v_actor, 'cancel_booking', p_idempotency_key, p_booking_id);
  return v_booking;
end;
$$;

create or replace function public.set_booking_payment_status(
  p_booking_id uuid,
  p_idempotency_key uuid,
  p_payment_status text,
  p_note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.bookings%rowtype;
  v_booking public.bookings%rowtype;
  v_hash text;
  v_is_new boolean;
  v_existing_id uuid;
  v_organization_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_payment_status not in ('unpaid', 'paid', 'not_required') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_STATUS';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception using errcode = 'P0001', message = 'INVALID_SETTLEMENT_NOTE';
  end if;

  select b.*
    into v_old
    from public.bookings b
   where b.id = p_booking_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;
  select v.organization_id into v_organization_id
    from public.venues v
   where v.id = v_old.venue_id;
  if not private.can_set_booking_payment_status(p_booking_id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'booking_id', p_booking_id,
    'payment_status', p_payment_status,
    'note', p_note
  )::text);
  select c.is_new, c.resource_id
    into v_is_new, v_existing_id
    from private.claim_idempotency(v_actor, 'set_booking_payment_status', p_idempotency_key, v_hash) c;
  if not v_is_new then
    select b.* into v_booking from public.bookings b where b.id = v_existing_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_RESULT_MISSING';
    end if;
    return v_booking;
  end if;

  if v_old.payment_status = p_payment_status then
    perform private.finish_idempotency(
      v_actor, 'set_booking_payment_status', p_idempotency_key, p_booking_id
    );
    return v_old;
  end if;

  update public.bookings b
     set payment_status = p_payment_status
   where b.id = p_booking_id
  returning b.* into v_booking;

  insert into public.booking_settlement_events (
    booking_id, from_status, to_status, actor_id, note, idempotency_key
  ) values (
    p_booking_id, v_old.payment_status, p_payment_status, v_actor,
    nullif(pg_catalog.btrim(p_note), ''), p_idempotency_key
  );

  insert into private.audit_events (
    actor_id, organization_id, action, entity_type, entity_id, request_id, metadata
  ) values (
    v_actor, v_organization_id, 'booking.payment_status_changed', 'booking', p_booking_id,
    p_idempotency_key,
    pg_catalog.jsonb_build_object(
      'from_status', v_old.payment_status,
      'to_status', p_payment_status
    )
  );

  insert into private.outbox_events (
    event_type, aggregate_type, aggregate_id, payload, idempotency_key
  ) values (
    'booking.payment_status_changed', 'booking', p_booking_id,
    pg_catalog.jsonb_build_object('booking_id', p_booking_id, 'payment_status', p_payment_status),
    p_idempotency_key
  );

  perform private.finish_idempotency(
    v_actor, 'set_booking_payment_status', p_idempotency_key, p_booking_id
  );
  return v_booking;
end;
$$;

create or replace function public.save_booking_note(
  p_booking_id uuid,
  p_body text,
  p_visibility text default 'private'
)
returns public.booking_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_note public.booking_notes%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not private.is_booking_member(p_booking_id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_body is null or char_length(p_body) > 5000 then
    raise exception using errcode = 'P0001', message = 'INVALID_NOTE';
  end if;
  if p_visibility not in ('private', 'participants', 'coaches') then
    raise exception using errcode = 'P0001', message = 'INVALID_NOTE_VISIBILITY';
  end if;

  insert into public.booking_notes (booking_id, author_id, visibility, body)
  values (p_booking_id, v_actor, p_visibility, p_body)
  on conflict (booking_id, author_id) where author_id is not null do update
    set visibility = excluded.visibility,
        body = excluded.body,
        edited_at = pg_catalog.now()
  returning * into v_note;

  return v_note;
end;
$$;

revoke all on function public.create_booking(uuid, uuid, uuid, uuid, uuid, timestamptz, integer, uuid[], text, text) from public, anon;
revoke all on function public.reschedule_booking(uuid, uuid, timestamptz, integer) from public, anon;
revoke all on function public.cancel_booking(uuid, uuid, text) from public, anon;
revoke all on function public.set_booking_payment_status(uuid, uuid, text, text) from public, anon;
revoke all on function public.save_booking_note(uuid, text, text) from public, anon;
