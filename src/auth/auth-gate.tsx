import Ionicons from '@expo/vector-icons/Ionicons';
import React, { PropsWithChildren, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, LoadingScreen } from '@/components/ui';
import { AppTheme, useThemeStyles } from '@/theme';

import { useAuth } from './auth-provider';

type AuthMode = 'signIn' | 'signUp' | 'reset';
type Notice = { type: 'error' | 'success'; text: string } | null;

function useStyles() {
  return useThemeStyles(createStyles);
}

function translateAuthError(message: string) {
  const normalized = message.toLocaleLowerCase('en');
  if (normalized.includes('invalid login credentials')) return 'Nieprawidłowy e-mail lub hasło.';
  if (normalized.includes('email not confirmed')) return 'Najpierw potwierdź adres e-mail.';
  if (normalized.includes('user already registered')) return 'Konto z tym adresem e-mail już istnieje.';
  if (normalized.includes('password should be at least')) return 'Hasło jest za krótkie.';
  if (normalized.includes('new password should be different') || normalized.includes('same password')) {
    return 'Nowe hasło musi różnić się od poprzedniego.';
  }
  if (normalized.includes('weak password')) return 'Hasło nie spełnia wymagań bezpieczeństwa.';
  if (normalized.includes('auth session missing') || normalized.includes('session not found')) {
    return 'Link do zmiany hasła wygasł lub został już użyty. Poproś o nowy link.';
  }
  if (normalized.includes('unable to validate email address')) return 'Podaj poprawny adres e-mail.';
  if (normalized.includes('rate limit')) return 'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.';
  if (normalized.includes('failed to fetch') || normalized.includes('network request failed')) {
    return 'Nie udało się połączyć z serwerem. Sprawdź internet i spróbuj ponownie.';
  }
  return message;
}

