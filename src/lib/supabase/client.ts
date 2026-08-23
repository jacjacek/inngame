import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

const missingEnvironmentVariables = [
  !supabaseUrl ? 'EXPO_PUBLIC_SUPABASE_URL' : null,
  !supabasePublishableKey ? 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY' : null,
].filter((name): name is string => Boolean(name));

const webStorage = {
  async getItem(key: string) {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable in private browsing or hardened web views.
    }
  },
  async removeItem(key: string) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // The auth flow can continue without persistence for this browser session.
    }
  },
};

function initializeSupabase(): { client: SupabaseClient | null; error: string | null } {
  if (missingEnvironmentVariables.length > 0 || !supabaseUrl || !supabasePublishableKey) {
    return {
      client: null,
      error: `Brakuje konfiguracji Supabase: ${missingEnvironmentVariables.join(', ')}.`,
    };
  }

  try {
    return {
      client: createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          // Browser auth callbacks carry the recovery session in the URL.
          // Native deep links require an explicit exchange and must not be
          // interpreted as a browser callback by the shared client.
          detectSessionInUrl: Platform.OS === 'web',
          lock: processLock,
        },
      }),
      error: null,
    };
  } catch {
    return {
      client: null,
      error: 'Konfiguracja Supabase jest nieprawidłowa. Sprawdź adres projektu i klucz publiczny.',
    };
  }
}

const initializedSupabase = initializeSupabase();

export const supabase = initializedSupabase.client;
export const supabaseConfigurationError = initializedSupabase.error;
export const isSupabaseConfigured = supabase !== null;

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(supabaseConfigurationError ?? 'Klient Supabase nie został skonfigurowany.');
  }

  return supabase;
}
