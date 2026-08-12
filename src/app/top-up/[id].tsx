import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, LoadingScreen, ModalHeader, Pill, SectionTitle, selectionHaptic, successHaptic, useClientReady, withSheetPage } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { theme } from '@/theme';

const offers = [
  { hours: 5, discount: 0 },
  { hours: 10, discount: 5 },
  { hours: 20, discount: 10 },
];

function TopUpScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useAppStore();
  const clientReady = useClientReady();
  const item = store.packages.find((candidate) => candidate.id === id);
  const [selectedHours, setSelectedHours] = useState(10);
  const [payment, setPayment] = useState('BLIK');
  const [complete, setComplete] = useState(false);

  if (!clientReady || !store.hydrated) return <LoadingScreen />;

  if (!item) return <View style={styles.page}><ModalHeader title="Dokup pakiet" /><View style={styles.center}><Text style={styles.muted}>Nie udało się znaleźć tego pakietu.</Text></View></View>;

  const offer = offers.find((candidate) => candidate.hours === selectedHours) ?? offers[1];
  const price = Math.round(offer.hours * item.baseHourlyPrice * (1 - offer.discount / 100));
  const hourly = Math.round(price / offer.hours);

  const purchase = () => {
    store.topUpPackage(item.id, offer.hours, offer.discount, payment);
    successHaptic();
    setComplete(true);
  };

  if (complete) {
    return (
      <View style={styles.page}>
        <ModalHeader title="Gotowe" />
        <View style={styles.success}>
          <View style={styles.successIcon}><Ionicons name="checkmark" size={38} color="#11120F" /></View>
          <Text style={styles.successTitle}>Pakiet dokupiony</Text>
          <Text style={styles.successText}>+{offer.hours} godz. jest już dostępne w Twoim saldzie.</Text>
          <View style={styles.confirmation}>
            <ConfirmationRow label="Pakiet" value={item.name} />
            <ConfirmationRow label="Dodano" value={`+${offer.hours} godz.`} />
            <ConfirmationRow label="Płatność" value={`${price} zł · ${payment}`} />
          </View>
          <AppButton title="Gotowe" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ModalHeader title="Dokup pakiet" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.current}>
          <View style={styles.icon}><Ionicons name={item.scope === 'trainer' ? 'person' : 'grid'} size={20} color={theme.colors.secondaryText} /></View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>Obecny pakiet · {item.scope === 'trainer' ? 'trener' : 'korty'}</Text>
            <Text style={styles.name}>{item.name}</Text>
          </View>
          <View style={styles.currentBalance}>
            <Text style={styles.currentValue}>{item.remainingHours.toLocaleString('pl-PL')}</Text>
            <Text style={styles.currentLabel}>godz. dostępne</Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Wybierz liczbę godzin" />
          <View>
            {offers.map((candidate, index) => {
              const selected = candidate.hours === selectedHours;
              const candidatePrice = Math.round(candidate.hours * item.baseHourlyPrice * (1 - candidate.discount / 100));
              return (
                <View key={candidate.hours}>
                  <Pressable
                    onPress={() => { selectionHaptic(); setSelectedHours(candidate.hours); }}
                    style={styles.offer}>
                    <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                    <View style={styles.flex}>
                      <View style={styles.offerTitleRow}>
                        <Text style={styles.offerTitle}>+{candidate.hours} godz.</Text>
                        {candidate.discount ? <View style={styles.discount}><Text style={styles.discountText}>-{candidate.discount}%</Text></View> : null}
                      </View>
                      <Text style={styles.offerMeta}>{Math.round(candidatePrice / candidate.hours)} zł za godzinę</Text>
                    </View>
                    <Text style={[styles.offerPrice, selected && styles.offerPriceSelected]}>{candidatePrice} zł</Text>
                  </Pressable>
                  {index < offers.length - 1 ? <View style={styles.offerDivider} /> : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Metoda płatności" />
          <View style={styles.payments}>
            {['BLIK', 'Visa •••• 4242', 'Apple Pay / Google Pay'].map((method) => <Pill key={method} label={method} active={payment === method} onPress={() => setPayment(method)} />)}
          </View>
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Podsumowanie</Text>
          <ConfirmationRow label="Dodane godziny" value={`+${offer.hours} godz.`} />
          <ConfirmationRow label="Cena za godzinę" value={`${hourly} zł`} />
          {offer.discount ? <ConfirmationRow label="Oszczędzasz" value={`${offer.hours * item.baseHourlyPrice - price} zł`} accent /> : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Do zapłaty</Text>
            <Text style={styles.total}>{price} zł</Text>
          </View>
        </View>

        <View style={styles.security}>
          <Ionicons name="lock-closed" size={14} color={theme.colors.secondaryText} />
          <Text style={styles.securityText}>Płatność jest szyfrowana i bezpieczna</Text>
        </View>
        <Text style={styles.info}>Po płatności godziny od razu pojawią się w saldzie. Ważność całego pakietu zostanie wydłużona o 6 miesięcy.</Text>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.bottom}>
        <AppButton title={`Zapłać ${price} zł`} onPress={purchase} />
      </SafeAreaView>
    </View>
  );
}

function ConfirmationRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, accent && { color: theme.colors.lime }]}>{value}</Text>
    </View>
  );
}

export default withSheetPage(TopUpScreen);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  muted: { color: theme.colors.secondaryText },
  content: { padding: 16, paddingBottom: 28, gap: 22 },
  current: { paddingHorizontal: 2, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  icon: { width: 36, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: theme.colors.secondaryText, fontSize: 9.5, fontWeight: '500' },
  name: { color: theme.colors.text, fontSize: 15, fontWeight: '600', marginTop: 3 },
  currentBalance: { alignItems: 'flex-end' },
  currentValue: { color: theme.colors.text, fontSize: 22, fontWeight: '600' },
  currentLabel: { color: theme.colors.secondaryText, fontSize: 9.5, marginTop: 2 },
  section: { gap: 9 },
  offer: { minHeight: 75, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', gap: 12 },
  offerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginLeft: 36 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: theme.colors.tertiaryText, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: theme.colors.lime },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.lime },
  offerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  offerTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  discount: { backgroundColor: theme.colors.lime, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  discountText: { color: '#11120F', fontSize: 9, fontWeight: '700' },
  offerMeta: { color: theme.colors.secondaryText, fontSize: 11.5, marginTop: 5 },
  offerPrice: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  offerPriceSelected: { color: theme.colors.lime },
  payments: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summary: { paddingHorizontal: 2, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  summaryTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '600', paddingBottom: 9 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  rowLabel: { color: theme.colors.secondaryText, fontSize: 13 },
  rowValue: { color: theme.colors.text, fontSize: 13, fontWeight: '600', maxWidth: '65%', textAlign: 'right' },
  totalRow: { marginTop: 8, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  total: { color: theme.colors.lime, fontSize: 24, fontWeight: '600' },
  security: { flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  securityText: { color: theme.colors.secondaryText, fontSize: 11.5 },
  info: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 15 },
  bottom: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: theme.colors.surfaceSoft, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  success: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 14 },
  successIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: theme.colors.lime, alignItems: 'center', justifyContent: 'center' },
  successTitle: { color: theme.colors.text, fontSize: 26, fontWeight: '700', marginTop: 8 },
  successText: { color: theme.colors.secondaryText, fontSize: 14, textAlign: 'center' },
  confirmation: { width: '100%', paddingVertical: 12, marginVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
});
