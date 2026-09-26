import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@/api";
import { useAuth } from "@/auth";
import { apiBaseUrl, previewMode } from "@/config";
import { formatPhone, toE164 } from "@/format";
import { colors, space } from "@/theme";
import { Banner, Button, Field, Screen } from "@/ui";
import { useVoice, useVoiceSnapshot } from "@/voice/VoiceContext";
import { WEB_LINKS, webUrl } from "@/web-links";

export default function SettingsScreen() {
  const { token, email, account, accountError, refreshAccount, signOut } = useAuth();
  const voice = useVoice();
  const snapshot = useVoiceSnapshot();
  const [displayName, setDisplayName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDisplayName(account?.profile?.display_name ?? "");
    setAgentPhone(account?.profile?.agent_phone ? formatPhone(account.profile.agent_phone) : "");
  }, [account]);

  async function save() {
    if (!token) return;
    const phone = agentPhone.trim() ? toE164(agentPhone) : null;
    if (agentPhone.trim() && !phone) {
      setError("Enter a full mobile number, or leave it blank.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.updateProfile(token, { displayName, agentPhone: phone });
      await refreshAccount();
      setMessage("Saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const pushDetail = snapshot.pushConfigured
    ? "Twilio has a push credential for this build. A locked or force-quit phone can still ring."
    : snapshot.status === "registered"
      ? "Signed in. Calls work while the app is open. Add the Twilio push credential to ring a locked phone."
      : snapshot.error || "This phone is not registered for calls.";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body}>
        {accountError ? <Banner message={accountError} /> : null}
        {error ? <Banner message={error} /> : null}
        {message ? <Banner message={message} tone="warning" /> : null}
        <Text style={styles.name}>{account?.profile?.workspace_name || "SixVox"}</Text>
        <Text style={styles.meta}>{email}</Text>
        <Field label="Your name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
        <Field
          label="Your cell, for the missed-call fallback"
          value={agentPhone}
          onChangeText={setAgentPhone}
          keyboardType="phone-pad"
          placeholder="(555) 555-0100"
        />
        <Button label="Save" onPress={() => void save()} busy={busy} />
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Calling on this phone</Text>
          <Text style={styles.meta}>{pushDetail}</Text>
          <Text style={styles.meta}>Registration: {snapshot.status}</Text>
        </View>
        {previewMode() ? (
          <Button label="Simulate an incoming call" tone="quiet" onPress={() => voice.previewRing()} />
        ) : null}
        <Text style={styles.blockTitle}>On the web</Text>
        {WEB_LINKS.map((link) => (
          <Pressable
            key={link.path}
            style={styles.link}
            onPress={() => void Linking.openURL(webUrl(apiBaseUrl(), link.path))}
          >
            <Text style={styles.linkLabel}>{link.label}</Text>
            <Text style={styles.meta}>{link.detail}</Text>
          </Pressable>
        ))}
        <Button label="Sign out" tone="danger" onPress={() => void signOut()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  name: { color: colors.text, fontSize: 24, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  block: { gap: 6 },
  blockTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: space.sm },
  link: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    gap: 2,
  },
  linkLabel: { color: colors.text, fontSize: 16, fontWeight: "700" },
});
