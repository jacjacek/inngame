-- Private authorization and pricing helpers. Only the helpers referenced by RLS
-- receive EXECUTE later; all other helpers remain private to SECURITY DEFINER RPCs.

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
         from private.platform_role_assignments pra
        where pra.user_id = (select auth.uid())
          and pra.role = 'platform_admin'
          and pra.revoked_at is null
     );
$$;

create or replace function private.is_org_member(
  p_organization_id uuid,
  p_allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and (
       private.is_platform_admin()
       or exists (
         select 1
           from public.organization_memberships om
          where om.organization_id = p_organization_id
            and om.user_id = (select auth.uid())
            and om.status = 'active'
            and (p_allowed_roles is null or om.role = any(p_allowed_roles))
       )
     );
$$;

create or replace function private.is_linked_trainer(p_trainer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
         from public.trainers t
        where t.id = p_trainer_id
          and t.user_id = (select auth.uid())
     );
$$;

create or replace function private.is_booking_member(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
         from public.bookings b
         join public.venues v on v.id = b.venue_id
         left join public.trainers t on t.id = b.trainer_id
        where b.id = p_booking_id
          and (
            b.creator_id = (select auth.uid())
            or t.user_id = (select auth.uid())
            or exists (
              select 1
                from public.booking_participants bp
               where bp.booking_id = b.id
                 and bp.user_id = (select auth.uid())
                 and bp.response_status <> 'removed'
            )
            or private.is_org_member(v.organization_id, array['owner', 'manager', 'reception', 'trainer', 'viewer'])
          )
     );
$$;

create or replace function private.can_manage_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
         from public.bookings b
         join public.venues v on v.id = b.venue_id
         left join public.trainers t on t.id = b.trainer_id
        where b.id = p_booking_id
          and (
            b.creator_id = (select auth.uid())
            or t.user_id = (select auth.uid())
            or exists (
              select 1
                from public.booking_participants bp
               where bp.booking_id = b.id
                 and bp.user_id = (select auth.uid())
                 and bp.role = 'organizer'
                 and bp.response_status <> 'removed'
            )
            or private.is_org_member(v.organization_id, array['owner', 'manager', 'reception'])
          )
     );
$$;

create or replace function private.can_set_booking_payment_status(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
         from public.bookings b
         join public.venues v on v.id = b.venue_id
         left join public.trainers t on t.id = b.trainer_id
        where b.id = p_booking_id
          and (
            t.user_id = (select auth.uid())
            or private.is_org_member(v.organization_id, array['owner', 'manager', 'reception'])
          )
     );
$$;

create or replace function private.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
         from public.conversation_members cm
        where cm.conversation_id = p_conversation_id
          and cm.user_id = (select auth.uid())
          and cm.left_at is null
     );
$$;

create or replace function private.can_read_booking_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
         from public.booking_notes bn
         join public.bookings b on b.id = bn.booking_id
         join public.venues v on v.id = b.venue_id
         left join public.trainers t on t.id = b.trainer_id
        where bn.id = p_note_id
          and (
            bn.author_id = (select auth.uid())
            or (
              bn.visibility = 'participants'
              and private.is_booking_member(bn.booking_id)
            )
            or (
              bn.visibility = 'coaches'
              and (
                t.user_id = (select auth.uid())
                or private.is_org_member(v.organization_id, array['owner', 'manager', 'reception', 'trainer'])
              )
            )
          )
     );
$$;

