import { useLocalSearchParams, useRouter } from 'expo-router';
import { PropsWithChildren, useSyncExternalStore } from 'react';

import { LoadingScreen } from '@/components/ui';
import { LandingPage } from '@/landing/landing-page';

import {
  AuthScreen,
  ConfigurationError,
  PasswordRecoveryScreen,
  type AuthMode,
} from './auth-gate';
import { useAuth } from './auth-provider';

type EntryView = 'landing' | Exclude<AuthMode, 'reset'>;

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerHydratedSnapshot = () => false;

function useHasHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );
}

export function WebAuthGate({ children }: PropsWithChildren) {
  const { session, loading, passwordRecovery, configured, configurationError } = useAuth();
  const hydrated = useHasHydrated();
  const router = useRouter();
  const params = useLocalSearchParams<{ auth?: string | string[] }>();
  const authParam = Array.isArray(params.auth) ? params.auth[0] : params.auth;
  const requestedEntry: EntryView = authParam === 'login'
    ? 'signIn'
    : authParam === 'register'
      ? 'signUp'
      : 'landing';
  const entry: EntryView = hydrated ? requestedEntry : 'landing';

  const openAuth = (mode: Exclude<AuthMode, 'reset'>, replace = false) => {
    const href = { pathname: '/' as const, params: { auth: mode === 'signIn' ? 'login' : 'register' } };
    if (replace) router.replace(href);
    else router.push(href);
  };

  if (passwordRecovery && session) return <PasswordRecoveryScreen />;
  if (session) return <>{children}</>;
  if (entry === 'landing') {
    return (
      <LandingPage
        onSignIn={() => openAuth('signIn')}
        onSignUp={() => openAuth('signUp')}
      />
    );
  }
  if (!configured) return <ConfigurationError message={configurationError} />;
  if (loading) return <LoadingScreen />;

  return (
    <AuthScreen
      mode={entry}
      onBack={() => router.replace('/')}
      onModeChange={(mode) => openAuth(mode, true)}
    />
  );
}
