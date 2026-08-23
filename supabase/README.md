# Supabase database layer

This directory contains the production-MVP database contract. It intentionally
does not include a payment processor or prepaid-package ledger. Bookings use only
the manual settlement states `unpaid`, `paid` and `not_required`.

## Local verification

```sh
supabase db reset
supabase test db supabase/tests --local
```

The seed is safe for a public catalogue: it creates deterministic tennis, club,
venue, court, rate and unlinked trainer rows only. It never inserts `auth.users`.

The pgTAP suite covers the schema and grants as well as active-account
deprovisioning, role isolation, trainer relinking/backfill, contextual profile
cards, authoritative quoting, slot conflicts, quota/rate limiting, automatic
availability offers, reservation, settlement resets and due-booking processing.

## Booking and settlement operations

`quote_booking` is the authoritative preview used before create/reschedule:

```text
quote_booking(
  p_sport_id uuid,
  p_venue_id uuid,
  p_court_id uuid,
  p_trainer_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_exclude_booking_id uuid default null
) -> jsonb
```

Its stable response keys are `court_amount_minor`, `trainer_amount_minor`,
`subtotal_minor`, `discount_minor`, `total_minor`, `currency`, `starts_at`,
`ends_at`, `duration_minutes`, the selected resource/rate IDs and
`payment_status`. An exclusion is accepted only for an existing booking the
actor may manage, and only when its sport/venue/court/trainer match the quote.
The MVP is explicitly PLN-only: court rates, trainer rates, bookings and offers
enforce `currency = 'PLN'`; no currency conversion is implied by the schema.
Migration 011 refuses to continue when it finds incompatible legacy currency,
slot-grid or payment-state rows, and then fully validates all six constraints.

Price-sensitive clients should mutate through
`create_booking_with_quote(..., p_expected_total_minor, p_expected_currency, ...)`
and `reschedule_booking_with_quote(..., p_expected_total_minor,
p_expected_currency)`. Both execute the existing lifecycle RPC in the same
transaction. On a mismatch they return the standard PostgREST error object
`{code,message,details,hint}` with HTTP 409 and code `QUOTE_CHANGED`; the booking
change and its idempotency claim roll back together. Reserving an availability
offer performs the equivalent comparison against the stored offer and returns
`OFFER_PRICE_CHANGED`/409 on drift. Successful create, reschedule and reserve
responses remain a JSON booking object. The legacy unquoted `create_booking` and
`reschedule_booking` implementations are no longer executable by
`authenticated`; they remain private implementation boundaries for these
quote-checked wrappers.

Booking starts are aligned to at least 15 minutes and to an applicable trainer
availability rule's `slot_step_minutes`. A creator can hold at most 12 future,
confirmed, unpaid bookings. The quota uses a per-creator transaction advisory
lock, so concurrent inserts cannot all pass an earlier count. Create/reserve
attempts are limited to 20 per 5 minutes and quotes to 60 per 5 minutes.
Rate consumption sits outside the rollback scope of the operation itself, so
invalid, conflicting and stale-price attempts count too. Domain failures use a
standard 4xx PostgREST body (and therefore `result.error` in Supabase JS);
unexpected database failures are sanitized to `INTERNAL_ERROR`/500 without raw
SQL details.

There is no online payment integration. For a positive total the public manual
settlement RPC accepts only `paid` and `unpaid`; `not_required` is reserved for
genuinely zero-price bookings. A price-changing reschedule resets a paid booking
to unpaid and appends an auditable settlement event.

`process_due_bookings` idempotently moves due confirmed bookings to `completed`
or an explicitly selected `no_show`, then recomputes trainer completion counts.
It is callable only by `service_role` or an active platform administrator.
The migration installs the private, fully revoked
`private.process_due_bookings_cron()` entrypoint and the idempotently named
`mymovio-process-due-bookings` pg_cron job (`*/5 * * * *`). The wrapper sets a
transaction-local service claim and invokes the same checked public worker; it
does not weaken the public RPC's authorization. Automatic completion uses a
15-minute grace period after the scheduled end; an explicit privileged run can
still classify selected due booking IDs as `no_show` during that window.

## Availability delivery

Cancellation and rescheduling status-history events synchronously match freed
future slots against active preferences, windows, lead time, duration, venue and
trainer. A match creates an idempotent `availability_offer`, an in-app
notification and (when enabled) a push outbox event in the same transaction.
`publish_availability_slot` exposes the same producer only to the linked trainer
or venue owner/manager/reception.

To prevent client-to-client chat spam, a venue-only preference gets a private
one-person alert conversation. A second member is added only when the preference
explicitly targets a trainer who currently has an active linked account. Offer
production requires no external worker; actual push transport still consumes
the durable private outbox.

## Account security

Authorization helpers check `profiles.status = 'active'` on every request,
independently of JWT lifetime. Leaving `active` synchronously disables
organization memberships and alert preferences, revokes platform roles, unlinks
trainer accounts, marks historical coach participation removed, leaves
conversations and disables device installations. Every private/own Data API
policy repeats the active-account guard, so a blocked JWT cannot bypass the
helper layer. Reactivation alone does not restore old coach access; a platform
administrator must explicitly relink that trainer account.
Profile cards are visible only to self, shared booking/conversation members and
staff with a concrete organization context; they are not globally enumerable.

Direct writes to profiles and user sports are intentionally revoked. Use
`save_profile`/`select_trainer`. Internal price lines, booking status history and
settlement events also have no direct authenticated SELECT grant.

## First platform administrator

`private.platform_role_assignments` is deliberately not exposed through the Data
API and no role is derived from `auth.users.raw_user_meta_data`. Bootstrap the
first administrator once from a trusted SQL/service session, after that account
has registered and its profile trigger has completed:

```sql
insert into private.platform_role_assignments (user_id, role)
values ('<existing-auth-user-uuid>'::uuid, 'platform_admin')
on conflict (user_id, role) do update
set revoked_at = null, assigned_at = now();
```

Subsequent assignments use `admin_assign_platform_role`. Link a catalogue trainer
to a real account with `admin_link_trainer_account`; optionally pass an
organization so the function also creates its active `trainer` membership. The
organization must actually serve that trainer. Relinking is atomic: historical
coach participants and booking chat memberships move to the new account, while
an old account keeps any independent organizer/player access.

Do not put service/secret keys in this directory, application configuration,
`EXPO_PUBLIC_*`, logs or test fixtures.
