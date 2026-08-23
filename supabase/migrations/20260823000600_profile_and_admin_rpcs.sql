-- Account-facing RPCs and explicit administrative account linkage.

create or replace function public.save_profile(
  p_display_name text,
  p_city text default null,
  p_locale text default 'pl-PL',
  p_timezone text default 'Europe/Warsaw',
  p_onboarding_completed boolean default false,
  p_primary_sport_id uuid default null,
  p_skill_system text default null,
  p_skill_code text default null,
  p_selected_trainer_id uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_display_name is null or char_length(pg_catalog.btrim(p_display_name)) not between 1 and 80 then
    raise exception using errcode = 'P0001', message = 'INVALID_DISPLAY_NAME';
  end if;
  if p_city is not null and char_length(p_city) > 120 then
    raise exception using errcode = 'P0001', message = 'INVALID_CITY';
  end if;
  if p_locale is null or char_length(p_locale) not between 2 and 20 then
    raise exception using errcode = 'P0001', message = 'INVALID_LOCALE';
  end if;
  if p_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names tz where tz.name = p_timezone
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_TIMEZONE';
  end if;
  if p_primary_sport_id is not null and not exists (
    select 1 from public.sports s where s.id = p_primary_sport_id and s.active
  ) then
    raise exception using errcode = 'P0001', message = 'SPORT_NOT_FOUND';
  end if;
  if p_selected_trainer_id is not null and not exists (
    select 1
      from public.trainers t
     where t.id = p_selected_trainer_id
       and t.status = 'active'
       and (
         p_primary_sport_id is null
         or exists (
           select 1
             from public.trainer_sports ts
            where ts.trainer_id = t.id
              and ts.sport_id = p_primary_sport_id
         )
       )
  ) then
    raise exception using errcode = 'P0001', message = 'TRAINER_NOT_FOUND';
  end if;
  if p_skill_system is not null and char_length(p_skill_system) > 40 then
    raise exception using errcode = 'P0001', message = 'INVALID_SKILL_SYSTEM';
  end if;
  if p_skill_code is not null and char_length(p_skill_code) > 40 then
    raise exception using errcode = 'P0001', message = 'INVALID_SKILL_CODE';
  end if;

  update public.profiles p
     set display_name = pg_catalog.btrim(p_display_name),
         city = nullif(pg_catalog.btrim(p_city), ''),
         locale = p_locale,
         timezone = p_timezone,
         selected_trainer_id = p_selected_trainer_id,
         onboarding_completed_at = case
           when p_onboarding_completed then coalesce(p.onboarding_completed_at, pg_catalog.now())
           else p.onboarding_completed_at
         end
   where p.id = v_actor
     and p.status = 'active'
  returning p.* into v_profile;

  if not found then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_ACTIVE';
  end if;

  if p_primary_sport_id is not null then
    update public.user_sports us
       set is_primary = false
     where us.user_id = v_actor
       and us.sport_id <> p_primary_sport_id
       and us.is_primary;

    insert into public.user_sports (
      user_id, sport_id, is_primary, skill_system, skill_code,
      assessed_at
    ) values (
      v_actor,
      p_primary_sport_id,
      true,
      nullif(pg_catalog.btrim(p_skill_system), ''),
      nullif(pg_catalog.btrim(p_skill_code), ''),
      case when p_skill_code is null then null else pg_catalog.now() end
    )
    on conflict (user_id, sport_id) do update
      set is_primary = true,
          skill_system = excluded.skill_system,
          skill_code = excluded.skill_code,
          assessed_at = excluded.assessed_at;
  end if;
  return v_profile;
end;
$$;

create or replace function public.select_trainer(p_trainer_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_trainer_id is not null and not exists (
    select 1 from public.trainers t where t.id = p_trainer_id and t.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'TRAINER_NOT_FOUND';
  end if;

  update public.profiles p
     set selected_trainer_id = p_trainer_id
   where p.id = v_actor
     and p.status = 'active'
  returning p.* into v_profile;

  if not found then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_ACTIVE';
  end if;
  return v_profile;
end;
$$;

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

  select pg_catalog.jsonb_build_object(
    'is_platform_admin', private.is_platform_admin(),
    'trainer_id', (
      select t.id from public.trainers t where t.user_id = v_actor limit 1
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
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_FOUND';
  end if;

  insert into private.platform_role_assignments (user_id, role, assigned_by, revoked_at)
  values (p_user_id, p_role, v_actor, case when p_enabled then null else pg_catalog.now() end)
  on conflict (user_id, role) do update
    set assigned_by = excluded.assigned_by,
        assigned_at = pg_catalog.now(),
        revoked_at = excluded.revoked_at;

  insert into private.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor,
    case when p_enabled then 'platform_role.assigned' else 'platform_role.revoked' end,
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
  if not exists (select 1 from public.organizations o where o.id = p_organization_id) then
    raise exception using errcode = 'P0001', message = 'ORGANIZATION_NOT_FOUND';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_FOUND';
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
          when excluded.status = 'active' then coalesce(public.organization_memberships.joined_at, pg_catalog.now())
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
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not private.is_platform_admin() then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.status = 'active') then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_ACTIVE';
  end if;
  if p_organization_id is not null and not exists (
    select 1 from public.organizations o where o.id = p_organization_id
  ) then
    raise exception using errcode = 'P0001', message = 'ORGANIZATION_NOT_FOUND';
  end if;

  update public.trainers t
     set user_id = p_user_id
   where t.id = p_trainer_id
  returning t.* into v_trainer;

  if not found then
    raise exception using errcode = 'P0001', message = 'TRAINER_NOT_FOUND';
  end if;

  if p_organization_id is not null then
    insert into public.organization_memberships (
      organization_id, user_id, role, status, invited_by, joined_at
    ) values (
      p_organization_id, p_user_id, 'trainer', 'active', v_actor, pg_catalog.now()
    )
    on conflict (organization_id, user_id) do update
      set role = 'trainer',
          status = 'active',
          invited_by = excluded.invited_by,
          joined_at = coalesce(public.organization_memberships.joined_at, pg_catalog.now());
  end if;

  insert into private.audit_events (
    actor_id, organization_id, action, entity_type, entity_id,
    metadata
  ) values (
    v_actor,
    p_organization_id,
    'trainer.account_linked',
    'trainer',
    p_trainer_id,
    pg_catalog.jsonb_build_object('user_id', p_user_id)
  );

  return v_trainer;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'TRAINER_ACCOUNT_ALREADY_LINKED';
end;
$$;

revoke all on function public.save_profile(text, text, text, text, boolean, uuid, text, text, uuid) from public, anon;
revoke all on function public.select_trainer(uuid) from public, anon;
revoke all on function public.get_my_roles() from public, anon;
revoke all on function public.admin_assign_platform_role(uuid, text, boolean) from public, anon;
revoke all on function public.admin_set_organization_membership(uuid, uuid, text, text) from public, anon;
revoke all on function public.admin_link_trainer_account(uuid, uuid, uuid) from public, anon;
