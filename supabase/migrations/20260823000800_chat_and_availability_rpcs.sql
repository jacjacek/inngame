-- Idempotent chat delivery/read cursors and user availability alerts.

create or replace function public.send_message(
  p_conversation_id uuid,
  p_client_message_id uuid,
  p_body text,
  p_reply_to_message_id uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_message public.messages%rowtype;
  v_sender_name text;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_client_message_id is null then
    raise exception using errcode = 'P0001', message = 'CLIENT_MESSAGE_ID_REQUIRED';
  end if;
  if p_body is null or char_length(pg_catalog.btrim(p_body)) not between 1 and 4000 then
    raise exception using errcode = 'P0001', message = 'INVALID_MESSAGE';
  end if;

  select m.* into v_message
    from public.messages m
   where m.sender_id = v_actor
     and m.client_message_id = p_client_message_id;
  if found then
    if v_message.conversation_id <> p_conversation_id
       or v_message.body is distinct from pg_catalog.btrim(p_body)
       or v_message.reply_to_message_id is distinct from p_reply_to_message_id then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_message;
  end if;

  if not private.is_conversation_member(p_conversation_id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_reply_to_message_id is not null and not exists (
    select 1
      from public.messages m
     where m.id = p_reply_to_message_id
       and m.conversation_id = p_conversation_id
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_REPLY_TARGET';
  end if;

  insert into public.messages (
    conversation_id, sender_id, client_message_id, kind, body, reply_to_message_id
  ) values (
    p_conversation_id, v_actor, p_client_message_id, 'text',
    pg_catalog.btrim(p_body), p_reply_to_message_id
  )
  on conflict (sender_id, client_message_id)
    where sender_id is not null and client_message_id is not null
    do nothing
  returning * into v_message;

  if not found then
    select m.* into v_message
      from public.messages m
     where m.sender_id = v_actor
       and m.client_message_id = p_client_message_id;
    if v_message.conversation_id <> p_conversation_id
       or v_message.body is distinct from pg_catalog.btrim(p_body)
       or v_message.reply_to_message_id is distinct from p_reply_to_message_id then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_message;
  end if;

  update public.conversations c
     set last_message_at = v_message.created_at
   where c.id = p_conversation_id;

  select pc.display_name into v_sender_name
    from public.profile_cards pc
   where pc.user_id = v_actor;

  insert into public.notifications (
    recipient_id, type, title, body, data, related_entity_type, related_entity_id
  )
  select
    cm.user_id,
    'chat.message',
    coalesce(v_sender_name, 'Nowa wiadomość'),
    'Masz nową wiadomość.',
    pg_catalog.jsonb_build_object(
      'conversation_id', p_conversation_id,
      'message_id', v_message.id
    ),
    'conversation',
    p_conversation_id
  from public.conversation_members cm
  join public.notification_preferences np on np.user_id = cm.user_id
  where cm.conversation_id = p_conversation_id
    and cm.left_at is null
    and cm.user_id <> v_actor
    and np.chat_messages;

  insert into private.outbox_events (
    event_type, aggregate_type, aggregate_id, payload, idempotency_key
  ) values (
    'message.created', 'message', v_message.id,
    pg_catalog.jsonb_build_object(
      'message_id', v_message.id,
      'conversation_id', p_conversation_id
    ),
    p_client_message_id
  );

  return v_message;
end;
$$;

create or replace function public.mark_conversation_read(
  p_conversation_id uuid,
  p_message_id uuid
)
returns public.conversation_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_membership public.conversation_members%rowtype;
  v_target_created_at timestamptz;
  v_current_created_at timestamptz;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select cm.* into v_membership
    from public.conversation_members cm
   where cm.conversation_id = p_conversation_id
     and cm.user_id = v_actor
     and cm.left_at is null
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  select m.created_at into v_target_created_at
    from public.messages m
   where m.id = p_message_id
     and m.conversation_id = p_conversation_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'MESSAGE_NOT_IN_CONVERSATION';
  end if;

  if v_membership.last_read_message_id is not null then
    select m.created_at into v_current_created_at
      from public.messages m
     where m.id = v_membership.last_read_message_id;
  end if;

  if v_membership.last_read_message_id is null
     or v_current_created_at < v_target_created_at
     or (
       v_current_created_at = v_target_created_at
       and v_membership.last_read_message_id < p_message_id
     ) then
    update public.conversation_members cm
       set last_read_message_id = p_message_id,
           last_read_at = v_target_created_at
     where cm.conversation_id = p_conversation_id
       and cm.user_id = v_actor
    returning cm.* into v_membership;
  end if;

  return v_membership;
end;
$$;

create or replace function public.save_availability_alert(
  p_idempotency_key uuid,
  p_sport_id uuid,
  p_duration_minutes integer,
  p_windows jsonb,
  p_preference_id uuid default null,
  p_venue_id uuid default null,
  p_trainer_id uuid default null,
  p_enabled boolean default true,
  p_lead_time text default 'threeDays',
  p_keep_all_in_chat boolean default true,
  p_timezone text default 'Europe/Warsaw',
  p_notify_push boolean default true,
  p_notify_in_app boolean default true,
  p_valid_from date default current_date,
  p_valid_until date default null
)
returns public.availability_alert_preferences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_hash text;
  v_is_new boolean;
  v_existing_id uuid;
  v_preference public.availability_alert_preferences%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_actor and p.status = 'active') then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_ACTIVE';
  end if;
  if not exists (select 1 from public.sports s where s.id = p_sport_id and s.active) then
    raise exception using errcode = 'P0001', message = 'SPORT_NOT_FOUND';
  end if;
  if p_venue_id is null and p_trainer_id is null then
    raise exception using errcode = 'P0001', message = 'AVAILABILITY_TARGET_REQUIRED';
  end if;
  if p_venue_id is not null and not exists (
    select 1 from public.venues v where v.id = p_venue_id and v.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'VENUE_NOT_FOUND';
  end if;
  if p_trainer_id is not null and not exists (
    select 1
      from public.trainers t
      join public.trainer_sports ts on ts.trainer_id = t.id and ts.sport_id = p_sport_id
     where t.id = p_trainer_id
       and t.status = 'active'
       and (
         p_venue_id is null
         or exists (
           select 1 from public.trainer_venues tv
            where tv.trainer_id = t.id and tv.venue_id = p_venue_id and tv.active
         )
       )
  ) then
    raise exception using errcode = 'P0001', message = 'TRAINER_NOT_FOUND';
  end if;
  if p_duration_minutes < 30 or p_duration_minutes > 360 or p_duration_minutes % 15 <> 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_DURATION';
  end if;
  if p_lead_time not in ('today', 'threeDays', 'sevenDays') then
    raise exception using errcode = 'P0001', message = 'INVALID_LEAD_TIME';
  end if;
  if not (p_notify_push or p_notify_in_app) then
    raise exception using errcode = 'P0001', message = 'NOTIFICATION_CHANNEL_REQUIRED';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names tz where tz.name = p_timezone) then
    raise exception using errcode = 'P0001', message = 'INVALID_TIMEZONE';
  end if;
  if p_valid_until is not null and p_valid_until < p_valid_from then
    raise exception using errcode = 'P0001', message = 'INVALID_VALIDITY_RANGE';
  end if;
  if p_windows is null
     or pg_catalog.jsonb_typeof(p_windows) <> 'array'
     or pg_catalog.jsonb_array_length(p_windows) > 21 then
    raise exception using errcode = 'P0001', message = 'INVALID_AVAILABILITY_WINDOWS';
  end if;
  if exists (
    select 1
      from pg_catalog.jsonb_array_elements(p_windows) w(value)
     where pg_catalog.jsonb_typeof(w.value) <> 'object'
        or nullif(w.value ->> 'weekday', '') is null
        or (w.value ->> 'weekday')::integer not between 1 and 7
        or not (
          (w.value ->> 'day_part') in ('morning', 'day', 'evening')
          or (
            nullif(w.value ->> 'starts_local', '') is not null
            and nullif(w.value ->> 'ends_local', '') is not null
            and (w.value ->> 'starts_local')::time < (w.value ->> 'ends_local')::time
          )
        )
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_AVAILABILITY_WINDOWS';
  end if;

  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'sport_id', p_sport_id,
    'duration_minutes', p_duration_minutes,
    'windows', p_windows,
    'preference_id', p_preference_id,
    'venue_id', p_venue_id,
    'trainer_id', p_trainer_id,
    'enabled', p_enabled,
    'lead_time', p_lead_time,
    'keep_all_in_chat', p_keep_all_in_chat,
    'timezone', p_timezone,
    'notify_push', p_notify_push,
    'notify_in_app', p_notify_in_app,
    'valid_from', p_valid_from,
    'valid_until', p_valid_until
  )::text);
  select c.is_new, c.resource_id
    into v_is_new, v_existing_id
    from private.claim_idempotency(v_actor, 'save_availability_alert', p_idempotency_key, v_hash) c;
  if not v_is_new then
    select aap.* into v_preference
      from public.availability_alert_preferences aap
     where aap.id = v_existing_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_RESULT_MISSING';
    end if;
    return v_preference;
  end if;

  if p_preference_id is not null then
    select aap.* into v_preference
      from public.availability_alert_preferences aap
     where aap.id = p_preference_id
       and aap.user_id = v_actor
     for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'AVAILABILITY_PREFERENCE_NOT_FOUND';
    end if;

    update public.availability_alert_preferences aap
       set sport_id = p_sport_id,
           venue_id = p_venue_id,
           trainer_id = p_trainer_id,
           duration_minutes = p_duration_minutes,
           lead_time = p_lead_time,
           keep_all_in_chat = p_keep_all_in_chat,
           timezone = p_timezone,
           enabled = p_enabled,
           notify_push = p_notify_push,
           notify_in_app = p_notify_in_app,
           valid_from = p_valid_from,
           valid_until = p_valid_until
     where aap.id = p_preference_id
    returning aap.* into v_preference;
  else
    select aap.* into v_preference
      from public.availability_alert_preferences aap
     where aap.user_id = v_actor
       and aap.sport_id = p_sport_id
       and aap.venue_id is not distinct from p_venue_id
       and aap.trainer_id is not distinct from p_trainer_id
       and aap.duration_minutes = p_duration_minutes
     for update;

    if found then
      update public.availability_alert_preferences aap
         set timezone = p_timezone,
             lead_time = p_lead_time,
             keep_all_in_chat = p_keep_all_in_chat,
             enabled = p_enabled,
             notify_push = p_notify_push,
             notify_in_app = p_notify_in_app,
             valid_from = p_valid_from,
             valid_until = p_valid_until
       where aap.id = v_preference.id
      returning aap.* into v_preference;
    else
      insert into public.availability_alert_preferences (
        user_id, sport_id, venue_id, trainer_id, duration_minutes, lead_time, keep_all_in_chat,
        timezone, enabled, notify_push, notify_in_app, valid_from, valid_until
      ) values (
        v_actor, p_sport_id, p_venue_id, p_trainer_id, p_duration_minutes, p_lead_time, p_keep_all_in_chat,
        p_timezone, p_enabled, p_notify_push, p_notify_in_app, p_valid_from, p_valid_until
      ) returning * into v_preference;
    end if;
  end if;

  delete from public.availability_alert_windows aaw
   where aaw.preference_id = v_preference.id;
  insert into public.availability_alert_windows (
    preference_id, weekday, day_part, starts_local, ends_local
  )
  select distinct
    v_preference.id,
    (w.value ->> 'weekday')::smallint,
    case
      when (w.value ->> 'day_part') in ('morning', 'day', 'evening')
        then w.value ->> 'day_part'
      else null
    end,
    case w.value ->> 'day_part'
      when 'morning' then '06:00'::time
      when 'day' then '12:00'::time
      when 'evening' then '17:00'::time
      else (w.value ->> 'starts_local')::time
    end,
    case w.value ->> 'day_part'
      when 'morning' then '12:00'::time
      when 'day' then '17:00'::time
      when 'evening' then '22:00'::time
      else (w.value ->> 'ends_local')::time
    end
  from pg_catalog.jsonb_array_elements(p_windows) w(value);

  perform private.finish_idempotency(
    v_actor, 'save_availability_alert', p_idempotency_key, v_preference.id
  );
  return v_preference;
exception
  when invalid_text_representation or datetime_field_overflow then
    raise exception using errcode = 'P0001', message = 'INVALID_AVAILABILITY_WINDOWS';
end;
$$;

create or replace function public.reserve_availability_offer(
  p_offer_id uuid,
  p_idempotency_key uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_offer public.availability_offers%rowtype;
  v_booking public.bookings%rowtype;
  v_duration_minutes integer;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select ao.* into v_offer
    from public.availability_offers ao
   where ao.id = p_offer_id
     and ao.recipient_id = v_actor
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_FOUND';
  end if;

  if v_offer.status = 'reserved' and v_offer.reserved_booking_id is not null then
    select b.* into v_booking
      from public.bookings b
     where b.id = v_offer.reserved_booking_id
       and private.is_booking_member(b.id);
    if found then
      return v_booking;
    end if;
  end if;
  if v_offer.status <> 'available' or v_offer.expires_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_AVAILABLE';
  end if;
  if not exists (
    select 1
      from public.availability_alert_preferences aap
      join public.notification_preferences np on np.user_id = aap.user_id
     where aap.id = v_offer.preference_id
       and aap.user_id = v_actor
       and aap.enabled
       and np.availability_alerts
  ) then
    raise exception using errcode = 'P0001', message = 'AVAILABILITY_ALERT_DISABLED';
  end if;

  v_duration_minutes := extract(epoch from (v_offer.ends_at - v_offer.starts_at))::integer / 60;
  v_booking := public.create_booking(
    p_idempotency_key,
    v_offer.sport_id,
    v_offer.venue_id,
    v_offer.court_id,
    v_offer.trainer_id,
    v_offer.starts_at,
    v_duration_minutes,
    '{}'::uuid[],
    'Trening z alertu dostępności',
    'web'
  );

  update public.availability_offers ao
     set status = 'reserved',
         reserved_booking_id = v_booking.id
   where ao.id = p_offer_id;

  update public.notifications n
     set read_at = coalesce(n.read_at, pg_catalog.now())
   where n.recipient_id = v_actor
     and n.related_entity_type = 'availability_offer'
     and n.related_entity_id = p_offer_id;

  return v_booking;
end;
$$;

revoke all on function public.send_message(uuid, uuid, text, uuid) from public, anon;
revoke all on function public.mark_conversation_read(uuid, uuid) from public, anon;
revoke all on function public.save_availability_alert(uuid, uuid, integer, jsonb, uuid, uuid, uuid, boolean, text, boolean, text, boolean, boolean, date, date) from public, anon;
revoke all on function public.reserve_availability_offer(uuid, uuid) from public, anon;
