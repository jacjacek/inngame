import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
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

import { conversations } from '@/data/models';
import { conversationPhotos } from '@/data/trainer-media';
import { useAppStore } from '@/state/app-store';
import { theme } from '@/theme';
import { endTime, formatDate, formatTime, IconButton, LoadingScreen, selectionHaptic } from '@/components/ui';

export default function ChatScreen() {
  const router = useRouter();
  const store = useAppStore();
  const [selectedId, setSelectedId] = useState(conversations[0].id);
  const [showList, setShowList] = useState(true);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [composerHeight, setComposerHeight] = useState(38);
  const [showComposerActions, setShowComposerActions] = useState(false);
  const [referenceTime] = useState(() => new Date().getTime());
  const scrollRef = useRef<ScrollView>(null);

  const conversation = conversations.find((item) => item.id === selectedId) ?? conversations[0];
  const messages = store.messages.filter((item) => item.conversationId === selectedId);
  const nearestTraining = [...store.trainings]
    .filter((item) => item.role === 'player' && new Date(item.start).getTime() + item.durationMinutes * 60_000 >= referenceTime)
    .sort((a, b) => a.start.localeCompare(b.start))[0];

  useFocusEffect(useCallback(() => {
    setShowList(true);
    setShowComposerActions(false);
  }, []));

  useEffect(() => {
    if (Platform.OS !== 'android' || showList) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowList(true);
      return true;
    });
    return () => subscription.remove();
  }, [showList]);

  useEffect(() => {
    if (!showList) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 40);
  }, [messages.length, selectedId, showList]);

  if (!store.hydrated) return <LoadingScreen />;

  if (showList) {
    const filtered = conversations.filter((item) => `${item.name} ${item.role}`.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl')));
    return (
      <SafeAreaView style={styles.page} edges={['top', 'left', 'right']}>
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
          <Text style={styles.sectionLabel}>Ostatnie</Text>
          {filtered.map((item, index) => (
            <View key={item.id}>
              <Pressable
                onPress={() => {
                  selectionHaptic();
                  setSelectedId(item.id);
                  setShowList(false);
                }}
                android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
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
        </ScrollView>
      </SafeAreaView>
    );
  }

  const training = store.trainings.find((item) => item.id === conversation.trainingId);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    selectionHaptic();
    store.sendMessage(selectedId, body);
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
    <SafeAreaView style={styles.page} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={styles.chatHeader}>
          <IconButton icon="chevron-back" accessibilityLabel="Wszystkie rozmowy" onPress={() => setShowList(true)} />
          <Pressable style={styles.chatPerson} onPress={() => setShowList(true)}>
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
          {messages.map((message, index) => {
            const isMe = message.author === 'me';
            const previous = messages[index - 1];
            const startsSeries = !previous || previous.author !== message.author;
            return (
              <View key={message.id} style={[styles.messageRow, isMe && styles.messageRowMe, startsSeries && { marginTop: 14 }]}>
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
              disabled={!draft.trim()}
              onPress={send}
              style={[styles.sendButton, !draft.trim() && { opacity: 0.35 }]}>
              <Ionicons name={Platform.OS === 'ios' ? 'arrow-up' : 'send'} size={18} color="#11120F" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  const size = tiny ? 27 : compact ? 36 : 48;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {source
        ? <Image source={source} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <Text style={[styles.avatarText, tiny && { fontSize: 9 }, compact && { fontSize: 11 }]}>{initials}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  pressed: { opacity: 0.72 },
  listHeader: { paddingHorizontal: 18, paddingTop: 9, paddingBottom: 14 },
  listTitle: { color: theme.colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -0.7 },
  listSubtitle: { color: theme.colors.secondaryText, fontSize: 13, marginTop: 4 },
  search: { marginHorizontal: 16, height: 46, borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceElevated },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 16 },
  listContent: { padding: 16, gap: 8, paddingBottom: 42 },
  sectionLabel: { color: theme.colors.secondaryText, fontSize: 11, fontWeight: '500', marginLeft: 3 },
  conversationRow: { minHeight: 84, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  conversationTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conversationName: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  conversationTime: { color: theme.colors.tertiaryText, fontSize: 11 },
  conversationRole: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500', marginTop: 3 },
  conversationPreview: { color: theme.colors.secondaryText, fontSize: 12.5, marginTop: 4 },
  avatar: { backgroundColor: '#3A3B35', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: theme.colors.lime, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#11120F', fontSize: 11, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginLeft: 74 },
  chatHeader: { height: 62, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  chatPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatName: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  online: { color: theme.colors.success, fontSize: 10.5, marginTop: 2 },
  messages: { paddingHorizontal: 14, paddingVertical: 10 },
  dateDivider: { alignSelf: 'center', color: theme.colors.tertiaryText, fontSize: 10, fontWeight: '500', marginVertical: 10 },
  trainingArtifact: { minHeight: 70, paddingVertical: 11, paddingHorizontal: 2, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
  artifactIcon: { width: 30, alignItems: 'center', justifyContent: 'center' },
  artifactEyebrow: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500' },
  artifactTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginTop: 3 },
  artifactMeta: { color: theme.colors.secondaryText, fontSize: 11, marginTop: 4 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 4, paddingRight: 48 },
  messageRowMe: { justifyContent: 'flex-end', paddingRight: 0, paddingLeft: 48 },
  messageBubble: { maxWidth: '90%', paddingHorizontal: 13, paddingTop: 9, paddingBottom: 7, borderRadius: 18 },
  myBubble: { backgroundColor: '#3A4520', borderBottomRightRadius: 5 },
  theirBubble: { backgroundColor: theme.colors.surfaceElevated, borderBottomLeftRadius: 5 },
  messageText: { color: theme.colors.text, fontSize: 14.5, lineHeight: 20 },
  messageTime: { color: theme.colors.tertiaryText, fontSize: 9, alignSelf: 'flex-end', marginTop: 4 },
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
  addButtonActive: { backgroundColor: 'rgba(199,225,46,0.1)' },
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
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  composerMenuAction: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  composerMenuActionPressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  composerMenuActionDisabled: { opacity: 0.45 },
  composerMenuIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(199,225,46,0.08)' },
  composerMenuText: { flex: 1, color: theme.colors.text, fontSize: 13.5, fontWeight: '500' },
  composerMenuTextDisabled: { color: theme.colors.tertiaryText },
  composerMenuDivider: { height: StyleSheet.hairlineWidth, marginLeft: 50, backgroundColor: theme.colors.divider },
});
