import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/api";
import { useAuth } from "@/auth";
import { formatPhone, relativeTime } from "@/format";
import { colors, space } from "@/theme";
import type { Conversation, Message } from "@/types";
import { Banner, Button, Screen } from "@/ui";

export default function ThreadScreen() {
  const { token } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !conversationId) return;
    try {
      const result = await api.messages(token, conversationId);
      setConversation(result.conversation);
      setMessages(result.messages);
      setError(null);
      await api.markRead(token, conversationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this conversation.");
    }
  }, [token, conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!token || !conversation || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.sendMessage(token, {
        appNumber: conversation.app_number,
        to: conversation.contact_number,
        body: draft.trim(),
      });
      setDraft("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The message was not sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Text style={styles.who}>
          {conversation ? conversation.contact_name || formatPhone(conversation.contact_number) : "Message"}
        </Text>
        {error ? <Banner message={error} /> : null}
        <FlatList
          style={styles.flex}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const outbound = item.direction === "outbound";
            return (
              <View style={[styles.bubble, outbound ? styles.outbound : styles.inbound]}>
                <Text style={styles.body}>{item.body || "Attachment"}</Text>
                <Text style={styles.time}>{relativeTime(item.created_at)}</Text>
              </View>
            );
          }}
        />
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Text your customer"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <Button label="Send" onPress={() => void send()} busy={busy} disabled={!draft.trim() || !conversation} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  who: { color: colors.text, fontSize: 18, fontWeight: "700", paddingHorizontal: space.lg, paddingVertical: space.sm },
  list: { padding: space.lg, gap: space.sm },
  bubble: { maxWidth: "82%", borderRadius: 16, padding: space.md, gap: 4 },
  inbound: { alignSelf: "flex-start", backgroundColor: colors.card },
  outbound: { alignSelf: "flex-end", backgroundColor: "#1d3a6e" },
  body: { color: colors.text, fontSize: 16, lineHeight: 22 },
  time: { color: colors.muted, fontSize: 12 },
  composer: { padding: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  input: {
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 16,
  },
});
