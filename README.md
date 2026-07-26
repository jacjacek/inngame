# MyMovio — Expo

Cross-platform Expo rebuild of the MyMovio SwiftUI prototype. The app targets iOS and Android from one TypeScript codebase while retaining platform-native navigation, tabs, sheets, back behavior, haptics, safe areas, keyboard handling, switches, alerts, and press feedback.

## Included flows

- Three-step first-run onboarding
- Home dashboard with the court artwork from the original app
- Booking, rescheduling, conflict detection, and cancellation
- Agenda, week, and month calendar views
- Training details, participants, venue, weather, and notes
- Conversation list, chat composer, training cards, and pinned notes
- Trainer and club discovery with trainer profiles
- Package balances, history, discounts, payments, and top-ups
- Profile, NTRP level, sports, notifications, and progress
- Persistent local state through AsyncStorage

## Stack

- Expo SDK 57 and React Native 0.86
- Expo Router native stacks and native tabs
- TypeScript with React Compiler enabled
- Expo Haptics and Linear Gradient
- AsyncStorage for local persistence

## Run

```bash
npm install
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
npm run lint
npx tsc --noEmit
npx expo export --platform all
```

Android debug APK:

```bash
cd android
./gradlew :app:assembleDebug
```

The application source lives in `src/app`, reusable UI primitives in `src/components`, app state in `src/state`, and fixtures/models in `src/data`.
