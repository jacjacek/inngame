-- Public, deterministic tennis catalogue only. This seed deliberately creates
-- no auth.users, profiles, memberships, bookings, conversations or messages.

insert into public.sports (id, code, name_pl, active)
values ('00000000-0000-0000-0000-000000000001', 'tennis', 'Tenis', true)
on conflict (id) do update
  set code = excluded.code,
      name_pl = excluded.name_pl,
      active = excluded.active;

insert into public.organizations (id, kind, slug, display_name, status)
values
  ('10000000-0000-0000-0000-000000000001', 'club', 'korty-deski', 'Korty DeSki', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'club', 'legia-tenis', 'Legia Tenis', 'active'),
  ('10000000-0000-0000-0000-000000000003', 'club', 'warszawianka', 'Warszawianka', 'active'),
  ('10000000-0000-0000-0000-000000000004', 'club', 'kt-mera', 'KT Mera', 'active')
on conflict (id) do update
  set kind = excluded.kind,
      slug = excluded.slug,
      display_name = excluded.display_name,
      status = excluded.status;

insert into public.venues (
  id, organization_id, slug, name, address_line, postal_code, city,
  country_code, timezone, latitude, longitude, phone, status
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'warszawa-zaruskiego', 'Korty DeSki', 'ul. Zaruskiego 8', '00-468',
    'Warszawa', 'PL', 'Europe/Warsaw', 52.226700, 21.054100, null, 'active'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'warszawa-mysliwiecka', 'Legia Tenis', 'ul. Myśliwiecka 4A', '00-459',
    'Warszawa', 'PL', 'Europe/Warsaw', 52.223900, 21.039700, null, 'active'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    'warszawa-merliniego', 'Warszawianka', 'ul. Merliniego 9', '02-511',
    'Warszawa', 'PL', 'Europe/Warsaw', 52.196500, 21.021500, null, 'active'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000004',
    'warszawa-bohaterow-wrzesnia', 'KT Mera', 'al. Bohaterów Września 12', '02-389',
    'Warszawa', 'PL', 'Europe/Warsaw', 52.211200, 20.964200, null, 'active'
  )
on conflict (id) do update
  set organization_id = excluded.organization_id,
      slug = excluded.slug,
      name = excluded.name,
      address_line = excluded.address_line,
      postal_code = excluded.postal_code,
      city = excluded.city,
      country_code = excluded.country_code,
      timezone = excluded.timezone,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      phone = excluded.phone,
      status = excluded.status;

with venue_ids(id) as (
  values
    ('20000000-0000-0000-0000-000000000001'::uuid),
    ('20000000-0000-0000-0000-000000000002'::uuid),
    ('20000000-0000-0000-0000-000000000003'::uuid),
    ('20000000-0000-0000-0000-000000000004'::uuid)
)
insert into public.venue_opening_hours (
  id, venue_id, weekday, opens_local, closes_local, valid_from
)
select
  pg_catalog.md5('opening:' || v.id::text || ':' || d.weekday::text)::uuid,
  v.id,
  d.weekday,
  '06:00'::time,
  '23:00'::time,
  '2025-01-01'::date
from venue_ids v
cross join pg_catalog.generate_series(1, 7) as d(weekday)
on conflict (id) do update
  set opens_local = excluded.opens_local,
      closes_local = excluded.closes_local,
      valid_from = excluded.valid_from,
      valid_until = null;

with venue_catalog(venue_id, slug, court_count, surface, hourly_minor) as (
  values
    ('20000000-0000-0000-0000-000000000001'::uuid, 'korty-deski', 7, 'clay', 12000::bigint),
    ('20000000-0000-0000-0000-000000000002'::uuid, 'legia-tenis', 10, 'clay', 14000::bigint),
    ('20000000-0000-0000-0000-000000000003'::uuid, 'warszawianka', 8, 'clay', 11000::bigint),
    ('20000000-0000-0000-0000-000000000004'::uuid, 'kt-mera', 12, 'hard', 13000::bigint)
)
insert into public.courts (
  id, venue_id, sport_id, code, name, surface, indoor, status
)
select
  pg_catalog.md5('court:' || vc.slug || ':' || n.number::text)::uuid,
  vc.venue_id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'court-' || n.number::text,
  'Kort ' || n.number::text,
  case
    when vc.slug = 'legia-tenis' and n.number > 7 then 'hard'
    else vc.surface
  end,
  case
    when vc.slug in ('legia-tenis', 'kt-mera') and n.number > vc.court_count - 2 then true
    else false
  end,
  'active'
from venue_catalog vc
cross join lateral pg_catalog.generate_series(1, vc.court_count) as n(number)
on conflict (id) do update
  set venue_id = excluded.venue_id,
      sport_id = excluded.sport_id,
      code = excluded.code,
      name = excluded.name,
      surface = excluded.surface,
      indoor = excluded.indoor,
      status = excluded.status;

with venue_catalog(venue_id, slug, hourly_minor) as (
  values
    ('20000000-0000-0000-0000-000000000001'::uuid, 'korty-deski', 12000::bigint),
    ('20000000-0000-0000-0000-000000000002'::uuid, 'legia-tenis', 14000::bigint),
    ('20000000-0000-0000-0000-000000000003'::uuid, 'warszawianka', 11000::bigint),
    ('20000000-0000-0000-0000-000000000004'::uuid, 'kt-mera', 13000::bigint)
)
insert into public.court_rates (
  id, court_id, weekday, starts_local, ends_local,
  amount_per_60_min_minor, currency, valid_from, priority
)
select
  pg_catalog.md5('court-rate:' || c.id::text || ':' || d.weekday::text)::uuid,
  c.id,
  d.weekday,
  '06:00'::time,
  '23:00'::time,
  vc.hourly_minor,
  'PLN',
  '2025-01-01'::date,
  0
