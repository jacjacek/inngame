import { PropsWithChildren, useEffect, useSyncExternalStore } from 'react';

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

// This gate renders from the ROOT LAYOUT, outside every matched route screen.
// In router v7 (SDK 57) URL query params are only exposed to components under
// the focused route, and navigation calls made from this context serialize
// their params away — so the auth query param never reaches this component
// through the router and the sign-in/sign-up buttons appear dead. Track the
// entry view as an external store over window.location instead, mirroring the
// param into the address bar manually so deep links stay shareable.
const AUTH_NAV_EVENT = 'mymovio:auth-entry-navigated';

function readEntryFromUrl(): EntryView {
  if (typeof window === 'undefined') return 'landing';
  const value = new URLSearchParams(window.location.search).get('auth');
  if (value === 'login') return 'signIn';
  if (value === 'register') return 'signUp';
  return 'landing';
}

function subscribeToEntry(onStoreChange: () => void) {
  window.addEventListener('popstate', onStoreChange);
  window.addEventListener(AUTH_NAV_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('popstate', onStoreChange);
    window.removeEventListener(AUTH_NAV_EVENT, onStoreChange);
  };
}

function getEntrySnapshot(): EntryView {
  return readEntryFromUrl();
}

function getServerEntrySnapshot(): EntryView {
  return 'landing';
}

function syncEntryToUrl(entry: EntryView, replace: boolean) {
  const url = new URL(window.location.href);
  if (entry === 'landing') {
    url.searchParams.delete('auth');
  } else {
    url.searchParams.set('auth', entry === 'signIn' ? 'login' : 'register');
  }
  if (replace || !window.history.state) {
    window.history.replaceState(window.history.state, '', url.toString());
  } else {
    window.history.pushState(window.history.state, '', url.toString());
  }
  window.dispatchEvent(new Event(AUTH_NAV_EVENT));
}

export function WebAuthGate({ children }: PropsWithChildren) {
  const { session, loading, passwordRecovery, configured, configurationError } = useAuth();
  const entry = useSyncExternalStore(subscribeToEntry, getEntrySnapshot, getServerEntrySnapshot);

  const openAuth = (mode: Exclude<AuthMode, 'reset'>, replace = false) => {
    syncEntryToUrl(mode, replace);
  };

  const closeAuth = () => {
    syncEntryToUrl('landing', true);
  };

  // A signed-in visitor has no business carrying the auth param around.
  useEffect(() => {
    if (session && typeof window !== 'undefined' && readEntryFromUrl() !== 'landing') {
      syncEntryToUrl('landing', true);
    }
  }, [session]);

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
      onBack={closeAuth}
      onModeChange={(mode) => openAuth(mode, true)}
    />
  );
}
