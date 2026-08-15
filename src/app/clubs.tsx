import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { clubs } from '@/data/models';
import { AppButton, ModalHeader, withSheetPage } from '@/components/ui';
import { AppTheme, useThemeStyles } from '@/theme';

function useStyles() {
  return useThemeStyles(createStyles);
}

function ClubsScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  return (
    <View style={styles.page}>
      <ModalHeader title="Znajdź klub" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.title}>Kort blisko Ciebie</Text>
          <Text style={styles.subtitle}>Porównaj lokalizację, nawierzchnię i cenę. Rezerwacja zajmuje mniej niż minutę.</Text>
        </View>
        <View>
          {clubs.map((club, index) => (
            <View key={club.id}>
              <View style={styles.club}>
                <View style={styles.clubTop}>
                  <View style={styles.icon}><Ionicons name="grid-outline" size={22} color={theme.colors.sky} /></View>
                  <View style={styles.flex}>
                    <Text style={styles.name}>{club.name}</Text>
                    <Text style={styles.address}>{club.address} · {club.distance}</Text>
                  </View>
                  <Text style={styles.price}>{club.price} zł/h</Text>
                </View>
                <View style={styles.facts}>
                  <Fact icon="grid" text={`${club.courts} kortów`} />
                  <Fact icon="layers-outline" text={club.surface} />
                  <Fact icon="car-outline" text="Parking" />
                </View>
                <AppButton title="Sprawdź terminy" compact variant="secondary" onPress={() => router.replace('/booking')} />
              </View>
              {index < clubs.length - 1 ? <View style={styles.clubDivider} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Fact({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  const { styles, theme } = useStyles();
  return <View style={styles.fact}><Ionicons name={icon} size={14} color={theme.colors.secondaryText} /><Text style={styles.factText}>{text}</Text></View>;
}

export default withSheetPage(ClubsScreen);

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  flex: { flex: 1 },
  title: { color: theme.colors.text, fontSize: 29, fontWeight: '700' },
  subtitle: { color: theme.colors.secondaryText, fontSize: 14, lineHeight: 20, marginTop: 7 },
  club: { paddingHorizontal: 2, paddingVertical: 16, gap: 14 },
  clubDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginLeft: 55 },
  clubTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(87,184,242,0.12)' },
  name: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  address: { color: theme.colors.secondaryText, fontSize: 11.5, marginTop: 4 },
  price: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  facts: { flexDirection: 'row', gap: 15, paddingLeft: 55 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factText: { color: theme.colors.secondaryText, fontSize: 11.5 },
});
