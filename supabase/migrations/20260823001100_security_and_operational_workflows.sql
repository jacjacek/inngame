-- Production hardening and synchronous operational workflows.
-- This migration deliberately preserves all previously published RPC signatures.

create extension if not exists pg_cron with schema extensions;

-- The Polish MVP has no currency conversion or multi-currency presentation.
-- Refuse deployment with an actionable error instead of leaving a partially
-- validated production contract behind.
do $$
begin
  if exists (select 1 from public.court_rates where currency <> 'PLN')
     or exists (select 1 from public.trainer_rates where currency <> 'PLN')
     or exists (select 1 from public.bookings where currency <> 'PLN')
     or exists (select 1 from public.availability_offers where currency <> 'PLN') then
    raise exception using
      errcode = 'P0001',
      message = 'LEGACY_NON_PLN_DATA',
      detail = 'Normalize court_rates, trainer_rates, bookings and availability_offers to PLN before migration 011.';
  end if;
end;
$$;

alter table public.court_rates
  add constraint court_rates_pln_only
  check (currency = 'PLN') not valid;
alter table public.trainer_rates
  add constraint trainer_rates_pln_only
  check (currency = 'PLN') not valid;
alter table public.bookings
  add constraint bookings_pln_only
  check (currency = 'PLN') not valid;
alter table public.availability_offers
  add constraint availability_offers_pln_only
  check (currency = 'PLN') not valid;

alter table public.court_rates validate constraint court_rates_pln_only;
alter table public.trainer_rates validate constraint trainer_rates_pln_only;
alter table public.bookings validate constraint bookings_pln_only;
alter table public.availability_offers validate constraint availability_offers_pln_only;

-- ---------------------------------------------------------------------------
-- Active-account authorization. Every authorization decision is resolved from
-- the database so that a previously issued JWT stops working immediately after
-- a profile is blocked, anonymized, or queued for deletion.
-- ---------------------------------------------------------------------------

create or replace function private.is_active_actor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
         from public.profiles p
        where p.id = (select auth.uid())
          and p.status = 'active'
     );
$$;

