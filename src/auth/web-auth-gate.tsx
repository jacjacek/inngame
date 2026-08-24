import { PropsWithChildren, useEffect, useState, useSyncExternalStore } from 'react';

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

// This gate renders from the ROOT LAYOUT, outside every matched route screen.
// In expo-router v7 (SDK 57) URL query params are only exposed to components
// under the focused route, and router.push({ pathname: '/', params }) from
// this context serializes to "/" losing the params entirely — so ?auth= never
// reaches this component and the sign-in/sign-up buttons appear dead. Drive
// the entry view with plain React state instead and mirror the ?auth= param
// into the address bar manually so deep links stay shareable.
function readEntryFromUrl(): EntryView | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('auth');
  if (value === 'login') return 'signIn';
  if (value === 'register') return 'signUp';
  return null;
}

function writeEntryToUrl(entry: EntryView) {
  const url = new URL(window.location.href);
  if (entry === 'landing') {
    url.searchParams.delete('auth');
  } else {
    url.searchParams.set('auth', entry === 'signIn' ? 'login' : 'register');
  }
  return url.toString();
}

export function WebAuthGate({ children }: PropsWithChildren) {
  const { session, loading, passwordRecovery, configured, configurationError } = useAuth();
  const hydrated = useHasHydrated();
  // Server/static render and the first client render must agree on 'landing'
  // to avoid a hydration mismatch; the mount effect adopts a deep link after.
  const [entry, setEntry] = useState<EntryView>('landing');

  useEffect(() => {
    setEntry(readEntryFromUrl() ?? 'landing');
    const onPopState = () => {
      setEntry(readEntryFromUrl() ?? 'landing');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openAuth = (mode: Exclude<AuthMode, 'reset'>, replace = false) => {
    setEntry(mode);
    const url = writeEntryToUrl(mode);
    if (replace) {
      window.history.replaceState(null, '', url);
    } else {
      window.history.pushState(null, '', url);
    }
  };

  const closeAuth = () => {
    setEntry('landing');
    window.history.replaceState(null, '', writeEntryToUrl('landing'));
  };

  if (passwordRecovery && session) return <PasswordRecoveryScreen />;
  if (session) return <>{children}</>;
  const view: EntryView = hydrated ? entry : 'landing';
  if (view === 'landing') {
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
      mode={view}
      onBack={closeAuth}
      onModeChange={(mode) => openAuth(mode, true)}
    />
  );
}
