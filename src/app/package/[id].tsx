import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, Card, Divider, formatDate, InfoRow, ModalHeader } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { theme } from '@/theme';

export default function PackageDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useAppStore();
  const item = store.packages.find((candidate) => candidate.id === id);

  if (!item) {
    return (
      <View style={styles.page}>
        <ModalHeader title="Szczegóły pakietu" />
        <View style={styles.missing}><Text style={styles.missingText}>Nie udało się znaleźć szczegółów tego pakietu.</Text></View>
      </View>
    );
  }

  const used = Math.max(item.totalHours - item.remainingHours, 0);
  const progress = item.remainingHours / item.totalHours;

  return (
    <View style={styles.page}>
      <ModalHeader title="Szczegóły pakietu" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.icon}><Ionicons name={item.scope === 'trainer' ? 'person' : 'grid'} size={23} color={theme.colors.secondaryText} /></View>
            <View style={styles.flex}>
              <Text style={styles.scope}>Pakiet godzinowy · {item.scope === 'trainer' ? 'trener' : 'korty'}</Text>
              <Text style={styles.name}>{item.name}</Text>
            </View>
            <View style={styles.active}><Text style={styles.activeText}>Aktywny</Text></View>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balance}>{item.remainingHours.toLocaleString('pl-PL')}<Text style={styles.unit}> godz.</Text></Text>
            <Text style={styles.total}>z {item.totalHours.toLocaleString('pl-PL')} godz.</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(progress, 1) * 100}%` }]} /></View>
          <Text style={styles.progressCaption}>Wykorzystano {used.toLocaleString('pl-PL')} godz. · pozostało {Math.round(progress * 100)}% salda</Text>
        </Card>

        <AppButton title="Dokup godziny" icon="add" onPress={() => router.push({ pathname: '/top-up/[id]', params: { id: item.id } })} />

        <View style={styles.metrics}>
          <Metric icon="calendar-outline" value={`${item.scheduledUses}`} label="zaplanowane" />
          <View style={styles.metricDivider} />
          <Metric icon="hourglass-outline" value={formatDate(item.validUntil, { day: 'numeric', month: 'short' })} label="ważny do" />
          <View style={styles.metricDivider} />
          <Metric icon="cash-outline" value={`${item.baseHourlyPrice} zł`} label="stawka bazowa" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informacje</Text>
          <View>
            <InfoRow flat icon="shield-checkmark-outline" title="Automatyczne rozliczenie" detail="Godziny schodzą z salda po zakończonym treningu." />
            <Divider inset={40} />
            <InfoRow flat icon="calendar-outline" title="Ważność pakietu" detail={`Do ${formatDate(item.validUntil, { day: 'numeric', month: 'long', year: 'numeric' })}`} />
            <Divider inset={40} />
            <InfoRow flat icon="swap-horizontal" title="Elastyczne terminy" detail="Możesz przełożyć rezerwację zgodnie z zasadami klubu." />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historia zakupów</Text>
          <View>
            {[...item.purchases].reverse().map((purchase, index) => (
              <View key={purchase.id}>
                <View style={styles.purchaseRow}>
                  <View style={styles.purchaseIcon}><Ionicons name="receipt-outline" size={17} color={theme.colors.secondaryText} /></View>
                  <View style={styles.flex}>
                    <Text style={styles.purchaseHours}>+{purchase.hours.toLocaleString('pl-PL')} godz.</Text>
                    <Text style={styles.purchaseMeta}>{formatDate(purchase.purchasedAt, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                    <Text style={styles.purchaseMeta}>{purchase.paymentMethod} · {purchase.reference}</Text>
                  </View>
                  <Text style={styles.purchaseAmount}>{purchase.amount} zł</Text>
                </View>
                {index < item.purchases.length - 1 ? <Divider inset={48} /> : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Metric({ icon, value, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={18} color={theme.colors.secondaryText} />
      <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  hero: { padding: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(199,225,46,0.12)', alignItems: 'center', justifyContent: 'center' },
  scope: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '500' },
  name: { color: theme.colors.text, fontSize: 18, fontWeight: '600', marginTop: 4 },
  active: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(152,215,91,0.13)' },
  activeText: { color: theme.colors.success, fontSize: 9, fontWeight: '600' },
  balanceRow: { marginTop: 24, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  balance: { color: theme.colors.text, fontSize: 40, fontWeight: '300', letterSpacing: -1.5 },
  unit: { fontSize: 17 },
  total: { color: theme.colors.secondaryText, fontSize: 12 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.09)', overflow: 'hidden', marginTop: 16 },
  fill: { height: '100%', backgroundColor: theme.colors.lime, borderRadius: 3 },
  progressCaption: { color: theme.colors.secondaryText, fontSize: 11.5, marginTop: 9 },
  metrics: { flexDirection: 'row', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
  metric: { flex: 1, minHeight: 104, padding: 13, justifyContent: 'space-between' },
  metricDivider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, marginVertical: 12 },
  metricValue: { color: theme.colors.text, fontSize: 15, fontWeight: '600', marginTop: 12 },
  metricLabel: { color: theme.colors.secondaryText, fontSize: 10.5, marginTop: 3 },
  section: { gap: 8 },
  sectionTitle: { color: 'rgba(255,255,255,0.86)', fontSize: 14, fontWeight: '600', marginLeft: 2 },
  purchaseRow: { minHeight: 91, paddingHorizontal: 2, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  purchaseIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  purchaseHours: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  purchaseMeta: { color: theme.colors.secondaryText, fontSize: 10.5, marginTop: 4 },
  purchaseAmount: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  missingText: { color: theme.colors.secondaryText, textAlign: 'center' },
});
