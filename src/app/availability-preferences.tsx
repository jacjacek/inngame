import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  availabilityTimeRangeError,
  AvailabilityLeadTime,
  dayPartOptions,
  overlappingAvailabilityRangeIds,
  preferenceSummary,
  weekdayOptions,
} from '@/data/availability';
import { trainers } from '@/data/models';
import {
  AppButton,
  Divider,
  InfoRow,
  LoadingScreen,
  ModalHeader,
  Segmented,
  ToggleRow,
  selectionHaptic,
  successHaptic,
  withSheetPage,
} from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { AppTheme, useThemeStyles } from '@/theme';

function useStyles() {
  return useThemeStyles(createStyles);
}

const leadTimes: { value: AvailabilityLeadTime; label: string }[] = [
  { value: 'today', label: 'Dzisiaj' },
  { value: 'threeDays', label: '1–3 dni' },
  { value: 'sevenDays', label: 'Do 7 dni' },
];

function HydratedAvailabilityPreferencesScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const { returnConversationId, trainerId } = useLocalSearchParams<{ returnConversationId?: string; trainerId?: string }>();
  const store = useAppStore();
  const trainer = trainers.find((item) => item.id === trainerId);

  if (!trainer) {
    return (
      <View testID="availability-preferences-hydrated" style={styles.page}>
        <ModalHeader title="Wolne terminy" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Ionicons name="notifications-outline" size={22} color={theme.colors.accentText} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.introTitle}>Mniej przypadkowych alertów</Text>
              <Text style={styles.introText}>Ustaw, kiedy zwykle możesz trenować. Oferty poza planem nadal znajdziesz w rozmowach.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <ToggleRow
              flat
              title="Powiadomienia o wolnych terminach"
              subtitle="Główne ustawienie dla wszystkich trenerów"
              value={store.availabilityNotificationsEnabled}
              onValueChange={store.setAvailabilityNotificationsEnabled}
            />
          </View>

          <View style={[styles.section, !store.availabilityNotificationsEnabled && styles.disabled]}>
            <Text style={styles.sectionTitle}>Trenerzy</Text>
            {trainers.map((item, index) => {
              const preference = store.availabilityPreferences[item.id];
              return (
                <View key={item.id}>
                  <Pressable
                    disabled={!store.availabilityNotificationsEnabled}
                    onPress={() => {
                      selectionHaptic();
                      router.push({ pathname: '/availability-preferences', params: { trainerId: item.id } });
                    }}
                    style={({ pressed }) => [styles.trainerRow, pressed && styles.pressed]}>
                    <View style={[styles.trainerInitials, preference.enabled && styles.trainerInitialsActive]}>
                      <Text style={[styles.trainerInitialsText, preference.enabled && styles.trainerInitialsTextActive]}>{item.initials}</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.trainerName}>{item.name}</Text>
                      <Text numberOfLines={1} style={styles.trainerSummary}>{preferenceSummary(preference)}</Text>
                    </View>
                    <View style={[styles.statusDot, preference.enabled && styles.statusDotActive]} />
                    <Ionicons name="chevron-forward" size={17} color={theme.colors.tertiaryText} />
                  </Pressable>
                  {index < trainers.length - 1 ? <Divider inset={58} /> : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  const preference = store.availabilityPreferences[trainer.id];
  const preferencesActive = store.availabilityNotificationsEnabled && preference.enabled;
  return (
    <View testID="availability-preferences-hydrated" style={styles.page}>
      <ModalHeader title="Wolne terminy" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.trainerHeader}>
          <View style={styles.trainerInitialsLarge}><Text style={styles.trainerInitialsLargeText}>{trainer.initials}</Text></View>
          <View style={styles.flex}>
            <Text style={styles.trainerNameLarge}>{trainer.name}</Text>
            <Text style={styles.trainerMeta}>Ustawienia tylko dla tego trenera</Text>
          </View>
        </View>

        <View style={styles.section}>
          <ToggleRow
            flat
            title="Powiadomienia globalne"
            subtitle="Główne ustawienie dla wszystkich trenerów"
            value={store.availabilityNotificationsEnabled}
            onValueChange={store.setAvailabilityNotificationsEnabled}
          />
          <Divider inset={0} />
          <ToggleRow
            flat
            title="Powiadamiaj o wolnych terminach"
            subtitle="Dostaniesz alert tylko dla pasujących pór"
            value={preference.enabled}
            onValueChange={(enabled) => store.setAvailabilityEnabled(trainer.id, enabled)}
          />
        </View>

        <View style={[styles.preferenceBody, !preferencesActive && styles.disabled]} pointerEvents={preferencesActive ? 'auto' : 'none'}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Kiedy zwykle możesz trenować?</Text>
            <Text style={styles.sectionDescription}>Zaznacz dowolną liczbę pór. Możesz łączyć rano, dzień i wieczór.</Text>
          </View>

          <View style={styles.weekMatrix}>
            <View style={styles.matrixHeader}>
              <View style={styles.dayNameSpacer} />
              {dayPartOptions.map((part) => (
                <View key={part.key} style={styles.partHeader}>
                  <Text style={styles.partHeaderText}>{part.label}</Text>
                  <Text style={styles.partRange}>{part.range}</Text>
                </View>
              ))}
            </View>
            {weekdayOptions.map((day) => (
              <View key={day.key} style={styles.matrixRow}>
                <Text style={styles.dayName}>{day.shortLabel}</Text>
                {dayPartOptions.map((part) => {
                  const active = preference.dayParts[day.key].includes(part.key);
                  return (
                    <Pressable
                      key={part.key}
                      accessibilityLabel={`${day.label}, ${part.label}`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                      onPress={() => {
                        selectionHaptic();
                        store.toggleAvailabilityDayPart(trainer.id, day.key, part.key);
                      }}
                      style={[styles.matrixCell, active && styles.matrixCellActive]}>
                      {active ? <Ionicons name="checkmark" size={17} color={theme.colors.onAccent} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <ToggleRow
              flat
              title="Doprecyzuj godziny"
              subtitle="Dodaj kilka osobnych okien jednego dnia"
              value={preference.preciseHoursEnabled}
              onValueChange={(preciseHoursEnabled) => store.setAvailabilityPreference(trainer.id, { preciseHoursEnabled })}
            />
          </View>

          {preference.preciseHoursEnabled ? (
            <View style={styles.preciseHours}>
              {weekdayOptions.map((day) => {
                const ranges = preference.preciseHours[day.key] ?? [];
                const overlappingIds = overlappingAvailabilityRangeIds(preference, day.key);
                if (!preference.dayParts[day.key].length && !ranges.length) return null;
                return (
                  <View key={day.key} style={styles.preciseDay}>
                    <View style={styles.preciseDayHeader}>
                      <Text style={styles.preciseDayTitle}>{day.label}</Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => store.addAvailabilityTimeRange(trainer.id, day.key)}
                        style={({ pressed }) => [styles.addRange, pressed && styles.pressed]}>
                        <Ionicons name="add" size={15} color={theme.colors.accentText} />
                        <Text style={styles.addRangeText}>Dodaj zakres</Text>
                      </Pressable>
                    </View>
                    {ranges.length ? ranges.map((range) => {
                      const error = availabilityTimeRangeError(range)
                        ?? (overlappingIds.has(range.id) ? 'Zakres nakłada się na inne okno' : undefined);
                      return (
                        <View key={range.id}>
                          <View style={styles.rangeRow}>
                            <TextInput
                              accessibilityLabel={`${day.label}, początek zakresu`}
                              value={range.start}
                              onChangeText={(start) => store.updateAvailabilityTimeRange(trainer.id, day.key, range.id, { start })}
                              placeholder="08:00"
                              placeholderTextColor={theme.colors.tertiaryText}
                              keyboardType="numbers-and-punctuation"
                              maxLength={5}
                              style={[styles.timeInput, error && styles.timeInputError]}
                            />
                            <Text style={styles.rangeDash}>–</Text>
                            <TextInput
                              accessibilityLabel={`${day.label}, koniec zakresu`}
                              value={range.end}
                              onChangeText={(end) => store.updateAvailabilityTimeRange(trainer.id, day.key, range.id, { end })}
                              placeholder="11:00"
                              placeholderTextColor={theme.colors.tertiaryText}
                              keyboardType="numbers-and-punctuation"
                              maxLength={5}
                              style={[styles.timeInput, error && styles.timeInputError]}
                            />
                            <Pressable
                              accessibilityLabel={`Usuń zakres ${day.label} ${range.start}–${range.end}`}
                              accessibilityRole="button"
                              onPress={() => store.removeAvailabilityTimeRange(trainer.id, day.key, range.id)}
                              style={styles.removeRange}>
                              <Ionicons name="close" size={18} color={theme.colors.secondaryText} />
                            </Pressable>
                          </View>
                          {error ? <Text style={styles.rangeError}>{error}. Ten zakres zostanie pominięty.</Text> : null}
                        </View>
                      );
                    }) : (
                      <Pressable accessibilityRole="button" onPress={() => store.addAvailabilityTimeRange(trainer.id, day.key)} style={styles.emptyRange}>
                        <Text style={styles.emptyRangeText}>Dodaj pierwsze dokładne okno</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Jak blisko terminu?</Text>
            <Text style={styles.sectionDescription}>Określ, jak spontaniczne propozycje mają uruchamiać push.</Text>
          </View>
          <Segmented values={leadTimes} value={preference.leadTime} onChange={(leadTime) => store.setAvailabilityPreference(trainer.id, { leadTime })} />

          <View style={styles.section}>
            <InfoRow
              flat
              icon="chatbubble-ellipses-outline"
              title="Wszystkie oferty zostają w rozmowie"
              detail="Poza preferowanymi porami po prostu nie uruchomią alertu"
            />
          </View>
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <AppButton title="Gotowe" onPress={() => {
          successHaptic();
          if (returnConversationId) {
            if (router.canDismiss()) {
              router.dismiss();
            } else {
              router.replace({ pathname: '/chat', params: { conversationId: returnConversationId } });
            }
          } else {
            router.back();
          }
        }} />
      </SafeAreaView>
    </View>
  );
}

function AvailabilityPreferencesScreen() {
  const store = useAppStore();
  if (!store.hydrated) return <LoadingScreen />;
  return <HydratedAvailabilityPreferencesScreen />;
}

export default withSheetPage(AvailabilityPreferencesScreen);

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 28, gap: 22 },
  intro: { flexDirection: 'row', gap: 13, alignItems: 'flex-start', padding: 16, borderRadius: 18, backgroundColor: theme.colors.surfaceSoft },
  introIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSoft },
  introTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  introText: { color: theme.colors.secondaryText, fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  section: { borderRadius: 16, backgroundColor: theme.colors.surfaceSoft, overflow: 'hidden' },
  sectionHeading: { gap: 5 },
  sectionTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600', paddingHorizontal: 2 },
  sectionDescription: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 17, paddingHorizontal: 2 },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.7 },
  trainerRow: { minHeight: 72, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  trainerInitials: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceElevated },
  trainerInitialsActive: { backgroundColor: theme.colors.accentSoft },
  trainerInitialsText: { color: theme.colors.secondaryText, fontSize: 12, fontWeight: '700' },
  trainerInitialsTextActive: { color: theme.colors.accentText },
  trainerName: { color: theme.colors.text, fontSize: 14.5, fontWeight: '600' },
  trainerSummary: { color: theme.colors.secondaryText, fontSize: 11, marginTop: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.tertiaryText },
  statusDotActive: { backgroundColor: theme.colors.success },
  trainerHeader: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 2 },
  trainerInitialsLarge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSoft },
  trainerInitialsLargeText: { color: theme.colors.accentText, fontSize: 15, fontWeight: '700' },
  trainerNameLarge: { color: theme.colors.text, fontSize: 20, fontWeight: '600' },
  trainerMeta: { color: theme.colors.secondaryText, fontSize: 11.5, marginTop: 4 },
  preferenceBody: { gap: 18 },
  weekMatrix: { gap: 7 },
  matrixHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  dayNameSpacer: { width: 48 },
  partHeader: { flex: 1, alignItems: 'center' },
  partHeaderText: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '600' },
  partRange: { color: theme.colors.tertiaryText, fontSize: 8.5, marginTop: 2 },
  matrixRow: { height: 43, flexDirection: 'row', gap: 7, alignItems: 'center' },
  dayName: { width: 48, color: theme.colors.text, fontSize: 12.5, fontWeight: '600' },
  matrixCell: { flex: 1, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceElevated },
  matrixCellActive: { backgroundColor: theme.colors.lime },
  preciseHours: { gap: 14 },
  preciseDay: { gap: 8 },
  preciseDayHeader: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preciseDayTitle: { color: theme.colors.text, fontSize: 12.5, fontWeight: '600' },
  addRange: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 7 },
  addRangeText: { color: theme.colors.accentText, fontSize: 10.5, fontWeight: '600' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { width: 76, height: 42, borderRadius: 11, backgroundColor: theme.colors.surfaceElevated, color: theme.colors.text, textAlign: 'center', fontSize: 13.5, fontWeight: '600' },
  timeInputError: { borderWidth: 1, borderColor: theme.colors.coral },
  rangeError: { color: theme.colors.coral, fontSize: 10.5, lineHeight: 15, marginTop: 5 },
  rangeDash: { color: theme.colors.secondaryText, fontSize: 14 },
  removeRange: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  emptyRange: { minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, borderStyle: 'dashed' },
  emptyRangeText: { color: theme.colors.secondaryText, fontSize: 11.5 },
  bottomBar: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider, backgroundColor: theme.colors.background },
});
