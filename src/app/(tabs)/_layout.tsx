import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAppStore } from '@/state/app-store';
import { useAppTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useAppTheme();
  const store = useAppStore();
  const unreadMessages = Object.values(store.conversationUnread).reduce((total, unread) => total + unread, 0);
  const unreadOffers = store.availabilityOffers.filter((offer) => offer.status === 'available' && !offer.readAt).length;
  const chatBadge = unreadMessages + unreadOffers;
  return (
    <NativeTabs
      backBehavior="history"
      backgroundColor={theme.colors.surfaceSoft}
      blurEffect={theme.mode === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      disableTransparentOnScrollEdge
      iconColor={{ default: theme.colors.secondaryText, selected: theme.colors.text }}
      indicatorColor="rgba(199,225,46,0.18)"
      labelStyle={{
        default: { color: theme.colors.secondaryText, fontSize: 11 },
        selected: { color: theme.colors.text, fontSize: 11, fontWeight: '600' },
      }}
      minimizeBehavior="never"
      rippleColor="rgba(199,225,46,0.15)"
      tabBarRespectsIMEInsets
      tintColor={theme.colors.text}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Start</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'sportscourt', selected: 'sportscourt.fill' }}
          md={{ default: 'sports_tennis', selected: 'sports_tennis' }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="schedule" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Kalendarz</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'calendar', selected: 'calendar' }}
          md={{ default: 'calendar_month', selected: 'calendar_month' }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Label>Czat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
          md={{ default: 'chat_bubble_outline', selected: 'chat_bubble' }}
        />
        {chatBadge ? <NativeTabs.Trigger.Badge>{String(chatBadge)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md={{ default: 'account_circle', selected: 'account_circle' }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
