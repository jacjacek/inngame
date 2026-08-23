-- Deny-by-default Data API surface. Public catalogue is read-only; sensitive
-- mutations are exposed only through explicitly granted RPCs.

revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'sports', 'profiles', 'profile_cards', 'user_sports',
    'notification_preferences', 'device_installations', 'notifications',
    'organizations', 'organization_memberships', 'venues',
    'venue_opening_hours', 'venue_closures', 'courts', 'court_rates',
    'trainers', 'trainer_sports', 'trainer_venues', 'trainer_rates',
    'trainer_availability_rules', 'trainer_availability_exceptions',
    'bookings', 'booking_participants', 'booking_price_lines',
    'booking_status_history', 'booking_settlement_events', 'booking_notes',
    'conversations', 'conversation_members', 'messages',
    'availability_alert_preferences', 'availability_alert_windows',
    'availability_offers'
  ]
  loop
    execute pg_catalog.format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute pg_catalog.format('alter table public.%I enable row level security', v_table);
    execute pg_catalog.format('alter table public.%I force row level security', v_table);
  end loop;
end;
$$;

-- Identity and notification grants.
grant select on public.sports to anon, authenticated;
grant select (
  id, display_name, city, locale, timezone, status, onboarding_completed_at,
  selected_trainer_id, created_at, updated_at, version
) on public.profiles to authenticated;
grant update (
  display_name, city, locale, timezone, onboarding_completed_at, selected_trainer_id
) on public.profiles to authenticated;
grant select on public.profile_cards to authenticated;
grant select, insert, update, delete on public.user_sports to authenticated;
grant select on public.notification_preferences to authenticated;
grant update (
  training_reminders, chat_messages, schedule_changes, payment_updates,
  court_conditions, availability_alerts, quiet_hours_start, quiet_hours_end,
  marketing
) on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.device_installations to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Catalogue grants. trainers.user_id and exception reason are intentionally not
-- part of the public catalogue column grant; get_my_roles returns the own link.
grant select (id, kind, slug, display_name, status, created_at, updated_at, version)
  on public.organizations to anon, authenticated;
grant select on public.organization_memberships to authenticated;
grant select (
  id, organization_id, slug, name, address_line, postal_code, city,
  country_code, timezone, latitude, longitude, phone, status,
  created_at, updated_at, version
) on public.venues to anon, authenticated;
grant select on public.venue_opening_hours to anon, authenticated;
grant select (id, venue_id, starts_at, ends_at, reason, created_at, updated_at, version)
  on public.venue_closures to anon, authenticated;
grant select on public.courts to anon, authenticated;
grant select on public.court_rates to anon, authenticated;
grant select (
  id, slug, display_name, initials, specialty, certification, bio,
  public_contact_phone, image_url, experience_since, status,
  rating_average, rating_count, completed_bookings_count,
  created_at, updated_at, version
) on public.trainers to anon, authenticated;
grant select on public.trainer_sports to anon, authenticated;
grant select on public.trainer_venues to anon, authenticated;
grant select on public.trainer_rates to anon, authenticated;
grant select on public.trainer_availability_rules to anon, authenticated;
grant select (
  id, trainer_id, kind, starts_at, ends_at, created_at, updated_at, version
) on public.trainer_availability_exceptions to anon, authenticated;

-- Bookings and chat are read-only through Data API; RPCs own all writes.
grant select on public.bookings to authenticated;
grant select on public.booking_participants to authenticated;
grant select on public.booking_price_lines to authenticated;
grant select on public.booking_status_history to authenticated;
grant select on public.booking_settlement_events to authenticated;
grant select on public.booking_notes to authenticated;
grant select on public.conversations to authenticated;
grant select on public.conversation_members to authenticated;
grant select on public.messages to authenticated;
grant select on public.availability_alert_preferences to authenticated;
grant select on public.availability_alert_windows to authenticated;
grant select on public.availability_offers to authenticated;
grant update (read_at) on public.availability_offers to authenticated;

-- Identity policies.
create policy sports_public_read
on public.sports for select to anon, authenticated
using (active);

