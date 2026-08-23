import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const colors = {
  ink: '#07100A',
  text: '#171914',
  canvas: '#F7F8F3',
  surface: '#FFFFFF',
  soft: '#ECEFE5',
  lime: '#C7E12E',
  blue: '#247399',
  coral: '#D9553B',
  white: '#FFFFFF',
  muted: '#62695B',
  border: 'rgba(7,16,10,0.13)',
  glass: 'rgba(247,248,243,0.92)',
};

type IconName = ComponentProps<typeof Ionicons>['name'];

type LandingPageProps = {
  onSignIn: () => void;
  onSignUp: () => void;
};

const emotions: { icon: IconName; title: string; text: string }[] = [
  { icon: 'leaf-outline', title: 'Spokój', text: 'Widzisz cenę, miejsce oraz status swojej rezerwacji.' },
  { icon: 'shield-checkmark-outline', title: 'Zaufanie', text: 'Porównujesz specjalizację, doświadczenie i opis trenera.' },
  { icon: 'navigate-outline', title: 'Sprawczość', text: 'Sam wybierasz trenera, miejsce i termin treningu.' },
  { icon: 'happy-outline', title: 'Radość', text: 'Pierwszy ruch staje się konkretnym terminem w kalendarzu.' },
];

const steps: { number: string; icon: IconName; title: string; text: string }[] = [
  {
    number: '01',
    icon: 'options-outline',
    title: 'Uzupełnij profil',
    text: 'Podaj poziom gry i lokalizację, aby łatwiej wybrać trenera.',
  },
  {
    number: '02',
    icon: 'person-outline',
    title: 'Wybierz trenera',
    text: 'Porównaj specjalizacje, doświadczenie, ceny i miejsca treningów.',
  },
  {
    number: '03',
    icon: 'tennisball-outline',
    title: 'Zarezerwuj trening',
    text: 'Sprawdź dostępność, wybierz termin i wracaj do kalendarza po kolejne treningi.',
  },
];

const features: {
  icon: IconName;
  kicker: string;
  title: string;
  text: string;
  tone: 'lime' | 'blue' | 'coral' | 'soft';
}[] = [
  {
    icon: 'people-outline',
    kicker: 'WYBÓR',
    title: 'Trenerzy i kluby',
    text: 'Czytelne profile, specjalizacje, doświadczenie i miejsca treningów pomagają wybrać właściwą osobę.',
    tone: 'lime',
  },
  {
    icon: 'calendar-outline',
    kicker: 'REGULARNOŚĆ',
    title: 'Rezerwacje i kalendarz',
    text: 'Sprawdzenie terminu, potwierdzenie rezerwacji, kalendarz oraz przełożenie lub odwołanie treningu.',
    tone: 'blue',
  },
  {
    icon: 'chatbubbles-outline',
    kicker: 'RELACJA',
    title: 'Czat i notatki',
    text: 'Każda rezerwacja ma własną rozmowę, a notatki pomagają zachować kontekst treningu.',
    tone: 'soft',
  },
  {
    icon: 'notifications-outline',
    kicker: 'ELASTYCZNOŚĆ',
    title: 'Alerty wolnych terminów',
    text: 'Dostajesz informację, kiedy pojawia się termin dopasowany do Twoich preferencji.',
    tone: 'coral',
  },
];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function responsiveMarker(name: string) {
  return { dataSet: { landing: name } };
}

