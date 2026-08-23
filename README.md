# MyMovio — Expo

Cross-platform Expo rebuild of the MyMovio SwiftUI prototype. The app targets iOS and Android from one TypeScript codebase while retaining platform-native navigation, tabs, sheets, back behavior, haptics, safe areas, keyboard handling, switches, alerts, and press feedback.

## Included flows

- Email/password authentication, recovery, and account settings through Supabase Auth
- Three-step first-run onboarding backed by the user profile
- Home dashboard with the court artwork from the original app
- Authoritative booking quotes, booking, rescheduling, conflict detection, and cancellation
- Agenda, week, and month calendar views
- Training details, participants, venue, weather, and notes
- Realtime conversation list, chat composer, training cards, and pinned notes
- Trainer and club discovery with trainer profiles
- Availability alerts and atomic reservation of matching offers
- Profile, NTRP level, sports, in-app notifications, roles, and progress
- External settlement tracking (`unpaid`, `paid`, `not_required`) by trainers and staff

There is intentionally no online payment processor or prepaid-package ledger in
this release. Trainings are settled outside the application and marked manually.

## Stack

- Expo SDK 57 and React Native 0.86
- Expo Router native stacks and native tabs
- TypeScript with React Compiler enabled
- Expo Haptics and Linear Gradient
- Supabase Auth, PostgREST, PostgreSQL RLS, Realtime, and pg_cron
- AsyncStorage/localStorage for the authenticated session and theme preference only

## Run

Copy `.env.example` to an ignored local environment file and configure the
project's public `sb_publishable_*` key. Never put a secret/service-role key in
an `EXPO_PUBLIC_*` variable.

```bash
npm ci
npm start
```

Native development builds:

```bash
npm run ios
npm run android
```

If native folders are absent, generate them from `app.json`:

```bash
npx expo prebuild --platform all
```

Android local builds require JDK 17 and Android API 36. iOS local builds require Xcode 26.4+ and CocoaPods.

## Verify

```bash
npm run verify
npm run db:reset
npm run test:db -- supabase/tests --local
npm run test:api:local
```

See `supabase/README.md` for the database contract, account bootstrap, RLS and
operational workflows. A push to `develop` builds and validates an immutable
web release in CI, then deploys it to the development site. Production promotion
uses the CI-attested release id, Git SHA, and manifest SHA-256:

```bash
sudo ./scripts/promote-production.sh <release-id> <git-sha> <manifest-sha256>
```

Android debug APK:

```bash
cd android
./gradlew :app:assembleDebug
```

The application source lives in `src/app`, reusable UI primitives in `src/components`, app state in `src/state`, and fixtures/models in `src/data`.
