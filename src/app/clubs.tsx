import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, LoadingScreen, ModalHeader, useClientReady, withSheetPage } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { AppTheme, useThemeStyles } from '@/theme';

function useStyles() {
  return useThemeStyles(createStyles);
}

function ClubsScreen() {
  const { styles, theme } = useStyles();
  const router = useRouter();
  const store = useAppStore();
  const clientReady = useClientReady();

  if (!clientReady || !store.hydrated || store.loading) return <LoadingScreen />;

  const clubs = store.clubs;
  const unavailable = Boolean(store.error) && clubs.length === 0;

  return (
    <View style={styles.page}>
      <ModalHeader title="Znajdź klub" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.title}>Kort blisko Ciebie</Text>
          <Text style={styles.subtitle}>Porównaj lokalizację, nawierzchnię i cenę. Rezerwacja zajmuje mniej niż minutę.</Text>
        </View>
        {unavailable ? (
          <CatalogState
            icon="cloud-offline-outline"
            title="Nie udało się pobrać klubów"
            description={String(store.error)}
            action="Spróbuj ponownie"
            onPress={() => void store.refresh()}
          />
        ) : clubs.length ? (
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
        ) : (
          <CatalogState
            icon="business-outline"
            title="Brak dostępnych klubów"
            description="Kluby i korty pojawią się tutaj, gdy zostaną dodane do katalogu."
          />
        )}
      </ScrollView>
    </View>
  );
}

function CatalogState({
  icon,
  title,
  description,
  action,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  action?: string;
  onPress?: () => void;
}) {
  const { styles, theme } = useStyles();
  return (
    <View style={styles.catalogState}>
      <Ionicons name={icon} size={25} color={theme.colors.secondaryText} />
      <Text style={styles.catalogStateTitle}>{title}</Text>
      <Text style={styles.catalogStateDescription}>{description}</Text>
      {action && onPress ? <AppButton compact variant="secondary" title={action} onPress={onPress} /> : null}
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
  catalogState: { minHeight: 210, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', gap: 8 },
  catalogStateTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  catalogStateDescription: { color: theme.colors.secondaryText, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginBottom: 5 },
});
