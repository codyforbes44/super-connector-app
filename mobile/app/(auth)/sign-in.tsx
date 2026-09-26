import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth";
import { colors, space } from "@/theme";
import { Banner, Button, Field } from "@/ui";

export default function SignInScreen() {
  const { signIn, signInWithGoogle, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"password" | "google" | null>(null);

  async function submitPassword() {
    setBusy("password");
    setError(null);
    try {
      await signIn(email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    } finally {
      setBusy(null);
    }
  }

  async function submitGoogle() {
    setBusy("google");
    setError(null);
    try {
      await signInWithGoogle();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google sign-in failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.mark}>SixVox</Text>
        <Text style={styles.lead}>Your second business line. Calls, texts, and voicemail for the number customers already have.</Text>
        {!configured ? (
          <Banner message="Add the Supabase URL and publishable key in mobile/.env before signing in." />
        ) : null}
        {error ? <Banner message={error} /> : null}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@shop.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" />
        <Button
          label="Sign in"
          onPress={() => void submitPassword()}
          disabled={!configured || !email.trim() || !password}
          busy={busy === "password"}
        />
        <Button
          label="Continue with Google"
          tone="quiet"
          onPress={() => void submitGoogle()}
          disabled={!configured}
          busy={busy === "google"}
        />
        <View>
          <Text style={styles.note}>Use the same account as the SixVox web app. Numbers, billing, and the receptionist stay on the web.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  body: { flexGrow: 1, justifyContent: "center", padding: space.lg, gap: space.md },
  mark: { color: colors.text, fontSize: 40, fontWeight: "800", letterSpacing: -0.5 },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 23, marginBottom: space.sm },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});
