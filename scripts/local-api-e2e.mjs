import { execFileSync, spawn } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbContainer = 'supabase_db_mymovio';
const sportId = '00000000-0000-0000-0000-000000000001';
const organizationId = '10000000-0000-0000-0000-000000000001';
const venueId = '20000000-0000-0000-0000-000000000001';
const trainerId = '30000000-0000-0000-0000-000000000001';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseStatusEnv() {
  const output = execFileSync(
    'npx',
    ['supabase', 'status', '-o', 'env'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: { ...process.env, DO_NOT_TRACK: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(?:"(.*)"|(.*))$/);
    if (match) values[match[1]] = match[2] ?? match[3];
  }
  assert(values.API_URL?.startsWith('http://127.0.0.1:'), 'Local Supabase API URL is unavailable.');
  assert(values.ANON_KEY, 'Local Supabase anonymous key is unavailable.');
  return values;
}

function sqlUuid(value) {
  assert(uuidPattern.test(value), `Invalid UUID supplied to local SQL bootstrap: ${value}`);
  return `'${value}'::uuid`;
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runLocalSql(sql) {
  return execFileSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-X', '-q', '-tA', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

function startLocalSql(sql, applicationName) {
  const child = spawn(
    'docker',
    [
      'exec', '-i', dbContainer,
      'psql', '-X', '-q', '-tA', '-U', 'postgres', '-d', 'postgres',
      '-v', 'ON_ERROR_STOP=1',
      '-c', `set application_name = ${sqlText(applicationName)}; ${sql}`,
    ],
    { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  return new Promise((resolvePromise) => {
    child.on('error', (error) => {
      resolvePromise({ code: null, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
  });
}

function holdLocalTransaction(applicationName, statements) {
  const marker = `READY_${randomUUID().replaceAll('-', '')}`;
  const child = spawn(
    'docker',
    [
      'exec', '-i', dbContainer,
      'psql', '-X', '-q', '-tA', '-U', 'postgres', '-d', 'postgres',
      '-v', 'ON_ERROR_STOP=1',
    ],
    { cwd: projectRoot, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let stdout = '';
  let stderr = '';
  let markerSeen = false;
  let released = false;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolvePromise, rejectPromise) => {
    resolveReady = resolvePromise;
    rejectReady = rejectPromise;
  });
  const exited = new Promise((resolvePromise) => {
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (!markerSeen && stdout.includes(marker)) {
        markerSeen = true;
        resolveReady();
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      stderr += error.message;
    });
    child.on('close', (code) => {
      if (!markerSeen) {
        rejectReady(new Error(`${applicationName} exited before its transaction was ready: ${stderr.trim()}`));
      }
      resolvePromise({ code, stdout, stderr });
    });
  });

  child.stdin.write(`begin;\n${statements}\nselect ${sqlText(marker)};\n`);

  async function finish(command) {
    if (released) return exited;
    released = true;
    if (!child.stdin.destroyed) {
      child.stdin.end(`${command};\n\\q\n`);
    }
    return exited;
  }

  return {
    ready,
    commit: () => finish('commit'),
    rollback: () => finish('rollback'),
  };
}

async function waitForSqlCondition(sql, predicate, label, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = '';
  while (Date.now() < deadline) {
    lastValue = runLocalSql(sql).trim();
    if (predicate(lastValue)) return lastValue;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error(`${label}: database condition timed out (last value: ${lastValue || '<empty>'}).`);
}

function authenticatedJwt(jwtSecret, userId) {
  const issuedAt = Math.floor(Date.now() / 1_000) - 5;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode({
      aud: 'authenticated',
      exp: issuedAt + 3_600,
      iat: issuedAt,
      role: 'authenticated',
      sub: userId,
    }),
  ].join('.');
  const signature = createHmac('sha256', jwtSecret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function provisionRaceActors(environment, count) {
  assert(environment.JWT_SECRET, 'Local JWT secret is unavailable.');
  const actors = Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(12, '0');
    return {
      id: `a11ce000-0000-4000-8000-${sequence}`,
      displayName: `Wyścig API ${String(index + 1).padStart(3, '0')}`,
    };
  });
  const values = actors.map((actor, index) => `(
    ${sqlUuid(actor.id)},
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    ${sqlText(`race-${String(index + 1).padStart(3, '0')}@local.e2e.invalid`)},
    pg_catalog.now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    pg_catalog.jsonb_build_object('display_name', ${sqlText(actor.displayName)}),
    pg_catalog.now(),
    pg_catalog.now()
  )`).join(',');
  runLocalSql(`
    insert into auth.users (
      id, instance_id, aud, role, email, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values ${values};
    update public.profiles
       set onboarding_completed_at = pg_catalog.now(),
           selected_trainer_id = ${sqlUuid(trainerId)}
     where id = any(array[${actors.map((actor) => sqlUuid(actor.id)).join(',')}]::uuid[]);
  `);
  return actors.map((actor) => ({
    id: actor.id,
    client: createClient(environment.API_URL, environment.ANON_KEY, {
      ...clientOptions(),
      accessToken: async () => authenticatedJwt(environment.JWT_SECRET, actor.id),
    }),
  }));
}

function rescheduleRollbackFingerprint(bookingId, actorId, requestId) {
  return runLocalSql(`
    select pg_catalog.jsonb_build_object(
      'idempotency_claims', (
        select pg_catalog.count(*)
          from private.idempotency_keys ik
         where ik.actor_id = ${sqlUuid(actorId)}
           and ik.scope = 'reschedule_booking'
           and ik.key = ${sqlUuid(requestId)}
      ),
      'reschedule_history', (
        select pg_catalog.count(*)
          from public.booking_status_history bsh
         where bsh.booking_id = ${sqlUuid(bookingId)}
           and bsh.reason = 'booking_rescheduled'
      ),
      'settlement_events', (
        select pg_catalog.count(*)
          from public.booking_settlement_events bse
         where bse.booking_id = ${sqlUuid(bookingId)}
      ),
      'reschedule_messages', (
        select pg_catalog.count(*)
          from public.messages m
         where m.related_booking_id = ${sqlUuid(bookingId)}
           and m.kind = 'system'
           and m.body = 'Termin treningu został zmieniony.'
      ),
      'reschedule_outbox', (
        select pg_catalog.count(*)
          from private.outbox_events oe
         where oe.aggregate_id = ${sqlUuid(bookingId)}
           and oe.event_type = 'booking.rescheduled'
      ),
      'request_audit', (
        select pg_catalog.count(*)
          from private.audit_events ae
         where ae.entity_id = ${sqlUuid(bookingId)}
           and ae.request_id = ${sqlUuid(requestId)}
      ),
      'reschedule_notifications', (
        select pg_catalog.count(*)
          from public.notifications n
         where n.related_entity_id = ${sqlUuid(bookingId)}
           and n.type = 'booking.rescheduled'
      ),
      'conversation_last_message_at', (
        select c.last_message_at
          from public.conversations c
         where c.booking_id = ${sqlUuid(bookingId)}
           and c.kind = 'booking'
      ),
      'price_lines', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', bpl.id,
            'kind', bpl.kind,
            'quantity', bpl.quantity,
            'unit_amount_minor', bpl.unit_amount_minor,
            'total_amount_minor', bpl.total_amount_minor,
            'source_rate_id', bpl.source_rate_id,
            'position', bpl.position,
            'created_at', bpl.created_at
          ) order by bpl.position
        )
          from public.booking_price_lines bpl
         where bpl.booking_id = ${sqlUuid(bookingId)}
      ), '[]'::jsonb)
    )::text;
  `).trim();
}

function unwrap(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

function firstRow(data, label) {
  const row = Array.isArray(data) ? data[0] : data;
  assert(row && typeof row === 'object', `${label}: response row is missing.`);
  return row;
}

function isJwtIssuedAtFuture(error) {
  return error?.code === 'PGRST303' && error.message === 'JWT issued at future';
}

async function retryJwtIssuedAtFuture(client, request, label) {
  let result = await request();
  if (!isJwtIssuedAtFuture(result.error)) return result;

  const session = unwrap(await client.auth.getSession(), `${label} session`).session;
  const tokenPart = session?.access_token?.split('.')[1];
  assert(tokenPart, `${label}: access-token claims are missing.`);
  const claims = JSON.parse(Buffer.from(tokenPart, 'base64url').toString('utf8'));
  assert(Number.isInteger(claims.iat), `${label}: access-token iat is missing.`);

  // Local Auth and PostgREST share the host clock, but immediately after a
  // reset PostgREST can validate against a timestamp cached in the prior
  // second. Retry only this exact pre-SQL rejection after the token is safely
  // beyond its issuance second; persistent or material skew still fails.
  const now = Date.now();
  const safeAt = Math.max(
    (claims.iat + 1) * 1_000,
    (Math.floor(now / 1_000) + 1) * 1_000,
  ) + 50;
  const waitMs = safeAt - now;
  assert(waitMs <= 5_000, `${label}: JWT iat is materially ahead of the test clock.`);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, waitMs));

  result = await request();
  return result;
}

function expectRpcError(result, expected, label) {
  assert(result.error, `${label}: request unexpectedly succeeded.`);
  const details = [result.error.message, result.error.details, result.error.hint].filter(Boolean).join(' ');
  assert(details.includes(expected), `${label}: expected ${expected}, received ${details}.`);
}

function futureStart(daysAhead, utcHour = 10) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + daysAhead);
  value.setUTCHours(utcHour, 0, 0, 0);
  return value.toISOString();
}

function localDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function clientOptions() {
  return {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  };
}

async function register(apiUrl, anonKey, runId, role, displayName) {
  const client = createClient(apiUrl, anonKey, clientOptions());
  const email = `mymovio-api-${runId}-${role}@example.com`;
  const password = `Local-only-${runId}-${role}!`;
  const signup = await client.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (signup.error) throw new Error(`signUp(${role}): ${signup.error.message}`);
  if (!signup.data.session) {
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw new Error(`signIn(${role}): ${login.error.message}`);
  }
  const user = unwrap(await client.auth.getUser(), `getUser(${role})`).user;
  assert(user?.id, `getUser(${role}): authenticated user is missing.`);
  return { client, id: user.id };
}

async function saveProfile(account, name, selectedTrainerId = null) {
  const save = () => account.client.rpc('save_profile', {
    p_display_name: name,
    p_city: 'Warszawa',
    p_locale: 'pl-PL',
    p_timezone: 'Europe/Warsaw',
    p_onboarding_completed: true,
    p_primary_sport_id: sportId,
    p_skill_system: 'NTRP',
    p_skill_code: '3.5',
    p_selected_trainer_id: selectedTrainerId,
  });
  unwrap(
    await retryJwtIssuedAtFuture(account.client, save, `save_profile(${name})`),
    `save_profile(${name})`,
  );
}

async function waitForMessage(client, conversationId, action) {
  const session = unwrap(await client.auth.getSession(), 'Realtime session').session;
  assert(session?.access_token, 'Realtime session token is missing.');
  await client.realtime.setAuth(session.access_token);
  let timer;
  let resolveReady;
  let rejectReady;
  let resolvePostgresReady;
  let rejectPostgresReady;
  let resolveReplicationReady;
  let rejectReplicationReady;
  let resolveEvent;
  let rejectEvent;
  const ready = new Promise((resolvePromise, rejectPromise) => {
    resolveReady = resolvePromise;
    rejectReady = rejectPromise;
  });
  const event = new Promise((resolvePromise, rejectPromise) => {
    resolveEvent = resolvePromise;
    rejectEvent = rejectPromise;
  });
  const postgresReady = new Promise((resolvePromise, rejectPromise) => {
    resolvePostgresReady = resolvePromise;
    rejectPostgresReady = rejectPromise;
  });
  const replicationReady = new Promise((resolvePromise, rejectPromise) => {
    resolveReplicationReady = resolvePromise;
    rejectReplicationReady = rejectPromise;
  });
  const channel = client
    // Phoenix SUBSCRIBED can precede cold-start CDC registration by seconds.
    // Ask Realtime for explicit replication and Postgres subscription signals.
    .channel(`api-e2e-${randomUUID()}`, {
      config: { broadcast: { replication_ready: true } },
    })
    .on(
      'postgres_changes',
      // Keep the production client's unfiltered subscription shape. RLS still
      // limits rows to conversation members, and this avoids a known Realtime
      // server regression affecting filtered Postgres Changes subscriptions.
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        if (payload.new.conversation_id === conversationId) resolveEvent(payload.new);
      },
    )
    .on('system', {}, (payload) => {
      if (payload.status === 'ok' && payload.extension === 'postgres_changes') {
        resolvePostgresReady();
      }
      if (payload.status === 'ok' && payload.extension === 'system') {
        resolveReplicationReady();
      }
      if (payload.status === 'error') {
        const error = new Error(
          `Realtime system readiness failed: ${payload.extension ?? 'unknown'} (${payload.message ?? 'unknown error'})`,
        );
        rejectPostgresReady(error);
        rejectReplicationReady(error);
      }
    })
    .subscribe((status, error) => {
      if (status === 'SUBSCRIBED') resolveReady();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        const subscriptionError = new Error(
          `Realtime subscription failed: ${status}${error?.message ? ` (${error.message})` : ''}`,
        );
        rejectReady(subscriptionError);
        rejectPostgresReady(subscriptionError);
        rejectReplicationReady(subscriptionError);
        rejectEvent(subscriptionError);
      }
    });
  try {
    timer = setTimeout(() => {
      const error = new Error('Realtime message event timed out.');
      rejectReady(error);
      rejectPostgresReady(error);
      rejectReplicationReady(error);
      rejectEvent(error);
    }, 15_000);
    await Promise.all([ready, postgresReady, replicationReady]);
    await action();
    return await event;
  } finally {
    clearTimeout(timer);
    await client.removeChannel(channel);
  }
}

async function main() {
  const environment = parseStatusEnv();
  const pristineTrainer = runLocalSql(`
    select user_id is null
      from public.trainers
     where id = ${sqlUuid(trainerId)};
  `).trim();
  assert(pristineTrainer === 't', 'Local API E2E requires a clean database. Run npm run db:reset first.');
  const runId = Date.now().toString(36);
  const accounts = [];

  try {
    const player = await register(environment.API_URL, environment.ANON_KEY, runId, 'player', 'Gracz API');
    const trainer = await register(environment.API_URL, environment.ANON_KEY, runId, 'trainer', 'Trener API');
    const admin = await register(environment.API_URL, environment.ANON_KEY, runId, 'admin', 'Administrator API');
    const staff = await register(environment.API_URL, environment.ANON_KEY, runId, 'staff', 'Recepcja API');
    const stranger = await register(environment.API_URL, environment.ANON_KEY, runId, 'stranger', 'Obcy API');
    const quotaUser = await register(environment.API_URL, environment.ANON_KEY, runId, 'quota', 'Limit API');
    accounts.push(player, trainer, admin, staff, stranger, quotaUser);

    await Promise.all([
      saveProfile(player, 'Gracz API', trainerId),
      saveProfile(trainer, 'Trener API'),
      saveProfile(admin, 'Administrator API'),
      saveProfile(staff, 'Recepcja API'),
      saveProfile(stranger, 'Obcy API'),
      saveProfile(quotaUser, 'Limit API', trainerId),
    ]);

    runLocalSql(`
      insert into private.platform_role_assignments (user_id, role, assigned_by)
      values (${sqlUuid(admin.id)}, 'platform_admin', ${sqlUuid(admin.id)})
      on conflict (user_id, role) do update
        set assigned_by = excluded.assigned_by, revoked_at = null;
    `);
    const adminRoles = unwrap(await admin.client.rpc('get_my_roles'), 'admin get_my_roles');
    assert(adminRoles.is_platform_admin === true, 'Trusted platform-admin bootstrap was not reflected by the API.');

    const courtRows = unwrap(await player.client
      .from('courts')
      .select('id,venue_id,sport_id,status')
      .eq('venue_id', venueId)
      .eq('sport_id', sportId)
      .eq('status', 'active')
      .order('code')
      .limit(1), 'load active court');
    assert(courtRows.length === 1, 'Seeded active court is missing.');
    const courtId = courtRows[0].id;

    const startsAt = futureStart(7);
    const quote = firstRow(unwrap(await player.client.rpc('quote_booking', {
      p_sport_id: sportId,
      p_venue_id: venueId,
      p_court_id: courtId,
      p_trainer_id: trainerId,
      p_starts_at: startsAt,
      p_duration_minutes: 60,
      p_exclude_booking_id: null,
    }), 'initial quote'), 'initial quote');
    assert(quote.total_minor > 0 && quote.currency === 'PLN', 'Server quote is not a positive PLN amount.');

    const staleKey = randomUUID();
    const staleCreate = await player.client.rpc('create_booking_with_quote', {
      p_idempotency_key: staleKey,
      p_sport_id: sportId,
      p_venue_id: venueId,
      p_court_id: courtId,
      p_trainer_id: trainerId,
      p_starts_at: startsAt,
      p_duration_minutes: 60,
      p_expected_total_minor: quote.total_minor + 1,
      p_expected_currency: quote.currency,
      p_participant_user_ids: [],
      p_title: 'Atomiczna rezerwacja API',
      p_source: 'web',
    });
    expectRpcError(staleCreate, 'QUOTE_CHANGED', 'stale create quote');
    const rolledBack = unwrap(await player.client.from('bookings').select('id').eq('starts_at', startsAt), 'stale quote rollback');
    assert(rolledBack.length === 0, 'Stale quote left a partial booking behind.');

    const bookingKey = randomUUID();
    const createArgs = {
      p_idempotency_key: bookingKey,
      p_sport_id: sportId,
      p_venue_id: venueId,
      p_court_id: courtId,
      p_trainer_id: trainerId,
      p_starts_at: startsAt,
      p_duration_minutes: 60,
      p_expected_total_minor: quote.total_minor,
      p_expected_currency: quote.currency,
      p_participant_user_ids: [],
      p_title: 'Atomiczna rezerwacja API',
      p_source: 'web',
    };
    const booking = firstRow(unwrap(await player.client.rpc('create_booking_with_quote', createArgs), 'create booking'), 'create booking');
    const retry = firstRow(unwrap(await player.client.rpc('create_booking_with_quote', createArgs), 'idempotent create retry'), 'idempotent create retry');
    assert(retry.id === booking.id, 'Idempotent booking retry returned a different booking.');

    unwrap(await admin.client.rpc('admin_link_trainer_account', {
      p_trainer_id: trainerId,
      p_user_id: trainer.id,
      p_organization_id: organizationId,
    }), 'link trainer account');
    unwrap(await admin.client.rpc('admin_set_organization_membership', {
      p_organization_id: organizationId,
      p_user_id: staff.id,
      p_role: 'reception',
      p_status: 'active',
    }), 'assign reception role');

    const trainerRoles = unwrap(await trainer.client.rpc('get_my_roles'), 'trainer roles');
    const staffRoles = unwrap(await staff.client.rpc('get_my_roles'), 'staff roles');
    assert(trainerRoles.trainer_id === trainerId, 'Trainer link is missing from get_my_roles.');
    assert(staffRoles.organization_memberships?.some((item) => item.role === 'reception'), 'Reception role is missing.');
    const trainerBooking = unwrap(await trainer.client.from('bookings').select('id').eq('id', booking.id), 'trainer booking access');
    assert(trainerBooking.length === 1, 'Trainer cannot read a booking created before account linkage.');
    const staffBooking = unwrap(await staff.client.from('bookings').select('id').eq('id', booking.id), 'staff booking access');
    assert(staffBooking.length === 1, 'Reception cannot read its organization booking.');
    const strangerBooking = unwrap(await stranger.client.from('bookings').select('id').eq('id', booking.id), 'stranger booking isolation');
    assert(strangerBooking.length === 0, 'Unrelated user can read a private booking.');
    const strangerCard = unwrap(await stranger.client.from('profile_cards').select('user_id').eq('user_id', player.id), 'profile-card isolation');
    assert(strangerCard.length === 0, 'Unrelated user can read another profile card.');

    const directProfileWrite = await player.client.from('profiles').update({ display_name: 'Bypass' }).eq('id', player.id);
    assert(directProfileWrite.error, 'Direct profile update unexpectedly bypassed save_profile.');

    const conversation = firstRow(unwrap(await player.client
      .from('conversations')
      .select('id,booking_id,kind')
      .eq('booking_id', booking.id)
      .single(), 'booking conversation'), 'booking conversation');
    const trainerConversation = unwrap(await trainer.client.from('conversations').select('id').eq('id', conversation.id), 'trainer conversation backfill');
    assert(trainerConversation.length === 1, 'Trainer was not backfilled into the existing booking conversation.');

    const playerMessageId = firstRow(unwrap(await player.client.rpc('send_message', {
      p_conversation_id: conversation.id,
      p_client_message_id: randomUUID(),
      p_body: 'Wiadomość gracza z testu API',
      p_reply_to_message_id: null,
    }), 'player send_message'), 'player send_message').id;
    assert(playerMessageId, 'Player message ID is missing.');
    const trainerMessageBody = 'Odpowiedź trenera z testu API';
    const realtimeMessage = await waitForMessage(player.client, conversation.id, async () => {
      unwrap(await trainer.client.rpc('send_message', {
        p_conversation_id: conversation.id,
        p_client_message_id: randomUUID(),
        p_body: trainerMessageBody,
        p_reply_to_message_id: playerMessageId,
      }), 'trainer send_message');
    });
    assert(realtimeMessage.body === trainerMessageBody, 'Realtime delivered an unexpected message payload.');

    unwrap(await trainer.client.rpc('save_booking_note', {
      p_booking_id: booking.id,
      p_body: 'Notatka widoczna dla uczestników',
      p_visibility: 'participants',
    }), 'trainer save note');
    const notes = unwrap(await player.client.from('booking_notes').select('body').eq('booking_id', booking.id), 'player note access');
    assert(notes.some((note) => note.body === 'Notatka widoczna dla uczestników'), 'Participant note is not visible to the player.');

    const forbiddenPayment = await player.client.rpc('set_booking_payment_status', {
      p_booking_id: booking.id,
      p_idempotency_key: randomUUID(),
      p_payment_status: 'paid',
      p_note: 'Niedozwolona próba gracza',
    });
    expectRpcError(forbiddenPayment, 'FORBIDDEN', 'player payment update');
    unwrap(await trainer.client.rpc('set_booking_payment_status', {
      p_booking_id: booking.id,
      p_idempotency_key: randomUUID(),
      p_payment_status: 'paid',
      p_note: 'Opłacono poza aplikacją',
    }), 'trainer payment update');

    const movedStart = futureStart(9);
    const movedQuote = firstRow(unwrap(await player.client.rpc('quote_booking', {
      p_sport_id: sportId,
      p_venue_id: venueId,
      p_court_id: courtId,
      p_trainer_id: trainerId,
      p_starts_at: movedStart,
      p_duration_minutes: 90,
      p_exclude_booking_id: booking.id,
    }), 'reschedule quote'), 'reschedule quote');
    const badMoveKey = randomUUID();
    const bookingRollbackColumns = [
      'starts_at', 'ends_at', 'status', 'currency', 'subtotal_minor',
      'discount_minor', 'total_minor', 'payment_status', 'cancelled_at',
      'cancelled_by', 'cancellation_reason', 'updated_at', 'version',
    ].join(',');
    const beforeBadMove = firstRow(unwrap(await player.client
      .from('bookings')
      .select(bookingRollbackColumns)
      .eq('id', booking.id)
      .single(), 'reschedule rollback baseline'), 'reschedule rollback baseline');
    const rollbackFingerprint = rescheduleRollbackFingerprint(
      booking.id,
      player.id,
      badMoveKey,
    );
    const badMove = await player.client.rpc('reschedule_booking_with_quote', {
      p_booking_id: booking.id,
      p_idempotency_key: badMoveKey,
      p_starts_at: movedStart,
      p_duration_minutes: 90,
      p_expected_total_minor: movedQuote.total_minor + 1,
      p_expected_currency: movedQuote.currency,
    });
    expectRpcError(badMove, 'QUOTE_CHANGED', 'stale reschedule quote');
    const afterBadMove = firstRow(unwrap(await player.client
      .from('bookings')
      .select(bookingRollbackColumns)
      .eq('id', booking.id)
      .single(), 'reschedule rollback'), 'reschedule rollback');
    assert(
      Date.parse(afterBadMove.starts_at) === Date.parse(startsAt)
        && afterBadMove.payment_status === 'paid'
        && JSON.stringify(afterBadMove) === JSON.stringify(beforeBadMove)
        && rescheduleRollbackFingerprint(booking.id, player.id, badMoveKey)
          === rollbackFingerprint,
      'Stale reschedule was not fully rolled back.',
    );
    const movedBooking = firstRow(unwrap(await player.client.rpc('reschedule_booking_with_quote', {
      p_booking_id: booking.id,
      p_idempotency_key: randomUUID(),
      p_starts_at: movedStart,
      p_duration_minutes: 90,
      p_expected_total_minor: movedQuote.total_minor,
      p_expected_currency: movedQuote.currency,
    }), 'reschedule booking'), 'reschedule booking');
    assert(
      Date.parse(movedBooking.starts_at) === Date.parse(movedStart)
        && movedBooking.payment_status === 'unpaid',
      'Price-changing reschedule did not reset settlement.',
    );
    unwrap(await staff.client.rpc('set_booking_payment_status', {
      p_booking_id: booking.id,
      p_idempotency_key: randomUUID(),
      p_payment_status: 'paid',
      p_note: 'Recepcja potwierdziła płatność poza aplikacją',
    }), 'reception payment update');

    const availabilityStart = futureStart(2);
    const preference = firstRow(unwrap(await player.client.rpc('save_availability_alert', {
      p_idempotency_key: randomUUID(),
      p_sport_id: sportId,
      p_duration_minutes: 60,
      p_windows: Array.from({ length: 7 }, (_, index) => ({
        weekday: index + 1,
        day_part: null,
        starts_local: '06:00',
        ends_local: '22:00',
      })),
      p_preference_id: null,
      p_venue_id: venueId,
      p_trainer_id: trainerId,
      p_enabled: true,
      p_lead_time: 'sevenDays',
      p_keep_all_in_chat: true,
      p_timezone: 'Europe/Warsaw',
      p_notify_push: false,
      p_notify_in_app: true,
      p_valid_from: localDate(),
      p_valid_until: null,
    }), 'save availability preference'), 'save availability preference');
    const produced = unwrap(await trainer.client.rpc('publish_availability_slot', {
      p_idempotency_key: randomUUID(),
      p_sport_id: sportId,
      p_venue_id: venueId,
      p_court_id: courtId,
      p_trainer_id: trainerId,
      p_starts_at: availabilityStart,
      p_duration_minutes: 60,
    }), 'publish availability slot');
    assert(produced === 1, `Expected one availability offer, received ${produced}.`);
    const offer = firstRow(unwrap(await player.client
      .from('availability_offers')
      .select('id,status,conversation_id,total_minor,currency')
      .eq('preference_id', preference.id)
      .eq('starts_at', availabilityStart)
      .single(), 'load availability offer'), 'load availability offer');
    assert(offer.status === 'available' && offer.total_minor > 0 && offer.currency === 'PLN', 'Availability offer has invalid state or price.');
    const offerNotification = unwrap(await player.client
      .from('notifications')
      .select('id')
      .eq('type', 'availability_offer.created')
      .eq('related_entity_id', offer.id), 'availability notification');
    assert(offerNotification.length === 1, 'Synchronous availability notification is missing.');
    const offerBooking = firstRow(unwrap(await player.client.rpc('reserve_availability_offer', {
      p_offer_id: offer.id,
      p_idempotency_key: randomUUID(),
    }), 'reserve availability offer'), 'reserve availability offer');
    const reservedOffer = firstRow(unwrap(await player.client.from('availability_offers').select('status,reserved_booking_id').eq('id', offer.id).single(), 'reserved offer state'), 'reserved offer state');
    assert(reservedOffer.status === 'reserved' && reservedOffer.reserved_booking_id === offerBooking.id, 'Availability offer was not atomically reserved.');

    const raceActors = provisionRaceActors(environment, 100);
    accounts.push(...raceActors);
    const raceStart = futureStart(11);
    const raceQuote = firstRow(unwrap(await raceActors[0].client.rpc('quote_booking', {
      p_sport_id: sportId,
      p_venue_id: venueId,
      p_court_id: courtId,
      p_trainer_id: trainerId,
      p_starts_at: raceStart,
      p_duration_minutes: 60,
      p_exclude_booking_id: null,
    }), 'concurrency quote'), 'concurrency quote');
    const raceGate = holdLocalTransaction(
      'api_e2e_slot_race_gate',
      'lock table public.bookings in share mode;',
    );
    await raceGate.ready;
    let raceResults;
    let raceRequests;
    try {
      raceRequests = Promise.all(raceActors.map((actor, index) => actor.client.rpc('create_booking_with_quote', {
        p_idempotency_key: randomUUID(),
        p_sport_id: sportId,
        p_venue_id: venueId,
        p_court_id: courtId,
        p_trainer_id: trainerId,
        p_starts_at: raceStart,
        p_duration_minutes: 60,
        p_expected_total_minor: raceQuote.total_minor,
        p_expected_currency: raceQuote.currency,
        p_participant_user_ids: [],
        p_title: `Wyścig API ${index + 1}`,
        p_source: 'web',
      })));
      const blockedContenders = Number(await waitForSqlCondition(`
        select pg_catalog.count(distinct l.pid)
          from pg_catalog.pg_locks l
         where l.relation = 'public.bookings'::regclass
           and l.mode = 'RowExclusiveLock'
           and not l.granted;
      `, (value) => Number(value) >= 2, 'same-slot insert contention'));
      assert(blockedContenders >= 2, 'Same-slot contenders did not reach the booking INSERT concurrently.');
      const gateResult = await raceGate.commit();
      assert(gateResult.code === 0, `Same-slot gate failed: ${gateResult.stderr.trim()}`);
      raceResults = await raceRequests;
    } catch (error) {
      await raceGate.rollback();
      if (raceRequests) await raceRequests;
      throw error;
    }
    const raceSuccesses = raceResults.filter((result) => !result.error);
    assert(raceSuccesses.length === 1, `Concurrent slot race created ${raceSuccesses.length} bookings instead of one.`);
    const raceBooking = firstRow(raceSuccesses[0].data, 'concurrency winner');
    const raceErrors = raceResults.filter((result) => result.error);
    assert(raceErrors.length === 99, `Same-slot race returned ${raceErrors.length} rejected contenders instead of 99.`);
    assert(
      raceErrors.every((result) => ![result.error.message, result.error.details, result.error.hint]
        .filter(Boolean).join(' ').includes('RATE_LIMITED')),
      'Same-slot contention was intercepted by the actor rate limiter.',
    );
    assert(
      raceErrors.some((result) => [result.error.message, result.error.details, result.error.hint]
        .filter(Boolean).join(' ').includes('SLOT_TAKEN')),
      'Same-slot contention did not surface an exclusion conflict.',
    );
    const raceRowCount = Number(runLocalSql(`
      select pg_catalog.count(*)
        from public.bookings b
       where b.starts_at = ${sqlText(raceStart)}::timestamptz
         and b.status = 'confirmed';
    `).trim());
    assert(raceRowCount === 1, `Database contains ${raceRowCount} bookings for the raced slot.`);
    assert(uuidPattern.test(raceBooking.id), 'Concurrent slot winner is missing a booking id.');

    for (let index = 0; index < 11; index += 1) {
      const quotaStart = futureStart(30 + index);
      const quotaQuote = firstRow(unwrap(await quotaUser.client.rpc('quote_booking', {
        p_sport_id: sportId,
        p_venue_id: venueId,
        p_court_id: courtId,
        p_trainer_id: trainerId,
        p_starts_at: quotaStart,
        p_duration_minutes: 60,
        p_exclude_booking_id: null,
      }), `quota setup quote ${index + 1}`), `quota setup quote ${index + 1}`);
      unwrap(await quotaUser.client.rpc('create_booking_with_quote', {
        p_idempotency_key: randomUUID(),
        p_sport_id: sportId,
        p_venue_id: venueId,
        p_court_id: courtId,
        p_trainer_id: trainerId,
        p_starts_at: quotaStart,
        p_duration_minutes: 60,
        p_expected_total_minor: quotaQuote.total_minor,
        p_expected_currency: quotaQuote.currency,
        p_participant_user_ids: [],
        p_title: `Limit API ${index + 1}`,
        p_source: 'web',
      }), `quota setup booking ${index + 1}`);
    }
    const quotaCandidateStarts = [futureStart(45), futureStart(46)];
    const quotaCandidateIds = [randomUUID(), randomUUID()];
    const quotaCandidateRequests = [randomUUID(), randomUUID()];
    const quotaInsert = (index) => `
      insert into public.bookings (
        id, creator_id, sport_id, venue_id, court_id, trainer_id,
        starts_at, ends_at, status, title, currency,
        subtotal_minor, discount_minor, total_minor, payment_status,
        source, client_request_id
      ) values (
        ${sqlUuid(quotaCandidateIds[index])}, ${sqlUuid(quotaUser.id)},
        ${sqlUuid(sportId)}, ${sqlUuid(venueId)}, ${sqlUuid(courtId)}, null,
        ${sqlText(quotaCandidateStarts[index])}::timestamptz,
        ${sqlText(quotaCandidateStarts[index])}::timestamptz + interval '60 minutes',
        'confirmed', ${sqlText(`Bezpośredni wyścig limitu ${index + 1}`)}, 'PLN',
        100, 0, 100, 'unpaid', 'web', ${sqlUuid(quotaCandidateRequests[index])}
      );
    `;
    const quotaWinnerTransaction = holdLocalTransaction(
      'api_e2e_quota_winner',
      quotaInsert(0),
    );
    await quotaWinnerTransaction.ready;
    let quotaLoserResult;
    let quotaLoserRequest;
    try {
      quotaLoserRequest = startLocalSql(
        `begin; ${quotaInsert(1)} commit;`,
        'api_e2e_quota_contender',
      );
      const advisoryWaiters = Number(await waitForSqlCondition(`
        select pg_catalog.count(*)
          from pg_catalog.pg_stat_activity a
         where a.application_name = 'api_e2e_quota_contender'
           and a.wait_event_type = 'Lock'
           and a.wait_event = 'advisory';
      `, (value) => Number(value) === 1, 'quota advisory-lock contention'));
      assert(advisoryWaiters === 1, 'Quota contender did not wait on the creator advisory lock.');
      const quotaWinnerResult = await quotaWinnerTransaction.commit();
      assert(quotaWinnerResult.code === 0, `Quota winner transaction failed: ${quotaWinnerResult.stderr.trim()}`);
      quotaLoserResult = await quotaLoserRequest;
    } catch (error) {
      await quotaWinnerTransaction.rollback();
      if (quotaLoserRequest) await quotaLoserRequest;
      throw error;
    }
    assert(quotaLoserResult.code !== 0, 'Concurrent quota contender unexpectedly committed.');
    assert(
      `${quotaLoserResult.stdout}\n${quotaLoserResult.stderr}`.includes('FUTURE_UNPAID_BOOKING_LIMIT'),
      `Concurrent quota contender failed for the wrong reason: ${quotaLoserResult.stderr.trim()}`,
    );
    const quotaState = JSON.parse(runLocalSql(`
      select pg_catalog.json_build_object(
        'future_unpaid', (
          select pg_catalog.count(*)
            from public.bookings b
           where b.creator_id = ${sqlUuid(quotaUser.id)}
             and b.status = 'confirmed'
             and b.payment_status = 'unpaid'
             and b.starts_at > pg_catalog.now()
        ),
        'candidate_rows', (
          select pg_catalog.count(*)
            from public.bookings b
           where b.id = any(array[
             ${sqlUuid(quotaCandidateIds[0])},
             ${sqlUuid(quotaCandidateIds[1])}
           ]::uuid[])
        )
      )::text;
    `).trim());
    assert(quotaState.future_unpaid === 12, `Quota account has ${quotaState.future_unpaid} unpaid bookings instead of 12.`);
    assert(quotaState.candidate_rows === 1, `Quota race committed ${quotaState.candidate_rows} candidate rows instead of one.`);

    const calendar = unwrap(await player.client.from('bookings').select('id,starts_at,status,payment_status').order('starts_at'), 'player calendar');
    assert(calendar.length >= 2, 'Player calendar does not include all created bookings.');
    const notifications = unwrap(await player.client.from('notifications').select('id,type,read_at').eq('recipient_id', player.id), 'player notifications');
    assert(notifications.length > 0, 'Booking and availability flows produced no in-app notifications.');

    runLocalSql(`update public.profiles set status = 'blocked' where id = ${sqlUuid(stranger.id)};`);
    const blockedRoles = await stranger.client.rpc('get_my_roles');
    expectRpcError(blockedRoles, 'PROFILE_NOT_ACTIVE', 'blocked user role access');
    const blockedCatalog = unwrap(await stranger.client.from('bookings').select('id'), 'blocked user booking read');
    assert(blockedCatalog.length === 0, 'Blocked user retained booking access through an existing JWT.');

    console.log('Local Supabase API E2E: PASS');
    console.log('Verified: auth/profile, roles/RLS, quote rollback, booking/idempotency, chat/Realtime, notes, external settlement, reschedule, availability offers, notifications, calendar, blocked users, 100-way slot race and two-session quota race.');
  } finally {
    for (const account of accounts) {
      await account.client.removeAllChannels();
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