function translatePasswordRecoveryError(message: string) {
  const translated = translateAuthError(message);
  return translated === message
    ? 'Nie udało się zmienić hasła. Poproś o nowy link i spróbuj ponownie.'
    : translated;
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function AuthGate({ children }: PropsWithChildren) {
  const { session, loading, passwordRecovery, configured, configurationError } = useAuth();

  if (!configured) {
    return <ConfigurationError message={configurationError} />;
  }
  if (loading) return <LoadingScreen />;
  if (passwordRecovery && session) return <PasswordRecoveryScreen />;
  if (!session) return <AuthScreen />;
  return <>{children}</>;
}

function PasswordRecoveryScreen() {
  const { styles, theme } = useStyles();
  const { finishPasswordRecovery, signOut, updatePassword, user } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const submit = async () => {
    if (busy || passwordUpdated) return;

    if (password.length < 8) {
      setNotice({ type: 'error', text: 'Nowe hasło musi mieć co najmniej 8 znaków.' });
      return;
    }
    if (!/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(password) || !/\d/.test(password)) {
      setNotice({ type: 'error', text: 'Użyj w haśle co najmniej jednej litery i jednej cyfry.' });
      return;
    }
    if (password !== passwordConfirmation) {
      setNotice({ type: 'error', text: 'Wpisane hasła nie są takie same.' });
      return;
    }

    setBusy(true);
    setNotice(null);
    const result = await updatePassword(password);
    setBusy(false);

    if (result.error) {
      setNotice({ type: 'error', text: translatePasswordRecoveryError(result.error) });
      return;
    }

    setPassword('');
    setPasswordConfirmation('');
    setPasswordUpdated(true);
    setNotice({ type: 'success', text: 'Hasło zostało bezpiecznie zmienione.' });
  };

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await signOut();
    } catch (error) {
      setBusy(false);
      setNotice({
        type: 'error',
        text: translateAuthError(error instanceof Error ? error.message : 'Nie udało się wylogować.'),
      });
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.authCard}>
            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <Ionicons name="key-outline" size={28} color={theme.colors.onAccent} />
              </View>
              <Text style={styles.brandName}>MyMovio</Text>
            </View>

            <View style={styles.heading}>
              <Text style={styles.title}>
                {passwordUpdated ? 'Hasło zmienione' : 'Ustaw nowe hasło'}
              </Text>
              <Text style={styles.subtitle}>
                {passwordUpdated
                  ? 'Możesz bezpiecznie przejść do aplikacji.'
                  : `Ustaw nowe, unikalne hasło${user?.email ? ` dla ${user.email}` : ''}.`}
              </Text>
            </View>

            <View style={styles.form}>
              {!passwordUpdated ? (
                <>
                  <AuthField
                    autoCapitalize="none"
                    autoComplete="new-password"
                    label="Nowe hasło"
                    onChangeText={setPassword}
                    placeholder="Minimum 8 znaków"
                    returnKeyType="next"
                    secureTextEntry
                    textContentType="newPassword"
                    value={password}
                  />
                  <AuthField
                    autoCapitalize="none"
                    autoComplete="new-password"
                    label="Powtórz nowe hasło"
                    onChangeText={setPasswordConfirmation}
                    onSubmitEditing={() => void submit()}
                    placeholder="Wpisz hasło ponownie"
                    returnKeyType="go"
                    secureTextEntry
                    textContentType="newPassword"
                    value={passwordConfirmation}
                  />
                </>
              ) : null}

              {notice ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={[styles.notice, notice.type === 'error' ? styles.errorNotice : styles.successNotice]}>
                  <Ionicons
                    name={notice.type === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                    size={18}
                    color={notice.type === 'error' ? theme.colors.danger : theme.colors.success}
                  />
                  <Text style={[styles.noticeText, notice.type === 'error' ? styles.errorText : styles.successText]}>
                    {notice.text}
                  </Text>
                </View>
              ) : null}

              <AppButton
                disabled={busy}
                onPress={passwordUpdated ? finishPasswordRecovery : () => void submit()}
                title={passwordUpdated ? 'Przejdź do aplikacji' : busy ? 'Zmieniam hasło…' : 'Zmień hasło'}
              />

              {!passwordUpdated ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  hitSlop={8}
                  onPress={() => void cancel()}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <Ionicons name="log-out-outline" size={16} color={theme.colors.accentText} />
                  <Text style={styles.textButtonLabel}>Anuluj i wróć do logowania</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ConfigurationError({ message }: { message: string | null }) {
  const { styles, theme } = useStyles();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.centeredContent}>
        <View style={[styles.brandMark, styles.errorMark]}>
          <Ionicons name="settings-outline" size={28} color={theme.colors.danger} />
        </View>
        <Text style={styles.title}>Aplikacja wymaga konfiguracji</Text>
        <Text style={styles.subtitle}>
          {message ?? 'Nie udało się uruchomić połączenia z Supabase.'}
        </Text>
        <View style={styles.configurationHint}>
          <Text style={styles.configurationHintText}>
            Ustaw zmienne środowiskowe projektu i uruchom aplikację ponownie.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function AuthScreen() {
  const { styles, theme } = useStyles();
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const selectMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setNotice(null);
    if (nextMode === 'reset') setPassword('');
  };

  const submit = async () => {
    if (busy) return;

    const normalizedEmail = email.trim();
    if (!validEmail(normalizedEmail)) {
      setNotice({ type: 'error', text: 'Podaj poprawny adres e-mail.' });
      return;
    }
    if (mode !== 'reset' && password.length < 6) {
      setNotice({ type: 'error', text: 'Hasło musi mieć co najmniej 6 znaków.' });
      return;
    }

    setBusy(true);
    setNotice(null);

    const result = mode === 'signIn'
      ? await signIn(normalizedEmail, password)
      : mode === 'signUp'
        ? await signUp(normalizedEmail, password)
        : await resetPassword(normalizedEmail);

    setBusy(false);

    if (result.error) {
      setNotice({ type: 'error', text: translateAuthError(result.error) });
      return;
    }

    if (mode === 'reset') {
      setNotice({ type: 'success', text: 'Wysłaliśmy wiadomość z linkiem do zmiany hasła.' });
      return;
    }

    if (mode === 'signUp' && result.requiresEmailConfirmation) {
      setPassword('');
      setMode('signIn');
      setNotice({
        type: 'success',
        text: 'Konto zostało utworzone. Sprawdź pocztę i potwierdź adres e-mail.',
      });
    }
  };

  const title = mode === 'signUp'
    ? 'Załóż konto'
    : mode === 'reset'
      ? 'Odzyskaj hasło'
      : 'Witaj ponownie';
  const description = mode === 'signUp'
    ? 'Dołącz do MyMovio i miej treningi zawsze pod ręką.'
    : mode === 'reset'
      ? 'Podaj e-mail użyty do rejestracji. Wyślemy Ci link do zmiany hasła.'
      : 'Zaloguj się, aby przejść do treningów, kalendarza i czatu.';

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.authCard}>
            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <Ionicons name="tennisball" size={30} color={theme.colors.onAccent} />
              </View>
              <Text style={styles.brandName}>MyMovio</Text>
            </View>

            {mode !== 'reset' ? (
              <View accessibilityRole="tablist" style={styles.modeSelector}>
                <ModeButton
                  active={mode === 'signIn'}
                  label="Logowanie"
                  onPress={() => selectMode('signIn')}
                />
                <ModeButton
                  active={mode === 'signUp'}
                  label="Rejestracja"
                  onPress={() => selectMode('signUp')}
                />
              </View>
            ) : null}

            <View style={styles.heading}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{description}</Text>
            </View>

            <View style={styles.form}>
              <AuthField
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                label="E-mail"
                onChangeText={setEmail}
                onSubmitEditing={() => {
                  if (mode === 'reset') void submit();
                }}
                placeholder="twoj@email.pl"
                returnKeyType={mode === 'reset' ? 'go' : 'next'}
                textContentType="emailAddress"
                value={email}
              />

              {mode !== 'reset' ? (
                <AuthField
                  autoCapitalize="none"
                  autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                  label="Hasło"
                  onChangeText={setPassword}
                  onSubmitEditing={() => void submit()}
                  placeholder={mode === 'signUp' ? 'Minimum 6 znaków' : 'Twoje hasło'}
                  returnKeyType="go"
                  secureTextEntry
                  textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
                  value={password}
                />
              ) : null}

              {notice ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={[styles.notice, notice.type === 'error' ? styles.errorNotice : styles.successNotice]}>
                  <Ionicons
                    name={notice.type === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                    size={18}
                    color={notice.type === 'error' ? theme.colors.danger : theme.colors.success}
                  />
                  <Text style={[styles.noticeText, notice.type === 'error' ? styles.errorText : styles.successText]}>
                    {notice.text}
                  </Text>
                </View>
              ) : null}

              <AppButton
                disabled={busy}
                onPress={() => void submit()}
                title={busy
                  ? 'Proszę czekać…'
                  : mode === 'signUp'
                    ? 'Utwórz konto'
                    : mode === 'reset'
                      ? 'Wyślij link'
                      : 'Zaloguj się'}
              />

              {mode === 'signIn' ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => selectMode('reset')}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <Text style={styles.textButtonLabel}>Nie pamiętasz hasła?</Text>
                </Pressable>
              ) : null}

              {mode === 'reset' ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => selectMode('signIn')}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <Ionicons name="arrow-back" size={16} color={theme.colors.accentText} />
                  <Text style={styles.textButtonLabel}>Wróć do logowania</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { styles } = useStyles();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeButton,
        active && styles.modeButtonActive,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.modeButtonLabel, active && styles.modeButtonLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function AuthField({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { styles, theme } = useStyles();
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.tertiaryText}
        selectionColor={theme.colors.lime}
        style={styles.field}
        {...props}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  authCard: {
    width: '100%',
    maxWidth: 440,
    gap: 24,
    padding: 24,
    borderRadius: theme.radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSoft,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: Platform.OS === 'web' ? 0.1 : 0.07,
    shadowRadius: 30,
    elevation: 3,
  },
  centeredContent: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 28,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: theme.colors.lime,
  },
  errorMark: { backgroundColor: theme.colors.dangerSoft },
  brandName: { color: theme.colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  modeSelector: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 15,
    backgroundColor: theme.colors.surfaceElevated,
  },
  modeButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  modeButtonActive: { backgroundColor: theme.colors.surface },
  modeButtonLabel: { color: theme.colors.secondaryText, fontSize: 14, fontWeight: '600' },
  modeButtonLabelActive: { color: theme.colors.text },
  heading: { gap: 7 },
  title: { color: theme.colors.text, fontSize: 29, fontWeight: '700', letterSpacing: -0.7, textAlign: 'left' },
  subtitle: { color: theme.colors.secondaryText, fontSize: 14, lineHeight: 21 },
  form: { gap: 16 },
  fieldGroup: { gap: 7 },
  fieldLabel: { marginLeft: 2, color: theme.colors.secondaryText, fontSize: 13, fontWeight: '600' },
  field: {
    minHeight: 52,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: 16,
  },
  notice: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorNotice: { borderColor: theme.colors.dangerBorder, backgroundColor: theme.colors.dangerSoft },
  successNotice: { borderColor: theme.colors.accentBorder, backgroundColor: theme.colors.successSoft },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  errorText: { color: theme.colors.danger },
  successText: { color: theme.colors.success },
  textButton: {
    minHeight: 34,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  textButtonLabel: { color: theme.colors.accentText, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.65 },
  configurationHint: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
  },
  configurationHintText: { color: theme.colors.secondaryText, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