create or replace function private.is_active_actor(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
     and exists (
       select 1
         from public.profiles p
        where p.id = p_user_id
          and p.status = 'active'
     );
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_actor()
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
  select private.is_active_actor()
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
  select private.is_active_actor()
     and exists (
       select 1
         from public.trainers t
        where t.id = p_trainer_id
          and t.user_id = (select auth.uid())
          and t.status in ('active', 'paused')
     );
$$;

create or replace function private.is_booking_member(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_actor()
     and exists (
       select 1
         from public.bookings b
         join public.venues v on v.id = b.venue_id
         left join public.trainers t on t.id = b.trainer_id
        where b.id = p_booking_id
          and (
            b.creator_id = (select auth.uid())
            or private.is_linked_trainer(b.trainer_id)
            or exists (
              select 1
                from public.booking_participants bp
               where bp.booking_id = b.id
                 and bp.user_id = (select auth.uid())
                 and bp.response_status = 'accepted'
            )
            or private.is_org_member(
              v.organization_id,
              array['owner', 'manager', 'reception']
            )
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
  select private.is_active_actor()
     and exists (
       select 1
         from public.bookings b
         join public.venues v on v.id = b.venue_id
         left join public.trainers t on t.id = b.trainer_id
        where b.id = p_booking_id
          and (
            b.creator_id = (select auth.uid())
            or private.is_linked_trainer(b.trainer_id)
            or exists (
              select 1
                from public.booking_participants bp
               where bp.booking_id = b.id
                 and bp.user_id = (select auth.uid())
                 and bp.role = 'organizer'
                 and bp.response_status = 'accepted'
            )
            or private.is_org_member(
              v.organization_id,
              array['owner', 'manager', 'reception']
            )
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
  select private.is_active_actor()
     and exists (
       select 1
         from public.bookings b
         join public.venues v on v.id = b.venue_id
         left join public.trainers t on t.id = b.trainer_id
        where b.id = p_booking_id
          and (
            private.is_linked_trainer(b.trainer_id)
            or private.is_org_member(
              v.organization_id,
              array['owner', 'manager', 'reception']
            )
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
  select private.is_active_actor()
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
  select private.is_active_actor()
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
                private.is_linked_trainer(b.trainer_id)
                or private.is_org_member(
                  v.organization_id,
                  array['owner', 'manager', 'reception']
                )
              )
            )
          )
     );
$$;

create or replace function private.can_read_profile_card(p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_actor()
     and private.is_active_actor(p_target_user_id)
     and (
       p_target_user_id = (select auth.uid())
       or exists (
         select 1
           from public.conversation_members mine
           join public.conversation_members theirs
             on theirs.conversation_id = mine.conversation_id
            and theirs.user_id = p_target_user_id
            and theirs.left_at is null
          where mine.user_id = (select auth.uid())
            and mine.left_at is null
       )
       or exists (
         select 1
           from public.bookings b
           join public.venues v on v.id = b.venue_id
           left join public.trainers t on t.id = b.trainer_id
          where (
            b.creator_id = (select auth.uid())
            or private.is_linked_trainer(b.trainer_id)
            or exists (
              select 1 from public.booking_participants bp
               where bp.booking_id = b.id
                 and bp.user_id = (select auth.uid())
                 and bp.response_status = 'accepted'
            )
            or private.is_org_member(
              v.organization_id,
              array['owner', 'manager', 'reception']
            )
          )
          and (
            b.creator_id = p_target_user_id
            or (
              t.user_id = p_target_user_id
              and t.status in ('active', 'paused')
            )
            or exists (
              select 1 from public.booking_participants bp
               where bp.booking_id = b.id
                 and bp.user_id = p_target_user_id
                 and bp.response_status = 'accepted'
            )
          )
       )
       or exists (
         select 1
           from public.organization_memberships staff
           join public.organization_memberships target
             on target.organization_id = staff.organization_id
            and target.user_id = p_target_user_id
            and target.status = 'active'
          where staff.user_id = (select auth.uid())
            and staff.status = 'active'
            and staff.role in ('owner', 'manager', 'reception')
       )
       or private.is_platform_admin()
     );
$$;

revoke all on function private.is_active_actor() from public, anon, authenticated;
revoke all on function private.is_active_actor(uuid) from public, anon, authenticated;
revoke all on function private.is_platform_admin() from public, anon, authenticated;
revoke all on function private.is_linked_trainer(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_booking(uuid) from public, anon, authenticated;
revoke all on function private.can_set_booking_payment_status(uuid) from public, anon, authenticated;
revoke all on function private.can_read_profile_card(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Immediate deprovisioning and active-target enforcement.
-- ---------------------------------------------------------------------------

create or replace function private.deprovision_inactive_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'active' and new.status <> 'active' then
    update public.organization_memberships om
       set status = 'disabled'
     where om.user_id = new.id
       and om.status <> 'disabled';

    update private.platform_role_assignments pra
       set revoked_at = coalesce(pra.revoked_at, pg_catalog.now())
     where pra.user_id = new.id
       and pra.revoked_at is null;

    update public.booking_participants bp
       set response_status = 'removed',
           responded_at = pg_catalog.now()
      from public.bookings b
      join public.trainers t on t.id = b.trainer_id
     where bp.booking_id = b.id
       and bp.user_id = new.id
       and bp.role = 'coach'
       and bp.response_status <> 'removed'
       and t.user_id = new.id;

    update public.trainers t
       set user_id = null
     where t.user_id = new.id;

    update public.conversation_members cm
       set left_at = coalesce(cm.left_at, pg_catalog.now())
     where cm.user_id = new.id
       and cm.left_at is null;

    update public.device_installations di
       set disabled_at = coalesce(di.disabled_at, pg_catalog.now())
     where di.user_id = new.id
       and di.disabled_at is null;

    update public.availability_alert_preferences aap
       set enabled = false
     where aap.user_id = new.id
       and aap.enabled;

    insert into private.audit_events (
      actor_id, actor_kind, action, entity_type, entity_id, metadata
    ) values (
      auth.uid(),
      case when auth.uid() is null then 'system' else 'user' end,
      'profile.deprovisioned',
      'profile',
      new.id,
      pg_catalog.jsonb_build_object('status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_deprovision_inactive on public.profiles;
create trigger profiles_deprovision_inactive
after update of status on public.profiles
for each row execute function private.deprovision_inactive_profile();

create or replace function private.enforce_active_membership_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('active', 'invited')
     and not private.is_active_actor(new.user_id) then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_ACTIVE';
  end if;
  return new;
end;
$$;

drop trigger if exists organization_memberships_active_target on public.organization_memberships;
create trigger organization_memberships_active_target
before insert or update of user_id, status on public.organization_memberships
for each row execute function private.enforce_active_membership_target();

create or replace function private.enforce_active_platform_role_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.revoked_at is null
     and not private.is_active_actor(new.user_id) then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_ACTIVE';
  end if;
  return new;
end;
$$;

drop trigger if exists platform_roles_active_target on private.platform_role_assignments;
create trigger platform_roles_active_target
before insert or update of user_id, revoked_at on private.platform_role_assignments
for each row execute function private.enforce_active_platform_role_target();

revoke all on function private.deprovision_inactive_profile() from public, anon, authenticated;
revoke all on function private.enforce_active_membership_target() from public, anon, authenticated;
revoke all on function private.enforce_active_platform_role_target() from public, anon, authenticated;

-- One private, purpose-scoped conversation per alert preference. It may contain
-- only the preference owner and the currently linked target trainer.
create table private.availability_conversations (
  preference_id uuid primary key
    references public.availability_alert_preferences(id) on delete cascade,
  conversation_id uuid not null unique
    references public.conversations(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table private.availability_conversations from public, anon, authenticated;

create or replace function public.get_my_roles()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not private.is_active_actor() then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_ACTIVE';
  end if;

  select pg_catalog.jsonb_build_object(
    'is_platform_admin', private.is_platform_admin(),
    'trainer_id', (
      select t.id
        from public.trainers t
       where t.user_id = v_actor
         and t.status in ('active', 'paused')
       order by t.id
       limit 1
    ),
    'organization_memberships', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'organization_id', om.organization_id,
          'role', om.role,
          'status', om.status
        ) order by om.organization_id
      )
        from public.organization_memberships om
       where om.user_id = v_actor
         and om.status = 'active'
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.admin_assign_platform_role(
  p_user_id uuid,
  p_role text,
  p_enabled boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not private.is_platform_admin() then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_role not in ('platform_admin', 'support') then
    raise exception using errcode = 'P0001', message = 'INVALID_PLATFORM_ROLE';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_FOUND';
  end if;
  if p_enabled and not private.is_active_actor(p_user_id) then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_ACTIVE';
  end if;

  insert into private.platform_role_assignments (
    user_id, role, assigned_by, revoked_at
  ) values (
    p_user_id,
    p_role,
    v_actor,
    case when p_enabled then null else pg_catalog.now() end
  )
  on conflict (user_id, role) do update
    set assigned_by = excluded.assigned_by,
        assigned_at = pg_catalog.now(),
        revoked_at = excluded.revoked_at;

  insert into private.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor,
    case when p_enabled
      then 'platform_role.assigned'
      else 'platform_role.revoked'
    end,
    'profile',
    p_user_id,
    pg_catalog.jsonb_build_object('role', p_role)
  );
end;
$$;

create or replace function public.admin_set_organization_membership(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text,
  p_status text default 'active'
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_membership public.organization_memberships%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not (
    private.is_platform_admin()
    or private.is_org_member(p_organization_id, array['owner'])
  ) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_role not in ('owner', 'manager', 'reception', 'trainer', 'viewer') then
    raise exception using errcode = 'P0001', message = 'INVALID_ORGANIZATION_ROLE';
  end if;
  if p_status not in ('invited', 'active', 'disabled') then
    raise exception using errcode = 'P0001', message = 'INVALID_MEMBERSHIP_STATUS';
  end if;
  if not exists (
    select 1 from public.organizations o where o.id = p_organization_id
  ) then
    raise exception using errcode = 'P0001', message = 'ORGANIZATION_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_FOUND';
  end if;
  if p_status in ('invited', 'active')
     and not private.is_active_actor(p_user_id) then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_ACTIVE';
  end if;

  insert into public.organization_memberships (
    organization_id, user_id, role, status, invited_by, joined_at
  ) values (
    p_organization_id,
    p_user_id,
    p_role,
    p_status,
    v_actor,
    case when p_status = 'active' then pg_catalog.now() else null end
  )
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        status = excluded.status,
        invited_by = excluded.invited_by,
        joined_at = case
          when excluded.status = 'active'
            then coalesce(public.organization_memberships.joined_at, pg_catalog.now())
          else public.organization_memberships.joined_at
        end
  returning * into v_membership;

  insert into private.audit_events (
    actor_id, organization_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor,
    p_organization_id,
    'organization_membership.set',
    'profile',
    p_user_id,
    pg_catalog.jsonb_build_object('role', p_role, 'status', p_status)
  );

  return v_membership;
end;
$$;

create or replace function public.admin_link_trainer_account(
  p_trainer_id uuid,
  p_user_id uuid,
  p_organization_id uuid default null
)
returns public.trainers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_trainer public.trainers%rowtype;
  v_old_user_id uuid;
  v_backfilled_participants integer := 0;
  v_reactivated_participants integer := 0;
  v_backfilled_conversations integer := 0;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not private.is_platform_admin() then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if not private.is_active_actor(p_user_id) then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_ACTIVE';
  end if;

  select t.user_id
    into v_old_user_id
    from public.trainers t
   where t.id = p_trainer_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'TRAINER_NOT_FOUND';
  end if;

  if exists (
    select 1
      from public.trainers t
     where t.user_id = p_user_id
       and t.id <> p_trainer_id
  ) then
    raise exception using errcode = 'P0001', message = 'TRAINER_ACCOUNT_ALREADY_LINKED';
  end if;

  if p_organization_id is not null and not exists (
    select 1
      from public.trainer_venues tv
      join public.venues v on v.id = tv.venue_id
      join public.organizations o on o.id = v.organization_id
     where tv.trainer_id = p_trainer_id
       and tv.active
       and v.organization_id = p_organization_id
       and o.status <> 'archived'
  ) then
    raise exception using errcode = 'P0001', message = 'TRAINER_NOT_SERVED_BY_ORGANIZATION';
  end if;

  if v_old_user_id is distinct from p_user_id and v_old_user_id is not null then
    -- A creator is independently entitled to the booking. Restore the semantic
    -- organizer row if an older implementation had turned it into a coach row.
    update public.booking_participants bp
       set role = 'organizer',
           response_status = 'accepted',
           responded_at = coalesce(bp.responded_at, pg_catalog.now())
      from public.bookings b
     where bp.booking_id = b.id
       and b.trainer_id = p_trainer_id
       and b.creator_id = v_old_user_id
       and bp.user_id = v_old_user_id
       and bp.role = 'coach';

    delete from public.booking_participants bp
     using public.bookings b
     where bp.booking_id = b.id
       and b.trainer_id = p_trainer_id
       and bp.user_id = v_old_user_id
       and bp.role = 'coach'
       and b.creator_id is distinct from v_old_user_id;

    update public.conversation_members cm
       set left_at = coalesce(cm.left_at, pg_catalog.now())
      from public.conversations c
      join public.bookings b on b.id = c.booking_id
     where cm.conversation_id = c.id
       and c.kind = 'booking'
       and b.trainer_id = p_trainer_id
       and cm.user_id = v_old_user_id
       and cm.left_at is null
       and b.creator_id is distinct from v_old_user_id
       and not exists (
         select 1
           from public.booking_participants bp
          where bp.booking_id = b.id
            and bp.user_id = v_old_user_id
            and bp.response_status = 'accepted'
       );

    update public.conversation_members cm
       set left_at = coalesce(cm.left_at, pg_catalog.now())
      from private.availability_conversations ac
     where cm.conversation_id = ac.conversation_id
       and ac.trainer_id = p_trainer_id
       and cm.user_id = v_old_user_id
       and cm.user_id <> ac.recipient_id
       and cm.left_at is null;

    update public.organization_memberships om
       set status = 'disabled'
     where om.user_id = v_old_user_id
       and om.role = 'trainer'
       and om.status <> 'disabled'
       and exists (
         select 1
           from public.trainer_venues tv
           join public.venues v on v.id = tv.venue_id
          where tv.trainer_id = p_trainer_id
            and v.organization_id = om.organization_id
       );
  end if;

  update public.trainers t
     set user_id = p_user_id
   where t.id = p_trainer_id
  returning t.* into v_trainer;

  if p_organization_id is not null then
    insert into public.organization_memberships (
      organization_id, user_id, role, status, invited_by, joined_at
    ) values (
      p_organization_id, p_user_id, 'trainer', 'active', v_actor, pg_catalog.now()
    )
    on conflict (organization_id, user_id) do update
      set role = case
            when public.organization_memberships.role in ('owner', 'manager', 'reception')
              then public.organization_memberships.role
            else 'trainer'
          end,
          status = 'active',
          invited_by = excluded.invited_by,
          joined_at = coalesce(
            public.organization_memberships.joined_at,
            pg_catalog.now()
          );
  end if;

  update public.booking_participants bp
     set response_status = 'accepted',
         responded_at = pg_catalog.now()
    from public.bookings b
   where bp.booking_id = b.id
     and b.trainer_id = p_trainer_id
     and bp.user_id = p_user_id
     and bp.role = 'coach'
     and bp.response_status = 'removed';
  get diagnostics v_reactivated_participants = row_count;

  insert into public.booking_participants (
    booking_id, user_id, display_name_snapshot, role,
    response_status, responded_at
  )
  select b.id, p.id, p.display_name, 'coach', 'accepted', pg_catalog.now()
    from public.bookings b
    join public.profiles p on p.id = p_user_id and p.status = 'active'
   where b.trainer_id = p_trainer_id
     and not exists (
       select 1
         from public.booking_participants bp
        where bp.booking_id = b.id
          and bp.user_id = p_user_id
     );
  get diagnostics v_backfilled_participants = row_count;
  v_backfilled_participants :=
    v_backfilled_participants + v_reactivated_participants;

  insert into public.conversation_members (
    conversation_id, user_id, role, left_at
  )
  select c.id,
         p_user_id,
         case when bp.role in ('organizer', 'coach')
           then 'moderator'
           else 'member'
         end,
         null
    from public.conversations c
    join public.bookings b on b.id = c.booking_id
    join public.booking_participants bp
      on bp.booking_id = b.id
     and bp.user_id = p_user_id
     and bp.response_status = 'accepted'
   where c.kind = 'booking'
     and b.trainer_id = p_trainer_id
  on conflict (conversation_id, user_id) do update
    set left_at = null,
        role = case
          when public.conversation_members.role = 'moderator'
            or excluded.role = 'moderator'
            then 'moderator'
          else 'member'
        end;
  get diagnostics v_backfilled_conversations = row_count;

  insert into public.conversation_members (
    conversation_id, user_id, role, left_at
  )
  select ac.conversation_id, p_user_id, 'moderator', null
    from private.availability_conversations ac
   where ac.trainer_id = p_trainer_id
     and ac.recipient_id <> p_user_id
  on conflict (conversation_id, user_id) do update
    set role = 'moderator', left_at = null;

  insert into private.audit_events (
    actor_id, organization_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor,
    p_organization_id,
    case when v_old_user_id is null
      then 'trainer.account_linked'
      else 'trainer.account_relinked'
    end,
    'trainer',
    p_trainer_id,
    pg_catalog.jsonb_build_object(
      'old_user_id', v_old_user_id,
      'user_id', p_user_id,
      'backfilled_booking_participants', v_backfilled_participants,
      'backfilled_conversations', v_backfilled_conversations
    )
  );

  return v_trainer;
end;
$$;

revoke all on function public.get_my_roles() from public, anon;
revoke all on function public.admin_assign_platform_role(uuid, text, boolean) from public, anon;
revoke all on function public.admin_set_organization_membership(uuid, uuid, text, text) from public, anon;
revoke all on function public.admin_link_trainer_account(uuid, uuid, uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Booking guardrails and a server-authoritative quote.
-- ---------------------------------------------------------------------------

create or replace function private.assert_booking_slot_step(
  p_venue_id uuid,
  p_trainer_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_local_date date;
  v_weekday smallint;
  v_rule_start time;
  v_slot_step integer;
  v_offset_seconds bigint;
begin
  if p_starts_at is null
     or p_ends_at is null
     or p_ends_at <= p_starts_at then
    raise exception using errcode = 'P0001', message = 'INVALID_TIME_RANGE';
  end if;

  -- Exact seconds and a universal 15-minute grid are the minimum contract.
  if date_trunc('minute', p_starts_at) is distinct from p_starts_at
     or mod(extract(epoch from p_starts_at), 900) <> 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_SLOT_STEP';
  end if;

  if p_trainer_id is null then
    return;
  end if;

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

  select tar.starts_local, tar.slot_step_minutes
    into v_rule_start, v_slot_step
    from public.trainer_availability_rules tar
   where tar.trainer_id = p_trainer_id
     and (tar.venue_id is null or tar.venue_id = p_venue_id)
     and tar.weekday = v_weekday
     and tar.valid_from <= v_local_date
     and (tar.valid_until is null or tar.valid_until >= v_local_date)
     and tar.starts_local <= v_local_start::time
     and tar.ends_local >= v_local_end::time
   order by tar.slot_step_minutes desc, (tar.venue_id is not null) desc, tar.id
   limit 1;

  if v_slot_step is not null then
    v_offset_seconds := extract(
      epoch from (v_local_start::time - v_rule_start)
    )::bigint;
    if mod(v_offset_seconds, v_slot_step * 60) <> 0 then
      raise exception using errcode = 'P0001', message = 'INVALID_SLOT_STEP';
    end if;
  end if;
end;
$$;

create or replace function private.assert_future_unpaid_booking_quota(
  p_creator_id uuid,
  p_exclude_booking_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_creator_id is null then
    return;
  end if;

  -- Serialize the count+insert/update decision for one creator. The transaction
  -- keeps this lock through the booking write, closing the classic quota race.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_creator_id::text, 7711)
  );

  select pg_catalog.count(*)::integer
    into v_count
    from public.bookings b
   where b.creator_id = p_creator_id
     and b.id is distinct from p_exclude_booking_id
     and b.status = 'confirmed'
     and b.payment_status = 'unpaid'
     and b.starts_at > pg_catalog.now();

  if v_count >= 12 then
    raise exception using errcode = 'P0001', message = 'FUTURE_UNPAID_BOOKING_LIMIT';
  end if;
end;
$$;

create table private.actor_rate_limits (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (char_length(scope) between 1 and 80),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (actor_id, scope)
);

revoke all on table private.actor_rate_limits from public, anon, authenticated;

create or replace function private.consume_actor_rate_limit(
  p_actor_id uuid,
  p_scope text,
  p_limit integer,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_actor_id is null
     or p_limit is null or p_limit < 1
     or p_window is null or p_window <= interval '0 seconds' then
    raise exception using errcode = 'P0001', message = 'INVALID_RATE_LIMIT';
  end if;

  insert into private.actor_rate_limits (
    actor_id, scope, window_started_at, request_count
  ) values (
    p_actor_id, p_scope, pg_catalog.clock_timestamp(), 1
  )
  on conflict (actor_id, scope) do update
    set window_started_at = case
          when private.actor_rate_limits.window_started_at + p_window
               <= pg_catalog.clock_timestamp()
            then pg_catalog.clock_timestamp()
          else private.actor_rate_limits.window_started_at
        end,
        request_count = case
          when private.actor_rate_limits.window_started_at + p_window
               <= pg_catalog.clock_timestamp()
            then 1
          else private.actor_rate_limits.request_count + 1
        end,
        updated_at = pg_catalog.clock_timestamp()
  returning request_count into v_count;

  if v_count > p_limit then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;
end;
$$;

create or replace function private.enforce_booking_guardrails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_booking_slot_step(
    new.venue_id, new.trainer_id, new.starts_at, new.ends_at
  );

  if new.total_minor > 0 and new.payment_status = 'not_required' then
    raise exception using errcode = 'P0001', message = 'PAYMENT_STATUS_NOT_ALLOWED';
  end if;

  if new.status = 'confirmed'
     and new.payment_status = 'unpaid'
     and new.starts_at > pg_catalog.now() then
    perform private.assert_future_unpaid_booking_quota(
      new.creator_id,
      case when tg_op = 'UPDATE' then new.id else null end
    );
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_enforce_guardrails on public.bookings;
create trigger bookings_enforce_guardrails
before insert or update of creator_id, venue_id, trainer_id, starts_at, ends_at,
  status, total_minor, payment_status
on public.bookings
for each row execute function private.enforce_booking_guardrails();

do $$
begin
  if exists (
    select 1
      from public.bookings b
     where date_trunc('minute', b.starts_at) is distinct from b.starts_at
        or mod(extract(epoch from b.starts_at), 900) <> 0
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'LEGACY_BOOKING_SLOT_GRID_VIOLATION',
      detail = 'Align every existing bookings.starts_at value to the 15-minute grid before migration 011.';
  end if;

  if exists (
    select 1
      from public.bookings b
     where b.total_minor > 0
       and b.payment_status = 'not_required'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'LEGACY_BOOKING_PAYMENT_STATUS_VIOLATION',
      detail = 'Positive-price legacy bookings must be paid or unpaid before migration 011.';
  end if;
end;
$$;

alter table public.bookings
  add constraint bookings_starts_on_15_minute_grid
  check (
    date_trunc('minute', starts_at) = starts_at
    and mod(extract(epoch from starts_at), 900) = 0
  )
  not valid;

alter table public.bookings
  add constraint bookings_positive_total_requires_payment
  check (total_minor = 0 or payment_status <> 'not_required')
  not valid;

alter table public.bookings
  validate constraint bookings_starts_on_15_minute_grid;
alter table public.bookings
  validate constraint bookings_positive_total_requires_payment;

create or replace function private.rpc_error_response(
  p_sqlstate text,
  p_message text,
  p_details text default null,
  p_hint text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_status text;
  v_details text := coalesce(p_details, '');
  v_hint text := coalesce(p_hint, '');
begin
  if p_sqlstate = 'P0001' then
    v_code := coalesce(p_message, 'INVALID_REQUEST');
  elsif p_sqlstate in ('23505', '23P01') then
    v_code := 'RESOURCE_CONFLICT';
    v_details := '';
    v_hint := '';
  elsif p_sqlstate in ('23503', '23514', '22007', '22P02') then
    v_code := 'INVALID_REQUEST';
    v_details := '';
    v_hint := '';
  elsif p_sqlstate in ('40001', '40P01') then
    v_code := 'RETRYABLE_CONFLICT';
    v_details := '';
    v_hint := 'Retry the request with the same idempotency key.';
  else
    v_code := 'INTERNAL_ERROR';
    v_details := '';
    v_hint := '';
  end if;

  v_status := case
    when v_code = 'INTERNAL_ERROR' then '500'
    when v_code = 'AUTH_REQUIRED' then '401'
    when v_code in ('FORBIDDEN', 'PROFILE_NOT_ACTIVE') then '403'
    when v_code like '%NOT_FOUND' then '404'
    when v_code in ('RATE_LIMITED', 'FUTURE_UNPAID_BOOKING_LIMIT') then '429'
    when v_code in (
      'SLOT_TAKEN', 'QUOTE_CHANGED', 'OFFER_PRICE_CHANGED',
      'IDEMPOTENCY_CONFLICT', 'RESOURCE_CONFLICT', 'RETRYABLE_CONFLICT'
    ) then '409'
    else '400'
  end;

  perform pg_catalog.set_config('response.status', v_status, true);
  return pg_catalog.jsonb_build_object(
    'code', v_code,
    'message', v_code,
    'details', v_details,
    'hint', v_hint
  );
end;
$$;

revoke all on function private.rpc_error_response(text, text, text, text)
  from public, anon, authenticated;

create or replace function public.quote_booking(
  p_sport_id uuid,
  p_venue_id uuid,
  p_court_id uuid,
  p_trainer_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_exclude_booking_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_ends_at timestamptz;
  v_price record;
  v_excluded public.bookings%rowtype;
  v_quota_user_id uuid;
  v_payment_status text;
  v_error_sqlstate text;
  v_error_code text;
  v_error_details text;
  v_error_hint text;
begin
  perform pg_catalog.set_config('response.status', '200', true);

  if v_actor is not null and private.is_active_actor() then
    begin
      perform private.consume_actor_rate_limit(
        v_actor, 'quote_booking', 60, interval '5 minutes'
      );
    exception when others then
      get stacked diagnostics
        v_error_sqlstate = returned_sqlstate,
        v_error_code = message_text,
        v_error_details = pg_exception_detail,
        v_error_hint = pg_exception_hint;
      return private.rpc_error_response(
        v_error_sqlstate, v_error_code, v_error_details, v_error_hint
      );
    end;
  end if;

  begin
    if v_actor is null then
      raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
    end if;
    if not private.is_active_actor() then
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

  v_ends_at := p_starts_at + pg_catalog.make_interval(mins => p_duration_minutes);
  v_quota_user_id := v_actor;

  if p_exclude_booking_id is not null then
    select b.*
      into v_excluded
      from public.bookings b
     where b.id = p_exclude_booking_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
    end if;
    if not private.can_manage_booking(p_exclude_booking_id) then
      raise exception using errcode = 'P0001', message = 'FORBIDDEN';
    end if;
    if v_excluded.sport_id <> p_sport_id
       or v_excluded.venue_id <> p_venue_id
       or v_excluded.court_id <> p_court_id
       or v_excluded.trainer_id is distinct from p_trainer_id then
      raise exception using errcode = 'P0001', message = 'BOOKING_RESOURCE_MISMATCH';
    end if;
    v_quota_user_id := v_excluded.creator_id;
  end if;

  perform private.assert_booking_availability(
    p_sport_id, p_venue_id, p_court_id, p_trainer_id,
    p_starts_at, v_ends_at
  );
  perform private.assert_booking_slot_step(
    p_venue_id, p_trainer_id, p_starts_at, v_ends_at
  );

  if exists (
    select 1
      from public.bookings b
     where b.status = 'confirmed'
       and b.id is distinct from p_exclude_booking_id
       and b.court_id = p_court_id
       and tstzrange(b.starts_at, b.ends_at, '[)')
           && tstzrange(p_starts_at, v_ends_at, '[)')
  ) or (
    p_trainer_id is not null and exists (
      select 1
        from public.bookings b
       where b.status = 'confirmed'
         and b.id is distinct from p_exclude_booking_id
         and b.trainer_id = p_trainer_id
         and tstzrange(b.starts_at, b.ends_at, '[)')
             && tstzrange(p_starts_at, v_ends_at, '[)')
    )
  ) then
    raise exception using errcode = 'P0001', message = 'SLOT_TAKEN';
  end if;

  select *
    into v_price
    from private.calculate_booking_price(
      p_sport_id, p_venue_id, p_court_id, p_trainer_id,
      p_starts_at, v_ends_at
    );

  v_payment_status := case
    when v_price.subtotal_minor = 0 then 'not_required'
    when p_exclude_booking_id is null then 'unpaid'
    when v_excluded.total_minor is distinct from v_price.subtotal_minor
      or v_excluded.currency is distinct from v_price.currency
      or v_excluded.payment_status = 'not_required'
      then 'unpaid'
    else v_excluded.payment_status
  end;

  if v_payment_status = 'unpaid' and p_starts_at > pg_catalog.now() then
    perform private.assert_future_unpaid_booking_quota(
      v_quota_user_id, p_exclude_booking_id
    );
  end if;

    return pg_catalog.jsonb_build_object(
    'sport_id', p_sport_id,
    'venue_id', p_venue_id,
    'court_id', p_court_id,
    'trainer_id', p_trainer_id,
    'starts_at', p_starts_at,
    'ends_at', v_ends_at,
    'duration_minutes', p_duration_minutes,
    'court_rate_id', v_price.court_rate_id,
    'trainer_rate_id', v_price.trainer_rate_id,
    'court_amount_minor', v_price.court_amount_minor,
    'trainer_amount_minor', v_price.trainer_amount_minor,
    'subtotal_minor', v_price.subtotal_minor,
    'discount_minor', 0,
    'total_minor', v_price.subtotal_minor,
    'currency', v_price.currency,
      'payment_status', v_payment_status
    );
  exception when others then
    get stacked diagnostics
      v_error_sqlstate = returned_sqlstate,
      v_error_code = message_text,
      v_error_details = pg_exception_detail,
      v_error_hint = pg_exception_hint;
    return private.rpc_error_response(
      v_error_sqlstate, v_error_code, v_error_details, v_error_hint
    );
  end;
end;
$$;

revoke all on function private.assert_booking_slot_step(uuid, uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function private.assert_future_unpaid_booking_quota(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.consume_actor_rate_limit(uuid, text, integer, interval)
  from public, anon, authenticated;
revoke all on function private.enforce_booking_guardrails()
  from public, anon, authenticated;
revoke all on function public.quote_booking(uuid, uuid, uuid, uuid, timestamptz, integer, uuid)
  from public, anon;
grant execute on function public.quote_booking(uuid, uuid, uuid, uuid, timestamptz, integer, uuid)
  to authenticated;

create or replace function public.create_booking_with_quote(
  p_idempotency_key uuid,
  p_sport_id uuid,
  p_venue_id uuid,
  p_court_id uuid,
  p_trainer_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_expected_total_minor bigint,
  p_expected_currency text,
  p_participant_user_ids uuid[] default '{}'::uuid[],
  p_title text default null,
  p_source text default 'web'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_error_sqlstate text;
  v_error_code text;
  v_error_details text;
  v_error_hint text;
begin
  perform pg_catalog.set_config('response.status', '200', true);

  if v_actor is not null and private.is_active_actor() then
    begin
      perform private.consume_actor_rate_limit(
        v_actor, 'create_booking', 20, interval '5 minutes'
      );
    exception when others then
      get stacked diagnostics
        v_error_sqlstate = returned_sqlstate,
        v_error_code = message_text,
        v_error_details = pg_exception_detail,
        v_error_hint = pg_exception_hint;
      return private.rpc_error_response(
        v_error_sqlstate, v_error_code, v_error_details, v_error_hint
      );
    end;
  end if;

  begin
    v_booking := public.create_booking(
      p_idempotency_key,
      p_sport_id,
      p_venue_id,
      p_court_id,
      p_trainer_id,
      p_starts_at,
      p_duration_minutes,
      p_participant_user_ids,
      p_title,
      p_source
    );

    if p_expected_total_minor is null
       or p_expected_currency is null
       or v_booking.total_minor is distinct from p_expected_total_minor
       or v_booking.currency::text is distinct from
          upper(pg_catalog.btrim(p_expected_currency)) then
      raise exception using errcode = 'P0001', message = 'QUOTE_CHANGED';
    end if;

    return pg_catalog.to_jsonb(v_booking);
  exception when others then
    get stacked diagnostics
      v_error_sqlstate = returned_sqlstate,
      v_error_code = message_text,
      v_error_details = pg_exception_detail,
      v_error_hint = pg_exception_hint;
    return private.rpc_error_response(
      v_error_sqlstate, v_error_code, v_error_details, v_error_hint
    );
  end;
end;
$$;

create or replace function public.reschedule_booking_with_quote(
  p_booking_id uuid,
  p_idempotency_key uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_expected_total_minor bigint,
  p_expected_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_error_sqlstate text;
  v_error_code text;
  v_error_details text;
  v_error_hint text;
begin
  perform pg_catalog.set_config('response.status', '200', true);

  if v_actor is not null and private.is_active_actor() then
    begin
      perform private.consume_actor_rate_limit(
        v_actor, 'reschedule_booking', 20, interval '5 minutes'
      );
    exception when others then
      get stacked diagnostics
        v_error_sqlstate = returned_sqlstate,
        v_error_code = message_text,
        v_error_details = pg_exception_detail,
        v_error_hint = pg_exception_hint;
      return private.rpc_error_response(
        v_error_sqlstate, v_error_code, v_error_details, v_error_hint
      );
    end;
  end if;

  begin
    v_booking := public.reschedule_booking(
      p_booking_id,
      p_idempotency_key,
      p_starts_at,
      p_duration_minutes
    );

    if p_expected_total_minor is null
       or p_expected_currency is null
       or v_booking.total_minor is distinct from p_expected_total_minor
       or v_booking.currency::text is distinct from
          upper(pg_catalog.btrim(p_expected_currency)) then
      raise exception using errcode = 'P0001', message = 'QUOTE_CHANGED';
    end if;

    return pg_catalog.to_jsonb(v_booking);
  exception when others then
    get stacked diagnostics
      v_error_sqlstate = returned_sqlstate,
      v_error_code = message_text,
      v_error_details = pg_exception_detail,
      v_error_hint = pg_exception_hint;
    return private.rpc_error_response(
      v_error_sqlstate, v_error_code, v_error_details, v_error_hint
    );
  end;
end;
$$;

revoke all on function public.create_booking_with_quote(uuid, uuid, uuid, uuid, uuid, timestamptz, integer, bigint, text, uuid[], text, text)
  from public, anon;
grant execute on function public.create_booking_with_quote(uuid, uuid, uuid, uuid, uuid, timestamptz, integer, bigint, text, uuid[], text, text)
  to authenticated;
revoke all on function public.reschedule_booking_with_quote(uuid, uuid, timestamptz, integer, bigint, text)
  from public, anon;
grant execute on function public.reschedule_booking_with_quote(uuid, uuid, timestamptz, integer, bigint, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Synchronous in-app booking notifications. Push delivery remains an outbox
-- concern; the durable in-app row is committed with the booking transaction.
-- ---------------------------------------------------------------------------

create unique index notifications_event_recipient_idx
  on public.notifications(recipient_id, type, ((data ->> 'event_id')))
  where data ? 'event_id';

create or replace function private.enqueue_notification_push(
  p_notification_id uuid,
  p_recipient_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.device_installations di
     where di.user_id = p_recipient_id
       and di.disabled_at is null
  ) then
    insert into private.outbox_events (
      event_type, aggregate_type, aggregate_id, payload, idempotency_key
    ) values (
      'notification.push',
      'notification',
      p_notification_id,
      pg_catalog.jsonb_build_object(
        'notification_id', p_notification_id,
        'recipient_id', p_recipient_id
      ),
      p_notification_id
    )
    on conflict (event_type, idempotency_key) do nothing;
  end if;
end;
$$;

create or replace function private.emit_booking_event_notifications(
  p_event_id uuid,
  p_booking_id uuid,
  p_event_type text,
  p_actor_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_title text;
  v_body text;
  v_notification record;
  v_count integer := 0;
begin
  select b.* into v_booking
    from public.bookings b
   where b.id = p_booking_id;
  if not found then
    return 0;
  end if;

  select x.title, x.body
    into v_title, v_body
    from (values
      ('booking.created', 'Nowy trening', 'Trening został zarezerwowany.'),
      ('booking.rescheduled', 'Zmiana terminu', 'Termin treningu został zmieniony.'),
      ('booking.cancelled', 'Trening anulowany', 'Trening został anulowany.'),
      ('booking.payment_status_changed', 'Zmiana rozliczenia', 'Status rozliczenia treningu został zmieniony.'),
      ('booking.completed', 'Trening zakończony', 'Trening został oznaczony jako zakończony.'),
      ('booking.no_show', 'Nieobecność', 'Trening został oznaczony jako nieobecność.')
    ) as x(event_type, title, body)
   where x.event_type = p_event_type;

  if v_title is null then
    return 0;
  end if;

  for v_notification in
    with recipients as (
      select v_booking.creator_id as user_id
      union
      select bp.user_id
        from public.booking_participants bp
       where bp.booking_id = p_booking_id
         and bp.response_status = 'accepted'
      union
      select t.user_id
        from public.trainers t
       where t.id = v_booking.trainer_id
    ), inserted as (
      insert into public.notifications (
        recipient_id, type, title, body, data,
        related_entity_type, related_entity_id
      )
      select r.user_id,
             p_event_type,
             v_title,
             v_body,
             pg_catalog.jsonb_build_object(
               'event_id', p_event_id,
               'booking_id', p_booking_id,
               'actor_id', p_actor_id,
               'metadata', coalesce(p_metadata, '{}'::jsonb)
             ),
             'booking',
             p_booking_id
        from recipients r
        join public.profiles p on p.id = r.user_id and p.status = 'active'
        join public.notification_preferences np on np.user_id = r.user_id
       where r.user_id is not null
         and case
           when p_event_type = 'booking.payment_status_changed'
             then np.payment_updates
           else np.schedule_changes
         end
      on conflict do nothing
      returning id, recipient_id
    )
    select i.id, i.recipient_id from inserted i
  loop
    v_count := v_count + 1;
    perform private.enqueue_notification_push(
      v_notification.id, v_notification.recipient_id
    );
  end loop;

  return v_count;
end;
$$;

revoke all on function private.enqueue_notification_push(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.emit_booking_event_notifications(uuid, uuid, text, uuid, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Availability matching and offer production.
-- ---------------------------------------------------------------------------

alter table public.availability_offers
  add column dedupe_key text;

create unique index availability_offers_dedupe_idx
  on public.availability_offers(dedupe_key)
  where dedupe_key is not null;

create table private.availability_producer_runs (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key uuid not null,
  request_hash text not null check (char_length(request_hash) between 16 and 128),
  produced_count integer,
  created_at timestamptz not null default now(),
  primary key (actor_id, idempotency_key)
);

revoke all on table private.availability_producer_runs from public, anon, authenticated;

create or replace function private.ensure_availability_conversation(
  p_preference_id uuid,
  p_recipient_id uuid,
  p_trainer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
  v_trainer_user_id uuid;
begin
  select ac.conversation_id
    into v_conversation_id
    from private.availability_conversations ac
   where ac.preference_id = p_preference_id
   for update;

  if p_trainer_id is not null then
    select t.user_id
      into v_trainer_user_id
      from public.trainers t
      join public.profiles p on p.id = t.user_id and p.status = 'active'
     where t.id = p_trainer_id;
  end if;

  if v_conversation_id is null then
    insert into public.conversations (
      kind, title, created_by
    ) values (
      case
        when v_trainer_user_id is not null
             and v_trainer_user_id <> p_recipient_id then 'direct'
        else 'group'
      end,
      'Alerty dostępności',
      p_recipient_id
    ) returning id into v_conversation_id;

    insert into private.availability_conversations (
      preference_id, conversation_id, recipient_id, trainer_id
    ) values (
      p_preference_id, v_conversation_id, p_recipient_id, p_trainer_id
    );
  else
    update private.availability_conversations ac
       set trainer_id = p_trainer_id,
           updated_at = pg_catalog.now()
     where ac.preference_id = p_preference_id;
  end if;

  insert into public.conversation_members (
    conversation_id, user_id, role, left_at
  ) values (
    v_conversation_id, p_recipient_id, 'moderator', null
  )
  on conflict (conversation_id, user_id) do update
    set role = 'moderator', left_at = null;

  -- A venue-only preference intentionally remains a one-person conversation.
  -- A second member is added only when the user explicitly targets a trainer.
  if v_trainer_user_id is not null
     and v_trainer_user_id <> p_recipient_id then
    insert into public.conversation_members (
      conversation_id, user_id, role, left_at
    ) values (
      v_conversation_id, v_trainer_user_id, 'moderator', null
    )
    on conflict (conversation_id, user_id) do update
      set role = 'moderator', left_at = null;
  end if;

  return v_conversation_id;
end;
$$;

create or replace function private.produce_availability_offers_for_slot(
  p_sport_id uuid,
  p_venue_id uuid,
  p_court_id uuid,
  p_trainer_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_actor_id uuid default null,
  p_source_booking_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duration_minutes integer;
  v_price record;
  v_preference record;
  v_offer public.availability_offers%rowtype;
  v_conversation_id uuid;
  v_message_id uuid;
  v_notification_id uuid;
  v_dedupe_key text;
  v_count integer := 0;
begin
  if p_starts_at <= pg_catalog.now() or p_ends_at <= p_starts_at then
    return 0;
  end if;

  v_duration_minutes :=
    extract(epoch from (p_ends_at - p_starts_at))::integer / 60;

  perform private.assert_booking_availability(
    p_sport_id, p_venue_id, p_court_id, p_trainer_id,
    p_starts_at, p_ends_at
  );
  perform private.assert_booking_slot_step(
    p_venue_id, p_trainer_id, p_starts_at, p_ends_at
  );

  if exists (
    select 1
      from public.bookings b
     where b.status = 'confirmed'
       and (
         b.court_id = p_court_id
         or (p_trainer_id is not null and b.trainer_id = p_trainer_id)
       )
       and tstzrange(b.starts_at, b.ends_at, '[)')
           && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    return 0;
  end if;

  select * into v_price
    from private.calculate_booking_price(
      p_sport_id, p_venue_id, p_court_id, p_trainer_id,
      p_starts_at, p_ends_at
    );

  for v_preference in
    select aap.*
      from public.availability_alert_preferences aap
      join public.profiles p
        on p.id = aap.user_id
       and p.status = 'active'
      join public.notification_preferences np
        on np.user_id = aap.user_id
       and np.availability_alerts
     where aap.enabled
       and aap.sport_id = p_sport_id
       and (aap.venue_id is null or aap.venue_id = p_venue_id)
       and (aap.trainer_id is null or aap.trainer_id = p_trainer_id)
       and aap.duration_minutes = v_duration_minutes
       and aap.valid_from <= (p_starts_at at time zone aap.timezone)::date
       and (
         aap.valid_until is null
         or aap.valid_until >= (p_starts_at at time zone aap.timezone)::date
       )
       and (p_starts_at at time zone aap.timezone)::date
           between (pg_catalog.now() at time zone aap.timezone)::date
               and (pg_catalog.now() at time zone aap.timezone)::date
                   + case aap.lead_time
                       when 'today' then 0
                       when 'threeDays' then 3
                       when 'sevenDays' then 7
                     end
       and exists (
         select 1
           from public.availability_alert_windows aaw
          where aaw.preference_id = aap.id
            and aaw.weekday = extract(
              isodow from (p_starts_at at time zone aap.timezone)
            )::smallint
            and aaw.starts_local
                <= (p_starts_at at time zone aap.timezone)::time
            and aaw.ends_local
                >= (p_ends_at at time zone aap.timezone)::time
       )
       and (
         p_source_booking_id is null
         or not exists (
           select 1
             from public.bookings source_booking
            where source_booking.id = p_source_booking_id
              and (
                source_booking.creator_id = aap.user_id
                or exists (
                  select 1
                    from public.booking_participants bp
                   where bp.booking_id = source_booking.id
                     and bp.user_id = aap.user_id
                     and bp.response_status = 'accepted'
                )
              )
         )
       )
       and not exists (
         select 1
           from public.trainers target_trainer
          where target_trainer.id = p_trainer_id
            and target_trainer.user_id = aap.user_id
       )
     order by aap.id
  loop
    -- Only explicitly trainer-targeted preferences include that trainer in chat.
    v_conversation_id := private.ensure_availability_conversation(
      v_preference.id,
      v_preference.user_id,
      v_preference.trainer_id
    );

    v_dedupe_key := pg_catalog.md5(pg_catalog.concat_ws(
      ':',
      v_preference.id::text,
      p_sport_id::text,
      p_venue_id::text,
      p_court_id::text,
      coalesce(p_trainer_id::text, ''),
      p_starts_at::text,
      p_ends_at::text
    ));

    insert into public.availability_offers (
      preference_id, recipient_id, sport_id, venue_id, court_id,
      trainer_id, conversation_id, starts_at, ends_at,
      total_minor, currency, status, expires_at, created_by, dedupe_key
    ) values (
      v_preference.id,
      v_preference.user_id,
      p_sport_id,
      p_venue_id,
      p_court_id,
      p_trainer_id,
      v_conversation_id,
      p_starts_at,
      p_ends_at,
      v_price.subtotal_minor,
      v_price.currency,
      'available',
      least(p_starts_at, pg_catalog.now() + interval '24 hours'),
      p_actor_id,
      v_dedupe_key
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning * into v_offer;

    if v_offer.id is null then
      continue;
    end if;

    v_count := v_count + 1;

    if v_preference.keep_all_in_chat then
      insert into public.messages (
        conversation_id, sender_id, kind, body
      ) values (
        v_conversation_id,
        null,
        'system',
        'Pojawił się termin zgodny z alertem dostępności.'
      ) returning id into v_message_id;

      update public.conversations c
         set last_message_at = pg_catalog.now()
       where c.id = v_conversation_id;
    end if;

    if v_preference.notify_in_app then
      insert into public.notifications (
        recipient_id, type, title, body, data,
        related_entity_type, related_entity_id
      ) values (
        v_preference.user_id,
        'availability_offer.created',
        'Wolny termin',
        'Pojawił się termin zgodny z Twoim alertem.',
        pg_catalog.jsonb_build_object(
          'event_id', v_offer.id,
          'offer_id', v_offer.id,
          'conversation_id', v_conversation_id,
          'source_booking_id', p_source_booking_id
        ),
        'availability_offer',
        v_offer.id
      )
      on conflict do nothing
      returning id into v_notification_id;
    end if;

    if v_preference.notify_push then
      insert into private.outbox_events (
        event_type, aggregate_type, aggregate_id, payload, idempotency_key
      ) values (
        'availability_offer.push',
        'availability_offer',
        v_offer.id,
        pg_catalog.jsonb_build_object(
          'offer_id', v_offer.id,
          'recipient_id', v_preference.user_id,
          'notification_id', v_notification_id
        ),
        v_offer.id
      )
      on conflict (event_type, idempotency_key) do nothing;
    end if;

    v_offer := null;
    v_notification_id := null;
  end loop;

  return v_count;
end;
$$;

create or replace function public.publish_availability_slot(
  p_idempotency_key uuid,
  p_sport_id uuid,
  p_venue_id uuid,
  p_court_id uuid,
  p_trainer_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_organization_id uuid;
  v_ends_at timestamptz;
  v_hash text;
  v_run private.availability_producer_runs%rowtype;
  v_count integer;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not private.is_active_actor() then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_ACTIVE';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_duration_minutes is null
     or p_duration_minutes < 30
     or p_duration_minutes > 360
     or p_duration_minutes % 15 <> 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_DURATION';
  end if;

  select v.organization_id
    into v_organization_id
    from public.venues v
   where v.id = p_venue_id;
  if v_organization_id is null then
    raise exception using errcode = 'P0001', message = 'VENUE_NOT_FOUND';
  end if;
  if not (
    private.is_linked_trainer(p_trainer_id)
    or private.is_org_member(
      v_organization_id,
      array['owner', 'manager', 'reception']
    )
  ) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  v_ends_at := p_starts_at + pg_catalog.make_interval(mins => p_duration_minutes);
  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'sport_id', p_sport_id,
    'venue_id', p_venue_id,
    'court_id', p_court_id,
    'trainer_id', p_trainer_id,
    'starts_at', p_starts_at,
    'duration_minutes', p_duration_minutes
  )::text);

  insert into private.availability_producer_runs (
    actor_id, idempotency_key, request_hash
  ) values (
    v_actor, p_idempotency_key, v_hash
  )
  on conflict (actor_id, idempotency_key) do nothing;

  select apr.* into v_run
    from private.availability_producer_runs apr
   where apr.actor_id = v_actor
     and apr.idempotency_key = p_idempotency_key
   for update;

  if v_run.request_hash is distinct from v_hash then
    raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
  end if;
  if v_run.produced_count is not null then
    return v_run.produced_count;
  end if;

  v_count := private.produce_availability_offers_for_slot(
    p_sport_id, p_venue_id, p_court_id, p_trainer_id,
    p_starts_at, v_ends_at, v_actor, null
  );

  update private.availability_producer_runs apr
     set produced_count = v_count
   where apr.actor_id = v_actor
     and apr.idempotency_key = p_idempotency_key;

  return v_count;
end;
$$;

revoke all on function private.ensure_availability_conversation(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.produce_availability_offers_for_slot(uuid, uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.publish_availability_slot(uuid, uuid, uuid, uuid, uuid, timestamptz, integer)
  from public, anon;
grant execute on function public.publish_availability_slot(uuid, uuid, uuid, uuid, uuid, timestamptz, integer)
  to authenticated;

create or replace function private.handle_booking_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_event_type text;
  v_freed_starts_at timestamptz;
  v_freed_ends_at timestamptz;
begin
  select b.* into v_booking
    from public.bookings b
   where b.id = new.booking_id;
  if not found then
    return new;
  end if;

  v_event_type := case
    when new.from_status is null and new.reason = 'booking_created'
      then 'booking.created'
    when new.reason = 'booking_rescheduled'
      then 'booking.rescheduled'
    when new.to_status in ('cancelled_by_customer', 'cancelled_by_provider')
      then 'booking.cancelled'
    when new.to_status = 'completed'
      then 'booking.completed'
    when new.to_status = 'no_show'
      then 'booking.no_show'
    else null
  end;

  if v_event_type is not null then
    perform private.emit_booking_event_notifications(
      new.id,
      new.booking_id,
      v_event_type,
      new.actor_id,
      new.metadata
    );
  end if;

  if new.reason = 'booking_rescheduled' then
    v_freed_starts_at := (new.metadata ->> 'old_starts_at')::timestamptz;
    v_freed_ends_at := (new.metadata ->> 'old_ends_at')::timestamptz;
  elsif new.to_status in ('cancelled_by_customer', 'cancelled_by_provider') then
    v_freed_starts_at := v_booking.starts_at;
    v_freed_ends_at := v_booking.ends_at;
  end if;

  if v_freed_starts_at is not null
     and v_freed_ends_at is not null
     and v_freed_starts_at > pg_catalog.now() then
    begin
      perform private.produce_availability_offers_for_slot(
        v_booking.sport_id,
        v_booking.venue_id,
        v_booking.court_id,
        v_booking.trainer_id,
        v_freed_starts_at,
        v_freed_ends_at,
        new.actor_id,
        new.booking_id
      );
    exception when others then
      -- Alert delivery must never make a valid cancellation/reschedule fail.
      insert into private.audit_events (
        actor_id, actor_kind, action, entity_type, entity_id, metadata
      ) values (
        new.actor_id,
        case when new.actor_id is null then 'system' else 'user' end,
        'availability_offer.production_failed',
        'booking',
        new.booking_id,
        pg_catalog.jsonb_build_object(
          'status_history_id', new.id,
          'sqlstate', sqlstate,
          'error', pg_catalog.left(sqlerrm, 500)
        )
      );
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists booking_status_history_operational_event
  on public.booking_status_history;
create trigger booking_status_history_operational_event
after insert on public.booking_status_history
for each row execute function private.handle_booking_status_event();

create or replace function private.handle_booking_settlement_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.from_status is not null
     and new.from_status is distinct from new.to_status then
    perform private.emit_booking_event_notifications(
      new.id,
      new.booking_id,
      'booking.payment_status_changed',
      new.actor_id,
      pg_catalog.jsonb_build_object(
        'from_status', new.from_status,
        'to_status', new.to_status
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists booking_settlement_events_operational_event
  on public.booking_settlement_events;
create trigger booking_settlement_events_operational_event
after insert on public.booking_settlement_events
for each row execute function private.handle_booking_settlement_event();

revoke all on function private.handle_booking_status_event()
  from public, anon, authenticated;
revoke all on function private.handle_booking_settlement_event()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Safe, idempotent transition of due bookings. A scheduler may invoke this as
-- service_role; an active platform administrator can invoke it operationally.
-- ---------------------------------------------------------------------------

create table private.booking_processing_runs (
  scope text not null,
  idempotency_key uuid not null,
  request_hash text not null check (char_length(request_hash) between 16 and 128),
  processed_count integer,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (scope, idempotency_key)
);

revoke all on table private.booking_processing_runs from public, anon, authenticated;

create or replace function public.process_due_bookings(
  p_idempotency_key uuid,
  p_until timestamptz default now(),
  p_no_show_booking_ids uuid[] default '{}'::uuid[],
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_hash text;
  v_run private.booking_processing_runs%rowtype;
  v_booking record;
  v_new_status text;
  v_count integer := 0;
begin
  if not v_is_service and not private.is_platform_admin() then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_until is null or p_until > pg_catalog.now() + interval '5 minutes' then
    raise exception using errcode = 'P0001', message = 'INVALID_PROCESSING_CUTOFF';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode = 'P0001', message = 'INVALID_LIMIT';
  end if;

  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'until', p_until,
    'no_show_booking_ids', coalesce(p_no_show_booking_ids, '{}'::uuid[]),
    'limit', p_limit
  )::text);

  insert into private.booking_processing_runs (
    scope, idempotency_key, request_hash, actor_id
  ) values (
    'process_due_bookings', p_idempotency_key, v_hash, v_actor
  )
  on conflict (scope, idempotency_key) do nothing;

  select bpr.* into v_run
    from private.booking_processing_runs bpr
   where bpr.scope = 'process_due_bookings'
     and bpr.idempotency_key = p_idempotency_key
   for update;

  if v_run.processed_count is not null then
    return v_run.processed_count;
  end if;
  if v_run.request_hash is distinct from v_hash then
    raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
  end if;

  for v_booking in
    select b.id, b.trainer_id
      from public.bookings b
     where b.status = 'confirmed'
       and b.ends_at <= p_until
     order by b.ends_at, b.id
     for update skip locked
     limit p_limit
  loop
    v_new_status := case
      when v_booking.id = any(coalesce(p_no_show_booking_ids, '{}'::uuid[]))
        then 'no_show'
      else 'completed'
    end;

    update public.bookings b
       set status = v_new_status
     where b.id = v_booking.id
       and b.status = 'confirmed';

    if found then
      v_count := v_count + 1;
      insert into public.booking_status_history (
        booking_id, from_status, to_status, actor_id, reason, metadata
      ) values (
        v_booking.id,
        'confirmed',
        v_new_status,
        v_actor,
        'process_due_bookings',
        pg_catalog.jsonb_build_object(
          'processing_idempotency_key', p_idempotency_key,
          'processed_until', p_until
        )
      );
    end if;
  end loop;

  update public.trainers t
     set completed_bookings_count = (
       select pg_catalog.count(*)::integer
         from public.bookings b
        where b.trainer_id = t.id
          and b.status = 'completed'
     )
   where exists (
     select 1
       from public.bookings b
      where b.trainer_id = t.id
        and b.ends_at <= p_until
   );

  update private.booking_processing_runs bpr
     set processed_count = v_count
   where bpr.scope = 'process_due_bookings'
     and bpr.idempotency_key = p_idempotency_key;

  return v_count;
end;
$$;

revoke all on function public.process_due_bookings(uuid, timestamptz, uuid[], integer)
  from public, anon;
grant execute on function public.process_due_bookings(uuid, timestamptz, uuid[], integer)
  to authenticated, service_role;

create or replace function private.process_due_bookings_cron()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result integer;
begin
  -- pg_cron connects as the trusted database owner, but the public worker still
  -- proves the same service-role contract used by an external scheduler.
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  perform pg_catalog.set_config(
    'request.jwt.claims', '{"role":"service_role"}', true
  );

  v_result := public.process_due_bookings(
    extensions.gen_random_uuid(),
    pg_catalog.now() - interval '15 minutes',
    '{}'::uuid[],
    200
  );
  return v_result;
end;
$$;

revoke all on function private.process_due_bookings_cron()
  from public, anon, authenticated, service_role;

select cron.schedule(
  'mymovio-process-due-bookings',
  '*/5 * * * *',
  'select private.process_due_bookings_cron()'
);

drop function public.reserve_availability_offer(uuid, uuid);

create function public.reserve_availability_offer(
  p_offer_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_offer public.availability_offers%rowtype;
  v_booking public.bookings%rowtype;
  v_duration_minutes integer;
  v_error_sqlstate text;
  v_error_code text;
  v_error_details text;
  v_error_hint text;
begin
  perform pg_catalog.set_config('response.status', '200', true);

  if v_actor is not null and private.is_active_actor() then
    begin
      perform private.consume_actor_rate_limit(
        v_actor, 'create_booking', 20, interval '5 minutes'
      );
    exception when others then
      get stacked diagnostics
        v_error_sqlstate = returned_sqlstate,
        v_error_code = message_text,
        v_error_details = pg_exception_detail,
        v_error_hint = pg_exception_hint;
      return private.rpc_error_response(
        v_error_sqlstate, v_error_code, v_error_details, v_error_hint
      );
    end;
  end if;

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
      if v_booking.total_minor is distinct from v_offer.total_minor
         or v_booking.currency is distinct from v_offer.currency then
        raise exception using errcode = 'P0001', message = 'OFFER_PRICE_CHANGED';
      end if;
      return pg_catalog.to_jsonb(v_booking);
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

  v_duration_minutes :=
    extract(epoch from (v_offer.ends_at - v_offer.starts_at))::integer / 60;
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

  if v_booking.total_minor is distinct from v_offer.total_minor
     or v_booking.currency is distinct from v_offer.currency then
    raise exception using errcode = 'P0001', message = 'OFFER_PRICE_CHANGED';
  end if;

  update public.availability_offers ao
     set status = 'reserved',
         reserved_booking_id = v_booking.id
   where ao.id = p_offer_id;

  update public.notifications n
     set read_at = coalesce(n.read_at, pg_catalog.now())
   where n.recipient_id = v_actor
     and n.related_entity_type = 'availability_offer'
     and n.related_entity_id = p_offer_id;

    return pg_catalog.to_jsonb(v_booking);
  exception when others then
    get stacked diagnostics
      v_error_sqlstate = returned_sqlstate,
      v_error_code = message_text,
      v_error_details = pg_exception_detail,
      v_error_hint = pg_exception_hint;
    return private.rpc_error_response(
      v_error_sqlstate, v_error_code, v_error_details, v_error_hint
    );
  end;
end;
$$;

revoke all on function public.reserve_availability_offer(uuid, uuid)
  from public, anon;
grant execute on function public.reserve_availability_offer(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Data API least privilege and contextual profile-card visibility.
-- ---------------------------------------------------------------------------

revoke update (
  display_name, city, locale, timezone, onboarding_completed_at,
  selected_trainer_id
) on public.profiles from authenticated;

revoke insert, update, delete on public.user_sports from authenticated;

revoke select on public.booking_price_lines from authenticated;
revoke select on public.booking_status_history from authenticated;
revoke select on public.booking_settlement_events from authenticated;

revoke execute on function public.create_booking(uuid, uuid, uuid, uuid, uuid, timestamptz, integer, uuid[], text, text)
  from authenticated;
revoke execute on function public.reschedule_booking(uuid, uuid, timestamptz, integer)
  from authenticated;

revoke select on public.trainer_availability_rules from anon, authenticated;
revoke select (
  id, trainer_id, kind, starts_at, ends_at, created_at, updated_at, version
) on public.trainer_availability_exceptions from anon, authenticated;

drop policy if exists trainer_availability_rules_public_read
  on public.trainer_availability_rules;
drop policy if exists trainer_availability_exceptions_public_read
  on public.trainer_availability_exceptions;

drop policy if exists profiles_own_read on public.profiles;
create policy profiles_active_own_read
on public.profiles for select to authenticated
using (private.is_active_actor() and id = (select auth.uid()));

drop policy if exists profiles_own_update on public.profiles;
create policy profiles_active_own_update
on public.profiles for update to authenticated
using (private.is_active_actor() and id = (select auth.uid()))
with check (private.is_active_actor() and id = (select auth.uid()) and status = 'active');

drop policy if exists user_sports_own_read on public.user_sports;
drop policy if exists user_sports_own_insert on public.user_sports;
drop policy if exists user_sports_own_update on public.user_sports;
drop policy if exists user_sports_own_delete on public.user_sports;
create policy user_sports_active_own_read
on public.user_sports for select to authenticated
using (private.is_active_actor() and user_id = (select auth.uid()));
create policy user_sports_active_own_insert
on public.user_sports for insert to authenticated
with check (private.is_active_actor() and user_id = (select auth.uid()));
create policy user_sports_active_own_update
on public.user_sports for update to authenticated
using (private.is_active_actor() and user_id = (select auth.uid()))
with check (private.is_active_actor() and user_id = (select auth.uid()));
create policy user_sports_active_own_delete
on public.user_sports for delete to authenticated
using (private.is_active_actor() and user_id = (select auth.uid()));

drop policy if exists notification_preferences_own_read
  on public.notification_preferences;
drop policy if exists notification_preferences_own_update
  on public.notification_preferences;
create policy notification_preferences_active_own_read
on public.notification_preferences for select to authenticated
using (private.is_active_actor() and user_id = (select auth.uid()));
create policy notification_preferences_active_own_update
on public.notification_preferences for update to authenticated
using (private.is_active_actor() and user_id = (select auth.uid()))
with check (private.is_active_actor() and user_id = (select auth.uid()));

drop policy if exists device_installations_own_read on public.device_installations;
drop policy if exists device_installations_own_insert on public.device_installations;
drop policy if exists device_installations_own_update on public.device_installations;
drop policy if exists device_installations_own_delete on public.device_installations;
create policy device_installations_active_own_read
on public.device_installations for select to authenticated
using (private.is_active_actor() and user_id = (select auth.uid()));
create policy device_installations_active_own_insert
on public.device_installations for insert to authenticated
with check (private.is_active_actor() and user_id = (select auth.uid()));
create policy device_installations_active_own_update
on public.device_installations for update to authenticated
using (private.is_active_actor() and user_id = (select auth.uid()))
with check (private.is_active_actor() and user_id = (select auth.uid()));
create policy device_installations_active_own_delete
on public.device_installations for delete to authenticated
using (private.is_active_actor() and user_id = (select auth.uid()));

drop policy if exists notifications_own_read on public.notifications;
drop policy if exists notifications_own_update on public.notifications;
create policy notifications_active_own_read
on public.notifications for select to authenticated
using (private.is_active_actor() and recipient_id = (select auth.uid()));
create policy notifications_active_own_update
on public.notifications for update to authenticated
using (private.is_active_actor() and recipient_id = (select auth.uid()))
with check (private.is_active_actor() and recipient_id = (select auth.uid()));

drop policy if exists organization_memberships_visible_members
  on public.organization_memberships;
create policy organization_memberships_active_visible_members
on public.organization_memberships for select to authenticated
using (
  private.is_active_actor()
  and (
    user_id = (select auth.uid())
    or private.is_org_member(
      organization_id, array['owner', 'manager', 'reception']
    )
  )
);

drop policy if exists availability_alert_preferences_own_read
  on public.availability_alert_preferences;
create policy availability_alert_preferences_active_own_read
on public.availability_alert_preferences for select to authenticated
using (private.is_active_actor() and user_id = (select auth.uid()));

drop policy if exists availability_alert_windows_own_read
  on public.availability_alert_windows;
create policy availability_alert_windows_active_own_read
on public.availability_alert_windows for select to authenticated
using (
  private.is_active_actor()
  and exists (
    select 1 from public.availability_alert_preferences aap
     where aap.id = preference_id
       and aap.user_id = (select auth.uid())
  )
);

drop policy if exists availability_offers_recipient_read
  on public.availability_offers;
create policy availability_offers_active_recipient_read
on public.availability_offers for select to authenticated
using (
  private.is_active_actor()
  and (
    recipient_id = (select auth.uid())
    or exists (
      select 1
        from public.venues v
       where v.id = venue_id
         and private.is_org_member(
           v.organization_id, array['owner', 'manager', 'reception']
         )
    )
  )
);

drop policy if exists availability_offers_recipient_mark_read
  on public.availability_offers;
create policy availability_offers_active_recipient_mark_read
on public.availability_offers for update to authenticated
using (private.is_active_actor() and recipient_id = (select auth.uid()))
with check (private.is_active_actor() and recipient_id = (select auth.uid()));

drop policy if exists profile_cards_authenticated_read on public.profile_cards;
create policy profile_cards_contextual_read
on public.profile_cards for select to authenticated
using (private.can_read_profile_card(user_id));

grant execute on function private.can_read_profile_card(uuid) to authenticated;

-- Existing policies call these helpers after their definitions were hardened.
grant execute on function private.is_active_actor() to authenticated;
grant execute on function private.is_org_member(uuid, text[]) to authenticated;
grant execute on function private.is_booking_member(uuid) to authenticated;
grant execute on function private.is_conversation_member(uuid) to authenticated;
grant execute on function private.can_read_booking_note(uuid) to authenticated;

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
