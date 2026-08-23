import { Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigurationError,
} from '@/lib/supabase/client';

export type AuthActionResult = {
  error: string | null;
  requiresEmailConfirmation?: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  passwordRecovery: boolean;
  configured: boolean;
  configurationError: string | null;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  resetPassword: (email: string) => Promise<AuthActionResult>;
  updatePassword: (password: string) => Promise<AuthActionResult>;
  finishPasswordRecovery: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function unavailableResult(): AuthActionResult {
  return {
    error: supabaseConfigurationError ?? 'Supabase nie jest skonfigurowany.',
  };
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
      }
      setLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || Platform.OS === 'web') return;

    const updateAutoRefresh = (state: string) => {
      if (state === 'active') {
        client.auth.startAutoRefresh();
      } else {
        client.auth.stopAutoRefresh();
      }
    };

    updateAutoRefresh(AppState.currentState);
    const subscription = AppState.addEventListener('change', updateAutoRefresh);

    return () => {
      subscription.remove();
      client.auth.stopAutoRefresh();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) return unavailableResult();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return { error: error.message };
      setSession(data.session);
      return { error: null };
    } catch (error) {
      return { error: errorMessage(error) };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) return unavailableResult();

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: Platform.OS === 'web' && typeof window !== 'undefined'
          ? { emailRedirectTo: window.location.origin }
          : undefined,
      });
      if (error) return { error: error.message };
      setSession(data.session);
      return {
        error: null,
        requiresEmailConfirmation: data.session === null,
      };
    } catch (error) {
      return { error: errorMessage(error) };
    }
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthActionResult> => {
    if (!supabase) return unavailableResult();

    try {
      const options = Platform.OS === 'web' && typeof window !== 'undefined'
        ? { redirectTo: window.location.origin }
        : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), options);
      return { error: error?.message ?? null };
    } catch (error) {
      return { error: errorMessage(error) };
    }
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthActionResult> => {
    if (!supabase) return unavailableResult();

    try {
      const { error } = await supabase.auth.updateUser({ password });
      return { error: error?.message ?? null };
    } catch (error) {
      return { error: errorMessage(error) };
    }
  }, []);

  const finishPasswordRecovery = useCallback(() => {
    setPasswordRecovery(false);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    if (!supabase) {
      throw new Error(supabaseConfigurationError ?? 'Supabase nie jest skonfigurowany.');
    }

    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    setPasswordRecovery(false);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    passwordRecovery,
    configured: isSupabaseConfigured,
    configurationError: supabaseConfigurationError,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    finishPasswordRecovery,
    signOut,
  }), [
    finishPasswordRecovery,
    loading,
    passwordRecovery,
    resetPassword,
    session,
    signIn,
    signOut,
    signUp,
    updatePassword,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth musi być użyty wewnątrz AuthProvider.');
  }
  return context;
}