create or replace function private.claim_idempotency(
  p_actor_id uuid,
  p_scope text,
  p_key uuid,
  p_request_hash text
)
returns table (is_new boolean, resource_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
  v_row private.idempotency_keys%rowtype;
begin
  if p_actor_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_key is null then
    raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  insert into private.idempotency_keys (actor_id, scope, key, request_hash)
  values (p_actor_id, p_scope, p_key, p_request_hash)
  on conflict (actor_id, scope, key) do nothing;
  get diagnostics v_inserted = row_count;

  select ik.*
    into v_row
    from private.idempotency_keys ik
   where ik.actor_id = p_actor_id
     and ik.scope = p_scope
     and ik.key = p_key
   for update;

  if v_row.request_hash is distinct from p_request_hash then
    raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
  end if;

  return query select (v_inserted = 1), v_row.resource_id;
end;
$$;

create or replace function private.finish_idempotency(
  p_actor_id uuid,
  p_scope text,
  p_key uuid,
  p_resource_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.idempotency_keys ik
     set resource_id = p_resource_id
   where ik.actor_id = p_actor_id
     and ik.scope = p_scope
     and ik.key = p_key;

  if not found then
    raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CLAIM_MISSING';
  end if;
end;
$$;

create or replace function private.assert_booking_availability(
  p_sport_id uuid,
  p_venue_id uuid,
  p_court_id uuid,
  p_trainer_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_local_date date;
  v_weekday smallint;
begin
  if p_ends_at <= p_starts_at then
    raise exception using errcode = 'P0001', message = 'INVALID_TIME_RANGE';
  end if;

  select v.timezone
    into v_timezone
    from public.courts c
    join public.venues v on v.id = c.venue_id
    join public.organizations o on o.id = v.organization_id
   where c.id = p_court_id
     and c.venue_id = p_venue_id
     and c.sport_id = p_sport_id
     and c.status = 'active'
     and v.status = 'active'
     and o.status = 'active';

  if v_timezone is null then
    raise exception using errcode = 'P0001', message = 'COURT_NOT_AVAILABLE';
  end if;

  v_local_start := p_starts_at at time zone v_timezone;
  v_local_end := p_ends_at at time zone v_timezone;
  v_local_date := v_local_start::date;
  v_weekday := extract(isodow from v_local_start)::smallint;

  if v_local_end::date <> v_local_date then
    raise exception using errcode = 'P0001', message = 'VENUE_CLOSED';
  end if;

  if not exists (
    select 1
      from public.venue_opening_hours voh
     where voh.venue_id = p_venue_id
       and voh.weekday = v_weekday
       and voh.valid_from <= v_local_date
       and (voh.valid_until is null or voh.valid_until >= v_local_date)
       and voh.opens_local <= v_local_start::time
       and voh.closes_local >= v_local_end::time
  ) then
    raise exception using errcode = 'P0001', message = 'VENUE_CLOSED';
  end if;

  if exists (
    select 1
      from public.venue_closures vc
     where vc.venue_id = p_venue_id
       and tstzrange(vc.starts_at, vc.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception using errcode = 'P0001', message = 'VENUE_CLOSED';
  end if;

  if p_trainer_id is not null then
    if not exists (
      select 1
        from public.trainers t
        join public.trainer_sports ts
          on ts.trainer_id = t.id and ts.sport_id = p_sport_id
        join public.trainer_venues tv
          on tv.trainer_id = t.id and tv.venue_id = p_venue_id and tv.active
       where t.id = p_trainer_id
         and t.status = 'active'
    ) then
      raise exception using errcode = 'P0001', message = 'TRAINER_NOT_AVAILABLE';
    end if;

    if exists (
      select 1
        from public.trainer_availability_exceptions tae
       where tae.trainer_id = p_trainer_id
         and tae.kind = 'unavailable'
         and tstzrange(tae.starts_at, tae.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    ) then
      raise exception using errcode = 'P0001', message = 'TRAINER_UNAVAILABLE';
    end if;

    if not (
      exists (
        select 1
          from public.trainer_availability_exceptions tae
         where tae.trainer_id = p_trainer_id
           and tae.kind = 'available'
           and tae.starts_at <= p_starts_at
           and tae.ends_at >= p_ends_at
      )
      or exists (
        select 1
          from public.trainer_availability_rules tar
         where tar.trainer_id = p_trainer_id
           and (tar.venue_id is null or tar.venue_id = p_venue_id)
           and tar.weekday = v_weekday
           and tar.valid_from <= v_local_date
           and (tar.valid_until is null or tar.valid_until >= v_local_date)
           and tar.starts_local <= v_local_start::time
           and tar.ends_local >= v_local_end::time
      )
    ) then
      raise exception using errcode = 'P0001', message = 'TRAINER_UNAVAILABLE';
    end if;
  end if;
end;
$$;

create or replace function private.calculate_booking_price(
  p_sport_id uuid,
  p_venue_id uuid,
  p_court_id uuid,
  p_trainer_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns table (
  court_rate_id uuid,
  court_amount_minor bigint,
  trainer_rate_id uuid,
  trainer_amount_minor bigint,
  currency char(3),
  subtotal_minor bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_local_date date;
  v_weekday smallint;
  v_duration_minutes integer;
  v_court_unit bigint;
  v_trainer_unit bigint;
  v_trainer_currency char(3);
begin
  select v.timezone
    into v_timezone
    from public.venues v
   where v.id = p_venue_id;

  if v_timezone is null then
    raise exception using errcode = 'P0001', message = 'VENUE_NOT_FOUND';
  end if;

  v_local_start := p_starts_at at time zone v_timezone;
  v_local_end := p_ends_at at time zone v_timezone;
  v_local_date := v_local_start::date;
  v_weekday := extract(isodow from v_local_start)::smallint;
  v_duration_minutes := extract(epoch from (p_ends_at - p_starts_at))::integer / 60;

  select cr.id, cr.amount_per_60_min_minor, cr.currency
    into court_rate_id, v_court_unit, currency
    from public.court_rates cr
   where cr.court_id = p_court_id
     and cr.weekday = v_weekday
     and cr.valid_from <= v_local_date
     and (cr.valid_until is null or cr.valid_until >= v_local_date)
     and cr.starts_local <= v_local_start::time
     and cr.ends_local >= v_local_end::time
   order by cr.priority desc, cr.valid_from desc, cr.id
   limit 1;

  if court_rate_id is null then
    raise exception using errcode = 'P0001', message = 'RATE_NOT_FOUND';
  end if;

  court_amount_minor := pg_catalog.round(v_court_unit::numeric * v_duration_minutes / 60)::bigint;
  trainer_rate_id := null;
  trainer_amount_minor := 0;

  if p_trainer_id is not null then
    select tr.id, tr.amount_per_60_min_minor, tr.currency
      into trainer_rate_id, v_trainer_unit, v_trainer_currency
      from public.trainer_rates tr
     where tr.trainer_id = p_trainer_id
       and tr.sport_id = p_sport_id
       and (tr.venue_id is null or tr.venue_id = p_venue_id)
       and tr.weekday = v_weekday
       and tr.valid_from <= v_local_date
       and (tr.valid_until is null or tr.valid_until >= v_local_date)
       and tr.starts_local <= v_local_start::time
       and tr.ends_local >= v_local_end::time
     order by (tr.venue_id is not null) desc, tr.priority desc, tr.valid_from desc, tr.id
     limit 1;

    if trainer_rate_id is null then
      raise exception using errcode = 'P0001', message = 'RATE_NOT_FOUND';
    end if;
    if v_trainer_currency <> currency then
      raise exception using errcode = 'P0001', message = 'CURRENCY_MISMATCH';
    end if;
    trainer_amount_minor := pg_catalog.round(v_trainer_unit::numeric * v_duration_minutes / 60)::bigint;
  end if;

  subtotal_minor := court_amount_minor + trainer_amount_minor;
  return next;
end;
$$;

create or replace function private.reject_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'APPEND_ONLY';
end;
$$;

create trigger booking_status_history_append_only
before update or delete on public.booking_status_history
for each row execute function private.reject_append_only_mutation();

create trigger booking_settlement_events_append_only
before update or delete on public.booking_settlement_events
for each row execute function private.reject_append_only_mutation();

revoke all on all functions in schema private from public, anon, authenticated;
