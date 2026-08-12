export const weekdayOptions = [
  { key: 'monday', label: 'Poniedziałek', shortLabel: 'Pon' },
  { key: 'tuesday', label: 'Wtorek', shortLabel: 'Wt' },
  { key: 'wednesday', label: 'Środa', shortLabel: 'Śr' },
  { key: 'thursday', label: 'Czwartek', shortLabel: 'Czw' },
  { key: 'friday', label: 'Piątek', shortLabel: 'Pt' },
  { key: 'saturday', label: 'Sobota', shortLabel: 'Sob' },
  { key: 'sunday', label: 'Niedziela', shortLabel: 'Niedz' },
] as const;

export const dayPartOptions = [
  { key: 'morning', label: 'Rano', range: '06–12' },
  { key: 'day', label: 'Dzień', range: '12–17' },
  { key: 'evening', label: 'Wieczór', range: '17–22' },
] as const;

export type WeekdayKey = typeof weekdayOptions[number]['key'];
export type DayPartKey = typeof dayPartOptions[number]['key'];
export type AvailabilityLeadTime = 'today' | 'threeDays' | 'sevenDays';
export type AvailabilityOfferStatus = 'available' | 'reserved' | 'cancelled' | 'expired' | 'withdrawn';
export type AvailabilityTimeRange = { id: string; start: string; end: string };

export type AvailabilityPreference = {
  enabled: boolean;
  dayParts: Record<WeekdayKey, DayPartKey[]>;
  leadTime: AvailabilityLeadTime;
  keepAllInChat: boolean;
  preciseHoursEnabled: boolean;
  preciseHours: Partial<Record<WeekdayKey, AvailabilityTimeRange[]>>;
};

export type AvailabilityOffer = {
  id: string;
  trainerId: string;
  conversationId: string;
  start: string;
  durationMinutes: number;
  venue: string;
  court: string;
  price: number;
  packageHours: number;
  sentAt: string;
  status: AvailabilityOfferStatus;
  readAt?: string;
  reservedTrainingId?: string;
};

const jsDayToWeekday: WeekdayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function dayPartForHour(hour: number): DayPartKey | undefined {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'day';
  if (hour >= 17 && hour < 22) return 'evening';
  return undefined;
}

export function minutesFromTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return hour * 60 + minute;
}

export function availabilityTimeRangeError(range: AvailabilityTimeRange) {
  const start = minutesFromTime(range.start);
  const end = minutesFromTime(range.end);
  if (start === undefined || end === undefined) return 'Wpisz godzinę w formacie HH:MM';
  if (start >= end) return 'Godzina końca musi być późniejsza';
  return undefined;
}

export function validAvailabilityRanges(preference: AvailabilityPreference, day: WeekdayKey) {
  return (preference.preciseHours[day] ?? []).filter((range) => !availabilityTimeRangeError(range));
}

export function overlappingAvailabilityRangeIds(preference: AvailabilityPreference, day: WeekdayKey) {
  const ranges = validAvailabilityRanges(preference, day)
    .map((range) => ({ ...range, startMinutes: minutesFromTime(range.start)!, endMinutes: minutesFromTime(range.end)! }));
  const overlapping = new Set<string>();
  for (let left = 0; left < ranges.length; left += 1) {
    for (let right = left + 1; right < ranges.length; right += 1) {
      if (ranges[left].startMinutes < ranges[right].endMinutes
        && ranges[right].startMinutes < ranges[left].endMinutes) {
        overlapping.add(ranges[left].id);
        overlapping.add(ranges[right].id);
      }
    }
  }
  return overlapping;
}

export function usableAvailabilityRanges(preference: AvailabilityPreference, day: WeekdayKey) {
  const overlapping = overlappingAvailabilityRangeIds(preference, day);
  return validAvailabilityRanges(preference, day).filter((range) => !overlapping.has(range.id));
}

function emptyWeek(): Record<WeekdayKey, DayPartKey[]> {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

function makePreference(dayParts: Partial<Record<WeekdayKey, DayPartKey[]>>): AvailabilityPreference {
  return {
    enabled: true,
    dayParts: { ...emptyWeek(), ...dayParts },
    leadTime: 'threeDays',
    keepAllInChat: true,
    preciseHoursEnabled: false,
    preciseHours: {},
  };
}

export function createDefaultAvailabilityPreferences(): Record<string, AvailabilityPreference> {
  return {
    'bartek-nowak': makePreference({
      tuesday: ['evening'],
      thursday: ['evening'],
      saturday: ['morning'],
    }),
    'anna-kowalska': makePreference({
      monday: ['evening'],
      wednesday: ['evening'],
      sunday: ['morning'],
    }),
    'michal-zielinski': {
      ...makePreference({ tuesday: ['evening'], friday: ['evening'] }),
      enabled: false,
    },
  };
}

function nextMatchingDate() {
  const preferred: Partial<Record<WeekdayKey, number>> = {
    tuesday: 18,
    thursday: 17,
    saturday: 9,
  };
  const now = new Date();
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    const weekday = jsDayToWeekday[candidate.getDay()];
    const hour = preferred[weekday];
    if (hour !== undefined) {
      candidate.setHours(hour, 0, 0, 0);
      return candidate;
    }
  }
  const fallback = new Date(now);
  fallback.setDate(now.getDate() + 1);
  fallback.setHours(17, 0, 0, 0);
  return fallback;
}

