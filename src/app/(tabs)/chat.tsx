import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  ImageSourcePropType,
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

import { AvailabilityOffer, doesOfferMatchPreference, offerTimeLabel, preferenceSummary } from '@/data/availability';
import { conversationPhotos } from '@/data/trainer-media';
import { layout } from '@/responsive';
import { useAppStore } from '@/state/app-store';
import { AppTheme, useThemeStyles } from '@/theme';
import { AppButton, endTime, formatDate, formatTime, IconButton, LoadingScreen, selectionHaptic } from '@/components/ui';

function useStyles() {
  return useThemeStyles(createStyles);
}

export default function ChatScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const store = useAppStore();
  const conversations = store.conversations;
  const trainers = store.trainers;
  const markConversationRead = store.markConversationRead;
  const [requestedConversationId, setSelectedId] = useState(conversationId ?? '');
  const selectedId = conversationId
    ?? conversations.find((item) => item.id === requestedConversationId)?.id
    ?? conversations[0]?.id
    ?? '';
  const [showList, setShowList] = useState(!conversationId);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [composerHeight, setComposerHeight] = useState(38);
  const [showComposerActions, setShowComposerActions] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const conversation = conversations.find((item) => item.id === selectedId);
  const messages = store.messages.filter((item) => item.conversationId === selectedId);
  const conversationOffers = store.availabilityOffers
    .filter((item) => item.conversationId === selectedId)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const timeline = [
    ...messages.map((message) => ({ kind: 'message' as const, sentAt: message.sentAt, message })),
    ...conversationOffers.map((offer) => ({ kind: 'offer' as const, sentAt: offer.sentAt, offer })),
  ].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const latestOffersByConversation = store.availabilityOffers.reduce<Record<string, AvailabilityOffer>>((latest, offer) => {
    const current = latest[offer.conversationId];
    if (!current || offer.sentAt > current.sentAt) latest[offer.conversationId] = offer;
    return latest;
  }, {});
  const matchedUnreadOffer = [...store.availabilityOffers]
    .filter((offer) => !offer.readAt && doesOfferMatchPreference(
      offer,
      store.availabilityPreferences[offer.trainerId],
      store.availabilityNotificationsEnabled,
      store.now,
    ))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
  const nearestTraining = [...store.trainings]
    .filter((item) => (
      item.role !== 'staff'
      && !item.status.startsWith('cancelled')
      && item.status !== 'no_show'
      && new Date(item.end).getTime() >= store.now
    ))
    .sort((a, b) => a.start.localeCompare(b.start))[0];

  useFocusEffect(useCallback(() => {
    if (conversationId) {
      setSelectedId(conversationId);
      setShowList(false);
    }
    setShowComposerActions(false);
  }, [conversationId]));

  const openConversationUnread = store.conversationUnread[selectedId] ?? 0;
  const openConversationUnreadOffers = store.availabilityOffers.filter((offer) => (
    offer.conversationId === selectedId && !offer.readAt
  )).length;

  useEffect(() => {
    if (!store.hydrated || !selectedId || showList || (!openConversationUnread && !openConversationUnreadOffers)) return;
    void markConversationRead(selectedId);
  }, [markConversationRead, openConversationUnread, openConversationUnreadOffers, selectedId, showList, store.hydrated]);

  useEffect(() => {
    if (Platform.OS !== 'android' || showList) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (conversationId) router.replace('/chat');
      setShowList(true);
      return true;
    });
    return () => subscription.remove();
  }, [conversationId, router, showList]);

  useEffect(() => {
    if (!showList) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 40);
  }, [conversationOffers.length, messages.length, selectedId, showList]);

  if (!store.hydrated) return <LoadingScreen />;

  if (showList) {
    const conversationItems = conversations.map((item) => {
      const latestOffer = latestOffersByConversation[item.id];
      const messageUnread = store.conversationUnread[item.id] ?? 0;
      if (!latestOffer) return { ...item, unread: messageUnread };
      const available = latestOffer.status === 'available' && new Date(latestOffer.start).getTime() > store.now;
      const unreadOfferCount = store.availabilityOffers.filter((offer) => offer.conversationId === item.id && !offer.readAt).length;
      return {
        ...item,
        preview: latestOffer.status === 'reserved'
          ? `Zarezerwowane: ${offerTimeLabel(latestOffer)}`
          : available
            ? `Zwolnił się termin: ${offerTimeLabel(latestOffer)}`
            : `Historia terminu: ${offerTimeLabel(latestOffer)}`,
        time: latestOffer.status === 'reserved' ? 'gotowe' : available ? 'teraz' : 'historia',
        unread: messageUnread + unreadOfferCount,
      };
    });
    const filtered = conversationItems.filter((item) => `${item.name} ${item.role}`.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl')));
    const matchedTrainer = matchedUnreadOffer ? trainers.find((trainer) => trainer.id === matchedUnreadOffer.trainerId) : undefined;
    return (
      <SafeAreaView testID="chat-screen-hydrated" style={styles.page} edges={['top', 'left', 'right']}>
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>Wiadomości</Text>
            <Text style={styles.listSubtitle}>Trenerzy, grupy i notatki treningowe</Text>
          </View>
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={theme.colors.secondaryText} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Szukaj rozmów"
            placeholderTextColor={theme.colors.tertiaryText}
            style={styles.searchInput}
            selectionColor={theme.colors.lime}
          />
          {query ? <IconButton icon="close-circle" accessibilityLabel="Wyczyść wyszukiwanie" onPress={() => setQuery('')} /> : null}
        </View>
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {matchedUnreadOffer ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Nowy termin od ${matchedTrainer?.name ?? 'trenera'}, ${offerTimeLabel(matchedUnreadOffer)}`}
              onPress={() => {
                void store.markConversationRead(matchedUnreadOffer.conversationId);
                setSelectedId(matchedUnreadOffer.conversationId);
                setShowList(false);
              }}
              style={({ pressed }) => [styles.pushPreview, pressed && styles.pressed]}>
              <View style={styles.pushIcon}><Ionicons name="flash" size={18} color={theme.colors.onAccent} /></View>
              <View style={styles.flex}>
                <Text style={styles.pushEyebrow}>NOWY TERMIN · {(matchedTrainer?.name ?? 'TRENER').toLocaleUpperCase('pl')}</Text>
                <Text numberOfLines={1} style={styles.pushTitle}>{offerTimeLabel(matchedUnreadOffer)}</Text>
                <Text style={styles.pushText}>Pasuje do Twoich preferencji</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={theme.colors.secondaryText} />
            </Pressable>
          ) : null}
          <Text style={styles.sectionLabel}>Ostatnie</Text>
          {filtered.map((item, index) => (
            <View key={item.id}>
              <Pressable
                accessibilityLabel={`${item.name}, ${item.role}${item.unread ? `, ${item.unread} nieprzeczytane` : ''}`}
                accessibilityRole="button"
                onPress={() => {
                  selectionHaptic();
                  setSelectedId(item.id);
                  void store.markConversationRead(item.id);
                  setShowList(false);
                }}
                android_ripple={{ color: theme.colors.pressed }}
                style={({ pressed }) => [styles.conversationRow, pressed && Platform.OS === 'ios' && styles.pressed]}>
                <Avatar initials={item.initials} source={conversationPhotos[item.id]} />
                <View style={styles.flex}>
                  <View style={styles.conversationTop}>
                    <Text style={styles.conversationName}>{item.name}</Text>
                    <Text style={styles.conversationTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.conversationRole}>{item.role}</Text>
                  <Text numberOfLines={1} style={styles.conversationPreview}>{item.preview}</Text>
                </View>
                {item.unread ? <View style={styles.badge}><Text style={styles.badgeText}>{item.unread}</Text></View> : null}
              </Pressable>
              {index < filtered.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
          {!filtered.length ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={34} color={theme.colors.tertiaryText} />
              <Text style={styles.emptyTitle}>{query ? 'Brak pasujących rozmów' : 'Nie masz jeszcze rozmów'}</Text>
              <Text style={styles.emptyText}>{query ? 'Zmień wyszukiwaną frazę.' : 'Rozmowa treningowa pojawi się automatycznie po utworzeniu rezerwacji.'}</Text>
              {!query ? <AppButton title="Umów trening" variant="secondary" onPress={() => router.push('/booking')} /> : null}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView testID="chat-screen-hydrated" style={styles.page} edges={['top', 'left', 'right']}>
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-ellipses-outline" size={34} color={theme.colors.tertiaryText} />
          <Text style={styles.emptyTitle}>Rozmowa jest niedostępna</Text>
          <Text style={styles.emptyText}>{store.error ?? 'Wróć do listy i wybierz inną rozmowę.'}</Text>
          <AppButton title="Wszystkie rozmowy" variant="secondary" onPress={() => {
            if (conversationId) router.replace('/chat');
            setShowList(true);
          }} />
        </View>
      </SafeAreaView>
    );
  }

  const training = store.trainings.find((item) => item.id === conversation.trainingId);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    selectionHaptic();
    setSending(true);
    const sent = await store.sendMessage(selectedId, body);
    setSending(false);
    if (!sent) {
      Alert.alert('Nie udało się wysłać wiadomości', store.error ?? 'Spróbuj ponownie.');
      return;
    }
    setDraft('');
    setComposerHeight(38);
  };

  const openComposerAction = (action: 'booking' | 'note' | 'edit') => {
    selectionHaptic();
    setShowComposerActions(false);
    if (action === 'booking') {
      router.push('/booking');
    } else if (action === 'note') {
      router.push('/training-note');
    } else if (nearestTraining) {
      router.push({ pathname: '/booking', params: { id: nearestTraining.id } });
    }
  };

  return (
    <SafeAreaView testID="chat-screen-hydrated" style={styles.page} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={styles.chatHeader}>
          <IconButton icon="chevron-back" accessibilityLabel="Wszystkie rozmowy" onPress={() => {
            if (conversationId) router.replace('/chat');
            setShowList(true);
          }} />
          <Pressable accessibilityLabel="Wróć do listy rozmów" accessibilityRole="button" style={styles.chatPerson} onPress={() => {
            if (conversationId) router.replace('/chat');
            setShowList(true);
          }}>
            <Avatar initials={conversation.initials} source={conversationPhotos[conversation.id]} compact />
            <View>
              <Text style={styles.chatName}>{conversation.name}</Text>
              <Text style={styles.online}>Aktywny dzisiaj</Text>
            </View>
          </Pressable>
          <IconButton icon="call-outline" accessibilityLabel="Zadzwoń" onPress={() => undefined} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => {
            if (!showList) scrollRef.current?.scrollToEnd({ animated: false });
          }}
          keyboardDismissMode="interactive"
          onScrollBeginDrag={() => setShowComposerActions(false)}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.dateDivider}>Wczoraj</Text>
          {training ? (
            <Pressable
              onPress={() => router.push({ pathname: '/training/[id]', params: { id: training.id } })}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <View style={styles.trainingArtifact}>
                <View style={styles.artifactIcon}><Ionicons name="tennisball" size={18} color={theme.colors.secondaryText} /></View>
                <View style={styles.flex}>
                  <Text style={styles.artifactEyebrow}>Następny trening</Text>
                  <Text style={styles.artifactTitle}>{training.venue} · {training.court}</Text>
                  <Text style={styles.artifactMeta}>{formatDate(training.start)} · {formatTime(training.start)}–{endTime(training)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={theme.colors.tertiaryText} />
              </View>
            </Pressable>
          ) : null}
          {timeline.map((entry, index) => {
            if (entry.kind === 'offer') {
              return <AvailabilityOfferCard key={`offer-${entry.offer.id}`} offer={entry.offer} referenceTime={store.now} />;
            }
            const message = entry.message;
            const isMe = message.author === 'me';
            const previous = timeline[index - 1];
            const startsSeries = previous?.kind !== 'message' || previous.message.author !== message.author;
            return (
              <View key={`message-${message.id}`} style={[styles.messageRow, isMe && styles.messageRowMe, startsSeries && { marginTop: 14 }]}>
                {!isMe && startsSeries ? <Avatar initials={conversation.initials} source={conversationPhotos[conversation.id]} tiny /> : !isMe ? <View style={{ width: 27 }} /> : null}
                <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
                  <Text style={styles.messageText}>{message.body}</Text>
                  <Text style={styles.messageTime}>{formatTime(message.sentAt)}</Text>
                </View>
              </View>
            );
          })}
          <View style={{ height: 12 }} />
        </ScrollView>

        <View style={styles.contextDock}>
          <Pressable onPress={() => router.push('/training-note')} style={styles.noteDock}>
            <Ionicons name="reader-outline" size={18} color={theme.colors.secondaryText} />
            <View style={styles.flex}>
              <Text style={styles.noteDockLabel}>Notatka po ostatnim treningu</Text>
              <Text numberOfLines={1} style={styles.noteDockText}>{store.trainingNote || 'Dodaj krótkie podsumowanie treningu'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={theme.colors.tertiaryText} />
          </Pressable>
          {showComposerActions ? (
            <View style={styles.composerMenu}>
              <ComposerAction
                icon="calendar-outline"
                title="Dodaj kolejny trening"
                onPress={() => openComposerAction('booking')}
              />
              <View style={styles.composerMenuDivider} />
              <ComposerAction
                icon="document-text-outline"
                title={store.trainingNote.trim() ? 'Edytuj notatkę po ostatnim treningu' : 'Dodaj notatkę po ostatnim treningu'}
                onPress={() => openComposerAction('note')}
              />
              <View style={styles.composerMenuDivider} />
              <ComposerAction
                icon="create-outline"
                title="Edytuj najbliższy trening"
                disabled={!nearestTraining}
                onPress={() => openComposerAction('edit')}
              />
            </View>
          ) : null}
          <View style={styles.composer}>
            <Pressable
              accessibilityLabel="Więcej opcji"
              accessibilityRole="button"
              accessibilityState={{ expanded: showComposerActions }}
              onPress={() => {
                selectionHaptic();
                setShowComposerActions((visible) => !visible);
              }}
              style={[styles.addButton, showComposerActions && styles.addButtonActive]}>
              <Ionicons name={showComposerActions ? 'close' : 'add'} size={22} color={showComposerActions ? theme.colors.lime : theme.colors.secondaryText} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={(value) => {
                setDraft(value);
                if (!value) setComposerHeight(38);
              }}
              onContentSizeChange={({ nativeEvent }) => {
                const nextHeight = draft ? Math.min(Math.max(nativeEvent.contentSize.height, 38), 96) : 38;
                setComposerHeight(nextHeight);
              }}
              onFocus={() => setShowComposerActions(false)}
              placeholder="Wiadomość"
              placeholderTextColor={theme.colors.tertiaryText}
              selectionColor={theme.colors.lime}
              multiline
              style={[styles.composerInput, { height: composerHeight }]}
            />
            <Pressable
              accessibilityLabel="Wyślij wiadomość"
              accessibilityRole="button"
              disabled={!draft.trim() || sending}
              onPress={() => { void send(); }}
              style={[styles.sendButton, (!draft.trim() || sending) && { opacity: 0.35 }]}>
              <Ionicons name={Platform.OS === 'ios' ? 'arrow-up' : 'send'} size={18} color={theme.colors.onAccent} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AvailabilityOfferCard({ offer, referenceTime }: { offer: AvailabilityOffer; referenceTime: number }) {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const store = useAppStore();
  const preference = store.availabilityPreferences[offer.trainerId];
  const available = offer.status === 'available' && new Date(offer.start).getTime() > referenceTime;
  const reserved = offer.status === 'reserved';
  const status = reserved
    ? 'Zarezerwowany przez Ciebie'
    : available
      ? 'Dostępny teraz'
      : offer.status === 'withdrawn'
        ? 'Wycofany przez trenera'
        : offer.status === 'cancelled'
          ? 'Anulowany przez Ciebie'
        : 'Termin wygasł';

  const openOffer = () => {
    selectionHaptic();
    if (reserved && offer.reservedTrainingId) {
      router.push({ pathname: '/training/[id]', params: { id: offer.reservedTrainingId } });
      return;
    }
    if (available) {
      router.push({ pathname: '/booking', params: { offerId: offer.id } });
    }
  };

  return (
    <View style={styles.offerWrap}>
      <View style={[styles.offerCard, reserved && styles.offerCardReserved]}>
        <View style={styles.offerEyebrowRow}>
          <View style={[styles.offerDot, !available && !reserved && styles.offerDotInactive]} />
          <Text style={[styles.offerEyebrow, reserved && styles.offerEyebrowReserved]}>
            {reserved ? 'ZAREZERWOWANY TERMIN' : 'WOLNY TERMIN'}
          </Text>
        </View>
        <Text style={styles.offerTime}>{offerTimeLabel(offer)}</Text>
        <Text style={styles.offerPlace}>{offer.venue} · {offer.court}</Text>
        <View style={styles.offerDivider} />
        <View style={styles.offerPriceRow}>
          <View>
            <Text style={styles.offerLabel}>CENA</Text>
            <Text style={styles.offerPrice}>{offer.price} zł</Text>
          </View>
          <Text style={styles.offerPackage}>Rozliczenie poza aplikacją</Text>
        </View>
        <View style={styles.offerStatusRow}>
          <Ionicons
            name={reserved ? 'checkmark-circle' : available ? 'radio-button-on' : 'time-outline'}
            size={15}
            color={reserved ? theme.colors.sky : available ? theme.colors.success : theme.colors.tertiaryText}
          />
          <Text style={[
            styles.offerStatus,
            reserved && styles.offerStatusReserved,
            !available && !reserved && styles.offerStatusInactive,
          ]}>{status}</Text>
        </View>
        <AppButton
          title={reserved ? 'Zobacz trening' : available ? 'Przejdź do rezerwacji' : 'Termin niedostępny'}
          disabled={!available && !reserved}
          onPress={openOffer}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({
          pathname: '/availability-preferences',
          params: { trainerId: offer.trainerId, returnConversationId: offer.conversationId },
        })}
        style={({ pressed }) => [styles.offerPreferenceLink, pressed && styles.pressed]}>
        <Ionicons name="options-outline" size={17} color={theme.colors.secondaryText} />
        <View style={styles.flex}>
          <Text style={styles.offerPreferenceTitle}>Nie pasuje Ci?</Text>
          <Text numberOfLines={1} style={styles.offerPreferenceText}>{preferenceSummary(preference)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.tertiaryText} />
      </Pressable>
      <Text style={styles.offerTracking}>Oferta zapisana w historii rozmowy</Text>
    </View>
  );
}

function ComposerAction({
  disabled,
  icon,
  onPress,
  title,
}: {
  disabled?: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  title: string;
}) {
  const { styles, theme } = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.composerMenuAction,
        pressed && !disabled && styles.composerMenuActionPressed,
        disabled && styles.composerMenuActionDisabled,
      ]}>
      <View style={styles.composerMenuIcon}>
        <Ionicons name={icon} size={18} color={disabled ? theme.colors.tertiaryText : theme.colors.lime} />
      </View>
      <Text style={[styles.composerMenuText, disabled && styles.composerMenuTextDisabled]}>{title}</Text>
    </Pressable>
  );
}

function Avatar({ initials, source, compact, tiny }: { initials: string; source?: ImageSourcePropType; compact?: boolean; tiny?: boolean }) {
  const { styles } = useStyles();
  const size = tiny ? 27 : compact ? 36 : 48;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {source
        ? <Image source={source} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <Text style={[styles.avatarText, tiny && { fontSize: 9 }, compact && { fontSize: 11 }]}>{initials}</Text>}
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  pressed: { opacity: 0.72 },
  listHeader: { paddingHorizontal: 18, paddingTop: 9, paddingBottom: 14 },
  listTitle: { color: theme.colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -0.7 },
  listSubtitle: { color: theme.colors.secondaryText, fontSize: 13, marginTop: 4 },
  search: { marginHorizontal: 16, height: 46, borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceElevated },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 16 },
  listContent: { padding: 16, gap: 8, paddingBottom: 42 },
  emptyState: { flex: 1, minHeight: 260, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: theme.colors.secondaryText, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 340 },
  pushPreview: { minHeight: 82, padding: 13, marginBottom: 8, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: theme.colors.accentSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.accentBorder },
  pushIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.lime },
  pushEyebrow: { color: theme.colors.accentText, fontSize: 8.5, fontWeight: '700', letterSpacing: 0.7 },
  pushTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '600', marginTop: 4, textTransform: 'capitalize' },
  pushText: { color: theme.colors.secondaryText, fontSize: 10.5, marginTop: 3 },
  sectionLabel: { color: theme.colors.secondaryText, fontSize: 11, fontWeight: '500', marginLeft: 3 },
  conversationRow: { minHeight: 84, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  conversationTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conversationName: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  conversationTime: { color: theme.colors.tertiaryText, fontSize: 11 },
  conversationRole: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500', marginTop: 3 },
  conversationPreview: { color: theme.colors.secondaryText, fontSize: 12.5, marginTop: 4 },
  avatar: { backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: theme.colors.lime, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: theme.colors.onAccent, fontSize: 11, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginLeft: 74 },
  chatHeader: { height: 62, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  chatPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatName: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  online: { color: theme.colors.success, fontSize: 10.5, marginTop: 2 },
  messages: { width: '100%', maxWidth: layout.readableMaxWidth, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  dateDivider: { alignSelf: 'center', color: theme.colors.tertiaryText, fontSize: 10, fontWeight: '500', marginVertical: 10 },
  trainingArtifact: { minHeight: 70, paddingVertical: 11, paddingHorizontal: 2, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
  artifactIcon: { width: 30, alignItems: 'center', justifyContent: 'center' },
  artifactEyebrow: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500' },
  artifactTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginTop: 3 },
  artifactMeta: { color: theme.colors.secondaryText, fontSize: 11, marginTop: 4 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 4, paddingRight: 48 },
  messageRowMe: { justifyContent: 'flex-end', paddingRight: 0, paddingLeft: 48 },
  messageBubble: { maxWidth: '90%', paddingHorizontal: 13, paddingTop: 9, paddingBottom: 7, borderRadius: 18 },
  myBubble: { backgroundColor: theme.colors.messageMine, borderBottomRightRadius: 5 },
  theirBubble: { backgroundColor: theme.colors.surfaceElevated, borderBottomLeftRadius: 5 },
  messageText: { color: theme.colors.text, fontSize: 14.5, lineHeight: 20 },
  messageTime: { color: theme.colors.tertiaryText, fontSize: 9, alignSelf: 'flex-end', marginTop: 4 },
  offerWrap: { marginTop: 18, gap: 9 },
  offerCard: { padding: 16, gap: 10, borderRadius: 21, backgroundColor: theme.colors.accentSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.accentBorder },
  offerCardReserved: { backgroundColor: theme.colors.skySoft, borderColor: theme.colors.skyBorder },
  offerEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  offerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.lime },
  offerDotInactive: { backgroundColor: theme.colors.tertiaryText },
  offerEyebrow: { color: theme.colors.accentText, fontSize: 9.5, fontWeight: '700', letterSpacing: 1 },
  offerEyebrowReserved: { color: theme.colors.sky },
  offerTime: { color: theme.colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, textTransform: 'capitalize' },
  offerPlace: { color: theme.colors.secondaryText, fontSize: 13 },
  offerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginVertical: 2 },
  offerPriceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  offerLabel: { color: theme.colors.tertiaryText, fontSize: 8.5, fontWeight: '600' },
  offerPrice: { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginTop: 3 },
  offerPackage: { color: theme.colors.secondaryText, fontSize: 12, marginBottom: 1 },
  offerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  offerStatus: { color: theme.colors.success, fontSize: 11, fontWeight: '600' },
  offerStatusReserved: { color: theme.colors.sky },
  offerStatusInactive: { color: theme.colors.tertiaryText },
  offerPreferenceLink: { minHeight: 58, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: theme.colors.surfaceSoft },
  offerPreferenceTitle: { color: theme.colors.text, fontSize: 12, fontWeight: '600' },
  offerPreferenceText: { color: theme.colors.secondaryText, fontSize: 10.5, marginTop: 3 },
  offerTracking: { color: theme.colors.tertiaryText, fontSize: 9.5, textAlign: 'center' },
  contextDock: {
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: Platform.OS === 'ios' ? 6 : 10,
    marginBottom: Platform.OS === 'ios' ? 78 : 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
    backgroundColor: theme.colors.surfaceSoft,
  },
  noteDock: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9, marginBottom: 6 },
  noteDockLabel: { color: theme.colors.secondaryText, fontSize: 9.5, fontWeight: '500' },
  noteDockText: { color: theme.colors.secondaryText, fontSize: 11.5, marginTop: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  addButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  addButtonActive: { backgroundColor: theme.colors.accentSoft },
  composerInput: { flex: 1, minHeight: 38, maxHeight: 96, borderRadius: 19, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8, color: theme.colors.text, fontSize: 15, lineHeight: 20, backgroundColor: theme.colors.surfaceElevated },
  sendButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.lime, alignItems: 'center', justifyContent: 'center' },
  composerMenu: {
    position: 'absolute',
    left: 8,
    bottom: 54,
    width: 286,
    zIndex: 20,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  composerMenuAction: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  composerMenuActionPressed: { backgroundColor: theme.colors.pressed },
  composerMenuActionDisabled: { opacity: 0.45 },
  composerMenuIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSoft },
  composerMenuText: { flex: 1, color: theme.colors.text, fontSize: 13.5, fontWeight: '500' },
  composerMenuTextDisabled: { color: theme.colors.tertiaryText },
  composerMenuDivider: { height: StyleSheet.hairlineWidth, marginLeft: 50, backgroundColor: theme.colors.divider },
});