from public.courts c
join venue_catalog vc on vc.venue_id = c.venue_id
cross join pg_catalog.generate_series(1, 7) as d(weekday)
where c.sport_id = '00000000-0000-0000-0000-000000000001'::uuid
on conflict (id) do update
  set starts_local = excluded.starts_local,
      ends_local = excluded.ends_local,
      amount_per_60_min_minor = excluded.amount_per_60_min_minor,
      currency = excluded.currency,
      valid_from = excluded.valid_from,
      valid_until = null,
      priority = excluded.priority;

insert into public.trainers (
  id, user_id, slug, display_name, initials, specialty, certification, bio,
  public_contact_phone, experience_since, status,
  rating_average, rating_count, completed_bookings_count
)
values
  (
    '30000000-0000-0000-0000-000000000001', null, 'bartek-nowak',
    'Bartek Nowak', 'BN', 'Technika i gra meczowa', 'PTR Professional',
    'Pomagam zawodnikom grać pewniej i podejmować lepsze decyzje podczas meczu. Łączę technikę z ćwiczeniami, które od razu przekładają się na sytuacje punktowe.',
    '+48 501 284 690', '2018-01-01', 'active', 4.90, 86, 640
  ),
  (
    '30000000-0000-0000-0000-000000000002', null, 'anna-kowalska',
    'Anna Kowalska', 'AK', 'Pierwsze kroki i regularność', 'ITF Coaching Level 2',
    'Uczę tenisa od podstaw i pomagam wrócić do regularnej gry po dłuższej przerwie. Pracuję zarówno z dorosłymi, jak i młodzieżą.',
    '+48 607 441 208', '2016-01-01', 'active', 5.00, 112, 910
  ),
  (
    '30000000-0000-0000-0000-000000000003', null, 'michal-zielinski',
    'Michał Zieliński', 'MZ', 'Kondycja i przygotowanie turniejowe', 'GPTCA Level C',
    'Łączę pracę nad poruszaniem, wytrzymałością i schematami taktycznymi. Na treningach stawiam na indywidualne podejście i realny progres.',
    '+48 733 877 599', '2019-01-01', 'active', 4.80, 64, 520
  )
on conflict (id) do update
  set slug = excluded.slug,
      display_name = excluded.display_name,
      initials = excluded.initials,
      specialty = excluded.specialty,
      certification = excluded.certification,
      bio = excluded.bio,
      public_contact_phone = excluded.public_contact_phone,
      experience_since = excluded.experience_since,
      status = excluded.status,
      rating_average = excluded.rating_average,
      rating_count = excluded.rating_count,
      completed_bookings_count = excluded.completed_bookings_count;

insert into public.trainer_sports (trainer_id, sport_id, specialty)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Technika i gra meczowa'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Pierwsze kroki i regularność'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Kondycja i przygotowanie turniejowe'
  )
on conflict (trainer_id, sport_id) do update
  set specialty = excluded.specialty;

insert into public.trainer_venues (trainer_id, venue_id, active)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', true),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', true),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', true),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', true),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', true)
on conflict (trainer_id, venue_id) do update
  set active = excluded.active;

with trainer_catalog(trainer_id, hourly_minor) as (
  values
    ('30000000-0000-0000-0000-000000000001'::uuid, 12000::bigint),
    ('30000000-0000-0000-0000-000000000002'::uuid, 14000::bigint),
    ('30000000-0000-0000-0000-000000000003'::uuid, 13000::bigint)
)
insert into public.trainer_rates (
  id, trainer_id, sport_id, venue_id, weekday, starts_local, ends_local,
  amount_per_60_min_minor, currency, valid_from, priority
)
select
  pg_catalog.md5('trainer-rate:' || tc.trainer_id::text || ':' || d.weekday::text)::uuid,
  tc.trainer_id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  null,
  d.weekday,
  '06:00'::time,
  '23:00'::time,
  tc.hourly_minor,
  'PLN',
  '2025-01-01'::date,
  0
from trainer_catalog tc
cross join pg_catalog.generate_series(1, 7) as d(weekday)
on conflict (id) do update
  set starts_local = excluded.starts_local,
      ends_local = excluded.ends_local,
      amount_per_60_min_minor = excluded.amount_per_60_min_minor,
      currency = excluded.currency,
      valid_from = excluded.valid_from,
      valid_until = null,
      priority = excluded.priority;

with trainer_ids(id) as (
  values
    ('30000000-0000-0000-0000-000000000001'::uuid),
    ('30000000-0000-0000-0000-000000000002'::uuid),
    ('30000000-0000-0000-0000-000000000003'::uuid)
)
insert into public.trainer_availability_rules (
  id, trainer_id, venue_id, weekday, starts_local, ends_local,
  valid_from, slot_step_minutes
)
select
  pg_catalog.md5('trainer-availability:' || t.id::text || ':' || d.weekday::text)::uuid,
  t.id,
  null,
  d.weekday,
  '07:00'::time,
  '22:00'::time,
  '2025-01-01'::date,
  30
from trainer_ids t
cross join pg_catalog.generate_series(1, 7) as d(weekday)
on conflict (id) do update
  set starts_local = excluded.starts_local,
      ends_local = excluded.ends_local,
      valid_from = excluded.valid_from,
      valid_until = null,
      slot_step_minutes = excluded.slot_step_minutes;
