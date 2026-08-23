begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(8);

select extensions.is(
  (select count(*) from public.sports where code = 'tennis' and active),
  1::bigint,
  'seed has one active tennis sport'
);
select extensions.is(
  (select count(*) from public.organizations where kind = 'club' and status = 'active'),
  4::bigint,
  'seed has four active clubs'
);
select extensions.is(
  (select count(*) from public.venues where status = 'active'),
  4::bigint,
  'seed has four active venues'
);
select extensions.is(
  (select count(*) from public.courts where status = 'active'),
  37::bigint,
  'seed has 37 active courts'
);
select extensions.is(
  (select count(*) from public.trainers where status = 'active'),
  3::bigint,
  'seed has three active catalogue trainers'
);
select extensions.ok(
  not exists (select 1 from public.trainers where user_id is not null),
  'public seed does not link trainers to auth.users'
);
select extensions.ok(
  exists (select 1 from public.court_rates where amount_per_60_min_minor > 0),
  'seed includes positive court rates'
);
select extensions.ok(
  exists (select 1 from public.trainer_rates where amount_per_60_min_minor > 0),
  'seed includes positive trainer rates'
);

select * from extensions.finish();
rollback;
