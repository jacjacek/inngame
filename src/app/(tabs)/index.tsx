import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { PurchasedPackage, Training } from '@/data/models';
import { useAppStore } from '@/state/app-store';
import { theme } from '@/theme';
import {
  AppButton,
  Card,
  endTime,
  formatDate,
  formatTime,
  LoadingScreen,
  Pill,
  SectionTitle,
  selectionHaptic,
} from '@/components/ui';
import { MotionPressable } from '@/components/motion';

const courtImage = require('@/assets/mymovio/wimbledon-court.png');
const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

function useHeroParallax() {
  const scrollY = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: reduceMotion
          ? 0
          : interpolate(scrollY.value, [0, 180], [0, 10], Extrapolation.CLAMP),
      },
      { scale: 1.06 },
    ],
  }), [reduceMotion]);
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: reduceMotion
        ? 0
        : interpolate(scrollY.value, [0, 180], [0, -8], Extrapolation.CLAMP),
    }],
  }), [reduceMotion]);

  return { contentStyle, imageStyle, onScroll };
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(date: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay(date, today)) return 'Dzisiaj';
  if (sameDay(date, tomorrow)) return 'Jutro';
  return formatDate(date.toISOString());
}

export default function HomeScreen() {
  const store = useAppStore();
  if (!store.hydrated) return <LoadingScreen />;
  return store.hasAnyTraining ? <TrainingDashboard /> : <FreshDashboard />;
}

function FreshDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profileCompleted, selectedTrainerId, completedSteps } = useAppStore();
  const progress = completedSteps / 3;
  const heroHeight = width < 768 ? Math.min(Math.max(width * 0.86, 320), 352) : 360;
  const heroMotion = useHeroParallax();

  const steps = [
    {
      title: 'Uzupełnij profil',
      subtitle: 'Poziom gry i lokalizacja',
      complete: profileCompleted,
      locked: false,
      onPress: () => router.push('/profile-form'),
    },
    {
      title: 'Wybierz trenera',
      subtitle: 'Poznaj polecanych specjalistów',
      complete: Boolean(selectedTrainerId),
      locked: !profileCompleted,
      onPress: () => router.push('/trainers?purpose=onboarding'),
    },
    {
      title: 'Umów pierwszy trening',
      subtitle: 'Wybierz termin i kort',
      complete: false,
      locked: !selectedTrainerId,
      onPress: () => router.push('/booking'),
    },
  ];

  return (
    <Animated.ScrollView
      style={styles.page}
      contentContainerStyle={styles.freshContent}
      contentInsetAdjustmentBehavior="automatic"
      onScroll={heroMotion.onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.freshHero, { height: heroHeight }]}>
        <Animated.Image source={courtImage} resizeMode="cover" style={[styles.freshHeroImage, heroMotion.imageStyle]} />
        <LinearGradient
          colors={['rgba(17,18,15,0.08)', 'rgba(17,18,15,0.22)', 'rgba(17,18,15,0.96)']}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
        <AnimatedSafeAreaView edges={['top']} style={[styles.freshHeroContent, heroMotion.contentStyle]}>
          <View style={styles.welcomePill}>
            <Ionicons name="tennisball" size={15} color={theme.colors.lime} />
            <Text style={styles.welcomeText}>Witaj w MyMovio</Text>
          </View>
          <Text style={styles.freshTitle}>Twój pierwszy trening{'\n'}zaczyna się tutaj</Text>
          <Text style={styles.freshSubtitle}>Przejdź 3 krótkie kroki, a dopasujemy trenera i termin do Ciebie.</Text>
        </AnimatedSafeAreaView>
      </View>

      <View style={styles.freshCards}>
        <View style={styles.checklist}>
          <View style={styles.checklistHeader}>
            <View>
              <Text style={styles.cardEyebrow}>Zacznij z MyMovio</Text>
              <Text style={styles.checklistCaption}>{completedSteps} z 3 kroków gotowe</Text>
            </View>
            <Text style={styles.progressLabel}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
          <View style={styles.steps}>
            {steps.map((step, index) => (
              <View key={step.title}>
                <MotionPressable
                  disabled={step.locked}
                  pressedScale={0.985}
                  onPress={() => {
                    selectionHaptic();
                    step.onPress();
                  }}
                  style={[styles.stepRow, step.locked && styles.locked]}>
                  <View style={[styles.stepNumber, step.complete && styles.stepComplete]}>
                    {step.complete ? (
                      <Ionicons name="checkmark" size={17} color="#11120F" />
                    ) : step.locked ? (
                      <Ionicons name="lock-closed" size={13} color={theme.colors.tertiaryText} />
                    ) : (
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={theme.colors.tertiaryText} />
                </MotionPressable>
                {index < steps.length - 1 ? <View style={styles.stepDivider} /> : null}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.reassurance}>
          <Ionicons name="shield-checkmark-outline" size={24} color={theme.colors.secondaryText} />
          <View style={styles.flex}>
            <Text style={styles.reassuranceTitle}>Bez zobowiązań</Text>
            <Text style={styles.reassuranceText}>Termin możesz zmienić, a z trenerem porozmawiasz przed pierwszym spotkaniem.</Text>
          </View>
        </View>
      </View>
    </Animated.ScrollView>
  );
}

function TrainingDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { trainings, packages, selectedSport, trainingNote } = useAppStore();
  const [selectedDay, setSelectedDay] = useState(0);
  const [referenceTime] = useState(() => new Date().getTime());
  const futureTrainings = useMemo(
    () => trainings.filter((item) => item.role === 'player' && new Date(item.start).getTime() >= referenceTime - item.durationMinutes * 60_000)
      .sort((a, b) => a.start.localeCompare(b.start)),
    [referenceTime, trainings],
  );
  const next = futureTrainings[0] ?? trainings[0];
  const heroHeight = width < 768 ? Math.min(Math.max(width * 0.86, 320), 352) : 360;
  const heroMotion = useHeroParallax();
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return date;
  }), []);
  const selectedTrainings = trainings.filter((item) => sameDay(new Date(item.start), days[selectedDay]));

  const openTraining = (training: Training) => {
    selectionHaptic();
    router.push({ pathname: '/training/[id]', params: { id: training.id } });
  };

  return (
    <Animated.ScrollView
      style={styles.page}
      contentContainerStyle={styles.dashboardContent}
      contentInsetAdjustmentBehavior="automatic"
      onScroll={heroMotion.onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}>
      <MotionPressable onPress={() => openTraining(next)} pressedScale={0.995} style={[styles.hero, { height: heroHeight }]}>
        <Animated.Image source={courtImage} resizeMode="cover" style={[styles.heroImage, heroMotion.imageStyle]} />
          <LinearGradient
            colors={['rgba(17,18,15,0.12)', 'rgba(17,18,15,0.3)', 'rgba(17,18,15,0.97)']}
            locations={[0, 0.46, 1]}
            style={StyleSheet.absoluteFill}
          />
          <AnimatedSafeAreaView edges={['top']} style={[styles.heroContent, heroMotion.contentStyle]}>
            <Text style={styles.heroEyebrow}>Następny trening</Text>
            <Text style={styles.heroTime}>{formatTime(next.start)}</Text>
            <Text style={styles.heroTitle}>{next.title}</Text>
            <Text style={styles.heroMeta}>{dayLabel(new Date(next.start))}  ·  {next.venue}  ·  {next.court}</Text>
            <View style={styles.durationRow}>
              <Ionicons name="time-outline" size={15} color={theme.colors.secondaryText} />
              <Text style={styles.durationText}>{next.durationMinutes} min</Text>
            </View>
          </AnimatedSafeAreaView>
      </MotionPressable>

      <View style={styles.dashboardBody}>
        <View style={styles.factStrip}>
          <HeroFact icon="grid-outline" label="Kort" value={next.court} />
          <View style={styles.verticalDivider} />
          <HeroFact icon="person" label="Trener" value={next.trainer.split(' ')[0]} />
          <View style={styles.verticalDivider} />
          <HeroFact icon="partly-sunny" label="Warunki" value="22° · Dobre" />
        </View>

        <View style={styles.quickGrid}>
          <QuickAction icon="tennisball" title="Umów grę" subtitle="Partner, trener i kort" onPress={() => router.push('/booking')} />
          <QuickAction icon="list-outline" title="Szczegóły treningu" subtitle="Plan, miejsce i uczestnicy" onPress={() => openTraining(next)} />
        </View>

        <MotionPressable onPress={() => openTraining(next)} pressedScale={0.99}>
          <View style={styles.noteCard}>
            <View style={styles.noteIcon}><Ionicons name="reader-outline" size={18} color={theme.colors.secondaryText} /></View>
            <View style={styles.flex}>
              <Text style={styles.cardEyebrow}>Notatka na następny trening</Text>
              <Text style={styles.noteText}>{trainingNote}</Text>
              <Text style={styles.noteMeta}>{dayLabel(new Date(next.start))} · {formatTime(next.start)}–{endTime(next)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={theme.colors.tertiaryText} />
          </View>
        </MotionPressable>

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <View>
              <Text style={styles.sectionCardTitle}>Najbliższe 7 dni</Text>
              <Text style={styles.calendarHint}>Wybierz dzień</Text>
            </View>
            <Pressable onPress={() => router.navigate('/schedule')} hitSlop={10}>
              <Text style={styles.calendarLink}>Pełny kalendarz  ›</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysRow}>
            {days.map((date, index) => {
              const eventCount = trainings.filter((item) => sameDay(new Date(item.start), date)).length;
              return (
                <Pressable key={date.toISOString()} onPress={() => { selectionHaptic(); setSelectedDay(index); }} style={[styles.day, selectedDay === index && styles.daySelected]}>
                  <Text style={[styles.dayWeek, selectedDay === index && styles.dayTextSelected]}>{new Intl.DateTimeFormat('pl-PL', { weekday: 'short' }).format(date).replace('.', '')}</Text>
                  <Text style={[styles.dayNumber, selectedDay === index && styles.dayTextSelected]}>{date.getDate()}</Text>
                  {eventCount ? <View style={[styles.eventDot, selectedDay === index && { backgroundColor: '#11120F' }]} /> : <View style={styles.eventDotSpacer} />}
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.agenda}>
            {selectedTrainings.length ? selectedTrainings.map((training) => (
              <Pressable key={training.id} onPress={() => openTraining(training)} style={styles.agendaRow}>
                <Text style={styles.agendaTime}>{formatTime(training.start)}</Text>
                <View style={styles.agendaLine} />
                <View style={styles.flex}>
                  <Text style={styles.agendaTitle}>{training.title}</Text>
                  <Text style={styles.agendaMeta}>{training.venue} · {training.court}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.tertiaryText} />
              </Pressable>
            )) : (
              <View style={styles.emptyAgenda}>
                <Ionicons name="calendar-outline" size={19} color={theme.colors.tertiaryText} />
                <Text style={styles.emptyText}>Brak zaplanowanych wydarzeń</Text>
              </View>
            )}
          </View>
        </View>

        <SectionTitle title="Aktywne pakiety" action={<Text style={styles.sectionMeta}>{packages.length} aktywne</Text>} />
        <View style={styles.packageGrid}>
          {packages.map((item) => (
            <PackageColumn
              key={item.id}
              item={item}
              onDetails={() => router.push({ pathname: '/package/[id]', params: { id: item.id } })}
              onTopUp={() => router.push({ pathname: '/top-up/[id]', params: { id: item.id } })}
              onDiscover={() => router.push(item.scope === 'trainer' ? '/trainers' : '/clubs')}
            />
          ))}
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <View>
              <Text style={styles.sectionCardTitle}>Statystyki</Text>
              <Text style={styles.calendarHint}>Ostatnie 13 tygodni</Text>
            </View>
            <Pill label="+18%" active />
          </View>
          <View style={styles.chart}>
            {[18, 30, 46, 35, 24, 42, 60, 34, 52, 46, 69, 57, 78].map((height, index) => (
              <View key={index} style={[styles.chartBar, { height }]} />
            ))}
          </View>
          <View style={styles.metrics}>
            <Metric value="65" label="treningów" />
            <Metric value="45" label="spotkań" />
            <Metric value="450" label="minut" />
          </View>
        </View>

        <AppButton title={`Sport: ${selectedSport}`} icon="swap-horizontal" variant="ghost" onPress={() => router.push('/sport-picker')} />
      </View>
    </Animated.ScrollView>
  );
}

function PackageColumn({
  item,
  onDetails,
  onTopUp,
  onDiscover,
}: {
  item: PurchasedPackage;
  onDetails: () => void;
  onTopUp: () => void;
  onDiscover: () => void;
}) {
  const trainerPackage = item.scope === 'trainer';
  const progress = Math.min(item.remainingHours / item.totalHours, 1);

  return (
    <View style={styles.packageColumn}>
      <Card style={styles.packageCard}>
        <MotionPressable
          onPress={() => { selectionHaptic(); onDetails(); }}
          pressedScale={0.985}
          style={styles.packageDetails}>
          <View style={styles.packageLabelRow}>
            <View style={styles.packageScopeRow}>
              <Ionicons
                name={trainerPackage ? 'person' : 'grid-outline'}
                size={12}
                color={trainerPackage ? theme.colors.lime : theme.colors.sky}
              />
              <Text style={styles.packageScope}>{trainerPackage ? 'Trener' : 'Korty'}</Text>
            </View>
            <Text style={styles.scheduledUses}>{item.scheduledUses} zapl.</Text>
          </View>
          <Text numberOfLines={1} style={styles.packageName}>{item.name}</Text>
          <View style={styles.packageSpacer} />
          <Text style={styles.balance}>
            {item.remainingHours.toLocaleString('pl-PL')}
            <Text style={styles.balanceUnit}> h</Text>
          </Text>
          <Text style={styles.balanceCaption}>pozostało z {item.totalHours.toLocaleString('pl-PL')} h</Text>
          <View style={styles.packageProgressTrack}>
            <View
              style={[
                styles.packageProgressFill,
                { width: `${progress * 100}%`, backgroundColor: trainerPackage ? theme.colors.lime : theme.colors.sky },
              ]}
            />
          </View>
        </MotionPressable>
        <MotionPressable
          onPress={() => { selectionHaptic(); onTopUp(); }}
          pressedScale={0.98}
          style={styles.packageTopUp}>
          <Ionicons name="add" size={13} color={theme.colors.secondaryText} />
          <Text style={styles.topUpLink}>Dokup pakiet</Text>
          <View style={styles.flex} />
          <Ionicons name="chevron-forward" size={12} color={theme.colors.tertiaryText} />
        </MotionPressable>
      </Card>
      <MotionPressable
        onPress={() => { selectionHaptic(); onDiscover(); }}
        pressedScale={0.985}
        style={styles.discoveryTile}>
        <Ionicons
          name={trainerPackage ? 'person-add-outline' : 'search'}
          size={15}
          color={theme.colors.secondaryText}
        />
        <Text numberOfLines={1} style={styles.discoveryText}>
          {trainerPackage ? 'Znajdź trenera' : 'Znajdź kort'}
        </Text>
        <View style={styles.flex} />
        <Ionicons name="chevron-forward" size={12} color={theme.colors.tertiaryText} />
      </MotionPressable>
    </View>
  );
}

function HeroFact({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.heroFact}>
      <View style={styles.factLabelRow}><Ionicons name={icon} size={11} color={theme.colors.secondaryText} /><Text style={styles.factLabel}>{label}</Text></View>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function QuickAction({ icon, title, subtitle, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string; onPress: () => void }) {
  return (
    <MotionPressable
      onPress={() => { selectionHaptic(); onPress(); }}
      android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
      pressedScale={0.985}
      style={styles.quickAction}>
      <Ionicons name={icon} size={20} color={theme.colors.secondaryText} />
      <View style={styles.flex}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.tertiaryText} />
    </MotionPressable>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  pressed: { opacity: 0.72 },
  locked: { opacity: 0.38 },
  freshContent: { paddingBottom: 40 },
  freshHero: { height: 390, width: '100%', position: 'relative', overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: theme.colors.background },
  freshHeroImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: 0.78 },
  freshHeroContent: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 22, paddingBottom: 24 },
  welcomePill: { alignSelf: 'flex-start', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 14 },
  welcomeText: { color: theme.colors.lime, fontSize: 11.5, fontWeight: '600' },
  freshTitle: { color: theme.colors.text, fontSize: 34, fontWeight: '700', letterSpacing: -1.1, lineHeight: 38 },
  freshSubtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 14.5, lineHeight: 20, marginTop: 9, maxWidth: 320 },
  freshCards: { paddingHorizontal: 16, gap: 14 },
  checklist: { paddingHorizontal: 2, paddingVertical: 8 },
  checklistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardEyebrow: { color: theme.colors.secondaryText, fontSize: 10.5, fontWeight: '500' },
  checklistCaption: { color: theme.colors.secondaryText, marginTop: 5, fontSize: 13 },
  progressLabel: { color: theme.colors.text, fontSize: 22, fontWeight: '300' },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.09)', overflow: 'hidden', marginTop: 16 },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.lime },
  steps: { marginTop: 10 },
  stepRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 13 },
  stepDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginLeft: 47 },
  stepNumber: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceElevated },
  stepNumberText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  stepComplete: { backgroundColor: theme.colors.lime },
  stepTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  stepSubtitle: { color: theme.colors.secondaryText, fontSize: 12.5, marginTop: 4 },
  reassurance: { paddingHorizontal: 2, paddingVertical: 16, flexDirection: 'row', gap: 14, alignItems: 'flex-start', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  reassuranceTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  reassuranceText: { color: theme.colors.secondaryText, fontSize: 13, lineHeight: 18, marginTop: 4 },
  dashboardContent: { paddingBottom: 30 },
  hero: { height: 390, width: '100%', position: 'relative', overflow: 'hidden', backgroundColor: theme.colors.background },
  heroImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: 0.74 },
  heroContent: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 23, paddingHorizontal: 20 },
  heroEyebrow: { color: 'rgba(255,255,255,0.68)', fontSize: 10.5, fontWeight: '500' },
  heroTime: { color: theme.colors.text, fontSize: 52, fontWeight: '200', letterSpacing: -2.8, marginTop: 5 },
  heroTitle: { color: theme.colors.text, fontSize: 19, fontWeight: '600', marginTop: 3 },
  heroMeta: { color: theme.colors.secondaryText, fontSize: 13, marginTop: 6 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  durationText: { color: theme.colors.secondaryText, fontSize: 12 },
  dashboardBody: { paddingHorizontal: 16, marginTop: -8, gap: 12 },
  factStrip: { minHeight: 66, flexDirection: 'row', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
  heroFact: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  factLabelRow: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  factLabel: { color: theme.colors.secondaryText, fontSize: 9.5, fontWeight: '500' },
  factValue: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  verticalDivider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  quickGrid: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  quickAction: { minHeight: 66, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider, overflow: 'hidden' },
  quickTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  quickSubtitle: { color: theme.colors.secondaryText, fontSize: 11.5, marginTop: 4 },
  noteCard: { minHeight: 82, flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingHorizontal: 2, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
  noteIcon: { width: 31, alignItems: 'center', justifyContent: 'center' },
  noteText: { color: theme.colors.text, fontSize: 13.5, lineHeight: 18, marginTop: 5 },
  noteMeta: { color: theme.colors.tertiaryText, fontSize: 11.5, marginTop: 6 },
  calendarCard: { paddingTop: 8 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  sectionCardTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  calendarHint: { color: theme.colors.secondaryText, fontSize: 11.5, marginTop: 3 },
  calendarLink: { color: theme.colors.secondaryText, fontSize: 12 },
  daysRow: { paddingVertical: 14, gap: 6 },
  day: { width: 43, minHeight: 66, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  daySelected: { backgroundColor: theme.colors.lime },
  dayWeek: { color: theme.colors.secondaryText, fontSize: 10, textTransform: 'capitalize' },
  dayNumber: { color: theme.colors.text, fontSize: 17, fontWeight: '600', marginTop: 4 },
  dayTextSelected: { color: '#10110E' },
  eventDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.lime, marginTop: 5 },
  eventDotSpacer: { height: 9 },
  agenda: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  agendaRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  agendaTime: { color: theme.colors.text, fontSize: 13, fontWeight: '600', width: 42 },
  agendaLine: { width: 3, height: 32, borderRadius: 2, backgroundColor: theme.colors.lime },
  agendaTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  agendaMeta: { color: theme.colors.secondaryText, fontSize: 11.5, marginTop: 3 },
  emptyAgenda: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { color: theme.colors.secondaryText, fontSize: 12.5 },
  sectionMeta: { color: theme.colors.secondaryText, fontSize: 12 },
  packageGrid: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  packageColumn: { flex: 1, gap: 8 },
  packageCard: { borderRadius: 12 },
  packageDetails: { minHeight: 158, padding: 13 },
  packageLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  packageScopeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  packageScope: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500' },
  scheduledUses: { color: theme.colors.tertiaryText, fontSize: 9.5 },
  packageName: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginTop: 5 },
  packageSpacer: { flex: 1, minHeight: 15 },
  balance: { color: theme.colors.text, fontSize: 26, fontWeight: '500', letterSpacing: -0.8 },
  balanceUnit: { color: theme.colors.secondaryText, fontSize: 14 },
  balanceCaption: { color: theme.colors.tertiaryText, fontSize: 10, marginTop: 1 },
  packageProgressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.09)', overflow: 'hidden', marginTop: 10 },
  packageProgressFill: { height: '100%', borderRadius: 2 },
  packageTopUp: { minHeight: 39, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
  topUpLink: { color: theme.colors.secondaryText, fontSize: 11.5, fontWeight: '600' },
  discoveryTile: { minHeight: 42, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', gap: 6 },
  discoveryText: { color: 'rgba(255,255,255,0.78)', fontSize: 11.5, fontWeight: '600', flexShrink: 1 },
  statsCard: { paddingHorizontal: 2, paddingTop: 10 },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chart: { height: 88, flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  chartBar: { flex: 1, minWidth: 4, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: 'rgba(255,255,255,0.34)' },
  metrics: { flexDirection: 'row', marginTop: 16 },
  metric: { flex: 1 },
  metricValue: { color: theme.colors.text, fontSize: 22, fontWeight: '600' },
  metricLabel: { color: theme.colors.secondaryText, fontSize: 11.5, marginTop: 2 },
});
