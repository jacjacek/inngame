begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(47);

select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_extension e where e.extname = 'pg_cron'
  ),
  'pg_cron is installed for due booking processing'
);
select extensions.ok(
  pg_catalog.to_regprocedure('private.process_due_bookings_cron()') is not null,
  'private cron-safe due booking entrypoint exists'
);
select extensions.ok(
  exists (
    select 1
      from cron.job j
     where j.jobname = 'mymovio-process-due-bookings'
       and j.schedule = '*/5 * * * *'
       and j.command = 'select private.process_due_bookings_cron()'
       and j.active
  ),
  'due booking processing is scheduled every five minutes'
);
select extensions.is(
  (
    select pg_catalog.count(*)
      from pg_catalog.pg_constraint c
     where c.conname in (
       'court_rates_pln_only', 'trainer_rates_pln_only',
       'bookings_pln_only', 'availability_offers_pln_only',
       'bookings_starts_on_15_minute_grid',
       'bookings_positive_total_requires_payment'
     )
       and c.contype = 'c'
       and c.convalidated
  ),
  6::bigint,
  'PLN, slot-grid and payment constraints are fully validated'
);
select extensions.is(
  (
    select pg_catalog.count(*)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'quote_booking', 'create_booking_with_quote',
         'reschedule_booking_with_quote', 'reserve_availability_offer'
       )
       and pg_catalog.format_type(p.prorettype, null) = 'jsonb'
  ),
  4::bigint,
  'public rate-limited RPCs return JSON success or standard PostgREST error bodies'
);

select extensions.has_table('public', required.name, 'required table public.' || required.name)
from (
  values
    ('profiles'), ('sports'), ('organizations'), ('organization_memberships'),
    ('trainers'), ('venues'), ('courts'), ('bookings'),
    ('booking_status_history'), ('booking_settlement_events'), ('booking_notes'),
    ('conversations'), ('conversation_members'), ('messages'),
    ('availability_alert_preferences'), ('availability_alert_windows'),
    ('availability_offers')
) required(name);

select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint c
     where c.conname = 'bookings_no_court_overlap' and c.contype = 'x'
  ),
  'court overlap is protected by an exclusion constraint'
);

select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint c
     where c.conname = 'bookings_no_trainer_overlap' and c.contype = 'x'
  ),
  'trainer overlap is protected by an exclusion constraint'
);

select extensions.has_column(
  'public', 'profiles', 'selected_trainer_id',
  'profiles persists the selected catalogue trainer'
);
select extensions.has_column(
  'public', 'availability_offers', 'conversation_id',
  'availability offers can be rendered in a conversation'
);
select extensions.has_column(
  'public', 'availability_offers', 'read_at',
  'availability offers have an independent read cursor'
);
select extensions.has_column(
  'public', 'availability_offers', 'dedupe_key',
  'availability offers have an idempotent producer key'
);
select extensions.has_table(
  'private', 'availability_conversations',
  'availability conversations have a private ownership mapping'
);

select extensions.ok(
  pg_catalog.to_regprocedure(required.signature) is not null,
  'required RPC ' || required.signature
)
from (
  values
    ('public.save_profile(text,text,text,text,boolean,uuid,text,text,uuid)'),
    ('public.select_trainer(uuid)'),
    ('public.get_my_roles()'),
    ('public.create_booking(uuid,uuid,uuid,uuid,uuid,timestamp with time zone,integer,uuid[],text,text)'),
    ('public.reschedule_booking(uuid,uuid,timestamp with time zone,integer)'),
    ('public.cancel_booking(uuid,uuid,text)'),
    ('public.set_booking_payment_status(uuid,uuid,text,text)'),
    ('public.save_booking_note(uuid,text,text)'),
    ('public.send_message(uuid,uuid,text,uuid)'),
    ('public.mark_conversation_read(uuid,uuid)'),
    ('public.save_availability_alert(uuid,uuid,integer,jsonb,uuid,uuid,uuid,boolean,text,boolean,text,boolean,boolean,date,date)'),
    ('public.reserve_availability_offer(uuid,uuid)'),
    ('public.quote_booking(uuid,uuid,uuid,uuid,timestamp with time zone,integer,uuid)'),
    ('public.create_booking_with_quote(uuid,uuid,uuid,uuid,uuid,timestamp with time zone,integer,bigint,text,uuid[],text,text)'),
    ('public.reschedule_booking_with_quote(uuid,uuid,timestamp with time zone,integer,bigint,text)'),
    ('public.publish_availability_slot(uuid,uuid,uuid,uuid,uuid,timestamp with time zone,integer)'),
    ('public.process_due_bookings(uuid,timestamp with time zone,uuid[],integer)')
) required(signature);

select extensions.ok(
  not exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'save_profile', 'select_trainer', 'get_my_roles',
         'admin_assign_platform_role', 'admin_set_organization_membership',
         'admin_link_trainer_account', 'create_booking', 'reschedule_booking',
         'cancel_booking', 'set_booking_payment_status', 'save_booking_note',
         'send_message', 'mark_conversation_read', 'save_availability_alert',
         'reserve_availability_offer', 'quote_booking',
         'create_booking_with_quote', 'reschedule_booking_with_quote',
         'publish_availability_slot', 'process_due_bookings'
       )
       and (
         not p.prosecdef
         or not exists (
           select 1
             from pg_catalog.unnest(coalesce(p.proconfig, '{}'::text[])) setting(value)
            where setting.value in ('search_path=', 'search_path=""')
         )
       )
  ),
  'every client RPC is SECURITY DEFINER with an empty search_path'
);

select * from extensions.finish();
rollback;
