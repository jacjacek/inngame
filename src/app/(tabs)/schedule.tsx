import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Training } from '@/data/models';
import { useAppStore } from '@/state/app-store';
import { theme } from '@/theme';
import {
  AppButton,
  formatDate,
  formatTime,
  Header,
  IconButton,
  LoadingScreen,
  Screen,
  selectionHaptic,
} from '@/components/ui';

type Mode = 'list' | 'week' | 'month';

const WEEK_START_HOUR = 6;
const WEEK_END_HOUR = 24;
const HOUR_HEIGHT = 58;
const TIME_COLUMN_WIDTH = 46;
const DAY_COLUMN_WIDTH = 108;
const WEEK_CANVAS_WIDTH = TIME_COLUMN_WIDTH + DAY_COLUMN_WIDTH * 7;
const WEEK_CANVAS_HEIGHT = (WEEK_END_HOUR - WEEK_START_HOUR) * HOUR_HEIGHT;

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(value: Date) {
  const date = startOfDay(value);
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  return date;
}

function addDays(value: Date, count: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + count);
  return date;
}

function trainingsForDay(trainings: Training[], date: Date) {
  return trainings
    .filter((training) => sameDay(new Date(training.start), date))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function eventsCountLabel(count: number) {
  if (count === 0) return 'brak wydarzeń';
  if (count === 1) return '1 wydarzenie';
  if (count >= 2 && count <= 4) return `${count} wydarzenia`;
  return `${count} wydarzeń`;
}

function monthCells(focusDate: Date) {
  const first = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const day = index - leading + 1;
    return day >= 1 && day <= daysInMonth
      ? new Date(focusDate.getFullYear(), focusDate.getMonth(), day)
      : null;
  });
}

export default function ScheduleScreen() {
  const router = useRouter();
  const { trainings, hydrated } = useAppStore();
  const [mode, setMode] = useState<Mode>('list');
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));
  const sortedTrainings = useMemo(
    () => [...trainings].sort((a, b) => a.start.localeCompare(b.start)),
    [trainings],
  );

  if (!hydrated) return <LoadingScreen />;

  const open = (training: Training) => {
    selectionHaptic();
    router.push({ pathname: '/training/[id]', params: { id: training.id } });
  };

  const selectDate = (date: Date) => {
    selectionHaptic();
    setFocusDate(startOfDay(date));
  };

  return (
    <Screen scroll={false} contentStyle={styles.screenContent}>
      <View style={styles.topChrome}>
        <Header
          title="Kalendarz"
          action={<IconButton icon="add" accessibilityLabel="Zaplanuj trening" onPress={() => router.push('/booking')} />}
        />
        <CalendarModeBar
          mode={mode}
          focusDate={focusDate}
          setMode={setMode}
          setFocusDate={selectDate}
        />
      </View>
      {mode === 'list' ? (
        <ListMode trainings={sortedTrainings} open={open} />
      ) : null}
      {mode === 'week' ? (
        <WeekMode
          trainings={sortedTrainings}
          focusDate={focusDate}
          setFocusDate={selectDate}
          open={open}
        />
      ) : null}
      {mode === 'month' ? (
        <MonthMode
          trainings={sortedTrainings}
          focusDate={focusDate}
          setFocusDate={selectDate}
          open={open}
        />
      ) : null}
    </Screen>
  );
}