create policy profiles_own_read
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy profiles_own_update
on public.profiles for update to authenticated
using (id = (select auth.uid()) and status = 'active')
with check (id = (select auth.uid()) and status = 'active');

create policy profile_cards_authenticated_read
on public.profile_cards for select to authenticated
using (true);

create policy user_sports_own_read
on public.user_sports for select to authenticated
using (user_id = (select auth.uid()));
create policy user_sports_own_insert
on public.user_sports for insert to authenticated
with check (user_id = (select auth.uid()));
create policy user_sports_own_update
on public.user_sports for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy user_sports_own_delete
on public.user_sports for delete to authenticated
using (user_id = (select auth.uid()));

create policy notification_preferences_own_read
on public.notification_preferences for select to authenticated
using (user_id = (select auth.uid()));
create policy notification_preferences_own_update
on public.notification_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy device_installations_own_read
on public.device_installations for select to authenticated
using (user_id = (select auth.uid()));
create policy device_installations_own_insert
on public.device_installations for insert to authenticated
with check (user_id = (select auth.uid()));
create policy device_installations_own_update
on public.device_installations for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy device_installations_own_delete
on public.device_installations for delete to authenticated
using (user_id = (select auth.uid()));

create policy notifications_own_read
on public.notifications for select to authenticated
using (recipient_id = (select auth.uid()));
create policy notifications_own_update
on public.notifications for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

-- Organization and catalogue policies.
create policy organizations_anon_active_read
on public.organizations for select to anon
using (status = 'active');
create policy organizations_authenticated_read
on public.organizations for select to authenticated
using (status = 'active' or private.is_org_member(id, null));

create policy organization_memberships_visible_members
on public.organization_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_org_member(organization_id, array['owner', 'manager', 'reception'])
);

create policy venues_anon_active_read
on public.venues for select to anon
using (
  status = 'active'
  and exists (
    select 1 from public.organizations o
     where o.id = organization_id and o.status = 'active'
  )
);
create policy venues_authenticated_read
on public.venues for select to authenticated
using (
  (
    status = 'active'
    and exists (
      select 1 from public.organizations o
       where o.id = organization_id and o.status = 'active'
    )
  )
  or private.is_org_member(organization_id, null)
);

create policy venue_opening_hours_public_read
on public.venue_opening_hours for select to anon, authenticated
using (
  exists (
    select 1
      from public.venues v
      join public.organizations o on o.id = v.organization_id
     where v.id = venue_id and v.status = 'active' and o.status = 'active'
  )
);

create policy venue_closures_public_read
on public.venue_closures for select to anon, authenticated
using (
  exists (
    select 1
      from public.venues v
      join public.organizations o on o.id = v.organization_id
     where v.id = venue_id and v.status = 'active' and o.status = 'active'
  )
);

create policy courts_public_read
on public.courts for select to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1
      from public.venues v
      join public.organizations o on o.id = v.organization_id
     where v.id = venue_id and v.status = 'active' and o.status = 'active'
  )
);

create policy court_rates_public_read
on public.court_rates for select to anon, authenticated
using (
  exists (
    select 1
      from public.courts c
      join public.venues v on v.id = c.venue_id
      join public.organizations o on o.id = v.organization_id
     where c.id = court_id and c.status = 'active'
       and v.status = 'active' and o.status = 'active'
  )
);

create policy trainers_public_read
on public.trainers for select to anon, authenticated
using (status = 'active' or user_id = (select auth.uid()));

create policy trainer_sports_public_read
on public.trainer_sports for select to anon, authenticated
using (exists (select 1 from public.trainers t where t.id = trainer_id and t.status = 'active'));
create policy trainer_venues_public_read
on public.trainer_venues for select to anon, authenticated
using (active and exists (select 1 from public.trainers t where t.id = trainer_id and t.status = 'active'));
create policy trainer_rates_public_read
on public.trainer_rates for select to anon, authenticated
using (exists (select 1 from public.trainers t where t.id = trainer_id and t.status = 'active'));
create policy trainer_availability_rules_public_read
on public.trainer_availability_rules for select to anon, authenticated
using (exists (select 1 from public.trainers t where t.id = trainer_id and t.status = 'active'));
create policy trainer_availability_exceptions_public_read
on public.trainer_availability_exceptions for select to anon, authenticated
using (exists (select 1 from public.trainers t where t.id = trainer_id and t.status = 'active'));

