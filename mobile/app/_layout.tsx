import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/auth";
import { colors } from "@/theme";
import { useVoiceSnapshot, VoiceProvider } from "@/voice/VoiceContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <VoiceProvider>
          <StatusBar style="light" />
          <Shell />
        </VoiceProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { ready } = useAuth();
  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.bootText}>SixVox</Text>
      </View>
    );
  }
  return (
    <>
      <Gate />
      <CallRouter />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="call" options={{ presentation: "fullScreenModal", animation: "fade" }} />
      </Stack>
    </>
  );
}

function Gate() {
  const { token } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    const inAuth = segments[0] === "(auth)";
    if (!token && !inAuth) router.replace("/sign-in");
    if (token && inAuth) router.replace("/");
  }, [token, segments, router]);
  return null;
}

function CallRouter() {
  const { token } = useAuth();
  const { phase } = useVoiceSnapshot();
  const pathname = usePathname();
  const router = useRouter();
  const previous = useRef(phase);
  useEffect(() => {
    const was = previous.current;
    previous.current = phase;
    if (!token) return;
    if (was === "idle" && phase !== "idle" && pathname !== "/call/active") {
      router.push("/call/active");
    }
    if (was !== "idle" && phase === "idle" && pathname === "/call/active") {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }
  }, [phase, pathname, router, token]);
  return null;
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 12 },
  bootText: { color: colors.text, fontSize: 22, fontWeight: "700" },
});