function CalendarModeBar({
  mode,
  focusDate,
  setMode,
  setFocusDate,
}: {
  mode: Mode;
  focusDate: Date;
  setMode: (mode: Mode) => void;
  setFocusDate: (date: Date) => void;
}) {
  const modes: { value: Mode; label: string }[] = [
    { value: 'list', label: 'Lista' },
    { value: 'week', label: 'Tydzień' },
    { value: 'month', label: 'Miesiąc' },
  ];
  const weekStart = startOfWeek(focusDate);
  const periodTitle = mode === 'week'
    ? `${formatDate(weekStart.toISOString(), { day: 'numeric' })}–${formatDate(addDays(weekStart, 6).toISOString(), { day: 'numeric', month: 'short' })}`
    : new Intl.DateTimeFormat('pl-PL', { month: 'short', year: 'numeric' }).format(focusDate).replace('.', '');

  const movePeriod = (amount: number) => {
    if (mode === 'week') {
      setFocusDate(addDays(focusDate, amount * 7));
    } else {
      setFocusDate(new Date(focusDate.getFullYear(), focusDate.getMonth() + amount, 1));
    }
  };

  return (
    <View style={styles.calendarModeBar}>
      <View style={styles.compactModePicker}>
        {modes.map((item) => (
          <Pressable
            key={item.value}
            accessibilityLabel={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === item.value }}
            onPress={() => {
              selectionHaptic();
              setMode(item.value);
            }}
            style={[styles.compactModeButton, mode === item.value && styles.compactModeButtonSelected]}>
            <Text style={[styles.compactModeText, mode === item.value && styles.compactModeTextSelected]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {mode === 'list' ? <View style={styles.periodSpacer} /> : (
        <View style={styles.periodSwitcher}>
          <Pressable
            accessibilityLabel={mode === 'week' ? 'Poprzedni tydzień' : 'Poprzedni miesiąc'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => movePeriod(-1)}
            style={styles.periodArrow}>
            <Ionicons name="chevron-back" size={17} color={theme.colors.secondaryText} />
          </Pressable>
          <Pressable
            accessibilityLabel="Wróć do dzisiaj"
            accessibilityRole="button"
            onPress={() => setFocusDate(new Date())}
            style={styles.periodTitleButton}>
            <Text numberOfLines={1} style={styles.periodTitle}>{periodTitle}</Text>
            <View style={styles.todayIndicator} />
          </Pressable>
          <Pressable
            accessibilityLabel={mode === 'week' ? 'Następny tydzień' : 'Następny miesiąc'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => movePeriod(1)}
            style={styles.periodArrow}>
            <Ionicons name="chevron-forward" size={17} color={theme.colors.secondaryText} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ListMode({
  trainings,
  open,
}: {
  trainings: Training[];
  open: (training: Training) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [showTodayButton, setShowTodayButton] = useState(false);
  const groups = useMemo(() => {
    const byDay = new Map<string, Training[]>();
    trainings.forEach((training) => {
      const key = startOfDay(new Date(training.start)).toISOString();
      byDay.set(key, [...(byDay.get(key) ?? []), training]);
    });
    return [...byDay.entries()];
  }, [trainings]);

  return (
    <View style={styles.flex}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.modeScrollContent}
        onScroll={(event) => setShowTodayButton(event.nativeEvent.contentOffset.y > 56)}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.contextTitle}>Następne treningi</Text>
        {groups.map(([key, items]) => (
          <View key={key} style={styles.dayGroup}>
            <Text style={styles.dayHeader}>{formatDate(items[0].start, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            <View style={styles.listRows}>
              {items.map((training, index) => (
                <View key={training.id}>
                  <TrainingRow training={training} open={() => open(training)} />
                  {index < items.length - 1 ? <View style={styles.rowDivider} /> : null}
                </View>
              ))}
            </View>
          </View>
        ))}
        {!groups.length ? <EmptyState /> : null}
      </ScrollView>
      {showTodayButton ? (
        <TodayButton
          onPress={() => {
            selectionHaptic();
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
        />
      ) : null}
    </View>
  );
}

function WeekMode({
  trainings,
  focusDate,
  setFocusDate,
  open,
}: {
  trainings: Training[];
  focusDate: Date;
  setFocusDate: (date: Date) => void;
  open: (training: Training) => void;
}) {
  const horizontalRef = useRef<ScrollView>(null);
  const [horizontalOffset, setHorizontalOffset] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const weekStart = startOfWeek(focusDate);
  const weekStartTime = weekStart.getTime();
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekEnd = addDays(weekStart, 7);
  const selectedDayIndex = Math.max(
    0,
    Math.min(6, Math.floor((startOfDay(focusDate).getTime() - weekStart.getTime()) / 86_400_000)),
  );
  const initialHorizontalOffset = Math.max(0, Math.min(
    WEEK_CANVAS_WIDTH,
    TIME_COLUMN_WIDTH + (selectedDayIndex - 1) * DAY_COLUMN_WIDTH,
  ));
  const weekTrainings = trainings.filter((training) => {
    const start = new Date(training.start);
    return start >= weekStart && start < weekEnd;
  });
  const today = startOfDay(new Date());
  const todayWeekStart = startOfWeek(today);
  const isCurrentWeek = sameDay(weekStart, todayWeekStart);
  const todayIndex = Math.max(
    0,
    Math.min(6, Math.floor((today.getTime() - todayWeekStart.getTime()) / 86_400_000)),
  );
  const todayMinX = TIME_COLUMN_WIDTH + todayIndex * DAY_COLUMN_WIDTH;
  const todayMaxX = todayMinX + DAY_COLUMN_WIDTH;
  const todayIsVisible = isCurrentWeek
    && viewportWidth > 0
    && todayMaxX > horizontalOffset
    && todayMinX < horizontalOffset + viewportWidth;
  const hasDifferentSelectedDay = !sameDay(focusDate, today);
  const showTodayButton = hasDifferentSelectedDay
    || (viewportWidth > 0 ? !todayIsVisible : !isCurrentWeek);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      horizontalRef.current?.scrollTo({ x: initialHorizontalOffset, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialHorizontalOffset, weekStartTime]);

  return (
    <View style={styles.weekMode}>
      <View
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        style={styles.weekFrame}>
        <ScrollView
          ref={horizontalRef}
          horizontal
          bounces={false}
          onScroll={(event) => setHorizontalOffset(event.nativeEvent.contentOffset.x)}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          style={styles.weekHorizontal}
          contentContainerStyle={styles.weekHorizontalContent}>
          <View style={styles.weekCanvas}>
            <View style={styles.weekHeader}>
              <View style={styles.weekTimeHeader} />
              {days.map((date) => {
                const selected = sameDay(date, focusDate);
                const today = sameDay(date, new Date());
                const count = trainingsForDay(trainings, date).length;
                return (
                  <Pressable
                    key={date.toISOString()}
                    accessibilityLabel={formatDate(date.toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setFocusDate(date)}
                    style={[styles.weekDayHeader, selected && styles.weekDayHeaderSelected]}>
                    <Text style={styles.weekdayLabel}>
                      {new Intl.DateTimeFormat('pl-PL', { weekday: 'short' }).format(date).replace('.', '')}
                    </Text>
                    <View style={[styles.weekdayNumberCircle, selected && styles.weekdayNumberCircleSelected]}>
                      <Text style={[styles.weekdayNumber, today && styles.todayNumber, selected && styles.selectedDayNumber]}>
                        {date.getDate()}
                      </Text>
                    </View>
                    {count > 0 ? <View style={[styles.weekEventDot, selected && styles.weekEventDotSelected]} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <ScrollView
              nestedScrollEnabled
              bounces={false}
              showsVerticalScrollIndicator
              style={styles.weekVertical}>
              <View style={styles.weekGrid}>
                {Array.from({ length: WEEK_END_HOUR - WEEK_START_HOUR + 1 }, (_, index) => {
                  const hour = index + WEEK_START_HOUR;
                  return (
                    <View key={hour} style={[styles.hourLine, { top: index * HOUR_HEIGHT }]}>
                      <Text style={styles.hourLabel}>{String(hour).padStart(2, '0')}:00</Text>
                      <View style={styles.hourRule} />
                    </View>
                  );
                })}
                {days.map((date, index) => (
                  <Pressable
                    key={date.toISOString()}
                    onPress={() => setFocusDate(date)}
                    style={[
                      styles.dayColumn,
                      { left: TIME_COLUMN_WIDTH + index * DAY_COLUMN_WIDTH },
                      sameDay(date, focusDate) && styles.dayColumnSelected,
                    ]}
                  />
                ))}
                {weekTrainings.map((training) => {
                  const start = new Date(training.start);
                  const dayIndex = Math.floor((startOfDay(start).getTime() - weekStart.getTime()) / 86_400_000);
                  const minutes = start.getHours() * 60 + start.getMinutes() - WEEK_START_HOUR * 60;
                  const top = Math.max(0, minutes / 60 * HOUR_HEIGHT) + 2;
                  const height = Math.max(36, training.durationMinutes / 60 * HOUR_HEIGHT - 4);
                  return (
                    <Pressable
                      key={training.id}
                      onPress={() => open(training)}
                      style={({ pressed }) => [
                        styles.weekEvent,
                        training.role === 'coach' && styles.weekEventCoach,
                        {
                          left: TIME_COLUMN_WIDTH + dayIndex * DAY_COLUMN_WIDTH + 4,
                          top,
                          width: DAY_COLUMN_WIDTH - 8,
                          height,
                        },
                        pressed && styles.pressed,
                      ]}>
                      <View style={[styles.weekEventAccent, training.role === 'coach' && styles.weekEventAccentCoach]} />
                      <View style={styles.weekEventContent}>
                        <Text style={styles.weekEventTime}>{formatTime(training.start)}</Text>
                        <Text numberOfLines={2} style={styles.weekEventTitle}>{training.title}</Text>
                        {height >= 66 ? <Text numberOfLines={1} style={styles.weekEventVenue}>{training.venue}</Text> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      </View>
      {showTodayButton ? (
        <TodayButton
          onPress={() => {
            horizontalRef.current?.scrollTo({
              x: Math.max(0, TIME_COLUMN_WIDTH + (todayIndex - 1) * DAY_COLUMN_WIDTH),
              animated: true,
            });
            setFocusDate(today);
          }}
        />
      ) : null}
    </View>
  );
}

function MonthMode({
  trainings,
  focusDate,
  setFocusDate,
  open,
}: {
  trainings: Training[];
  focusDate: Date;
  setFocusDate: (date: Date) => void;
  open: (training: Training) => void;
}) {
  const cells = monthCells(focusDate);
  const selectedTrainings = trainingsForDay(trainings, focusDate);
  const today = startOfDay(new Date());
  const showTodayButton = !sameDay(focusDate, today);

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.monthScrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.monthWeekdays}>
          {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map((day) => (
            <Text key={day} style={styles.monthWeekday}>{day}</Text>
          ))}
        </View>
        <View style={styles.monthGrid}>
          {cells.map((date, index) => {
            if (!date) return <View key={`empty-${index}`} style={[styles.monthCell, styles.monthEmptyCell]} />;
            const selected = sameDay(date, focusDate);
            const isToday = sameDay(date, today);
            const events = trainingsForDay(trainings, date);
            const visibleEvents = events.slice(0, 2);
            return (
              <Pressable
                key={date.toISOString()}
                accessibilityLabel={`${formatDate(date.toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })}, ${eventsCountLabel(events.length)}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setFocusDate(date)}
                style={[styles.monthCell, selected && styles.monthCellSelected]}>
                <View style={[styles.monthNumberCircle, selected && styles.monthNumberCircleSelected]}>
                  <Text style={[
                    styles.monthNumber,
                    isToday && styles.todayNumber,
                    selected && styles.selectedDayNumber,
                  ]}>
                    {date.getDate()}
                  </Text>
                </View>
                {visibleEvents.map((training) => (
                  <View
                    key={training.id}
                    style={[styles.monthEvent, training.role === 'coach' && styles.monthEventCoach]}>
                    <View style={[styles.monthEventAccent, training.role === 'coach' && styles.monthEventAccentCoach]} />
                    <Text numberOfLines={1} style={styles.monthEventText}>{training.title}</Text>
                  </View>
                ))}
                {events.length > visibleEvents.length ? (
                  <Text style={styles.moreEvents}>+{events.length - visibleEvents.length}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.selectedDayTitle}>
          {formatDate(focusDate.toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        {selectedTrainings.length ? (
          <View style={styles.selectedDayRows}>
            {selectedTrainings.slice(0, 2).map((training, index) => (
              <View key={training.id}>
                <SelectedDayRow training={training} open={() => open(training)} />
                {index < Math.min(selectedTrainings.length, 2) - 1 ? <View style={styles.previewDivider} /> : null}
              </View>
            ))}
            {selectedTrainings.length > 2 ? (
              <Text style={styles.additionalEvents}>+{selectedTrainings.length - 2} kolejne</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.selectedDayEmpty}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.tertiaryText} />
            <Text style={styles.selectedDayEmptyText}>Brak wydarzeń tego dnia</Text>
          </View>
        )}
      </ScrollView>
      {showTodayButton ? <TodayButton onPress={() => setFocusDate(today)} /> : null}
    </View>
  );
}

function TodayButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint="Wraca do bieżącej daty"
      accessibilityLabel="Wróć do dziś"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.todayButton, pressed && styles.todayButtonPressed]}>
      <Text style={styles.todayButtonText}>Wróć do dziś</Text>
    </Pressable>
  );
}

function SelectedDayRow({ training, open }: { training: Training; open: () => void }) {
  return (
    <Pressable
      onPress={() => {
        selectionHaptic();
        open();
      }}
      style={({ pressed }) => [styles.selectedDayRow, pressed && styles.pressed]}>
      <Text style={styles.previewTime}>{formatTime(training.start)}</Text>
      <View style={[styles.previewRoleBar, training.role === 'coach' && styles.roleBarCoach]} />
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.previewTitle}>{training.title}</Text>
        <Text numberOfLines={1} style={styles.previewMeta}>{training.venue} · {training.court}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={theme.colors.tertiaryText} />
    </Pressable>
  );
}

function TrainingRow({ training, open }: { training: Training; open: () => void }) {
  return (
    <Pressable
      onPress={() => {
        selectionHaptic();
        open();
      }}
      android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
      style={({ pressed }) => [styles.trainingRow, pressed && Platform.OS === 'ios' && styles.pressed]}>
      <View style={styles.trainingTime}>
        <Text style={styles.trainingTimeMain}>{formatTime(training.start)}</Text>
        <Text style={styles.trainingDuration}>{training.durationMinutes} min</Text>
      </View>
      <View style={[styles.roleBar, training.role === 'coach' && styles.roleBarCoach]} />
      <View style={styles.flex}>
        <View style={styles.trainingTitleRow}>
          <Text style={styles.trainingTitle}>{training.title}</Text>
          {training.role === 'coach' ? <Text style={styles.coachBadge}>Prowadzisz</Text> : null}
        </View>
        <Text style={styles.trainingMeta}>{training.venue} · {training.court}</Text>
        <Text style={styles.trainingMeta}>{training.trainer}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={theme.colors.tertiaryText} />
    </Pressable>
  );
}

function EmptyState() {
  const router = useRouter();
  return (
    <View style={styles.empty}>
      <Ionicons name="calendar-clear-outline" size={30} color={theme.colors.tertiaryText} />
      <Text style={styles.emptyTitle}>Brak treningów tego dnia</Text>
      <AppButton title="Zaplanuj trening" compact variant="secondary" onPress={() => router.push('/booking')} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenContent: { flex: 1, paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  topChrome: { flexShrink: 0, gap: 8 },
  modeScrollContent: { gap: 12, paddingBottom: 100 },
  monthScrollContent: { gap: 8, paddingBottom: 100 },
  contextTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  calendarModeBar: { height: 38, flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactModePicker: { flex: 1.18, height: 38, padding: 2, flexDirection: 'row', borderRadius: 11, backgroundColor: theme.colors.surfaceElevated },
  compactModeButton: { flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  compactModeButtonSelected: { backgroundColor: '#55564F' },
  compactModeText: { color: theme.colors.secondaryText, fontSize: 10.5, fontWeight: '600' },
  compactModeTextSelected: { color: theme.colors.text },
  periodSpacer: { flex: 0.82 },
  periodSwitcher: { flex: 0.82, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.035)' },
  periodArrow: { width: 28, height: 38, alignItems: 'center', justifyContent: 'center' },
  periodTitleButton: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' },
  periodTitle: { color: theme.colors.text, fontSize: 10.5, fontWeight: '600', textTransform: 'capitalize' },
  todayIndicator: { width: 12, height: 1.5, borderRadius: 1, backgroundColor: theme.colors.lime, marginTop: 3 },
  todayButton: {
    position: 'absolute',
    right: 12,
    bottom: 16,
    zIndex: 10,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(35,36,33,0.94)',
  },
  todayButtonPressed: { opacity: 0.72 },
  todayButtonText: { color: theme.colors.secondaryText, fontSize: 12, fontWeight: '600' },
  dayGroup: { gap: 8 },
  dayHeader: { color: theme.colors.secondaryText, fontSize: 13, fontWeight: '600', textTransform: 'capitalize', marginLeft: 3, marginTop: 5 },
  listRows: { marginHorizontal: 2 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginLeft: 82 },
  trainingRow: { minHeight: 88, paddingHorizontal: 2, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  trainingTime: { width: 53 },
  trainingTimeMain: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  trainingDuration: { color: theme.colors.secondaryText, fontSize: 11, marginTop: 5 },
  roleBar: { width: 3, height: 48, borderRadius: 2, backgroundColor: theme.colors.lime },
  roleBarCoach: { backgroundColor: theme.colors.sky },
  trainingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trainingTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  trainingMeta: { color: theme.colors.secondaryText, fontSize: 12, marginTop: 4 },
  coachBadge: { color: theme.colors.sky, fontSize: 9, fontWeight: '600' },
  weekMode: { flex: 1 },
  weekFrame: { flex: 1, minHeight: 300, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, overflow: 'hidden', backgroundColor: theme.colors.background },
  weekHorizontal: { flex: 1, width: '100%' },
  weekHorizontalContent: { width: WEEK_CANVAS_WIDTH },
  weekCanvas: { width: WEEK_CANVAS_WIDTH, flex: 1 },
  weekHeader: { height: 58, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surfaceSoft },
  weekTimeHeader: { width: TIME_COLUMN_WIDTH, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.colors.border },
  weekDayHeader: { width: DAY_COLUMN_WIDTH, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.colors.divider },
  weekDayHeaderSelected: { backgroundColor: 'rgba(255,255,255,0.035)' },
  weekdayLabel: { color: theme.colors.secondaryText, fontSize: 9, fontWeight: '500', textTransform: 'capitalize' },
  weekdayNumberCircle: { width: 24, height: 24, marginTop: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  weekdayNumberCircleSelected: { backgroundColor: theme.colors.lime },
  weekdayNumber: { color: theme.colors.text, fontSize: 12, fontWeight: '600' },
  selectedDayNumber: { color: '#11120F' },
  todayNumber: { color: theme.colors.lime },
  weekEventDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: theme.colors.lime, marginTop: 2 },
  weekEventDotSelected: { backgroundColor: '#11120F' },
  weekVertical: { flex: 1 },
  weekGrid: { width: WEEK_CANVAS_WIDTH, height: WEEK_CANVAS_HEIGHT, position: 'relative' },
  hourLine: { position: 'absolute', left: 0, width: WEEK_CANVAS_WIDTH, height: 1, flexDirection: 'row', alignItems: 'center' },
  hourLabel: { width: TIME_COLUMN_WIDTH - 7, color: theme.colors.tertiaryText, fontSize: 8, fontVariant: ['tabular-nums'], textAlign: 'right', transform: [{ translateY: -5 }] },
  hourRule: { height: StyleSheet.hairlineWidth, flex: 1, marginLeft: 7, backgroundColor: 'rgba(255,255,255,0.075)' },
  dayColumn: { position: 'absolute', top: 0, bottom: 0, width: DAY_COLUMN_WIDTH, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(255,255,255,0.05)' },
  dayColumnSelected: { backgroundColor: 'rgba(255,255,255,0.018)' },
  weekEvent: { position: 'absolute', flexDirection: 'row', borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(41,42,39,0.96)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(199,225,46,0.20)' },
  weekEventCoach: { backgroundColor: 'rgba(87,184,242,0.09)', borderColor: 'rgba(87,184,242,0.24)' },
  weekEventAccent: { width: 2.5, backgroundColor: theme.colors.lime },
  weekEventAccentCoach: { backgroundColor: theme.colors.sky },
  weekEventContent: { flex: 1, paddingHorizontal: 6, paddingVertical: 5 },
  weekEventTime: { color: theme.colors.secondaryText, fontSize: 8, fontWeight: '600', fontVariant: ['tabular-nums'] },
  weekEventTitle: { color: theme.colors.text, fontSize: 9.5, lineHeight: 12, fontWeight: '600', marginTop: 2 },
  weekEventVenue: { color: theme.colors.tertiaryText, fontSize: 8, marginTop: 2 },
  monthWeekdays: { flexDirection: 'row', marginTop: 2 },
  monthWeekday: { width: '14.2857%', textAlign: 'center', color: theme.colors.secondaryText, fontSize: 10, fontWeight: '600' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
  monthCell: { width: '14.2857%', height: 57, paddingHorizontal: 3, paddingVertical: 3, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
  monthEmptyCell: { backgroundColor: 'rgba(255,255,255,0.008)' },
  monthCellSelected: { backgroundColor: 'rgba(255,255,255,0.025)' },
  monthNumberCircle: { width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  monthNumberCircleSelected: { backgroundColor: theme.colors.lime },
  monthNumber: { color: theme.colors.text, fontSize: 10, fontWeight: '600' },
  monthEvent: { height: 10, marginTop: 2, borderRadius: 2, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: 'rgba(199,225,46,0.075)' },
  monthEventCoach: { backgroundColor: 'rgba(255,255,255,0.035)' },
  monthEventAccent: { width: 2, alignSelf: 'stretch', backgroundColor: theme.colors.lime },
  monthEventAccentCoach: { backgroundColor: theme.colors.sky },
  monthEventText: { flex: 1, color: 'rgba(255,255,255,0.82)', fontSize: 7, fontWeight: '600', paddingHorizontal: 2 },
  moreEvents: { color: theme.colors.secondaryText, fontSize: 8, fontWeight: '600', marginLeft: 3, marginTop: 1 },
  selectedDayTitle: { color: theme.colors.secondaryText, fontSize: 10.5, fontWeight: '500', textTransform: 'capitalize', marginTop: 4 },
  selectedDayRows: { marginHorizontal: 2 },
  selectedDayRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9 },
  previewTime: { width: 37, color: theme.colors.text, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  previewRoleBar: { width: 2.5, height: 32, borderRadius: 2, backgroundColor: theme.colors.lime },
  previewTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  previewMeta: { color: theme.colors.secondaryText, fontSize: 10.5, marginTop: 3 },
  previewDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginLeft: 60 },
  additionalEvents: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '600', paddingBottom: 8 },
  selectedDayEmpty: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  selectedDayEmptyText: { color: theme.colors.secondaryText, fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyTitle: { color: theme.colors.secondaryText, fontSize: 14, marginBottom: 4 },
  pressed: { opacity: 0.72 },
});