export function createSampleAvailabilityOffers(): AvailabilityOffer[] {
  const start = nextMatchingDate();
  return [{
    id: `bartek-last-minute-slot-${start.toISOString().slice(0, 10)}`,
    trainerId: 'bartek-nowak',
    conversationId: 'bartek',
    start: start.toISOString(),
    durationMinutes: 60,
    venue: 'Korty Deski',
    court: 'Kort 2',
    price: 240,
    packageHours: 1,
    sentAt: new Date().toISOString(),
    status: 'available',
  }];
}

export function mergeAvailabilityPreferences(
  stored: Record<string, AvailabilityPreference> | undefined,
): Record<string, AvailabilityPreference> {
  const defaults = createDefaultAvailabilityPreferences();
  if (!stored) return defaults;
  return Object.fromEntries(Object.entries(defaults).map(([trainerId, fallback]) => {
    const value = stored[trainerId];
    if (!value) return [trainerId, fallback];
    return [trainerId, {
      ...fallback,
      ...value,
      dayParts: { ...fallback.dayParts, ...value.dayParts },
      preciseHours: { ...fallback.preciseHours, ...value.preciseHours },
    }];
  }));
}

export function restoreAvailabilityOffers(stored: AvailabilityOffer[] | undefined) {
  if (!stored?.length) return createSampleAvailabilityOffers();
  const now = Date.now();
  const restored = expireAvailabilityOffers(stored, now);
  if (restored.some((offer) => isOfferAvailable(offer, now))) {
    return restored;
  }
  const nextOffer = createSampleAvailabilityOffers()[0];
  return restored.some((offer) => offer.id === nextOffer.id) ? restored : [...restored, nextOffer];
}

export function expireAvailabilityOffers(offers: AvailabilityOffer[], referenceTime = Date.now()) {
  let changed = false;
  const expired = offers.map((offer) => {
    if (offer.status !== 'available' || new Date(offer.start).getTime() > referenceTime) return offer;
    changed = true;
    return { ...offer, status: 'expired' as const };
  });
  return changed ? expired : offers;
}

export function preferenceSummary(preference: AvailabilityPreference) {
  if (!preference.enabled) return 'Wyłączone';
  if (preference.preciseHoursEnabled) {
    const precise = weekdayOptions.flatMap((day) => usableAvailabilityRanges(preference, day.key).map((range) => (
      `${day.shortLabel} ${range.start}–${range.end}`
    )));
    if (precise.length) return precise.join(' · ');
  }
  const selected = weekdayOptions.flatMap((day) => {
    const parts = preference.dayParts[day.key];
    if (!parts.length) return [];
    const labels = parts.map((part) => dayPartOptions.find((item) => item.key === part)?.label.toLocaleLowerCase('pl')).filter(Boolean);
    return [`${day.shortLabel} ${labels.join(', ')}`];
  });
  return selected.length ? selected.join(' · ') : 'Wybierz dostępne pory';
}

export function offerTimeLabel(offer: AvailabilityOffer) {
  const start = new Date(offer.start);
  const end = new Date(start.getTime() + offer.durationMinutes * 60_000);
  const date = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'short' }).format(start);
  const time = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(start);
  const endTime = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(end);
  return `${date} · ${time}–${endTime}`;
}

export function isOfferAvailable(offer: AvailabilityOffer, referenceTime = Date.now()) {
  return offer.status === 'available' && new Date(offer.start).getTime() > referenceTime;
}

export function doesOfferMatchPreference(
  offer: AvailabilityOffer,
  preference: AvailabilityPreference | undefined,
  notificationsEnabled: boolean,
  referenceTime = Date.now(),
) {
  if (!notificationsEnabled || !preference?.enabled || !isOfferAvailable(offer, referenceTime)) return false;
  const start = new Date(offer.start);
  const day = jsDayToWeekday[start.getDay()];
  const leadHours = (start.getTime() - referenceTime) / 3_600_000;
  if (leadHours < 0) return false;
  if (preference.leadTime === 'today') {
    if (start.toDateString() !== new Date(referenceTime).toDateString()) return false;
  } else {
    const maxLeadHours = preference.leadTime === 'threeDays' ? 72 : 168;
    if (leadHours > maxLeadHours) return false;
  }
  if (preference.preciseHoursEnabled) {
    const offerMinutes = start.getHours() * 60 + start.getMinutes();
    const offerEndMinutes = offerMinutes + offer.durationMinutes;
    const preciseRanges = usableAvailabilityRanges(preference, day);
    if (preciseRanges.length) return preciseRanges.some((range) => {
      const rangeStart = minutesFromTime(range.start);
      const rangeEnd = minutesFromTime(range.end);
      return rangeStart !== undefined
        && rangeEnd !== undefined
        && rangeStart < rangeEnd
        && offerMinutes >= rangeStart
        && offerEndMinutes <= rangeEnd;
    });
  }
  const part = dayPartForHour(start.getHours());
  return part ? preference.dayParts[day].includes(part) : false;
}
