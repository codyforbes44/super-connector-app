import { Stack } from "expo-router";

import { colors } from "@/theme";

export default function InboxLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Inbox" }} />
      <Stack.Screen name="[id]" options={{ title: "Message" }} />
    </Stack>
  );
}