export function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  // Static rendering uses the desktop style set. CSS media queries in +html.tsx
  // adapt these marked elements before first paint, without a hydration shift.
  const compact = false;
  const mobile = false;

  return (
    <ScrollView
      role="main"
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      style={styles.scroll}>
      <View {...responsiveMarker('shell')} style={[styles.shell, mobile && styles.shellMobile]}>
        <View {...responsiveMarker('header')} style={[styles.header, mobile && styles.headerMobile]}>
          <View style={styles.brand}>
            <Image
              accessibilityLabel="Logo MyMovio"
              source={require('../../assets/mymovio/icon.png')}
              style={styles.brandMark}
            />
            <Text style={styles.brandName}>MyMovio</Text>
          </View>

          <View {...responsiveMarker('nav')} role="navigation" style={[styles.nav, compact && styles.hidden]}>
            <NavButton id="jak-to-dziala" label="Jak to działa" />
            <NavButton id="funkcje" label="Funkcje" />
            <NavButton id="dlaczego" label="Dlaczego MyMovio" />
          </View>

          <View style={styles.headerActions}>
            <Pressable
              {...responsiveMarker('header-login')}
              accessibilityRole="button"
              onPress={onSignIn}
              style={({ pressed }) => [styles.loginButton, mobile && styles.hidden, pressed && styles.pressed]}>
              <Text style={styles.loginLabel}>Zaloguj się</Text>
            </Pressable>
            <Pressable
              {...responsiveMarker('header-cta')}
              accessibilityRole="button"
              onPress={onSignUp}
              style={({ pressed }) => [styles.navCta, mobile && styles.navCtaMobile, pressed && styles.pressed]}>
              <Text style={styles.navCtaLabel}>Załóż konto</Text>
              <Ionicons color={colors.ink} name="arrow-forward" size={16} />
            </Pressable>
          </View>
        </View>

        <View {...responsiveMarker('hero')} style={[styles.hero, compact && styles.heroCompact]}>
          <View {...responsiveMarker('hero-copy')} style={[styles.heroCopy, compact && styles.heroCopyCompact, mobile && styles.heroCopyMobile]}>
            <SectionEyebrow light label="TENIS W TWOIM RYTMIE" />
            <Text
              {...responsiveMarker('hero-title')}
              accessibilityRole="header"
              aria-level={1}
              style={[styles.heroTitle, compact && styles.heroTitleCompact, mobile && styles.heroTitleMobile]}>
              Dobry ruch zaczyna się od dobrego prowadzenia.
            </Text>
            <Text {...responsiveMarker('hero-lead')} style={[styles.heroLead, mobile && styles.heroLeadMobile]}>
              Znajdź trenera, sprawdź termin i zamień dobry zamiar w regularny ruch — spokojnie, we własnym rytmie.
            </Text>
            <View style={styles.heroActions}>
              <Pressable
                {...responsiveMarker('primary-cta')}
                accessibilityRole="button"
                onPress={onSignUp}
                style={({ pressed }) => [styles.primaryCta, mobile && styles.primaryCtaMobile, pressed && styles.pressed]}>
                <Text style={styles.primaryCtaLabel}>Znajdź swojego trenera</Text>
                <Ionicons color={colors.ink} name="arrow-forward" size={18} />
              </Pressable>
              <Pressable
                {...responsiveMarker('secondary-cta')}
                accessibilityRole="button"
                onPress={onSignIn}
                style={({ pressed }) => [styles.secondaryCta, mobile && styles.secondaryCtaMobile, pressed && styles.pressed]}>
                <Text style={styles.secondaryCtaLabel}>Mam już konto</Text>
              </Pressable>
            </View>
            <View style={styles.assurances}>
              {['Jasny kolejny krok', 'Wybór po Twojej stronie', 'Wszystko w jednym miejscu'].map((label) => (
                <View key={label} style={styles.assurance}>
                  <Ionicons color={colors.lime} name="checkmark-circle" size={17} />
                  <Text style={styles.assuranceText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          <ImageBackground
            {...responsiveMarker('hero-visual')}
            imageStyle={styles.heroImage}
            resizeMode="cover"
            source={require('../../assets/mymovio/wimbledon-court.png')}
            style={[styles.heroVisual, compact && styles.heroVisualCompact, mobile && styles.heroVisualMobile]}>
            <View style={styles.visualScrim} />
            <View style={styles.visualTopline}>
              <Text style={styles.visualKicker}>TWÓJ PLAN</Text>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>W RYTMIE</Text>
              </View>
            </View>

            <View {...responsiveMarker('coach-hint')} style={[styles.coachHint, mobile && styles.coachHintMobile]}>
              <Image
                accessibilityLabel="Profil trenerki"
                source={require('../assets/mymovio/trainers/anna-kowalska.png')}
                style={styles.coachAvatar}
              />
              <View style={styles.coachHintCopy}>
                <Text style={styles.coachHintLabel}>WYBRANY TRENER</Text>
                <Text style={styles.coachHintTitle}>Pierwsze kroki i regularność</Text>
              </View>
              <View style={styles.coachCheck}>
                <Ionicons color={colors.ink} name="checkmark" size={16} />
              </View>
            </View>

            <View {...responsiveMarker('next-training')} style={[styles.nextTrainingCard, mobile && styles.nextTrainingCardMobile]}>
              <View style={styles.calendarBadge}>
                <Text style={styles.calendarDay}>24</Text>
                <Text style={styles.calendarMonth}>SIE</Text>
              </View>
              <View style={styles.trainingCopy}>
                <Text style={styles.trainingMeta}>NAJBLIŻSZY TRENING • 18:00</Text>
                <Text style={styles.trainingTitle}>Technika i pewność gry</Text>
                <Text style={styles.trainingPlace}>Kort 2 · 60 min · z trenerem</Text>
              </View>
              <View {...responsiveMarker('training-arrow')} style={[styles.trainingArrow, mobile && styles.hidden]}>
                <Ionicons color={colors.ink} name="arrow-up" size={18} style={styles.arrowTilt} />
              </View>
            </View>
          </ImageBackground>
        </View>

        <View {...responsiveMarker('emotion-section')} nativeID="dlaczego" style={[styles.emotionSection, compact && styles.sectionCompact]}>
          <View {...responsiveMarker('emotion-intro')} style={[styles.emotionIntro, compact && styles.emotionIntroCompact]}>
            <SectionEyebrow label="DOBRY POCZĄTEK" />
            <Text {...responsiveMarker('section-title')} accessibilityRole="header" aria-level={2} style={[styles.sectionTitle, mobile && styles.sectionTitleMobile]}>
              Nie potrzebujesz więcej presji. Potrzebujesz dobrego początku.
            </Text>
            <Text style={styles.sectionLead}>
              Nie musisz mieć formy, planu ani pewności siebie. Dobry trener pomaga zacząć dokładnie na poziomie, na którym jesteś.
            </Text>
          </View>
          <View {...responsiveMarker('emotion-grid')} style={[styles.emotionGrid, compact && styles.emotionGridCompact]}>
            {emotions.map((emotion) => (
              <View {...responsiveMarker('emotion-card')} key={emotion.title} style={[styles.emotionCard, mobile && styles.emotionCardMobile]}>
                <View style={styles.emotionIcon}>
                  <Ionicons color={colors.ink} name={emotion.icon} size={21} />
                </View>
                <Text accessibilityRole="header" aria-level={3} style={styles.emotionTitle}>{emotion.title}</Text>
                <Text style={styles.emotionText}>{emotion.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View nativeID="jak-to-dziala" style={styles.howSection}>
          <View {...responsiveMarker('section-header')} style={[styles.sectionHeader, mobile && styles.sectionHeaderMobile]}>
            <View style={styles.sectionHeaderCopy}>
              <SectionEyebrow label="JAK TO DZIAŁA" />
              <Text {...responsiveMarker('section-title')} accessibilityRole="header" aria-level={2} style={[styles.sectionTitle, mobile && styles.sectionTitleMobile]}>
                Od pierwszej decyzji do własnego rytmu.
              </Text>
            </View>
            <Text {...responsiveMarker('section-header-lead')} style={[styles.sectionHeaderLead, mobile && styles.sectionHeaderLeadMobile]}>
              Trzy proste kroki. Resztę układacie razem.
            </Text>
          </View>
          <View {...responsiveMarker('steps')} style={[styles.steps, compact && styles.stepsCompact]}>
            {steps.map((step, index) => (
              <View {...responsiveMarker('step-card')} key={step.number} style={[styles.stepCard, compact && styles.stepCardCompact]}>
                <View style={styles.stepTopline}>
                  <Text style={styles.stepNumber}>{step.number}</Text>
                  <View style={styles.stepIcon}>
                    <Ionicons color={colors.ink} name={step.icon} size={23} />
                  </View>
                </View>
                <Text accessibilityRole="header" aria-level={3} style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
                {index < steps.length - 1 && !compact ? (
                  <View {...responsiveMarker('step-connector')} style={styles.stepConnector}>
                    <Ionicons color={colors.muted} name="arrow-forward" size={18} />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        <View nativeID="funkcje" style={styles.featuresSection}>
          <View {...responsiveMarker('features-hero')} style={[styles.featuresHero, compact && styles.featuresHeroCompact]}>
            <View {...responsiveMarker('features-copy')} style={[styles.featuresCopy, compact && styles.featuresCopyCompact]}>
              <SectionEyebrow light label="WSZYSTKO W JEDNYM MIEJSCU" />
              <Text {...responsiveMarker('features-title')} accessibilityRole="header" aria-level={2} style={[styles.featuresTitle, mobile && styles.featuresTitleMobile]}>
                Mniej organizowania. Więcej dobrych treningów.
              </Text>
              <Text style={styles.featuresLead}>
                MyMovio porządkuje wybór trenera, terminy, rozmowy i notatki — od pierwszej rezerwacji po kolejne treningi.
              </Text>
              <View style={styles.featureSummary}>
                <SummaryPill icon="checkmark" label="Terminy pod kontrolą" />
                <SummaryPill icon="checkmark" label="Kontakt bez chaosu" />
                <SummaryPill icon="checkmark" label="Historia treningów i czas na korcie" />
              </View>
            </View>

            <View {...responsiveMarker('schedule')} style={[styles.scheduleMockup, compact && styles.scheduleMockupCompact, mobile && styles.scheduleMockupMobile]}>
              <View style={styles.mockupHeader}>
                <View>
                  <Text style={styles.mockupEyebrow}>TYDZIEŃ 35</Text>
                  <Text style={styles.mockupTitle}>Twój kalendarz</Text>
                </View>
                <View style={styles.mockupAdd}>
                  <Ionicons color={colors.ink} name="add" size={20} />
                </View>
              </View>
              <View style={styles.weekRow}>
                {[
                  ['PN', '24'],
                  ['WT', '25'],
                  ['ŚR', '26'],
                  ['CZW', '27'],
                  ['PT', '28'],
                ].map(([day, date], index) => (
                  <View key={day} style={[styles.weekDay, index === 2 && styles.weekDayActive]}>
                    <Text style={[styles.weekDayName, index === 2 && styles.weekDayNameActive]}>{day}</Text>
                    <Text style={[styles.weekDate, index === 2 && styles.weekDateActive]}>{date}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.mockupTraining}>
                <View style={styles.mockupTime}>
                  <Text style={styles.mockupTimeText}>18:00</Text>
                </View>
                <View style={styles.mockupTrainingCopy}>
                  <Text style={styles.mockupTrainingTitle}>Trening techniczny</Text>
                  <Text style={styles.mockupTrainingMeta}>Kort 2 · 60 min</Text>
                </View>
                <Image
                  accessibilityLabel="Trener"
                  source={require('../assets/mymovio/trainers/bartek-nowak.png')}
                  style={styles.mockupAvatar}
                />
              </View>
              <View style={styles.mockupNotice}>
                <Ionicons color={colors.coral} name="notifications" size={18} />
                <Text style={styles.mockupNoticeText}>Pojawił się wolny termin jutro o 17:30</Text>
              </View>
            </View>
          </View>

          <View style={styles.featureGrid}>
            {features.map((feature) => (
              <View {...responsiveMarker('feature-card')} key={feature.title} style={[styles.featureCard, compact && styles.featureCardCompact]}>
                <View style={[styles.featureIcon, styles[`featureIcon_${feature.tone}`]]}>
                  <Ionicons
                    color={feature.tone === 'blue' ? colors.blue : feature.tone === 'coral' ? colors.coral : colors.ink}
                    name={feature.icon}
                    size={23}
                  />
                </View>
                <Text style={styles.featureKicker}>{feature.kicker}</Text>
                <Text accessibilityRole="header" aria-level={3} style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureText}>{feature.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View {...responsiveMarker('coach-section')} style={[styles.coachSection, compact && styles.coachSectionCompact]}>
          <View {...responsiveMarker('coach-portrait')} style={[styles.coachPortraitWrap, compact && styles.coachPortraitWrapCompact]}>
            <Image
              accessibilityLabel="Anna Kowalska, trenerka tenisa"
              resizeMode="cover"
              source={require('../assets/mymovio/trainers/anna-kowalska.png')}
              style={styles.coachPortrait}
            />
            <View {...responsiveMarker('coach-profile')} style={[styles.coachProfileCard, mobile && styles.coachProfileCardMobile]}>
              <Text style={styles.coachProfileExample}>PRZYKŁADOWY PROFIL</Text>
              <View style={styles.coachProfileTopline}>
                <View>
                  <Text style={styles.coachProfileName}>Anna Kowalska</Text>
                  <Text style={styles.coachProfileSpecialty}>Pierwsze kroki i regularność</Text>
                </View>
                <View style={styles.ratingPill}>
                  <Ionicons color={colors.ink} name="star" size={14} />
                  <Text style={styles.ratingText}>5,0</Text>
                </View>
              </View>
              <Text style={styles.coachProfileMeta}>ITF Coaching Level 2 · od 2016 r.</Text>
            </View>
          </View>

          <View {...responsiveMarker('coach-copy')} style={[styles.coachCopy, compact && styles.coachCopyCompact]}>
            <SectionEyebrow label="CZŁOWIEK, NIE ALGORYTM" />
            <Text {...responsiveMarker('section-title')} accessibilityRole="header" aria-level={2} style={[styles.sectionTitle, mobile && styles.sectionTitleMobile]}>
              Wybierasz trenera. To Ty decydujesz, komu zaufać.
            </Text>
            <Text style={styles.sectionLead}>
              Porównujesz doświadczenie, specjalizację, cenę i miejsca treningów. Potem sprawdzasz dostępność i wybierasz konkretny termin.
            </Text>
            <View style={styles.coachBenefits}>
              <BenefitRow icon="reader-outline" text="Czytelne doświadczenie i specjalizacja" />
              <BenefitRow icon="chatbubble-ellipses-outline" text="Rozmowa i notatki powiązane z rezerwacją" />
              <BenefitRow icon="swap-horizontal-outline" text="Elastyczna zmiana terminu" />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onSignUp}
              style={({ pressed }) => [styles.inlineCta, pressed && styles.pressed]}>
              <Text style={styles.inlineCtaLabel}>Załóż konto i poznaj trenerów</Text>
              <Ionicons color={colors.ink} name="arrow-forward" size={17} />
            </Pressable>
          </View>
        </View>

        <View {...responsiveMarker('final')} style={[styles.finalCta, mobile && styles.finalCtaMobile]}>
          <View style={styles.finalGlow} />
          <View style={styles.finalCtaContent}>
            <SectionEyebrow light label="TWÓJ PIERWSZY RUCH" />
            <Text {...responsiveMarker('final-title')} accessibilityRole="header" aria-level={2} style={[styles.finalTitle, mobile && styles.finalTitleMobile]}>
              Nie musi być wielki. Wystarczy, że będzie Twój.
            </Text>
            <Text style={styles.finalLead}>
              Załóż konto i przejrzyj trenerów. Rezerwację potwierdzasz po sprawdzeniu terminu i ceny.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onSignUp}
              style={({ pressed }) => [styles.finalButton, pressed && styles.pressed]}>
              <Text style={styles.finalButtonLabel}>Załóż konto i zacznij</Text>
              <Ionicons color={colors.ink} name="arrow-forward" size={18} />
            </Pressable>
          </View>
          <View {...responsiveMarker('court')} style={[styles.courtMotif, mobile && styles.hidden]}>
            <View style={[styles.courtLine, styles.courtLineOne]} />
            <View style={[styles.courtLine, styles.courtLineTwo]} />
            <View style={[styles.courtLine, styles.courtLineThree]} />
            <View style={styles.courtBall} />
          </View>
        </View>

        <View {...responsiveMarker('footer')} role="contentinfo" style={[styles.footer, mobile && styles.footerMobile]}>
          <View style={styles.brand}>
            <Image
              accessibilityLabel="Logo MyMovio"
              source={require('../../assets/mymovio/icon.png')}
              style={styles.footerMark}
            />
            <View>
              <Text style={styles.footerBrand}>MyMovio</Text>
              <Text style={styles.footerTagline}>Tenis w Twoim rytmie.</Text>
            </View>
          </View>
          <Text style={styles.footerCopy}>© 2026 MyMovio · tenis.walasek.xyz</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function NavButton({ id, label }: { id: string; label: string }) {
  return (
    <Text
      accessibilityRole="link"
      // React Native Web renders Text with `href` as a semantic anchor.
      // @ts-expect-error `href` is a supported web prop not present in the native Text type.
      href={`#${id}`}
      onPress={() => scrollToSection(id)}
      style={styles.navButtonLabel}>
      {label}
    </Text>
  );
}

function SectionEyebrow({ label, light = false }: { label: string; light?: boolean }) {
  return (
    <View style={styles.eyebrow}>
      <View style={styles.eyebrowDot} />
      <Text style={[styles.eyebrowText, light && styles.eyebrowTextLight]}>{label}</Text>
    </View>
  );
}

function SummaryPill({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.summaryPill}>
      <View style={styles.summaryIcon}>
        <Ionicons color={colors.ink} name={icon} size={13} />
      </View>
      <Text style={styles.summaryText}>{label}</Text>
    </View>
  );
}

function BenefitRow({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIcon}>
        <Ionicons color={colors.ink} name={icon} size={19} />
      </View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.canvas },
  page: { flexGrow: 1, backgroundColor: colors.canvas },
  shell: { width: '100%', maxWidth: 1480, alignSelf: 'center', paddingHorizontal: 28 },
  shellMobile: { paddingHorizontal: 14 },
  header: { minHeight: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerMobile: { minHeight: 76 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 13 },
  brandName: { color: colors.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.6 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navButtonLabel: { paddingHorizontal: 13, paddingVertical: 13, color: colors.muted, fontSize: 13, fontWeight: '600', textDecorationLine: 'none' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loginButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  loginLabel: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  navCta: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.lime },
  navCtaMobile: { minHeight: 42, paddingHorizontal: 15 },
  navCtaLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  hero: { minHeight: 720, flexDirection: 'row', overflow: 'hidden', borderRadius: 34, backgroundColor: colors.ink },
  heroCompact: { minHeight: 0, flexDirection: 'column' },
  heroCopy: { flex: 1.02, justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: 64, paddingVertical: 72 },
  heroCopyCompact: { flex: 0, minHeight: 580, paddingHorizontal: 48 },
  heroCopyMobile: { minHeight: 0, paddingHorizontal: 22, paddingVertical: 48 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 24 },
  eyebrowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  eyebrowText: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  eyebrowTextLight: { color: colors.lime },
  heroTitle: { maxWidth: 650, color: colors.white, fontSize: 62, lineHeight: 64, fontWeight: '800', letterSpacing: -2.8 },
  heroTitleCompact: { maxWidth: 760, fontSize: 60, lineHeight: 63 },
  heroTitleMobile: { fontSize: 42, lineHeight: 44, letterSpacing: -1.8 },
  heroLead: { maxWidth: 590, marginTop: 28, color: 'rgba(255,255,255,0.72)', fontSize: 18, lineHeight: 29 },
  heroLeadMobile: { marginTop: 22, fontSize: 16, lineHeight: 25 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 36 },
  primaryCta: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 22, borderRadius: 999, backgroundColor: colors.lime },
  primaryCtaMobile: { width: '100%' },
  primaryCtaLabel: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  secondaryCta: { minHeight: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  secondaryCtaMobile: { width: '100%' },
  secondaryCtaLabel: { color: colors.white, fontSize: 15, fontWeight: '700' },
  assurances: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 36 },
  assurance: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  assuranceText: { color: 'rgba(255,255,255,0.62)', fontSize: 12, fontWeight: '600' },
  heroVisual: { flex: 0.98, minHeight: 720, justifyContent: 'space-between', padding: 34 },
  heroVisualCompact: { flex: 0, minHeight: 560 },
  heroVisualMobile: { minHeight: 480, padding: 20 },
  heroImage: { opacity: 0.96 },
  visualScrim: { position: 'absolute', inset: 0, backgroundColor: 'rgba(4,16,9,0.13)' },
  visualTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  visualKicker: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(7,16,10,0.56)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime },
  liveText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  coachHint: { position: 'absolute', top: 94, right: 34, maxWidth: 330, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 10, paddingRight: 14, borderRadius: 18, backgroundColor: 'rgba(7,16,10,0.76)' },
  coachHintMobile: { top: 82, right: 20, left: 20, maxWidth: undefined },
  coachAvatar: { width: 48, height: 48, borderRadius: 14 },
  coachHintCopy: { flex: 1, gap: 3 },
  coachHintLabel: { color: colors.lime, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  coachHintTitle: { color: colors.white, fontSize: 13, fontWeight: '700' },
  coachCheck: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.lime },
  nextTrainingCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: 22, backgroundColor: colors.glass },
  nextTrainingCardMobile: { gap: 12, padding: 14 },
  calendarBadge: { width: 58, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.ink },
  calendarDay: { color: colors.white, fontSize: 21, fontWeight: '800', lineHeight: 23 },
  calendarMonth: { color: colors.lime, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  trainingCopy: { flex: 1, gap: 3 },
  trainingMeta: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.9 },
  trainingTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.25 },
  trainingPlace: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  trainingArrow: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.lime },
  arrowTilt: { transform: [{ rotate: '45deg' }] },
  emotionSection: { flexDirection: 'row', gap: 72, paddingHorizontal: 34, paddingVertical: 132 },
  sectionCompact: { flexDirection: 'column', gap: 52, paddingHorizontal: 18, paddingVertical: 96 },
  emotionIntro: { flex: 0.9, alignItems: 'flex-start' },
  emotionIntroCompact: { maxWidth: 780 },
  sectionTitle: { maxWidth: 680, color: colors.text, fontSize: 48, lineHeight: 52, fontWeight: '800', letterSpacing: -2 },
  sectionTitleMobile: { fontSize: 36, lineHeight: 39, letterSpacing: -1.4 },
  sectionLead: { maxWidth: 640, marginTop: 24, color: colors.muted, fontSize: 17, lineHeight: 28 },
  emotionGrid: { flex: 1.1, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  emotionGridCompact: { width: '100%' },
  emotionCard: { width: '48%', minHeight: 210, padding: 24, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emotionCardMobile: { width: '100%', minHeight: 0 },
  emotionIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.lime },
  emotionTitle: { marginTop: 30, color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  emotionText: { marginTop: 9, color: colors.muted, fontSize: 14, lineHeight: 21 },
  howSection: { paddingHorizontal: 34, paddingBottom: 132 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 40 },
  sectionHeaderMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: 18 },
  sectionHeaderCopy: { flex: 1, alignItems: 'flex-start' },
  sectionHeaderLead: { maxWidth: 280, paddingBottom: 5, color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: 'right' },
  sectionHeaderLeadMobile: { textAlign: 'left' },
  steps: { flexDirection: 'row', gap: 14, marginTop: 52 },
  stepsCompact: { flexDirection: 'column' },
  stepCard: { flex: 1, minHeight: 310, padding: 28, borderRadius: 26, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  stepCardCompact: { minHeight: 0 },
  stepTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepNumber: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  stepIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.soft },
  stepTitle: { maxWidth: 300, marginTop: 54, color: colors.text, fontSize: 22, lineHeight: 26, fontWeight: '800', letterSpacing: -0.6 },
  stepText: { maxWidth: 330, marginTop: 12, color: colors.muted, fontSize: 14, lineHeight: 22 },
  stepConnector: { position: 'absolute', top: 142, right: -28, zIndex: 3, width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas },
  featuresSection: { paddingBottom: 132 },
  featuresHero: { minHeight: 640, flexDirection: 'row', overflow: 'hidden', borderRadius: 34, backgroundColor: colors.ink },
  featuresHeroCompact: { flexDirection: 'column' },
  featuresCopy: { flex: 0.9, justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: 62, paddingVertical: 68 },
  featuresCopyCompact: { flex: 0, paddingHorizontal: 38 },
  featuresTitle: { maxWidth: 560, color: colors.white, fontSize: 50, lineHeight: 53, fontWeight: '800', letterSpacing: -2.2 },
  featuresTitleMobile: { fontSize: 36, lineHeight: 39, letterSpacing: -1.4 },
  featuresLead: { maxWidth: 550, marginTop: 22, color: 'rgba(255,255,255,0.68)', fontSize: 16, lineHeight: 26 },
  featureSummary: { gap: 12, marginTop: 32 },
  summaryPill: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  summaryIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.lime },
  summaryText: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '600' },
  scheduleMockup: { flex: 1.1, alignSelf: 'center', maxWidth: 610, margin: 48, padding: 26, borderRadius: 28, backgroundColor: colors.canvas, transform: [{ rotate: '-1.8deg' }] },
  scheduleMockupCompact: { flex: 0, width: '86%' },
  scheduleMockupMobile: { width: 'auto', marginHorizontal: 18, marginTop: 4, padding: 18, transform: [] },
  mockupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mockupEyebrow: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  mockupTitle: { marginTop: 3, color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.7 },
  mockupAdd: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.lime },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 7, marginTop: 28 },
  weekDay: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 13, borderRadius: 16, backgroundColor: colors.soft },
  weekDayActive: { backgroundColor: colors.ink },
  weekDayName: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  weekDayNameActive: { color: colors.lime },
  weekDate: { color: colors.text, fontSize: 15, fontWeight: '800' },
  weekDateActive: { color: colors.white },
  mockupTraining: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 20, padding: 15, borderRadius: 19, backgroundColor: colors.surface },
  mockupTime: { alignItems: 'center', justifyContent: 'center', width: 56, height: 48, borderRadius: 14, backgroundColor: colors.lime },
  mockupTimeText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  mockupTrainingCopy: { flex: 1, gap: 3 },
  mockupTrainingTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  mockupTrainingMeta: { color: colors.muted, fontSize: 11 },
  mockupAvatar: { width: 42, height: 42, borderRadius: 14 },
  mockupNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 11, padding: 13, borderRadius: 17, backgroundColor: 'rgba(217,85,59,0.09)' },
  mockupNoticeText: { flex: 1, color: colors.text, fontSize: 11, fontWeight: '600' },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  featureCard: { width: '49%', minHeight: 300, padding: 30, borderRadius: 26, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  featureCardCompact: { width: '100%', minHeight: 0 },
  featureIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  featureIcon_lime: { backgroundColor: colors.lime },
  featureIcon_blue: { backgroundColor: 'rgba(36,115,153,0.10)' },
  featureIcon_coral: { backgroundColor: 'rgba(217,85,59,0.10)' },
  featureIcon_soft: { backgroundColor: colors.soft },
  featureKicker: { marginTop: 32, color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  featureTitle: { marginTop: 8, color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.7 },
  featureText: { maxWidth: 480, marginTop: 11, color: colors.muted, fontSize: 14, lineHeight: 22 },
  coachSection: { flexDirection: 'row', alignItems: 'center', gap: 86, paddingHorizontal: 34, paddingBottom: 132 },
  coachSectionCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 58, paddingHorizontal: 18 },
  coachPortraitWrap: { flex: 0.95, minHeight: 660, overflow: 'hidden', borderRadius: 32, backgroundColor: colors.soft },
  coachPortraitWrapCompact: { flex: 0, minHeight: 580 },
  coachPortrait: { width: '100%', height: '100%' },
  coachProfileCard: { position: 'absolute', right: 20, bottom: 20, left: 20, padding: 20, borderRadius: 22, backgroundColor: colors.glass },
  coachProfileCardMobile: { padding: 16 },
  coachProfileExample: { marginBottom: 11, color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  coachProfileTopline: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  coachProfileName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  coachProfileSpecialty: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '600' },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.lime },
  ratingText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  coachProfileMeta: { marginTop: 16, color: colors.muted, fontSize: 11, fontWeight: '600' },
  coachCopy: { flex: 1.05, alignItems: 'flex-start' },
  coachCopyCompact: { flex: 0 },
  coachBenefits: { gap: 12, marginTop: 30 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.soft },
  benefitText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  inlineCta: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 34, paddingHorizontal: 20, borderRadius: 999, backgroundColor: colors.lime },
  inlineCtaLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  finalCta: { minHeight: 520, justifyContent: 'center', overflow: 'hidden', paddingHorizontal: 64, paddingVertical: 70, borderRadius: 34, backgroundColor: colors.ink },
  finalCtaMobile: { minHeight: 0, paddingHorizontal: 24, paddingVertical: 58 },
  finalGlow: { position: 'absolute', top: -160, right: -80, width: 500, height: 500, borderRadius: 250, backgroundColor: 'rgba(199,225,46,0.08)' },
  finalCtaContent: { zIndex: 2, maxWidth: 730, alignItems: 'flex-start' },
  finalTitle: { color: colors.white, fontSize: 54, lineHeight: 57, fontWeight: '800', letterSpacing: -2.3 },
  finalTitleMobile: { fontSize: 38, lineHeight: 41, letterSpacing: -1.5 },
  finalLead: { maxWidth: 560, marginTop: 20, color: 'rgba(255,255,255,0.66)', fontSize: 16, lineHeight: 25 },
  finalButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 32, paddingHorizontal: 22, borderRadius: 999, backgroundColor: colors.lime },
  finalButtonLabel: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  courtMotif: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '44%', overflow: 'hidden' },
  courtLine: { position: 'absolute', height: 1, backgroundColor: 'rgba(199,225,46,0.30)' },
  courtLineOne: { top: 100, right: -80, width: 460, transform: [{ rotate: '-34deg' }] },
  courtLineTwo: { top: 290, right: -50, width: 540, transform: [{ rotate: '18deg' }] },
  courtLineThree: { top: 370, right: 120, width: 320, transform: [{ rotate: '-48deg' }] },
  courtBall: { position: 'absolute', top: 245, right: 118, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.lime },
  footer: { minHeight: 150, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  footerMobile: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 22 },
  footerMark: { width: 38, height: 38, borderRadius: 13 },
  footerBrand: { color: colors.text, fontSize: 16, fontWeight: '800' },
  footerTagline: { marginTop: 2, color: colors.muted, fontSize: 11 },
  footerCopy: { color: colors.muted, fontSize: 11 },
  pressed: { opacity: 0.72 },
  hidden: { display: 'none' },
});