-- Booking, note and conversation policies.
create policy bookings_member_read
on public.bookings for select to authenticated
using (private.is_booking_member(id));
create policy booking_participants_member_read
on public.booking_participants for select to authenticated
using (private.is_booking_member(booking_id));
create policy booking_price_lines_member_read
on public.booking_price_lines for select to authenticated
using (private.is_booking_member(booking_id));
create policy booking_status_history_member_read
on public.booking_status_history for select to authenticated
using (private.is_booking_member(booking_id));
create policy booking_settlement_events_member_read
on public.booking_settlement_events for select to authenticated
using (private.is_booking_member(booking_id));
create policy booking_notes_visibility_read
on public.booking_notes for select to authenticated
using (private.can_read_booking_note(id));

create policy conversations_member_read
on public.conversations for select to authenticated
using (private.is_conversation_member(id));
create policy conversation_members_member_read
on public.conversation_members for select to authenticated
using (private.is_conversation_member(conversation_id));
create policy messages_member_read
on public.messages for select to authenticated
using (private.is_conversation_member(conversation_id));

-- Availability alert policies.
create policy availability_alert_preferences_own_read
on public.availability_alert_preferences for select to authenticated
using (user_id = (select auth.uid()));
create policy availability_alert_windows_own_read
on public.availability_alert_windows for select to authenticated
using (
  exists (
    select 1 from public.availability_alert_preferences aap
     where aap.id = preference_id and aap.user_id = (select auth.uid())
  )
);
create policy availability_offers_recipient_read
on public.availability_offers for select to authenticated
using (
  recipient_id = (select auth.uid())
  or exists (
    select 1
      from public.venues v
     where v.id = venue_id
       and private.is_org_member(v.organization_id, array['owner', 'manager', 'reception'])
  )
);
create policy availability_offers_recipient_mark_read
on public.availability_offers for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

-- RLS helper execution is narrowly granted. The private schema itself remains
-- unavailable, so these helpers are usable only through stored policies/RPCs.
grant execute on function private.is_org_member(uuid, text[]) to authenticated;
grant execute on function private.is_booking_member(uuid) to authenticated;
grant execute on function private.is_conversation_member(uuid) to authenticated;
grant execute on function private.can_read_booking_note(uuid) to authenticated;

grant execute on function public.save_profile(text, text, text, text, boolean, uuid, text, text, uuid) to authenticated;
grant execute on function public.select_trainer(uuid) to authenticated;
grant execute on function public.get_my_roles() to authenticated;
grant execute on function public.admin_assign_platform_role(uuid, text, boolean) to authenticated;
grant execute on function public.admin_set_organization_membership(uuid, uuid, text, text) to authenticated;
grant execute on function public.admin_link_trainer_account(uuid, uuid, uuid) to authenticated;
grant execute on function public.create_booking(uuid, uuid, uuid, uuid, uuid, timestamptz, integer, uuid[], text, text) to authenticated;
grant execute on function public.reschedule_booking(uuid, uuid, timestamptz, integer) to authenticated;
grant execute on function public.cancel_booking(uuid, uuid, text) to authenticated;
grant execute on function public.set_booking_payment_status(uuid, uuid, text, text) to authenticated;
grant execute on function public.save_booking_note(uuid, text, text) to authenticated;
grant execute on function public.send_message(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid, uuid) to authenticated;
grant execute on function public.save_availability_alert(uuid, uuid, integer, jsonb, uuid, uuid, uuid, boolean, text, boolean, text, boolean, boolean, date, date) to authenticated;
grant execute on function public.reserve_availability_offer(uuid, uuid) to authenticated;

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
