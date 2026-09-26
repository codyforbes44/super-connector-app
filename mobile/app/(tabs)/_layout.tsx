import { Tabs } from "expo-router";

import { colors } from "@/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dial" }} />
      <Tabs.Screen name="inbox" options={{ title: "Inbox", headerShown: false }} />
      <Tabs.Screen name="voicemail" options={{ title: "Voicemail" }} />
      <Tabs.Screen name="recents" options={{ title: "Recents" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
