begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(17);

select extensions.ok(
  not exists (
    select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relname in (
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
       )
       and (not c.relrowsecurity or not c.relforcerowsecurity)
  ),
  'every exposed public table has RLS and FORCE RLS'
);

select extensions.ok(
  not pg_catalog.has_table_privilege('anon', 'public.bookings', 'SELECT'),
  'anon cannot read bookings'
);
select extensions.ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.bookings', 'INSERT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.bookings', 'UPDATE')
  and not pg_catalog.has_table_privilege('authenticated', 'public.bookings', 'DELETE'),
  'authenticated cannot mutate bookings directly'
);
select extensions.ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.messages', 'INSERT'),
  'authenticated cannot insert messages directly'
);
select extensions.ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.booking_settlement_events', 'INSERT'),
  'authenticated cannot insert settlement events directly'
);
select extensions.ok(
  not pg_catalog.has_schema_privilege('authenticated', 'private', 'USAGE')
  and not pg_catalog.has_schema_privilege('anon', 'private', 'USAGE'),
  'Data API roles cannot use the private schema'
);
select extensions.ok(
  pg_catalog.has_function_privilege(
    'authenticated', 'private.is_active_actor()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated', 'private.is_active_actor(uuid)', 'EXECUTE'
  ),
  'RLS may evaluate only the zero-argument active-account guard'
);
select extensions.ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.create_booking(uuid,uuid,uuid,uuid,uuid,timestamp with time zone,integer,uuid[],text,text)',
    'EXECUTE'
  ),
  'anon cannot execute create_booking'
);
select extensions.ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_booking(uuid,uuid,uuid,uuid,uuid,timestamp with time zone,integer,uuid[],text,text)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.reschedule_booking(uuid,uuid,timestamp with time zone,integer)',
    'EXECUTE'
  ),
  'authenticated cannot bypass quote-checked booking mutations'
);

select extensions.ok(
  not exists (
    select 1
      from information_schema.column_privileges cp
     where cp.table_schema = 'public'
       and cp.table_name = 'profiles'
       and cp.grantee = 'authenticated'
       and cp.privilege_type = 'UPDATE'
  )
  and not pg_catalog.has_table_privilege('authenticated', 'public.user_sports', 'INSERT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.user_sports', 'UPDATE')
  and not pg_catalog.has_table_privilege('authenticated', 'public.user_sports', 'DELETE'),
  'profile and user sport mutations are RPC-only'
);
select extensions.ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.booking_price_lines', 'SELECT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.booking_status_history', 'SELECT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.booking_settlement_events', 'SELECT'),
  'internal booking price and ledger tables are not directly readable'
);
select extensions.ok(
  not pg_catalog.has_table_privilege('anon', 'public.trainer_availability_rules', 'SELECT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.trainer_availability_rules', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'public.trainer_availability_exceptions', 'SELECT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.trainer_availability_exceptions', 'SELECT'),
  'exact trainer availability is server-only'
);
select extensions.ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.quote_booking(uuid,uuid,uuid,uuid,timestamp with time zone,integer,uuid)',
    'EXECUTE'
  ),
  'authenticated can request a server quote'
);
select extensions.ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.quote_booking(uuid,uuid,uuid,uuid,timestamp with time zone,integer,uuid)',
    'EXECUTE'
  ),
  'anon cannot request a server quote'
);
select extensions.ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_booking_with_quote(uuid,uuid,uuid,uuid,uuid,timestamp with time zone,integer,bigint,text,uuid[],text,text)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.reschedule_booking_with_quote(uuid,uuid,timestamp with time zone,integer,bigint,text)',
    'EXECUTE'
  ),
  'authenticated can use atomic quote-checked booking mutations'
);
select extensions.ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.create_booking_with_quote(uuid,uuid,uuid,uuid,uuid,timestamp with time zone,integer,bigint,text,uuid[],text,text)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.reschedule_booking_with_quote(uuid,uuid,timestamp with time zone,integer,bigint,text)',
    'EXECUTE'
  ),
  'anon cannot use quote-checked booking mutations'
);
select extensions.ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.process_due_bookings_cron()',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'private.process_due_bookings_cron()',
    'EXECUTE'
  ),
  'cron entrypoint is not executable through Data API roles'
);

select * from extensions.finish();
rollback;
