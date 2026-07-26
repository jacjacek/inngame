export type TrainingRole = 'player' | 'coach';

export type Training = {
  id: string;
  start: string;
  durationMinutes: number;
  title: string;
  trainer: string;
  venue: string;
  court: string;
  totalPrice: number;
  role: TrainingRole;
  participants: string[];
  notes: string;
};

export type PackageScope = 'trainer' | 'club';

export type PackagePurchase = {
  id: string;
  purchasedAt: string;
  hours: number;
  amount: number;
  paymentMethod: string;
  reference: string;
};

export type PurchasedPackage = {
  id: string;
  scope: PackageScope;
  name: string;
  totalHours: number;
  remainingHours: number;
  scheduledUses: number;
  baseHourlyPrice: number;
  validUntil: string;
  purchases: PackagePurchase[];
};

export type Trainer = {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  certification: string;
  phone: string;
  distance: string;
  rating: string;
  reviewCount: number;
  price: number;
  availability: string;
  experience: string;
  trainings: number;
  about: string[];
  clubs: string[];
};

export type Club = {
  id: string;
  name: string;
  address: string;
  distance: string;
  courts: number;
  surface: string;
  price: number;
};

export type ChatConversation = {
  id: string;
  name: string;
  initials: string;
  role: string;
  preview: string;
  time: string;
  unread: number;
  trainingId?: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  author: 'me' | 'them';
  body: string;
  sentAt: string;
};

export type Profile = {
  name: string;
  city: string;
  playingLevel: string;
};

export type NotificationSettings = {
  trainingReminders: boolean;
  chatMessages: boolean;
  scheduleChanges: boolean;
  payments: boolean;
  courtConditions: boolean;
};

export const trainers: Trainer[] = [
  {
    id: 'bartek-nowak',
    name: 'Bartek Nowak',
    initials: 'BN',
    specialty: 'Technika i gra meczowa',
    certification: 'PTR Professional',
    phone: '+48 501 284 690',
    distance: '1,8 km',
    rating: '4,9',
    reviewCount: 86,
    price: 120,
    availability: 'Jutro od 17:00',
    experience: '8 lat',
    trainings: 640,
    about: [
      'Pomagam zawodnikom grać pewniej i podejmować lepsze decyzje podczas meczu.',
      'Łączę technikę z ćwiczeniami, które od razu przekładają się na sytuacje punktowe.',
      'Na korcie stawiam na konkretny feedback, wysoką intensywność i dobrą atmosferę.',
    ],
    clubs: ['Korty Deski', 'Legia Tenis'],
  },
  {
    id: 'anna-kowalska',
    name: 'Anna Kowalska',
    initials: 'AK',
    specialty: 'Pierwsze kroki i regularność',
    certification: 'ITF Coaching Level 2',
    phone: '+48 607 441 208',
    distance: '3,2 km',
    rating: '5,0',
    reviewCount: 112,
    price: 140,
    availability: 'Poniedziałek od 16:00',
    experience: '10 lat',
    trainings: 910,
    about: [
      'Uczę tenisa od podstaw i pomagam wrócić do regularnej gry po dłuższej przerwie.',
      'Pracuję zarówno z dorosłymi, jak i młodzieżą.',
      'Najważniejsze są dla mnie cierpliwość, dobra komunikacja i radość z gry.',
    ],
    clubs: ['Warszawianka', 'KT Mera'],
  },
  {
    id: 'michal-zielinski',
    name: 'Michał Zieliński',
    initials: 'MZ',
    specialty: 'Kondycja i przygotowanie turniejowe',
    certification: 'GPTCA Level C',
    phone: '+48 733 877 599',
    distance: '4,5 km',
    rating: '4,8',
    reviewCount: 64,
    price: 130,
    availability: 'Wtorek od 18:30',
    experience: '7 lat',
    trainings: 520,
    about: [
      'Jestem trenerem tenisa i byłym zawodnikiem turniejowym.',
      'Łączę pracę nad poruszaniem, wytrzymałością i schematami taktycznymi.',
      'Na treningach stawiam na indywidualne podejście i realny progres.',
    ],
    clubs: ['DeSki Warszawa'],
  },
];

export const clubs: Club[] = [
  { id: 'deski', name: 'Korty Deski', address: 'ul. Zaruskiego 8', distance: '1,2 km', courts: 7, surface: 'Mączka', price: 120 },
  { id: 'legia', name: 'Legia Tenis', address: 'ul. Myśliwiecka 4A', distance: '2,7 km', courts: 10, surface: 'Mączka / hard', price: 140 },
  { id: 'warszawianka', name: 'Warszawianka', address: 'ul. Merliniego 9', distance: '4,1 km', courts: 8, surface: 'Mączka', price: 110 },
  { id: 'mera', name: 'KT Mera', address: 'al. Bohaterów Września 12', distance: '6,3 km', courts: 12, surface: 'Hard', price: 130 },
];

