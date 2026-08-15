import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { trainers } from '@/data/models';
import { trainerPhotos } from '@/data/trainer-media';
import { ModalHeader, Pill, selectionHaptic, withSheetPage } from '@/components/ui';
import { AppTheme, useThemeStyles } from '@/theme';

function useStyles() {
  return useThemeStyles(createStyles);
}

function TrainersScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const { purpose } = useLocalSearchParams<{ purpose?: string }>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Polecani');
  const filtered = trainers.filter((trainer) => `${trainer.name} ${trainer.specialty} ${trainer.clubs.join(' ')}`.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl')));

  return (
    <View style={styles.page}>
      <ModalHeader title={purpose === 'onboarding' ? 'Wybierz trenera' : 'Znajdź trenera'} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.title}>{purpose === 'onboarding' ? 'Kto pomoże Ci zacząć?' : 'Trener dopasowany do Ciebie'}</Text>
          <Text style={styles.subtitle}>Zweryfikowani trenerzy tenisa w Warszawie. Poznaj ich styl pracy i najbliższe terminy.</Text>
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={theme.colors.secondaryText} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Nazwisko, klub lub specjalizacja" placeholderTextColor={theme.colors.tertiaryText} style={styles.searchInput} selectionColor={theme.colors.lime} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {['Polecani', 'Najbliżej', 'Dostępni jutro', 'Do 130 zł'].map((item) => <Pill key={item} label={item} active={filter === item} onPress={() => setFilter(item)} />)}
        </ScrollView>
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>Polecani</Text>
          <Text style={styles.resultCount}>{filtered.length}</Text>
        </View>
        <View style={styles.trainerList}>
          {filtered.map((trainer, index) => (
            <View key={trainer.id}>
              <Pressable
                onPress={() => {
                  selectionHaptic();
                  router.push({ pathname: '/trainer/[id]', params: { id: trainer.id, purpose: purpose ?? 'browse' } });
                }}
                style={({ pressed }) => [styles.trainerRow, pressed && styles.pressed]}>
                <View style={styles.trainerTop}>
                  <View style={styles.avatar}>
                    {trainerPhotos[trainer.id]
                      ? <Image source={trainerPhotos[trainer.id]} style={styles.avatarImage} />
                      : <Text style={styles.avatarText}>{trainer.initials}</Text>}
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{trainer.name}</Text>
                      <Ionicons name="checkmark-circle" size={16} color={theme.colors.sky} />
                    </View>
                    <Text style={styles.specialty}>{trainer.specialty}</Text>
                    <Text style={styles.certification}>{trainer.certification}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={theme.colors.tertiaryText} />
                </View>
                <View style={styles.stats}>
                  <Stat icon="star" text={`${trainer.rating} (${trainer.reviewCount})`} />
                  <Stat icon="location" text={trainer.distance} />
                  <Stat icon="cash" text={`${trainer.price} zł/h`} />
                </View>
                <View style={styles.availability}>
                  <Ionicons name="calendar-outline" size={15} color={theme.colors.secondaryText} />
                  <Text style={styles.availabilityLabel}>Najbliższy termin</Text>
                  <Text style={styles.availabilityValue}>{trainer.availability}</Text>
                </View>
              </Pressable>
              {index < filtered.length - 1 ? <View style={styles.trainerDivider} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  const { styles, theme } = useStyles();
  return <View style={styles.stat}><Ionicons name={icon} size={13} color={theme.colors.secondaryText} /><Text style={styles.statText}>{text}</Text></View>;
}

export default withSheetPage(TrainersScreen);

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 15, paddingBottom: 40 },
  flex: { flex: 1 },
  title: { color: theme.colors.text, fontSize: 29, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { color: theme.colors.secondaryText, fontSize: 14, lineHeight: 20, marginTop: 7 },
  search: { height: 48, borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: theme.colors.surfaceElevated },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 15 },
  filters: { gap: 8 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  resultTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  resultCount: { color: theme.colors.secondaryText, fontSize: 13 },
  trainerList: { marginTop: -3 },
  trainerRow: { paddingHorizontal: 2, paddingVertical: 16 },
  trainerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginLeft: 67 },
  trainerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 53, height: 53, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceElevated },
  avatarImage: { width: '100%', height: '100%', borderRadius: 27 },
  avatarText: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  specialty: { color: theme.colors.secondaryText, fontSize: 12, marginTop: 4 },
  certification: { color: theme.colors.secondaryText, fontSize: 10.5, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 16, paddingTop: 11, paddingLeft: 65 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { color: theme.colors.secondaryText, fontSize: 11.5 },
  availability: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 9, paddingLeft: 65 },
  availabilityLabel: { color: theme.colors.secondaryText, fontSize: 11.5, flex: 1 },
  availabilityValue: { color: theme.colors.text, fontSize: 12, fontWeight: '600' },
  pressed: { opacity: 0.72 },
});