function at(dayOffset: number, hour: number, minute = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function inMonths(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function ago(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export const sampleTrainings: Training[] = [
  {
    id: 'deski-next-training',
    start: at(1, 10),
    durationMinutes: 120,
    title: 'Trening z Bartkiem',
    trainer: 'Bartek Nowak',
    venue: 'Korty Deski',
    court: 'Kort 2',
    totalPrice: 480,
    role: 'player',
    participants: ['Bartek Nowak', 'Michał', 'Piotr'],
    notes: 'Serwis: wyższy podrzut piłki. Return z bekhendu i wcześniejszy split step.',
  },
  {
    id: 'legia-rozgrzewka',
    start: at(3, 8),
    durationMinutes: 60,
    title: 'Rozgrzewka meczowa',
    trainer: 'Bartek Nowak',
    venue: 'Legia Tenis',
    court: 'Kort 2',
    totalPrice: 260,
    role: 'player',
    participants: ['Bartek Nowak'],
    notes: 'Krótki blok przed meczem ligowym.',
  },
  {
    id: 'legia-liga',
    start: at(3, 11),
    durationMinutes: 120,
    title: 'Mecz ligowy',
    trainer: 'Liga klubowa',
    venue: 'Legia Tenis',
    court: 'Kort 1',
    totalPrice: 280,
    role: 'player',
    participants: ['Michał'],
    notes: 'Runda klubowa.',
  },
  {
    id: 'deski-grupa',
    start: at(4, 8),
    durationMinutes: 60,
    title: 'Grupa początkująca',
    trainer: '4 uczestników',
    venue: 'Korty Deski',
    court: 'Kort 1',
    totalPrice: 120,
    role: 'coach',
    participants: ['4 uczestników'],
    notes: 'Prowadzisz ten trening.',
  },
  {
    id: 'warszawianka-serwis',
    start: at(6, 18),
    durationMinutes: 120,
    title: 'Technika serwisu',
    trainer: 'Anna Kowalska',
    venue: 'Warszawianka',
    court: 'Kort 3',
    totalPrice: 500,
    role: 'player',
    participants: ['Anna Kowalska'],
    notes: 'Praca nad pierwszym podaniem.',
  },
  {
    id: 'mery-debel',
    start: at(12, 11),
    durationMinutes: 120,
    title: 'Debel treningowy',
    trainer: 'Bartek i Michał',
    venue: 'KT Mera',
    court: 'Kort 7',
    totalPrice: 500,
    role: 'player',
    participants: ['Bartek', 'Michał', 'Ola'],
    notes: 'Rotacja przy siatce.',
  },
];

export const samplePackages: PurchasedPackage[] = [
  {
    id: 'bartek-ten-hour-package',
    scope: 'trainer',
    name: 'Bartek Nowak',
    totalHours: 10,
    remainingHours: 6.5,
    scheduledUses: 3,
    baseHourlyPrice: 120,
    validUntil: inMonths(4),
    purchases: [
      { id: 'bartek-initial', purchasedAt: ago(72), hours: 10, amount: 1140, paymentMethod: 'Visa •••• 4242', reference: 'MYM-260508-BN' },
    ],
  },
  {
    id: 'deski-twenty-hour-package',
    scope: 'club',
    name: 'Korty Deski',
    totalHours: 20,
    remainingHours: 12,
    scheduledUses: 2,
    baseHourlyPrice: 100,
    validUntil: inMonths(5),
    purchases: [
      { id: 'deski-initial', purchasedAt: ago(41), hours: 20, amount: 1800, paymentMethod: 'BLIK', reference: 'MYM-260608-KD' },
    ],
  },
];

export const conversations: ChatConversation[] = [
  { id: 'bartek', name: 'Bartek Nowak', initials: 'BN', role: 'Trener', preview: 'Jasne, widzimy się jutro na Deski.', time: '18:42', unread: 2, trainingId: 'deski-next-training' },
  { id: 'team', name: 'Michał i Piotr', initials: 'MP', role: 'Grupa treningowa', preview: 'Piotr potwierdził godzinę 10:00.', time: '16:18', unread: 0, trainingId: 'deski-next-training' },
  { id: 'anna', name: 'Anna Kowalska', initials: 'AK', role: 'Trenerka', preview: 'Podeślę Ci ćwiczenie na serwis.', time: 'Wczoraj', unread: 0, trainingId: 'warszawianka-serwis' },
];

export const initialMessages: ChatMessage[] = [
  { id: 'm1', conversationId: 'bartek', author: 'them', body: 'Cześć! Jutro skupimy się na serwisie i pierwszej piłce po returnie.', sentAt: ago(1) },
  { id: 'm2', conversationId: 'bartek', author: 'me', body: 'Super. Czy mogę przyjść 10 minut wcześniej na rozgrzewkę?', sentAt: ago(1) },
  { id: 'm3', conversationId: 'bartek', author: 'them', body: 'Jasne, widzimy się jutro na Deski.', sentAt: new Date().toISOString() },
  { id: 'm4', conversationId: 'team', author: 'them', body: 'Piotr potwierdził godzinę 10:00.', sentAt: new Date().toISOString() },
  { id: 'm5', conversationId: 'anna', author: 'them', body: 'Podeślę Ci ćwiczenie na serwis po treningu.', sentAt: ago(1) },
];

